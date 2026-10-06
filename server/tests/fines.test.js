import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import * as argon2 from '@node-rs/argon2'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { app } from '../app.js'
import { User, Book, Copy, Loan, Reservation, Policy, allModels, getPolicy } from '../models.js'
import { Fine } from '../features/fines/fine.model.js'
import { expireReservations } from '../features/reservations/reservation.service.js'

let mongo
let staffToken, memberToken, otherToken, directorToken
let memberId, otherId, bookId, copyId
const password = 'Library-testing-password-2026'
const DAY = 86400000
const auth = (token) => ({ Authorization: `Bearer ${token}` })

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongo.getUri('biblioteca-fines-test'))
  for (const model of allModels) await model.init()
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongo?.stop()
})
beforeEach(async () => {
  for (const model of allModels) await model.collection.deleteMany({})
  const passwordHash = await argon2.hash(password)
  const users = await User.create([
    { name: 'Library Staff', email: 'staff@test.local', passwordHash, role: 'librarian' },
    { name: 'Amina Wanjiku', email: 'amina@test.local', passwordHash },
    { name: 'David Otieno', email: 'david@test.local', passwordHash },
    { name: 'Dara Director', email: 'director@test.local', passwordHash, role: 'director' },
  ])
  memberId = String(users[1]._id)
  otherId = String(users[2]._id)
  const tokens = []
  for (const user of users) {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password })
    tokens.push(response.body.accessToken)
  }
  ;[staffToken, memberToken, otherToken, directorToken] = tokens
  const book = await Book.create({
    title: 'Things Fall Apart',
    author: 'Chinua Achebe',
    isbn: '1',
    genre: 'Fiction',
    year: 1958,
  })
  bookId = String(book._id)
  copyId = String((await Copy.create({ book: book._id, barcode: 'BIB-001', shelf: 'FIC 1' }))._id)
  await getPolicy()
})

// Issues a loan and backdates its due date so it is late by `daysLate` days.
async function lateLoan(daysLate, member = memberId, copy = copyId) {
  const issued = await request(app)
    .post('/api/loans')
    .set(auth(staffToken))
    .send({ memberId: member, copyId: copy })
  expect(issued.status).toBe(201)
  await Loan.updateOne(
    { _id: issued.body._id },
    { $set: { dueAt: new Date(Date.now() - daysLate * DAY + 60000) } },
  )
  return issued.body._id
}
const giveBack = (loanId, body = {}) =>
  request(app).post(`/api/loans/${loanId}/return`).set(auth(staffToken)).send(body)
const enableFines = (values = {}) =>
  Policy.updateOne(
    { key: 'library' },
    { $set: { fineEnabled: true, finePerDay: 2, graceDays: 1, maxFine: 10, ...values } },
  )

describe('fines', () => {
  it('creates no fine until the library configures them', async () => {
    const response = await giveBack(await lateLoan(5))
    expect(response.status).toBe(200)
    expect(response.body.fine).toBeNull()
    expect(await Fine.countDocuments()).toBe(0)
  })

  it('applies the configured rate, grace period and maximum', async () => {
    await enableFines()
    const response = await giveBack(await lateLoan(5))
    expect(response.body.fine.amount).toBe(8) // (5 days - 1 grace) x 2
    expect(response.body.late).toBe(5)
    await Policy.updateOne({ key: 'library' }, { $set: { maxFine: 5 } })
    const capped = await giveBack(await lateLoan(30))
    expect(capped.body.fine.amount).toBe(5)
  })

  it('does not fine returns within the grace period or on time', async () => {
    await enableFines()
    expect((await giveBack(await lateLoan(1))).body.fine).toBeNull()
  })

  it('records partial and full payments and rejects overpayment', async () => {
    await enableFines()
    const fine = (await giveBack(await lateLoan(5))).body.fine
    const pay = (amount) =>
      request(app).post(`/api/fines/${fine._id}/payment`).set(auth(staffToken)).send({ amount })
    expect((await pay(100)).status).toBe(400)
    expect((await pay(3)).status).toBe(200)
    expect((await Fine.findById(fine._id)).status).toBe('partially_paid')
    expect((await pay(5)).status).toBe(200)
    expect((await Fine.findById(fine._id)).status).toBe('paid')
    expect((await pay(1)).status).toBe(409)
  })

  it('waives a fine with a recorded reason', async () => {
    await enableFines()
    const fine = (await giveBack(await lateLoan(5))).body.fine
    const waive = (note) =>
      request(app).post(`/api/fines/${fine._id}/waive`).set(auth(staffToken)).send({ note })
    expect((await waive('x')).status).toBe(400)
    expect((await waive('Hardship, approved by the director')).status).toBe(200)
    const saved = await Fine.findById(fine._id)
    expect(saved.status).toBe('waived')
    expect(saved.history[0].action).toBe('waiver')
  })

  it('shows members only their own fines and blocks them from changing fines', async () => {
    await enableFines()
    const fine = (await giveBack(await lateLoan(5))).body.fine
    const mine = await request(app).get('/api/fines').set(auth(memberToken))
    expect(mine.body.map((item) => item._id)).toEqual([fine._id])
    expect((await request(app).get('/api/fines').set(auth(otherToken))).body).toEqual([])
    expect(
      (
        await request(app)
          .post(`/api/fines/${fine._id}/payment`)
          .set(auth(memberToken))
          .send({ amount: 1 })
      ).status,
    ).toBe(403)
    expect((await request(app).get('/api/fines/summary').set(auth(memberToken))).status).toBe(403)
    const summary = await request(app).get('/api/fines/summary').set(auth(staffToken))
    expect(summary.body).toMatchObject({ outstanding: 8, collected: 0, count: 1 })
  })
})

describe('return condition', () => {
  it('marks a damaged copy damaged and keeps it from being issued', async () => {
    const loanId = await lateLoan(0)
    expect((await giveBack(loanId, { condition: 'damaged', notes: 'Torn cover' })).status).toBe(200)
    expect((await Copy.findById(copyId)).status).toBe('damaged')
    expect((await Loan.findById(loanId)).returnNotes).toBe('Torn cover')
    const again = await request(app)
      .post('/api/loans')
      .set(auth(staffToken))
      .send({ memberId: otherId, copyId })
    expect(again.status).toBe(404)
  })

  it('records a lost book, closes the loan and retires the copy from circulation', async () => {
    const loanId = await lateLoan(0)
    expect((await giveBack(loanId, { condition: 'lost' })).body.message).toBe('Recorded as lost.')
    const loan = await Loan.findById(loanId)
    expect(loan.outcome).toBe('lost')
    expect(loan.returnedAt).not.toBeNull()
    expect((await Copy.findById(copyId)).status).toBe('lost')
  })

  it('rejects an unknown condition', async () => {
    expect((await giveBack(await lateLoan(0), { condition: 'eaten' })).status).toBe(400)
  })
})

describe('overdue follow-up', () => {
  it('lists days overdue with the fine so far and records follow-ups', async () => {
    await enableFines()
    const loanId = await lateLoan(4)
    const list = await request(app).get('/api/loans?status=overdue').set(auth(staffToken))
    expect(list.body[0]).toMatchObject({ daysOverdue: 4, projectedFine: 6 })
    expect(
      (
        await request(app)
          .post(`/api/loans/${loanId}/follow-up`)
          .set(auth(staffToken))
          .send({ note: 'Called, no answer' })
      ).status,
    ).toBe(200)
    expect(
      (
        await request(app)
          .post(`/api/loans/${loanId}/follow-up`)
          .set(auth(memberToken))
          .send({ note: 'sneaky' })
      ).status,
    ).toBe(403)
    expect((await Loan.findById(loanId)).followUps).toHaveLength(1)
  })
})

describe('reservations', () => {
  it('marks the first waiting reader ready when the copy is returned', async () => {
    const loanId = await lateLoan(0)
    await Reservation.create([{ member: otherId, book: bookId }])
    await giveBack(loanId)
    const hold = await Reservation.findOne({ member: otherId })
    expect(hold.ready).toBe(true)
    expect(hold.expiresAt).toBeNull() // no hold period configured: never expires
  })

  it('expires an uncollected ready reservation and offers the copy to the next reader', async () => {
    await Policy.updateOne({ key: 'library' }, { $set: { reservationHoldDays: 2 } })
    const loanId = await lateLoan(0)
    await Reservation.create([{ member: otherId, book: bookId }])
    await new Promise((resolve) => setTimeout(resolve, 5))
    await Reservation.create([{ member: memberId, book: bookId }])
    await giveBack(loanId)
    const first = await Reservation.findOne({ member: otherId })
    expect(first.ready).toBe(true)
    expect(first.expiresAt.getTime()).toBeGreaterThan(Date.now())
    await Reservation.updateOne(
      { _id: first._id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    )
    expect(await expireReservations()).toBe(1)
    expect((await Reservation.findById(first._id)).status).toBe('expired')
    expect((await Reservation.findOne({ member: memberId })).ready).toBe(true)
    expect(await expireReservations()).toBe(0)
  })
})

describe('director role', () => {
  it('can read reports, activity, fines and loans', async () => {
    const get = (path) => request(app).get(path).set(auth(directorToken))
    expect((await get('/api/staff/reports')).status).toBe(200)
    expect((await get('/api/staff/reports/inventory.csv')).status).toBe(200)
    expect((await get('/api/staff/audit')).status).toBe(200)
    expect((await get('/api/fines/summary')).status).toBe(200)
    expect((await get('/api/loans')).status).toBe(200)
  })

  it('cannot run daily operations or change anything', async () => {
    const as = (method, path, body = {}) =>
      request(app)[method](path).set(auth(directorToken)).send(body)
    expect((await as('post', '/api/loans', { memberId, copyId })).status).toBe(403)
    expect((await as('get', '/api/staff/members')).status).toBe(403)
    expect((await as('post', '/api/staff/categories', { name: { en: 'X' } })).status).toBe(403)
    expect(
      (await as('post', '/api/staff/content', { kind: 'news', title: { en: 'x' } })).status,
    ).toBe(403)
    expect((await as('put', '/api/staff/policies', {})).status).toBe(403)
    expect((await as('get', '/api/staff/applications')).status).toBe(403)
    await enableFines()
    const fine = (await giveBack(await lateLoan(5))).body.fine
    expect((await as('post', `/api/fines/${fine._id}/payment`, { amount: 1 })).status).toBe(403)
    expect((await as('post', `/api/fines/${fine._id}/waive`, { note: 'please' })).status).toBe(403)
  })

  it('cannot reach administrator-only pages and librarians still cannot read the audit log', async () => {
    expect((await request(app).get('/api/staff/audit').set(auth(staffToken))).status).toBe(403)
    expect(
      (await request(app).get('/api/staff/members?group=team').set(auth(directorToken))).status,
    ).toBe(403)
  })
})

describe('report builder', () => {
  const run = (path, token = staffToken) =>
    request(app).get(`/api/staff/reports/run/${path}`).set(auth(token))
  const types = [
    'books-by-category',
    'books-by-author',
    'books-by-publisher',
    'inventory',
    'lost-damaged',
    'reservations-summary',
    'members-summary',
    'membership-growth',
    'member-history',
    'borrowing-by-period',
    'overdue',
    'most-borrowed',
    'popular-categories',
    'fines',
  ]

  it('answers every report type with columns and rows, for staff and directors only', async () => {
    for (const type of types) {
      const response = await run(type)
      expect(response.status, type).toBe(200)
      expect(response.body.columns.length, type).toBeGreaterThan(0)
      expect(Array.isArray(response.body.rows), type).toBe(true)
    }
    expect((await run('fines', directorToken)).status).toBe(200)
    expect((await run('fines', memberToken)).status).toBe(403)
    expect((await request(app).get('/api/staff/reports/run/fines')).status).toBe(401)
  })

  it('rejects unknown reports and invalid dates', async () => {
    expect((await run('payroll')).status).toBe(400)
    expect((await run('fines?from=2026-02-30')).status).toBe(400)
    expect((await run('fines?from=2026-03-02&to=2026-03-01')).status).toBe(400)
    expect((await run('borrowing-by-period?groupBy=year')).status).toBe(400)
  })

  it('groups borrowing by period and filters by date range', async () => {
    const first = await lateLoan(0)
    await giveBack(first)
    const second = await lateLoan(0)
    await giveBack(second)
    await Loan.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(first) },
      { $set: { createdAt: new Date('2026-01-15T10:00:00Z') } },
    )
    await Loan.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(second) },
      { $set: { createdAt: new Date('2026-02-20T10:00:00Z') } },
    )
    const months = await run('borrowing-by-period?groupBy=month&from=2026-01-01&to=2026-02-28')
    expect(months.body.rows.map((row) => [row.period, row.issued])).toEqual([
      ['2026-01-01', 1],
      ['2026-02-01', 1],
    ])
    const january = await run('borrowing-by-period?groupBy=day&from=2026-01-01&to=2026-01-31')
    expect(january.body.rows).toEqual([{ period: '2026-01-15', issued: 1, returned: 0 }])
    const top = await run('most-borrowed?from=2026-01-01&to=2026-01-31')
    expect(top.body.rows).toEqual([
      { title: 'Things Fall Apart', author: 'Chinua Achebe', loans: 1 },
    ])
  })

  it('pages lists, returns everything on request and searches by member', async () => {
    await giveBack(await lateLoan(0))
    await giveBack(await lateLoan(0, otherId))
    const paged = await run('member-history?limit=1&page=2')
    expect(paged.body).toMatchObject({ total: 2, pages: 2, page: 2 })
    expect(paged.body.rows).toHaveLength(1)
    expect((await run('member-history?all=true')).body.rows).toHaveLength(2)
    const search = await run('member-history?q=Amina')
    expect(search.body.rows.map((row) => row.member)).toEqual(['Amina Wanjiku'])
    expect(search.body.rows[0].status).toBe('returned')
  })

  it('summarises fines for the chosen period', async () => {
    await enableFines()
    await giveBack(await lateLoan(5))
    const fine = await Fine.findOne()
    await request(app)
      .post(`/api/fines/${fine._id}/payment`)
      .set(auth(staffToken))
      .send({ amount: 3 })
    const report = await run('fines')
    expect(Object.fromEntries(report.body.summary.map((item) => [item.key, item.value]))).toEqual({
      collected: 3,
      outstanding: 5,
      waived: 0,
    })
    expect(report.body.rows[0]).toMatchObject({
      member: 'Amina Wanjiku',
      amount: 8,
      paid: 3,
      status: 'partially_paid',
    })
    expect((await run('fines?from=2020-01-01&to=2020-12-31')).body.rows).toEqual([])
  })

  it('reports lost and damaged copies, categories and members', async () => {
    await giveBack(await lateLoan(0), { condition: 'damaged' })
    const lost = await run('lost-damaged')
    expect(lost.body.rows[0]).toMatchObject({ barcode: 'BIB-001', status: 'damaged' })
    const inventory = await run('inventory')
    expect(inventory.body.rows).toEqual([{ status: 'damaged', copies: 1 }])
    const members = await run('members-summary')
    expect(members.body.rows.find((row) => row.metric === 'membersTotal').value).toBe(2)
    const categories = await run('books-by-category')
    expect(categories.body.rows).toEqual([{ category: null, titles: 1 }])
  })
})

describe('member portal data', () => {
  it('counts due-soon and overdue loans and reports membership status', async () => {
    // Issue the due-soon loan first: members with an overdue book cannot borrow again.
    const second = await Copy.create({ book: bookId, barcode: 'BIB-002', shelf: 'FIC 2' })
    const soon = await request(app)
      .post('/api/loans')
      .set(auth(staffToken))
      .send({ memberId, copyId: String(second._id) })
    expect(soon.status).toBe(201)
    await Loan.updateOne({ _id: soon.body._id }, { $set: { dueAt: new Date(Date.now() + DAY) } })
    const overdueId = await lateLoan(3)

    const summary = await request(app).get('/api/me/summary').set(auth(memberToken))
    expect(summary.body).toMatchObject({
      currentLoans: 2,
      dueSoon: 1,
      overdue: 1,
      membershipStatus: 'active',
    })
    expect(summary.body.memberSince).toBeTruthy()
    await giveBack(overdueId)
    const after = await request(app).get('/api/me/summary').set(auth(memberToken))
    expect(after.body).toMatchObject({ currentLoans: 1, dueSoon: 1, overdue: 0 })
  })

  it('shows members only their own loans, including history', async () => {
    await giveBack(await lateLoan(0))
    const mine = await request(app).get('/api/loans?scope=mine&status=all').set(auth(memberToken))
    expect(mine.body).toHaveLength(1)
    expect(mine.body[0].returnedAt).not.toBeNull()
    const theirs = await request(app).get('/api/loans?scope=mine&status=all').set(auth(otherToken))
    expect(theirs.body).toEqual([])
    const sneaky = await request(app).get('/api/loans').set(auth(otherToken))
    expect(sneaky.body).toEqual([])
    const notices = await request(app).get('/api/notifications').set(auth(otherToken))
    expect(notices.body.items).toEqual([])
  })

  it('lets a member renew only their own loan', async () => {
    const loanId = await lateLoan(-5)
    expect(
      (await request(app).post(`/api/loans/${loanId}/renew`).set(auth(otherToken))).status,
    ).toBe(404)
    expect(
      (await request(app).post(`/api/loans/${loanId}/renew`).set(auth(memberToken))).status,
    ).toBe(200)
  })
})

describe('home page data', () => {
  const home = (lang = 'en') => request(app).get(`/api/books/home?lang=${lang}`)

  it('returns featured and recent books, popular categories and honest statistics', async () => {
    const { Category } = await import('../features/taxonomy/taxonomy.model.js')
    const category = await Category.create({ name: { en: 'Fiction', ar: 'خيال' } })
    await Book.updateOne({ _id: bookId }, { $set: { category: category._id, featured: true } })
    const second = await Book.create({
      title: 'Newer Book',
      author: 'A',
      isbn: '2',
      genre: 'Fiction',
      year: 2020,
      category: category._id,
    })
    await Copy.create({ book: second._id, barcode: 'BIB-009', shelf: 'X' })
    const response = await home()
    expect(response.status).toBe(200)
    expect(response.body.featured.map((book) => book.title)).toEqual(['Things Fall Apart'])
    expect(response.body.recent.map((book) => book.title)).toEqual([
      'Newer Book',
      'Things Fall Apart',
    ])
    expect(response.body.recent[0].copies).toMatchObject({ total: 1, available: 1 })
    expect(response.body.categories).toEqual([
      { _id: String(category._id), name: 'Fiction', books: 2 },
    ])
    expect(response.body.stats).toMatchObject({ titles: 2, copies: 2, available: 2, members: 2 })
    expect((await home('ar')).body.categories[0].name).toBe('خيال')
  })

  it('shows only published services and announcements, in the requested language', async () => {
    const { Content } = await import('../features/content/content.model.js')
    await Content.create([
      {
        kind: 'service',
        title: { en: 'Reading room', so: 'Qolka akhriska' },
        body: { en: 'Quiet space' },
      },
      { kind: 'service', title: { en: 'Hidden' }, published: false },
      { kind: 'service', title: { en: 'Old' }, archived: true },
      { kind: 'news', title: { en: 'Opening day' }, featured: true },
      { kind: 'event', title: { en: 'Story hour', ar: 'ساعة القصة' } },
      { kind: 'rule', title: { en: 'No food' } },
    ])
    const so = (await home('so')).body
    expect(so.services.map((item) => item.title)).toEqual(['Qolka akhriska'])
    expect(so.stats.services).toBe(1)
    expect(so.announcements.map((item) => item.title)).toEqual(['Opening day', 'Story hour'])
    expect((await home('ar')).body.announcements[1].title).toBe('ساعة القصة')
  })

  it('is empty, not broken, for a brand new library and needs no sign-in', async () => {
    await Book.deleteMany({})
    const response = await home()
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      featured: [],
      recent: [],
      categories: [],
      services: [],
      announcements: [],
    })
  })

  it('lets staff feature a book', async () => {
    const { Category } = await import('../features/taxonomy/taxonomy.model.js')
    const category = await Category.create({ name: { en: 'Fiction' } })
    const response = await request(app)
      .patch(`/api/staff/books/${bookId}`)
      .set(auth(staffToken))
      .send({
        title: 'Things Fall Apart',
        author: 'Chinua Achebe',
        isbn: '1',
        category: String(category._id),
        year: 1958,
        featured: true,
      })
    expect(response.status).toBe(200)
    expect((await home()).body.featured).toHaveLength(1)
  })
})

describe('book form input', () => {
  it('accepts an empty publisher choice and requires a category', async () => {
    const { Category } = await import('../features/taxonomy/taxonomy.model.js')
    const category = await Category.create({ name: { en: 'Fiction' } })
    const base = {
      title: 'Form Book',
      author: 'A Writer',
      isbn: 'FORM-1',
      year: 2024,
      featured: false,
    }
    const ok = await request(app)
      .post('/api/staff/books')
      .set(auth(staffToken))
      .send({ ...base, category: String(category._id), publisher: '', edition: '', language: 'en' })
    expect(ok.status).toBe(201)
    expect(ok.body.publisher).toBeNull()
    const missing = await request(app)
      .post('/api/staff/books')
      .set(auth(staffToken))
      .send({ ...base, isbn: 'FORM-2', category: '', publisher: '' })
    expect(missing.status).toBe(400)
  })
})

describe('borrowing with a chosen return date', () => {
  const borrow = (body) =>
    request(app)
      .post('/api/loans')
      .set(auth(staffToken))
      .send({ memberId, copyId, ...body })
  const inDays = (days) =>
    new Date(Date.now() + days * DAY + 3 * 3600000).toISOString().slice(0, 10)

  it('uses the picked return date and sets the borrow time automatically', async () => {
    const before = Date.now()
    const response = await borrow({ returnDate: inDays(10) })
    expect(response.status).toBe(201)
    expect(new Date(response.body.createdAt).getTime()).toBeGreaterThanOrEqual(before - 1000)
    expect(response.body.dueAt).toBe(new Date(`${inDays(10)}T23:59:59+03:00`).toISOString())
  })

  it('falls back to the loan policy when no date is picked', async () => {
    const response = await borrow({})
    const days = (new Date(response.body.dueAt) - Date.now()) / DAY
    expect(Math.round(days)).toBe((await getPolicy()).loanDays)
  })

  it('rejects past, invalid and far-future return dates', async () => {
    for (const returnDate of [inDays(-1), '2026-02-30', inDays(400), 'tomorrow'])
      expect((await borrow({ returnDate })).status, returnDate).toBe(400)
  })

  it('lists loans whose time is finished and loans due today', async () => {
    const overdueId = await lateLoan(2)
    const copy = await Copy.create({ book: bookId, barcode: 'BIB-003', shelf: 'X' })
    const today = await request(app)
      .post('/api/loans')
      .set(auth(staffToken))
      .send({ memberId: otherId, copyId: String(copy._id), returnDate: inDays(1) })
    expect(today.status).toBe(201)
    await Loan.updateOne({ _id: today.body._id }, { $set: { dueAt: new Date(Date.now() + 60000) } })
    const get = (status) => request(app).get(`/api/loans?status=${status}`).set(auth(staffToken))
    expect((await get('overdue')).body.map((loan) => loan._id)).toEqual([overdueId])
    expect((await get('due-today')).body.map((loan) => loan._id)).toEqual([today.body._id])
  })
})
