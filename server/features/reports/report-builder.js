import { z } from 'zod'
import { ApiError } from '../../shared/errors.js'
import { pagination, textSearch } from '../../shared/pagination.js'
import { LANGUAGES, pick } from '../../shared/localized.js'
import { Book } from '../inventory/book.model.js'
import { Copy } from '../inventory/copy.model.js'
import { Loan } from '../circulation/loan.model.js'
import { User } from '../members/user.model.js'
import { Fine } from '../fines/fine.model.js'
import { Reservation } from '../reservations/reservation.model.js'
import { Application } from '../applications/application.routes.js'
import { getPolicy } from '../policies/policy.model.js'
import { computeFine, daysLate } from '../circulation/fines.js'

const MAX_ROWS = 50000
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// Inclusive UTC date range from `from` / `to` (YYYY-MM-DD), or null when neither is given.
function dateRange(from, to) {
  const range = {}
  for (const [key, value] of [
    ['from', from],
    ['to', to],
  ]) {
    if (!value) continue
    const parsed = new Date(`${value}T00:00:00.000Z`)
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
      throw new ApiError(400, 'Choose valid calendar dates.')
    if (key === 'to') parsed.setUTCDate(parsed.getUTCDate() + 1)
    range[key === 'from' ? '$gte' : '$lt'] = parsed
  }
  if (range.$gte && range.$lt && range.$gte >= range.$lt)
    throw new ApiError(400, 'The start date must be on or before the end date.')
  return Object.keys(range).length ? range : null
}
const within = (field, range) => (range ? { [field]: range } : {})
const loanStatus = (loan) =>
  loan.outcome === 'lost'
    ? 'lost'
    : loan.returnedAt
      ? 'returned'
      : new Date(loan.dueAt) < new Date()
        ? 'overdue'
        : 'on_loan'
const localName = (field, lang) => (field ? pick(field, lang) : null)

// Each report returns { rows, total, summary? }. Aggregates return every row; lists page in the database.
const reports = {
  // ---- Books ----
  'books-by-category': {
    columns: ['category', 'titles'],
    async run({ lang }) {
      const rows = await Book.aggregate([
        { $match: { archived: false } },
        { $group: { _id: '$category', titles: { $sum: 1 } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'c' } },
        { $sort: { titles: -1, _id: 1 } },
      ])
      return {
        rows: rows.map((row) => ({
          category: localName(row.c[0]?.name, lang),
          titles: row.titles,
        })),
      }
    },
  },
  'books-by-author': {
    columns: ['author', 'titles'],
    async run() {
      const rows = await Book.aggregate([
        { $match: { archived: false } },
        { $unwind: '$authors' },
        { $group: { _id: '$authors', titles: { $sum: 1 } } },
        { $lookup: { from: 'authors', localField: '_id', foreignField: '_id', as: 'a' } },
        { $sort: { titles: -1, _id: 1 } },
        { $limit: MAX_ROWS },
      ])
      return { rows: rows.map((row) => ({ author: row.a[0]?.name ?? null, titles: row.titles })) }
    },
  },
  'books-by-publisher': {
    columns: ['publisher', 'titles'],
    async run() {
      const rows = await Book.aggregate([
        { $match: { archived: false } },
        { $group: { _id: '$publisher', titles: { $sum: 1 } } },
        { $lookup: { from: 'publishers', localField: '_id', foreignField: '_id', as: 'p' } },
        { $sort: { titles: -1, _id: 1 } },
      ])
      return {
        rows: rows.map((row) => ({ publisher: row.p[0]?.name ?? null, titles: row.titles })),
      }
    },
  },
  inventory: {
    columns: ['status', 'copies'],
    async run() {
      const rows = await Copy.aggregate([
        { $group: { _id: '$status', copies: { $sum: 1 } } },
        { $sort: { copies: -1 } },
      ])
      return { rows: rows.map((row) => ({ status: row._id, copies: row.copies })) }
    },
  },
  'lost-damaged': {
    columns: ['barcode', 'title', 'shelf', 'status', 'date'],
    async run({ range, page }) {
      const filter = { status: { $in: ['lost', 'damaged'] }, ...within('updatedAt', range) }
      const [items, total] = await Promise.all([
        Copy.find(filter)
          .populate('book', 'title')
          .sort({ updatedAt: -1, _id: 1 })
          .skip(page.skip)
          .limit(page.limit)
          .lean(),
        Copy.countDocuments(filter),
      ])
      return {
        total,
        rows: items.map((copy) => ({
          barcode: copy.barcode,
          title: copy.book?.title,
          shelf: copy.shelf,
          status: copy.status,
          date: copy.updatedAt,
        })),
      }
    },
  },

  // ---- Members ----
  'members-summary': {
    columns: ['metric', 'value'],
    async run() {
      const [byStatus, applications] = await Promise.all([
        User.aggregate([
          { $match: { role: 'member' } },
          { $group: { _id: '$status', n: { $sum: 1 } } },
        ]),
        Application.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      ])
      const count = (rows, key) => rows.find((row) => row._id === key)?.n ?? 0
      return {
        rows: [
          { metric: 'membersTotal', value: byStatus.reduce((sum, row) => sum + row.n, 0) },
          { metric: 'membersActive', value: count(byStatus, 'active') },
          { metric: 'membersSuspended', value: count(byStatus, 'suspended') },
          { metric: 'applicationsPending', value: count(applications, 'pending') },
          { metric: 'applicationsApproved', value: count(applications, 'approved') },
          { metric: 'applicationsRejected', value: count(applications, 'rejected') },
        ],
      }
    },
  },
  'membership-growth': {
    columns: ['period', 'newMembers'],
    async run({ range, groupBy }) {
      const rows = await User.aggregate([
        { $match: { role: 'member', ...within('createdAt', range) } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: groupBy === 'day' ? '%Y-%m-%d' : '%Y-%m',
                date: {
                  $dateTrunc: {
                    date: '$createdAt',
                    unit: groupBy === 'day' ? 'day' : 'month',
                    timezone: 'UTC',
                  },
                },
                timezone: 'UTC',
              },
            },
            newMembers: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      return { rows: rows.map((row) => ({ period: row._id, newMembers: row.newMembers })) }
    },
  },
  'member-history': {
    columns: ['member', 'email', 'title', 'issued', 'due', 'returned', 'status'],
    async run({ range, search, page }) {
      const members = search
        ? await User.distinct('_id', { $or: [{ name: search }, { email: search }] })
        : null
      const filter = {
        ...within('createdAt', range),
        ...(members ? { member: { $in: members } } : {}),
      }
      const [items, total] = await Promise.all([
        Loan.find(filter)
          .populate('member', 'name email')
          .populate('book', 'title')
          .sort({ createdAt: -1, _id: 1 })
          .skip(page.skip)
          .limit(page.limit)
          .lean(),
        Loan.countDocuments(filter),
      ])
      return {
        total,
        rows: items.map((loan) => ({
          member: loan.member?.name,
          email: loan.member?.email,
          title: loan.book?.title,
          issued: loan.createdAt,
          due: loan.dueAt,
          returned: loan.returnedAt,
          status: loanStatus(loan),
        })),
      }
    },
  },

  // ---- Borrowing ----
  'borrowing-by-period': {
    columns: ['period', 'issued', 'returned'],
    async run({ range, groupBy }) {
      const period = (field) => ({
        $dateToString: {
          format: '%Y-%m-%d',
          date: {
            $dateTrunc: { date: field, unit: groupBy, timezone: 'UTC', startOfWeek: 'monday' },
          },
          timezone: 'UTC',
        },
      })
      const [issued, returned] = await Promise.all([
        Loan.aggregate([
          { $match: within('createdAt', range) },
          { $group: { _id: period('$createdAt'), n: { $sum: 1 } } },
        ]),
        Loan.aggregate([
          { $match: { returnedAt: { $ne: null, ...(range ?? {}) } } },
          { $group: { _id: period('$returnedAt'), n: { $sum: 1 } } },
        ]),
      ])
      const merged = new Map()
      for (const row of issued) merged.set(row._id, { period: row._id, issued: row.n, returned: 0 })
      for (const row of returned)
        merged.set(row._id, {
          ...(merged.get(row._id) ?? { period: row._id, issued: 0 }),
          returned: row.n,
        })
      return { rows: [...merged.values()].sort((a, b) => a.period.localeCompare(b.period)) }
    },
  },
  overdue: {
    columns: ['member', 'title', 'barcode', 'issued', 'due', 'daysOverdue', 'fineSoFar'],
    async run({ range, page }) {
      const filter = { returnedAt: null, dueAt: { $lt: new Date(), ...(range ?? {}) } }
      const policy = await getPolicy()
      const [items, total] = await Promise.all([
        Loan.find(filter)
          .populate('member', 'name')
          .populate('book', 'title')
          .populate('copy', 'barcode')
          .sort({ dueAt: 1, _id: 1 })
          .skip(page.skip)
          .limit(page.limit)
          .lean(),
        Loan.countDocuments(filter),
      ])
      return {
        total,
        rows: items.map((loan) => ({
          member: loan.member?.name,
          title: loan.book?.title,
          barcode: loan.copy?.barcode,
          issued: loan.createdAt,
          due: loan.dueAt,
          daysOverdue: daysLate(loan.dueAt),
          fineSoFar: computeFine(loan.dueAt, policy).amount,
        })),
      }
    },
  },
  'most-borrowed': {
    columns: ['title', 'author', 'loans'],
    async run({ range }) {
      const rows = await Loan.aggregate([
        { $match: within('createdAt', range) },
        { $group: { _id: '$book', loans: { $sum: 1 } } },
        { $sort: { loans: -1, _id: 1 } },
        { $limit: 100 },
        { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'b' } },
      ])
      return {
        rows: rows.map((row) => ({
          title: row.b[0]?.title,
          author: row.b[0]?.author,
          loans: row.loans,
        })),
      }
    },
  },
  'popular-categories': {
    columns: ['category', 'loans'],
    async run({ range, lang }) {
      const rows = await Loan.aggregate([
        { $match: within('createdAt', range) },
        { $lookup: { from: 'books', localField: 'book', foreignField: '_id', as: 'b' } },
        { $group: { _id: { $arrayElemAt: ['$b.category', 0] }, loans: { $sum: 1 } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'c' } },
        { $sort: { loans: -1, _id: 1 } },
      ])
      return {
        rows: rows.map((row) => ({ category: localName(row.c[0]?.name, lang), loans: row.loans })),
      }
    },
  },

  'reservations-summary': {
    columns: ['status', 'value'],
    async run({ range }) {
      const rows = await Reservation.aggregate([
        { $match: within('createdAt', range) },
        {
          $group: {
            _id: {
              $cond: [
                { $and: [{ $eq: ['$status', 'waiting'] }, { $eq: ['$ready', true] }] },
                'ready',
                { $cond: [{ $eq: ['$status', 'waiting'] }, 'pending', '$status'] },
              ],
            },
            value: { $sum: 1 },
          },
        },
        { $sort: { value: -1 } },
      ])
      return { rows: rows.map((row) => ({ status: row._id, value: row.value })) }
    },
  },

  // ---- Financial ----
  fines: {
    columns: ['member', 'title', 'daysOverdue', 'amount', 'paid', 'status', 'date'],
    async run({ range, search, page }) {
      const members = search
        ? await User.distinct('_id', { $or: [{ name: search }, { email: search }] })
        : null
      const filter = {
        ...within('createdAt', range),
        ...(members ? { member: { $in: members } } : {}),
      }
      const [items, total, totals] = await Promise.all([
        Fine.find(filter)
          .populate('member', 'name')
          .populate({ path: 'loan', select: 'book', populate: { path: 'book', select: 'title' } })
          .sort({ createdAt: -1, _id: 1 })
          .skip(page.skip)
          .limit(page.limit)
          .lean(),
        Fine.countDocuments(filter),
        Fine.aggregate([
          { $match: filter },
          { $group: { _id: '$status', amount: { $sum: '$amount' }, paid: { $sum: '$paid' } } },
        ]),
      ])
      const sum = (statuses, field) =>
        totals.filter((row) => statuses.includes(row._id)).reduce((acc, row) => acc + row[field], 0)
      const round = (value) => Math.round(value * 100) / 100
      return {
        total,
        summary: [
          { key: 'collected', value: round(totals.reduce((acc, row) => acc + row.paid, 0)) },
          {
            key: 'outstanding',
            value: round(
              sum(['outstanding', 'partially_paid'], 'amount') -
                sum(['outstanding', 'partially_paid'], 'paid'),
            ),
          },
          { key: 'waived', value: round(sum(['waived'], 'amount')) },
        ],
        rows: items.map((fine) => ({
          member: fine.member?.name,
          title: fine.loan?.book?.title,
          daysOverdue: fine.daysOverdue,
          amount: fine.amount,
          paid: fine.paid,
          status: fine.status,
          date: fine.createdAt,
        })),
      }
    },
  },
}

export const reportTypes = Object.keys(reports)

// GET /staff/reports/run/:type - paged by default, or every row (capped) with ?all=true.
export async function runReport(req, res) {
  const type = z.enum(reportTypes).parse(req.params.type)
  const query = z
    .object({
      from: date.optional(),
      to: date.optional(),
      q: z.string().max(100).optional(),
      groupBy: z.enum(['day', 'week', 'month']).default('month'),
      lang: z.enum(LANGUAGES).catch('en'),
      all: z.enum(['true', 'false']).default('false'),
    })
    .parse(req.query)
  const everything = query.all === 'true'
  const page = everything
    ? { skip: 0, limit: MAX_ROWS, page: 1, paginated: true }
    : pagination(req, 100)
  const report = reports[type]
  const result = await report.run({
    range: dateRange(query.from, query.to),
    search: textSearch(query.q),
    groupBy: query.groupBy,
    lang: query.lang,
    page,
  })
  const total = result.total ?? result.rows.length
  // Aggregate reports return every row; slice them here so paging works the same everywhere.
  const rows =
    result.total === undefined && !everything
      ? result.rows.slice(page.skip, page.skip + page.limit)
      : result.rows
  res.json({
    type,
    columns: report.columns,
    rows,
    total,
    summary: result.summary ?? [],
    page: page.page,
    pages: everything ? 1 : Math.max(1, Math.ceil(total / page.limit)),
  })
}
