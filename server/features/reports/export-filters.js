import { z } from 'zod'
import { ApiError } from '../../shared/errors.js'
import { textSearch } from '../../shared/pagination.js'
import { Book } from '../inventory/book.model.js'
import { User } from '../members/user.model.js'
export async function exportFilters(req, kind) {
  const input = z
    .object({
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      q: z.string().max(100).optional(),
      status: z.string().optional(),
      dateField: z.enum(['createdAt', 'dueAt', 'returnedAt']).default('createdAt'),
    })
    .parse(req.query)
  const filter = {}
  const range = {}
  for (const key of ['from', 'to']) {
    if (!input[key]) continue
    const date = new Date(`${input[key]}T00:00:00.000Z`)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input[key])
      throw new ApiError(400, 'Choose valid calendar dates.')
    if (key === 'to') date.setUTCDate(date.getUTCDate() + 1)
    range[key === 'from' ? '$gte' : '$lt'] = date
  }
  if (range.$gte && range.$lt && range.$gte >= range.$lt)
    throw new ApiError(400, 'The start date must be on or before the end date.')
  if ((kind === 'inventory' || kind === 'reservations') && input.dateField !== 'createdAt')
    throw new ApiError(400, 'This export uses the record creation date.')
  if (Object.keys(range).length) filter[input.dateField] = range
  const status = input.status || 'all'
  const statuses =
    kind === 'inventory'
      ? ['all', 'available', 'on_loan', 'retired']
      : kind === 'reservations'
        ? ['all', 'waiting', 'fulfilled', 'cancelled']
        : ['all', 'active', 'returned', 'overdue']
  if (!statuses.includes(status)) throw new ApiError(400, 'Choose a valid report status.')
  if (kind === 'inventory' || kind === 'reservations') {
    if (status !== 'all') filter.status = status
  } else {
    const conditions = []
    if (status === 'active' || status === 'overdue' || kind === 'overdue')
      conditions.push({ returnedAt: null })
    if (status === 'returned') conditions.push({ returnedAt: { $ne: null } })
    if (status === 'overdue' || kind === 'overdue') conditions.push({ dueAt: { $lt: new Date() } })
    if (conditions.length) filter.$and = conditions
  }
  const search = textSearch(input.q)
  if (search) {
    const books = await Book.distinct('_id', {
      $or: [{ title: search }, { author: search }, { isbn: search }],
    })
    const members =
      kind === 'inventory'
        ? []
        : await User.distinct('_id', { $or: [{ name: search }, { email: search }] })
    filter.$or =
      kind === 'inventory'
        ? [{ book: { $in: books } }, { barcode: search }, { shelf: search }]
        : [{ book: { $in: books } }, { member: { $in: members } }]
  }
  return filter
}
