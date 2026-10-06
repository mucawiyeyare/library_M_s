import express from 'express'
import { z } from 'zod'
import { Content, contentKinds } from './content.model.js'
import { Audit } from '../audit/audit.model.js'
import { authenticate, authorize } from '../../shared/middleware/auth.js'
import { ApiError, requireRecord } from '../../shared/errors.js'
import { pagination, sendPage } from '../../shared/pagination.js'
import { idSchema } from '../../contracts/schemas.js'
import { LANGUAGES, pick, missingLanguages } from '../../shared/localized.js'

const kindSchema = z.enum(contentKinds)
const langSchema = z.enum(LANGUAGES).catch('en')
const text = (max) => z.string().trim().max(max).default('')
const localizedInput = (max) => z.object({ en: text(max), so: text(max), ar: text(max) })
const contentInput = z.object({
  kind: kindSchema,
  title: localizedInput(200),
  body: localizedInput(8000),
  eventDate: z.coerce.date().nullable().optional(),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
  order: z.number().int().min(0).max(100000).default(0),
})
// News and events can be managed by librarians; everything else is administrator-only.
const staffKinds = ['news', 'event']
function canManage(user, kind) {
  return user.role === 'admin' || (user.role === 'librarian' && staffKinds.includes(kind))
}
function toPublic(item, lang) {
  return {
    _id: item._id,
    kind: item.kind,
    title: pick(item.title, lang),
    body: pick(item.body, lang),
    eventDate: item.eventDate,
    featured: item.featured,
    createdAt: item.createdAt,
  }
}

export const publicContentRouter = express.Router()
publicContentRouter.get('/:kind', async (req, res) => {
  const kind = kindSchema.parse(req.params.kind)
  const lang = langSchema.parse(req.query.lang)
  const page = pagination(req, 100)
  const filter = { kind, archived: false, published: true }
  const sort =
    kind === 'news' || kind === 'event'
      ? { featured: -1, eventDate: -1, createdAt: -1 }
      : { order: 1, createdAt: 1 }
  const [items, total] = await Promise.all([
    Content.find(filter).sort(sort).skip(page.skip).limit(page.limit).lean(),
    Content.countDocuments(filter),
  ])
  sendPage(
    res,
    items.map((item) => toPublic(item, lang)),
    total,
    page,
  )
})
publicContentRouter.get('/item/:id', async (req, res) => {
  const lang = langSchema.parse(req.query.lang)
  const item = requireRecord(
    await Content.findOne({
      _id: idSchema.parse(req.params.id),
      archived: false,
      published: true,
    }).lean(),
  )
  res.json(toPublic(item, lang))
})

export const staffContentRouter = express.Router()
staffContentRouter.use(authenticate, authorize('admin', 'librarian'))
staffContentRouter.get('/', async (req, res) => {
  const kind = kindSchema.parse(req.query.kind)
  if (!canManage(req.user, kind))
    throw new ApiError(403, 'You do not have permission for this content')
  const page = pagination(req, 100)
  const filter = { kind, archived: false }
  const [items, total] = await Promise.all([
    Content.find(filter).sort({ order: 1, createdAt: -1 }).skip(page.skip).limit(page.limit).lean(),
    Content.countDocuments(filter),
  ])
  sendPage(
    res,
    items.map((item) => ({ ...item, missing: missingLanguages(item.title, item.body) })),
    total,
    page,
  )
})
staffContentRouter.post('/', async (req, res) => {
  const input = contentInput.parse(req.body)
  if (!canManage(req.user, input.kind))
    throw new ApiError(403, 'You do not have permission for this content')
  if (!input.title.en && !input.title.so && !input.title.ar)
    throw new ApiError(400, 'Add a title in at least one language.')
  const item = await Content.create({ ...input, createdBy: req.user.id })
  await Audit.create({
    actor: req.user.id,
    action: `content.${input.kind}.created`,
    entity: String(item._id),
  })
  res.status(201).json(item)
})
staffContentRouter.put('/:id', async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const existing = requireRecord(await Content.findOne({ _id: id, archived: false }))
  const input = contentInput.parse(req.body)
  if (!canManage(req.user, existing.kind) || input.kind !== existing.kind)
    throw new ApiError(403, 'You do not have permission for this content')
  Object.assign(existing, input)
  await existing.save()
  await Audit.create({
    actor: req.user.id,
    action: `content.${existing.kind}.updated`,
    entity: String(id),
  })
  res.json(existing)
})
// Content is archived, not erased, so published history is never silently lost.
staffContentRouter.delete('/:id', async (req, res) => {
  const existing = requireRecord(
    await Content.findOne({ _id: idSchema.parse(req.params.id), archived: false }),
  )
  if (!canManage(req.user, existing.kind))
    throw new ApiError(403, 'You do not have permission for this content')
  existing.archived = true
  await existing.save()
  await Audit.create({
    actor: req.user.id,
    action: `content.${existing.kind}.archived`,
    entity: String(existing._id),
  })
  res.status(204).end()
})
