import { z } from 'zod'
export function pagination(req, legacyLimit = 100) {
  const query = z
    .object({
      page: z.coerce.number().int().min(1).max(1000000).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    })
    .parse(req.query)
  const paginated = req.query.page !== undefined || req.query.limit !== undefined
  return {
    page: query.page,
    limit: paginated ? query.limit : legacyLimit,
    skip: paginated ? (query.page - 1) * query.limit : 0,
    paginated,
  }
}
export function sendPage(res, items, total, page) {
  res.json(
    page.paginated
      ? {
          items,
          total,
          page: page.page,
          limit: page.limit,
          pages: Math.max(1, Math.ceil(total / page.limit)),
        }
      : items,
  )
}
export function textSearch(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const escaped = [...value.trim().slice(0, 100)]
    .map((character) => ('.+*?^$()[]{}|\\'.includes(character) ? '\\' + character : character))
    .join('')
  return new RegExp(escaped, 'i')
}
