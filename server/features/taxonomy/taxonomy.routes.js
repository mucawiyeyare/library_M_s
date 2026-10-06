import express from 'express'
import { z } from 'zod'
import { Author, Category, Publisher, nameKey } from './taxonomy.model.js'
import { Book } from '../inventory/book.model.js'
import { Audit } from '../audit/audit.model.js'
import { authenticate, authorize } from '../../shared/middleware/auth.js'
import { ApiError, requireRecord } from '../../shared/errors.js'
import { pagination, sendPage, textSearch } from '../../shared/pagination.js'
import { idSchema } from '../../contracts/schemas.js'
import { LANGUAGES, pick } from '../../shared/localized.js'

const text = (max) => z.string().trim().max(max).default('')
const localized = (max) => z.object({ en: text(max), so: text(max), ar: text(max) })
const hasText = (value) => Object.values(value).some(Boolean)

const categorySchema = z.object({
  name: localized(100).refine(hasText, 'Add a name in at least one language.'),
  description: localized(1000),
  status: z.enum(['active', 'inactive']).default('active'),
})
const authorSchema = z.object({
  name: z.string().trim().min(1).max(150),
  biography: text(3000),
  country: text(80),
})
const publisherSchema = z.object({
  name: z.string().trim().min(1).max(150),
  contact: text(300),
})

// Which Book field points at each collection (used for "books associated with ...").
const definitions = {
  categories: {
    model: Category,
    schema: categorySchema,
    bookField: 'category',
    archiveField: 'status',
  },
  authors: { model: Author, schema: authorSchema, bookField: 'authors' },
  publishers: { model: Publisher, schema: publisherSchema, bookField: 'publisher' },
}

async function bookCounts(field, ids) {
  const rows = await Book.aggregate([
    { $match: { archived: false, [field]: { $in: ids } } },
    ...(field === 'authors'
      ? [{ $unwind: '$authors' }, { $match: { authors: { $in: ids } } }]
      : []),
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  ])
  return new Map(rows.map((row) => [String(row._id), row.count]))
}

function withKey(kind, data) {
  return kind === 'categories' ? data : { ...data, nameKey: nameKey(data.name) }
}

export const staffTaxonomyRouter = express.Router()
staffTaxonomyRouter.use(authenticate, authorize('admin', 'librarian'))
for (const [kind, def] of Object.entries(definitions)) {
  const base = `/${kind}`
  const archivedFilter = def.archiveField ? { status: 'active' } : { archived: false }
  staffTaxonomyRouter.get(base, async (req, res) => {
    const page = pagination(req, 500)
    const search = textSearch(req.query.q)
    const showAll = req.query.all === 'true'
    const filter = {
      ...(showAll ? {} : archivedFilter),
      ...(search ? { [kind === 'categories' ? 'name.en' : 'name']: search } : {}),
    }
    const [items, total] = await Promise.all([
      def.model
        .find(filter)
        .sort(kind === 'categories' ? { 'name.en': 1, _id: 1 } : { name: 1, _id: 1 })
        .skip(page.skip)
        .limit(page.limit)
        .lean(),
      def.model.countDocuments(filter),
    ])
    const counts = await bookCounts(
      def.bookField,
      items.map((item) => item._id),
    )
    sendPage(
      res,
      items.map((item) => ({ ...item, bookCount: counts.get(String(item._id)) ?? 0 })),
      total,
      page,
    )
  })
  staffTaxonomyRouter.post(base, async (req, res) => {
    const data = withKey(kind, def.schema.parse(req.body))
    try {
      const item = await def.model.create(data)
      await Audit.create({
        actor: req.user.id,
        action: `${kind}.created`,
        entity: String(item._id),
      })
      res.status(201).json(item)
    } catch (error) {
      if (error.code === 11000) throw new ApiError(409, 'This name already exists.')
      throw error
    }
  })
  staffTaxonomyRouter.put(`${base}/:id`, async (req, res) => {
    const id = idSchema.parse(req.params.id)
    const data = withKey(kind, def.schema.parse(req.body))
    try {
      const item = requireRecord(
        await def.model.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' }),
      )
      // Keep the book display strings in step with a renamed author or category.
      if (kind === 'authors') await refreshAuthorStrings(id)
      if (kind === 'categories')
        await Book.updateMany({ category: id }, { $set: { genre: pick(item.name, 'en') } })
      await Audit.create({ actor: req.user.id, action: `${kind}.updated`, entity: id })
      res.json(item)
    } catch (error) {
      if (error.code === 11000) throw new ApiError(409, 'This name already exists.')
      throw error
    }
  })
  // Archived, never erased: books and loan history keep their references.
  staffTaxonomyRouter.delete(`${base}/:id`, async (req, res) => {
    const id = idSchema.parse(req.params.id)
    requireRecord(
      await def.model.findByIdAndUpdate(id, {
        $set: def.archiveField ? { status: 'inactive' } : { archived: true },
      }),
    )
    await Audit.create({ actor: req.user.id, action: `${kind}.archived`, entity: id })
    res.status(204).end()
  })
}

async function refreshAuthorStrings(authorId) {
  for (const book of await Book.find({ authors: authorId }).populate('authors', 'name')) {
    await Book.updateOne(
      { _id: book._id },
      { $set: { author: book.authors.map((author) => author.name).join(', ') } },
    )
  }
}

export const publicTaxonomyRouter = express.Router()
publicTaxonomyRouter.get('/categories', async (req, res) => {
  const lang = z.enum(LANGUAGES).catch('en').parse(req.query.lang)
  const categories = await Category.find({ status: 'active' }).lean()
  res.json(
    categories
      .map((category) => ({
        _id: category._id,
        name: pick(category.name, lang),
        description: pick(category.description, lang),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, lang)),
  )
})
