import { vi } from 'vitest'
import { brandPalette, contrastRatio } from '../../client/shared/lib/brand-palette.js'
import { mkdtemp, writeFile, readFile, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import dotenv from 'dotenv'
import * as mailConfiguration from '../features/email/email-config.service.js'
import nodemailer from 'nodemailer'
import { config } from '../config/env.js'
import { EmailMessage } from '../features/email/email.model.js'
import { SecurityToken } from '../features/auth/securitytoken.model.js'
import { LibrarySettings } from '../features/settings/settings.model.js'
import { queueEmail, deliverEmails, readEmailBody } from '../features/email/email.service.js'
import { queueReminders } from '../features/email/reminders.service.js'
import sharp from 'sharp'
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import * as argon2 from '@node-rs/argon2'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { app } from '../app.js'
import {
  User,
  Book,
  Copy,
  Loan,
  Reservation,
  RefreshSession,
  Audit,
  Policy,
  Notification,
  allModels,
  getPolicy,
} from '../models.js'
let mongo
let adminToken, memberToken, otherToken, librarianToken
let memberId, otherId, adminId, bookId, copyId
const password = 'Library-testing-password-2026'
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongo.getUri('biblioteca-test'))
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
    { name: 'Library Admin', email: 'admin@test.local', passwordHash, role: 'admin' },
    { name: 'Amina Wanjiku', email: 'amina@test.local', passwordHash },
    { name: 'David Otieno', email: 'david@test.local', passwordHash },
    { name: 'Library Staff', email: 'staff@test.local', passwordHash, role: 'librarian' },
  ])
  adminId = String(users[0]._id)
  memberId = String(users[1]._id)
  otherId = String(users[2]._id)
  const tokens = []
  for (const user of users) {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password })
    expect(response.status).toBe(200)
    tokens.push(response.body.accessToken)
  }
  ;[adminToken, memberToken, otherToken, librarianToken] = tokens
  const book = await Book.create({
    title: 'Things Fall Apart',
    author: 'Chinua Achebe',
    isbn: '9780385474542',
    genre: 'Fiction',
    year: 1958,
    description: 'A novel.',
  })
  bookId = String(book._id)
  copyId = String((await Copy.create({ book: book._id, barcode: 'BIB-001', shelf: 'FIC 1' }))._id)
  await getPolicy()
})
const auth = (token) => ({ Authorization: `Bearer ${token}` })
const issue = (member = memberId, copy = copyId) =>
  request(app).post('/api/loans').set(auth(adminToken)).send({ memberId: member, copyId: copy })
it('counts account activity independently of history pages and other members', async () => {
  await issue()
  await Loan.create({
    member: memberId,
    book: bookId,
    copy: copyId,
    dueAt: new Date(),
    returnedAt: new Date(),
  })
  await Reservation.create([
    { member: memberId, book: bookId, status: 'waiting' },
    { member: memberId, book: bookId, status: 'cancelled' },
    { member: otherId, book: bookId, status: 'waiting' },
  ])
  await Notification.create({ member: otherId, message: 'Other member notice' })
  const summary = await request(app).get('/api/me/summary').set(auth(memberToken))
  expect(summary.status).toBe(200)
  expect(summary.body).toMatchObject({
    currentLoans: 1,
    reservations: 1,
    unreadNotices: 1,
    dueSoon: 0,
    overdue: 0,
    membershipStatus: 'active',
  })
  expect((await request(app).get('/api/me/summary')).status).toBe(401)
})
describe('Authentication and authorization', () => {
  it('updates profile identity securely, resets email verification, and revokes old sessions', async () => {
    const name = 'Updated Reader'
    expect((await request(app).patch('/api/me').set(auth(memberToken)).send({ name })).status).toBe(
      200,
    )
    const input = {
      name,
      email: 'updated-reader@test.local',
      password: 'Updated-password-2026',
      confirmPassword: 'Updated-password-2026',
    }
    expect(
      (
        await request(app)
          .patch('/api/me')
          .set(auth(memberToken))
          .send({ ...input, currentPassword: 'wrong-password' })
      ).status,
    ).toBe(400)
    expect(
      (
        await request(app)
          .patch('/api/me')
          .set(auth(memberToken))
          .send({ ...input, currentPassword: password, confirmPassword: 'different' })
      ).status,
    ).toBe(400)
    const changed = await request(app)
      .patch('/api/me')
      .set(auth(memberToken))
      .send({ ...input, currentPassword: password })
    expect(changed.status).toBe(200)
    expect(changed.body.requiresSignIn).toBe(true)
    expect(changed.body.emailVerified).toBe(false)
    expect(changed.body.passwordHash).toBeUndefined()
    expect((await request(app).get('/api/me').set(auth(memberToken))).status).toBe(401)
    expect(await RefreshSession.countDocuments({ user: memberId })).toBe(0)
    expect(await SecurityToken.countDocuments({ user: memberId, kind: 'verify' })).toBe(1)
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: input.email, password: input.password })
      ).status,
    ).toBe(200)
  })
  it('rejects duplicate email changes without revoking the valid session', async () => {
    const response = await request(app)
      .patch('/api/me')
      .set(auth(memberToken))
      .send({ name: 'Reader', email: 'admin@test.local', currentPassword: password })
    expect(response.status).toBe(409)
    expect((await request(app).get('/api/me').set(auth(memberToken))).status).toBe(200)
    expect((await User.findById(memberId)).email).toBe('amina@test.local')
  })
  it('validates and replaces profile photos without changing another account', async () => {
    const image = await sharp({
      create: { width: 64, height: 64, channels: 3, background: '#24634b' },
    })
      .png()
      .toBuffer()
    const upload = () =>
      request(app)
        .post('/api/me/avatar')
        .set(auth(memberToken))
        .set('Content-Type', 'image/png')
        .send(image)
    const first = await upload()
    expect(first.status).toBe(200)
    expect(first.body.avatarId).toBeTruthy()
    expect(first.body.passwordHash).toBeUndefined()
    const photo = await request(app).get(`/api/covers/${first.body.avatarId}`)
    expect(photo.status).toBe(200)
    expect(photo.headers['content-type']).toContain('image/webp')
    const second = await upload()
    expect(second.body.avatarId).not.toBe(first.body.avatarId)
    expect((await request(app).get(`/api/covers/${first.body.avatarId}`)).status).toBe(404)
    expect((await User.findById(otherId)).avatarId).toBeNull()
    expect(
      (
        await request(app)
          .post('/api/me/avatar')
          .set(auth(memberToken))
          .set('Content-Type', 'image/png')
          .send(Buffer.from('invalid image'))
      ).status,
    ).toBe(400)
    expect(
      (await request(app).post('/api/me/avatar').set('Content-Type', 'image/png').send(image))
        .status,
    ).toBe(401)
  })
  it('saves administrator mail settings in an isolated environment file without exposing credentials', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'khaliil-mail-config-test-'))
    const envPath = join(directory, '.env')
    await writeFile(
      envPath,
      'JWT_SECRET=unchanged-test-secret\nMAIL_TRANSPORT=preview\nSMTP_USER=old@test.local\nSMTP_PASSWORD=old-value\n',
    )
    const original = {
      transport: config.MAIL_TRANSPORT,
      user: config.SMTP_USER,
      password: config.SMTP_PASSWORD,
    }
    const persist = mailConfiguration.persistMailConfiguration
    const spy = vi
      .spyOn(mailConfiguration, 'persistMailConfiguration')
      .mockImplementation((input) => persist(input, envPath))
    try {
      const input = {
        transport: 'smtp',
        user: 'sender@test.local',
        password: 'test-only-app-password',
      }
      expect(
        (
          await request(app)
            .put('/api/staff/email/configuration')
            .set(auth(librarianToken))
            .send(input)
        ).status,
      ).toBe(403)
      const response = await request(app)
        .put('/api/staff/email/configuration')
        .set(auth(adminToken))
        .send(input)
      expect(response.status).toBe(200)
      expect(JSON.stringify(response.body)).not.toContain(input.password)
      const stored = dotenv.parse(await readFile(envPath))
      expect(stored.JWT_SECRET).toBe('unchanged-test-secret')
      expect(stored.SMTP_PASSWORD).toBe(input.password)
      expect(stored.MAIL_TRANSPORT).toBe('smtp')
      const status = await request(app).get('/api/staff/email/status').set(auth(adminToken))
      expect(status.body.passwordConfigured).toBe(true)
      expect(status.body.password).toBeUndefined()
      await request(app)
        .put('/api/staff/email/configuration')
        .set(auth(adminToken))
        .send({ transport: 'preview', user: input.user })
      expect(dotenv.parse(await readFile(envPath)).SMTP_PASSWORD).toBe(input.password)
      expect(
        (
          await request(app)
            .put('/api/staff/email/configuration')
            .set(auth(adminToken))
            .send({ ...input, password: 'bad\nvalue' })
        ).status,
      ).toBe(400)
    } finally {
      spy.mockRestore()
      config.MAIL_TRANSPORT = original.transport
      config.SMTP_USER = original.user
      config.SMTP_PASSWORD = original.password
      await unlink(envPath)
      await rmdir(directory)
    }
  })
  it('exports complete activity with inclusive date ranges, search and status filters', async () => {
    await issue()
    await Loan.collection.updateOne(
      { member: new mongoose.Types.ObjectId(memberId) },
      {
        $set: {
          createdAt: new Date('2026-01-05T23:59:00Z'),
          dueAt: new Date('2026-02-05T00:00:00Z'),
        },
      },
    )
    const filtered = await request(app)
      .get('/api/staff/reports/loans.csv?from=2026-01-05&to=2026-01-05&q=amina&status=active')
      .set(auth(adminToken))
    expect(filtered.status).toBe(200)
    expect(filtered.text).toContain('amina@test.local')
    const outside = await request(app)
      .get('/api/staff/reports/loans.csv?from=2026-01-06&status=active')
      .set(auth(adminToken))
    expect(outside.text).not.toContain('amina@test.local')
    const returns = await request(app)
      .get('/api/staff/reports/loans.csv?status=returned')
      .set(auth(adminToken))
    expect(returns.text).not.toContain('amina@test.local')
    const contradictory = await request(app)
      .get('/api/staff/reports/loans.csv?dateField=returnedAt&from=2026-01-01&status=active')
      .set(auth(adminToken))
    expect(contradictory.text).not.toContain('amina@test.local')
    expect(
      (
        await request(app)
          .get('/api/staff/reports/inventory.csv?from=2026-02-30')
          .set(auth(adminToken))
      ).status,
    ).toBe(400)
    expect(
      (
        await request(app)
          .get('/api/staff/reports/loans.csv?from=2026-02-01&to=2026-01-01')
          .set(auth(adminToken))
      ).status,
    ).toBe(400)
    expect(
      (
        await request(app)
          .get('/api/staff/reports/reservations.csv?status=invalid')
          .set(auth(adminToken))
      ).status,
    ).toBe(400)
  })
  it('separates reader and staff management and restricts staff creation', async () => {
    const readers = await request(app)
      .get('/api/staff/members?group=members&page=1')
      .set(auth(adminToken))
    expect(readers.body.items.every((item) => item.role === 'member')).toBe(true)
    const team = await request(app)
      .get('/api/staff/members?group=team&page=1')
      .set(auth(adminToken))
    expect(team.body.total).toBe(2)
    expect(
      (await request(app).get('/api/staff/members?group=team').set(auth(librarianToken))).status,
    ).toBe(403)
    const input = {
      name: 'New Librarian',
      email: 'new-staff@test.local',
      password,
      role: 'librarian',
    }
    expect(
      (await request(app).post('/api/staff/members').set(auth(librarianToken)).send(input)).status,
    ).toBe(403)
    const created = await request(app).post('/api/staff/members').set(auth(adminToken)).send(input)
    expect(created.status).toBe(201)
    expect(created.body.role).toBe('librarian')
  })
  it('reports full circulation and membership totals and exports historical activity', async () => {
    await issue()
    await Reservation.create({ member: otherId, book: bookId })
    const report = await request(app).get('/api/staff/reports').set(auth(adminToken))
    expect(report.body.members).toBe(2)
    expect(report.body.totalLoans).toBe(1)
    expect(report.body.monthly[0].issued).toBe(1)
    expect(report.body.popularTitles[0].title).toBe('Things Fall Apart')
    const loans = await request(app).get('/api/staff/reports/loans.csv').set(auth(adminToken))
    expect(loans.status).toBe(200)
    expect(loans.text).toContain('amina@test.local')
    const reservations = await request(app)
      .get('/api/staff/reports/reservations.csv')
      .set(auth(adminToken))
    expect(reservations.text).toContain('david@test.local')
    expect(
      (await request(app).get('/api/staff/reports/loans.csv').set(auth(memberToken))).status,
    ).toBe(403)
  })
  it('registers members without accepting privilege escalation', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Grace Njeri', email: 'grace@test.local', password, role: 'admin' })
    expect(response.status).toBe(201)
    expect(response.body.user.role).toBe('member')
    expect(response.body.user.passwordHash).toBeUndefined()
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly')
  })
  it('rotates refresh tokens and rejects the previous token after a short grace period', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'amina@test.local', password })
    const cookie = login.headers['set-cookie'][0].split(';')[0]
    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(refreshed.status).toBe(200)
    // A reload racing the refresh may reuse the old token for a few seconds...
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(200)
    // ...but not once the grace period is over.
    await RefreshSession.updateMany(
      { rotatedAt: { $ne: null } },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    )
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401)
    expect(await RefreshSession.countDocuments()).toBeGreaterThan(0)
  })
  it('blocks member inventory writes and librarian policy changes', async () => {
    expect((await request(app).get('/api/staff/books').set(auth(memberToken))).status).toBe(403)
    expect(
      (
        await request(app)
          .put('/api/staff/policies')
          .set(auth(librarianToken))
          .send({ loanDays: 14, maxLoans: 3, maxRenewals: 1, renewalDays: 7 })
      ).status,
    ).toBe(403)
    expect((await request(app).get('/api/loans')).status).toBe(401)
  })
  it('rejects untrusted browser origins and suspended accounts', async () => {
    const { config } = await import('../config/env.js')
    const localOrigin = new URL(config.CLIENT_ORIGIN)
    localOrigin.hostname = localOrigin.hostname === 'localhost' ? '127.0.0.1' : 'localhost'
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .set('Origin', localOrigin.origin)
          .send({ email: 'amina@test.local', password })
      ).status,
    ).toBe(200)
    localOrigin.port = '5999'
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .set('Origin', localOrigin.origin)
          .send({ email: 'amina@test.local', password })
      ).status,
    ).toBe(403)
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .set('Origin', 'https://untrusted.example')
          .send({ email: 'amina@test.local', password })
      ).status,
    ).toBe(403)
    await User.updateOne({ _id: memberId }, { status: 'suspended' })
    expect((await request(app).get('/api/me').set(auth(memberToken))).status).toBe(401)
  })
})
describe('Catalog and inventory', () => {
  it('searches titles and returns copy availability', async () => {
    const response = await request(app).get('/api/books?q=achebe')
    expect(response.status).toBe(200)
    expect(response.body.total).toBe(1)
    expect(response.body.items[0].copies.available).toBe(1)
    expect((await request(app).get('/api/books?q=%5B')).status).toBe(200)
  })
  it('validates identifiers and rejects duplicate ISBNs', async () => {
    expect((await request(app).get('/api/books/invalid')).status).toBe(400)
    const response = await request(app).post('/api/staff/books').set(auth(adminToken)).send({
      title: 'Duplicate',
      author: 'Author',
      isbn: '9780385474542',
      genre: 'Fiction',
      year: 2020,
    })
    expect(response.status).toBe(409)
  })
  it('persists saved books and isolates reading lists', async () => {
    expect((await request(app).put(`/api/me/saved/${bookId}`).set(auth(memberToken))).status).toBe(
      204,
    )
    expect((await request(app).get('/api/me/saved').set(auth(memberToken))).body).toHaveLength(1)
    expect((await request(app).get('/api/me/saved').set(auth(otherToken))).body).toHaveLength(0)
  })
})
describe('Circulation transactions', () => {
  it('issues and returns a copy with audit history and a notification', async () => {
    const issued = await issue()
    expect(issued.status).toBe(201)
    expect((await Copy.findById(copyId))?.status).toBe('on_loan')
    expect(await Notification.countDocuments({ member: memberId })).toBe(1)
    const returned = await request(app)
      .post(`/api/loans/${issued.body._id}/return`)
      .set(auth(adminToken))
    expect(returned.status).toBe(200)
    expect((await Copy.findById(copyId))?.status).toBe('available')
    // Sign-ins are audited too; this checks the two loan actions.
    expect(await Audit.countDocuments({ actor: adminId, action: /^loan\./ })).toBe(2)
    expect(
      (await request(app).post(`/api/loans/${issued.body._id}/return`).set(auth(adminToken)))
        .status,
    ).toBe(404)
  })
  it('allows only one concurrent checkout of the same copy', async () => {
    const responses = await Promise.all([issue(memberId), issue(otherId)])
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1)
    expect(await Loan.countDocuments({ returnedAt: null, copy: copyId })).toBe(1)
  })
  it('serializes concurrent borrowing-limit checks', async () => {
    await Policy.updateOne({ key: 'library' }, { maxLoans: 1 })
    const second = await Copy.create({ book: bookId, barcode: 'BIB-002', shelf: 'FIC 1' })
    const results = await Promise.all([
      issue(memberId, copyId),
      issue(memberId, String(second._id)),
    ])
    expect(results.filter((response) => response.status === 201)).toHaveLength(1)
    expect(await Loan.countDocuments({ member: memberId, returnedAt: null })).toBe(1)
  })
  it('blocks overdue borrowers without changing copy availability', async () => {
    const first = await issue()
    await Loan.updateOne({ _id: first.body._id }, { dueAt: new Date(Date.now() - 86400000) })
    const second = await Copy.create({ book: bookId, barcode: 'BIB-002', shelf: 'FIC 1' })
    expect((await issue(memberId, String(second._id))).status).toBe(409)
    expect((await Copy.findById(second._id))?.status).toBe('available')
  })
  it('enforces reservation order and fulfills the first hold', async () => {
    const hold = await request(app).post('/api/reservations').set(auth(otherToken)).send({ bookId })
    expect(hold.status).toBe(201)
    expect((await issue(memberId)).status).toBe(409)
    expect((await Copy.findById(copyId))?.status).toBe('available')
    expect((await issue(otherId)).status).toBe(201)
    expect((await Reservation.findById(hold.body._id))?.status).toBe('fulfilled')
  })
  it('prevents renewal by another member or when a hold is waiting', async () => {
    const loan = await issue()
    expect(
      (await request(app).post(`/api/loans/${loan.body._id}/renew`).set(auth(otherToken))).status,
    ).toBe(404)
    expect(
      (await request(app).post(`/api/loans/${loan.body._id}/renew`).set(auth(memberToken))).status,
    ).toBe(200)
    await request(app).post('/api/reservations').set(auth(otherToken)).send({ bookId })
    expect(
      (await request(app).post(`/api/loans/${loan.body._id}/renew`).set(auth(memberToken))).status,
    ).toBe(409)
  })
  it('prevents archive and copy retirement during an active loan', async () => {
    await issue()
    const book = await Book.findById(bookId)
    expect(
      (
        await request(app)
          .patch(`/api/staff/books/${bookId}`)
          .set(auth(adminToken))
          .send({ ...book.toObject(), archived: true })
      ).status,
    ).toBe(409)
    expect((await Book.findById(bookId))?.archived).toBe(false)
    expect(
      (
        await request(app)
          .patch(`/api/staff/copies/${copyId}`)
          .set(auth(adminToken))
          .send({ shelf: 'FIC 1', status: 'retired' })
      ).status,
    ).toBe(404)
  })
  it('isolates member loan history and cancellation rights', async () => {
    await issue()
    expect((await request(app).get('/api/loans').set(auth(otherToken))).body).toHaveLength(0)
    const hold = await request(app)
      .post('/api/reservations')
      .set(auth(memberToken))
      .send({ bookId })
    expect(
      (await request(app).post(`/api/reservations/${hold.body._id}/cancel`).set(auth(otherToken)))
        .status,
    ).toBe(404)
  })
})
it('publishes only current borrowing rules without requiring authentication', async () => {
  await Policy.updateOne(
    {},
    { $set: { loanDays: 21, maxLoans: 4, maxRenewals: 2, renewalDays: 7 } },
  )
  const response = await request(app).get('/api/library/policies')
  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({ loanDays: 21, maxLoans: 4, maxRenewals: 2, renewalDays: 7 })
  // Fines stay off and unset until the library configures them.
  expect(response.body).toMatchObject({ fineEnabled: false, finePerDay: 0, reservationHoldDays: 0 })
})
it('public registration cannot grant administrator or librarian access', async () => {
  for (const role of ['admin', 'librarian']) {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New Reader', email: `${role}-registration@test.local`, password, role })
    expect(response.status).toBe(201)
    const created = await User.findOne({ email: `${role}-registration@test.local` })
    expect(created?.role).toBe('member')
  }
})
it('staff can upload a real cover while members and invalid images are rejected', async () => {
  const image = await sharp({
    create: { width: 12, height: 18, channels: 3, background: '#24634b' },
  })
    .png()
    .toBuffer()
  expect(
    (
      await request(app)
        .post('/api/staff/covers')
        .set(auth(memberToken))
        .set('Content-Type', 'image/png')
        .send(image)
    ).status,
  ).toBe(403)
  expect(
    (
      await request(app)
        .post('/api/staff/covers')
        .set(auth(adminToken))
        .set('Content-Type', 'image/png')
        .send(Buffer.from('not an image'))
    ).status,
  ).toBe(400)
  const uploaded = await request(app)
    .post('/api/staff/covers')
    .set(auth(librarianToken))
    .set('Content-Type', 'image/png')
    .send(image)
  expect(uploaded.status).toBe(201)
  const cover = await request(app).get(`/api/covers/${uploaded.body.coverId}`)
  expect(cover.status).toBe(200)
  expect(cover.headers['content-type']).toContain('image/webp')
  const updated = await request(app)
    .patch(`/api/staff/books/${bookId}`)
    .set(auth(adminToken))
    .send({
      title: 'Things Fall Apart',
      author: 'Chinua Achebe',
      isbn: '9780385474542',
      genre: 'Fiction',
      year: 1958,
      coverId: uploaded.body.coverId,
    })
  expect(updated.status).toBe(200)
  expect(updated.body.coverId).toBe(uploaded.body.coverId)
  const removed = await request(app)
    .patch(`/api/staff/books/${bookId}`)
    .set(auth(adminToken))
    .send({
      title: 'Things Fall Apart',
      author: 'Chinua Achebe',
      isbn: '9780385474542',
      genre: 'Fiction',
      year: 1958,
      coverId: null,
    })
  expect(removed.status).toBe(200)
  expect(removed.body.coverId).toBeNull()
})
it('contact messages persist and only staff can read and handle them', async () => {
  const created = await request(app).post('/api/contact').send({
    name: 'Contact Reader',
    email: 'contact@test.local',
    subject: 'Borrowing',
    message: 'How do I collect my reserved title?',
  })
  expect(created.status).toBe(201)
  expect((await request(app).get('/api/staff/contact').set(auth(memberToken))).status).toBe(403)
  const inbox = await request(app).get('/api/staff/contact').set(auth(librarianToken))
  expect(inbox.status).toBe(200)
  expect(inbox.body[0].message).toBe('How do I collect my reserved title?')
  const handled = await request(app)
    .patch(`/api/staff/contact/${inbox.body[0]._id}`)
    .set(auth(adminToken))
    .send({ status: 'handled' })
  expect(handled.status).toBe(200)
  expect(handled.body.status).toBe('handled')
})
it('password recovery is one-time, expires, and revokes access and refresh sessions', async () => {
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'amina@test.local', password })
  const known = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'amina@test.local' })
  const unknown = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'absent@test.local' })
  expect(known.body).toEqual(unknown.body)
  const mail = await EmailMessage.findOne({ to: 'amina@test.local' })
  const token = readEmailBody(mail.text).match(/token=([a-f0-9]{64})/)[1]
  expect(await SecurityToken.findOne({ tokenHash: token })).toBeNull()
  const nextPassword = 'New-unique-password-2026'
  expect(
    (await request(app).post('/api/auth/reset-password').send({ token, password: nextPassword }))
      .status,
  ).toBe(200)
  expect(
    (await request(app).post('/api/auth/reset-password').send({ token, password: nextPassword }))
      .status,
  ).toBe(400)
  expect((await request(app).get('/api/me').set(auth(memberToken))).status).toBe(401)
  const cookie = login.headers['set-cookie'][0].split(';')[0]
  expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401)
  expect(
    (
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'amina@test.local', password: nextPassword })
    ).status,
  ).toBe(200)
  await request(app).post('/api/auth/forgot-password').send({ email: 'amina@test.local' })
  const newer = await EmailMessage.find({
    to: 'amina@test.local',
    subject: 'Reset your library password',
  }).sort({ createdAt: -1 })
  const expiredToken = readEmailBody(newer[0].text).match(/token=([a-f0-9]{64})/)[1]
  await SecurityToken.updateMany({}, { $set: { expiresAt: new Date(0) } })
  expect(
    (
      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: expiredToken, password: nextPassword })
    ).status,
  ).toBe(400)
})
it('verification links verify the email once and never grant staff access', async () => {
  await request(app).post('/api/auth/resend-verification').set(auth(memberToken))
  const mail = await EmailMessage.findOne({ to: 'amina@test.local' })
  const token = readEmailBody(mail.text).match(/token=([a-f0-9]{64})/)[1]
  expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(200)
  expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(400)
  const user = await User.findById(memberId)
  expect(user.emailVerified).toBe(true)
  expect(user.role).toBe('member')
})
it('generates readable brand colors in both modes', () => {
  const colors = ['#000000', '#ffffff', '#ffff00', '#ff00ff', '#00ffff', '#ff0000', '#24634b']
  for (const primary of colors)
    for (const secondary of colors)
      for (const dark of [false, true]) {
        const palette = brandPalette(primary, secondary, dark)
        for (const text of ['--text', '--muted', '--accent']) {
          for (const background of ['--bg', '--surface', '--soft']) {
            expect(contrastRatio(palette[text], palette[background])).toBeGreaterThanOrEqual(4.5)
          }
        }
        for (const background of ['--button', '--button-hover']) {
          expect(
            contrastRatio(palette['--accent-foreground'], palette[background]),
          ).toBeGreaterThanOrEqual(4.5)
        }
        expect(
          contrastRatio(palette['--secondary'], palette['--secondary-soft']),
        ).toBeGreaterThanOrEqual(4.5)
      }
})
it('library details are public but only administrators can change them', async () => {
  const details = {
    name: 'Khaliil Test Library',
    email: 'library@test.local',
    phone: '+252 616875280',
    address: 'Somalia',
    hours: 'Open 24 hours',
    timezone: 'Africa/Mogadishu',
    emailEnabled: true,
    reminderDays: 3,
  }
  expect(
    (await request(app).put('/api/staff/settings').set(auth(librarianToken)).send(details)).status,
  ).toBe(403)
  expect(
    (await request(app).put('/api/staff/settings').set(auth(adminToken)).send(details)).status,
  ).toBe(200)
  const publicDetails = await request(app).get('/api/library/settings')
  expect(publicDetails.body.name).toBe(details.name)
  expect(publicDetails.body.emailEnabled).toBeUndefined()
  const image = await sharp({
    create: { width: 64, height: 64, channels: 4, background: '#24634b' },
  })
    .png()
    .toBuffer()
  expect(
    (
      await request(app)
        .post('/api/staff/settings/logo')
        .set(auth(librarianToken))
        .set('Content-Type', 'image/png')
        .send(image)
    ).status,
  ).toBe(403)
  const uploaded = await request(app)
    .post('/api/staff/settings/logo')
    .set(auth(adminToken))
    .set('Content-Type', 'image/png')
    .send(image)
  expect(uploaded.status).toBe(201)
  const branding = await request(app)
    .put('/api/staff/settings')
    .set(auth(adminToken))
    .send({
      ...details,
      logoId: uploaded.body.logoId,
      showName: false,
      primaryColor: '#124578',
      secondaryColor: '#976234',
    })
  expect(branding.status).toBe(200)
  const publicBranding = await request(app).get('/api/library/settings')
  expect(publicBranding.body.logoId).toBe(uploaded.body.logoId)
  expect(publicBranding.body.showName).toBe(false)
  expect(publicBranding.body.primaryColor).toBe('#124578')
  expect(publicBranding.body.secondaryColor).toBe('#976234')
  expect((await request(app).get(`/api/covers/${uploaded.body.logoId}`)).status).toBe(200)
  expect(
    (
      await request(app)
        .put('/api/staff/settings')
        .set(auth(adminToken))
        .send({ ...details, timezone: 'invalid/timezone' })
    ).status,
  ).toBe(400)
})
it('paginated title search reaches records beyond the old limit and escapes literal search input', async () => {
  await Book.insertMany(
    Array.from({ length: 520 }, (_, index) => ({
      title: `Batch title ${String(index).padStart(3, '0')}`,
      author: 'Bulk Author',
      isbn: `BATCH-${index}`,
      genre: 'Fiction',
      year: 2020,
    })),
  )
  await Book.create({
    title: '[Special] literal title',
    author: 'Literal Author',
    isbn: 'LITERAL-1',
    genre: 'Fiction',
    year: 2020,
  })
  const page = await request(app).get('/api/staff/books?page=21&limit=25').set(auth(adminToken))
  expect(page.status).toBe(200)
  expect(page.body.total).toBe(522)
  expect(page.body.items.length).toBe(22)
  const search = await request(app)
    .get('/api/staff/books')
    .query({ page: 1, q: '[Special]' })
    .set(auth(adminToken))
  expect(search.status).toBe(200)
  expect(search.body.items).toHaveLength(1)
  expect((await request(app).get('/api/staff/books?page=-1').set(auth(adminToken))).status).toBe(
    400,
  )
})
it('inventory export includes every copy beyond the previous 1000-copy cap', async () => {
  await Copy.insertMany(
    Array.from({ length: 1005 }, (_, index) => ({
      book: bookId,
      barcode: `BULK-${index}`,
      shelf: index === 0 ? '=dangerous-formula' : 'FIC 1',
    })),
  )
  const report = await request(app)
    .get('/api/staff/reports/inventory.csv')
    .set(auth(librarianToken))
  expect(report.status).toBe(200)
  expect(report.text.trim().split(/\r?\n/)).toHaveLength(1007)
  expect(report.text).toContain('BULK-1004')
  expect(report.text).toContain("'=dangerous-formula")
  expect(
    (await request(app).get('/api/staff/reports/inventory.csv').set(auth(memberToken))).status,
  ).toBe(403)
})
it('email reminders are deduplicated and respect verification and disabled email preferences', async () => {
  await User.updateOne({ _id: memberId }, { $set: { emailVerified: true } })
  const loan = await issue()
  await Loan.updateOne({ _id: loan.body._id }, { $set: { dueAt: new Date(Date.now() + 86400000) } })
  await EmailMessage.deleteMany({})
  await queueReminders()
  await queueReminders()
  expect(await EmailMessage.countDocuments()).toBe(1)
  await LibrarySettings.updateOne({}, { $set: { emailEnabled: false } })
  await EmailMessage.deleteMany({})
  await queueReminders()
  expect(await EmailMessage.countDocuments()).toBe(0)
})
it('SMTP delivery marks accepted messages sent and retains failed attempts for retry', async () => {
  const original = {
    transport: config.MAIL_TRANSPORT,
    user: config.SMTP_USER,
    password: config.SMTP_PASSWORD,
  }
  const sendMail = vi.fn().mockResolvedValue({ accepted: ['reader@test.local'] })
  const create = vi
    .spyOn(nodemailer, 'createTransport')
    .mockReturnValue({ sendMail, close: vi.fn() })
  try {
    config.MAIL_TRANSPORT = 'smtp'
    config.SMTP_USER = 'sender@test.local'
    config.SMTP_PASSWORD = 'test-only-app-password'
    await queueEmail('reader@test.local', 'Test delivery', 'Test message')
    await deliverEmails()
    expect((await EmailMessage.findOne()).status).toBe('sent')
    sendMail.mockRejectedValueOnce(new Error('SMTP rejected'))
    await queueEmail('reader@test.local', 'Failed delivery', 'Test message')
    await deliverEmails()
    const failed = await EmailMessage.findOne({ subject: 'Failed delivery' })
    expect(failed.status).toBe('pending')
    expect(failed.attempts).toBe(1)
    expect(failed.lastError).not.toContain('SMTP rejected')
  } finally {
    config.MAIL_TRANSPORT = original.transport
    config.SMTP_USER = original.user
    config.SMTP_PASSWORD = original.password
    create.mockRestore()
  }
})
it('staff contact replies persist and queue an email', async () => {
  await request(app).post('/api/contact').send({
    name: 'Contact Reader',
    email: 'contact@test.local',
    subject: 'Other',
    message: 'Please explain how the library works.',
  })
  const inbox = await request(app).get('/api/staff/contact').set(auth(adminToken))
  const response = await request(app)
    .post(`/api/staff/contact/${inbox.body[0]._id}/reply`)
    .set(auth(librarianToken))
    .send({ message: 'Please visit the FAQ for borrowing details.' })
  expect(response.status).toBe(200)
  expect(readEmailBody((await EmailMessage.findOne({ to: 'contact@test.local' })).text)).toContain(
    'visit the FAQ',
  )
})
