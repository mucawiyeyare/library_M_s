import { z } from 'zod'
import { requireRecord } from '../../shared/errors.js'
import { Book } from '../inventory/book.model.js'
import { Copy } from '../inventory/copy.model.js'
import { Category } from '../taxonomy/taxonomy.model.js'
import { Content } from '../content/content.model.js'
import { LANGUAGES, pick } from '../../shared/localized.js'
import { User } from '../members/user.model.js'
import { Loan } from '../circulation/loan.model.js'
import { idSchema } from '../../contracts/schemas.js'
export const getList = async (req, res) => {
  const query = z
    .object({
      q: z.string().max(100).default(''),
      genre: z.string().max(80).default(''),
      category: idSchema.optional().or(z.literal('')),
      language: z.enum(['en', 'so', 'ar', 'other']).optional().or(z.literal('')),
      year: z.coerce
        .number()
        .int()
        .min(1000)
        .max(3000)
        .optional()
        .or(z.literal('').transform(() => undefined)),
      lang: z.enum(LANGUAGES).catch('en'),
      sort: z.enum(['title', 'newest']).default('title'),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(12),
      available: z.enum(['true', 'false']).optional(),
    })
    .parse(req.query)
  const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const filter = { archived: false }
  if (escaped)
    filter.$or = ['title', 'author', 'isbn'].map((field) => ({
      [field]: { $regex: escaped, $options: 'i' },
    }))
  if (query.genre) filter.genre = query.genre
  if (query.category) filter.category = query.category
  if (query.language) filter.language = query.language
  if (query.year) filter.year = query.year
  if (query.available === 'true')
    filter._id = { $in: await Copy.distinct('book', { status: 'available' }) }
  const [books, total, genres, categories, languages] = await Promise.all([
    Book.find(filter)
      .sort(query.sort === 'newest' ? { year: -1, title: 1 } : { title: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Book.countDocuments(filter),
    Book.distinct('genre', { archived: false }),
    Category.find({ status: 'active' }).lean(),
    Book.distinct('language', { archived: false }),
  ])
  const categoryNames = new Map(
    categories.map((category) => [String(category._id), pick(category.name, query.lang)]),
  )
  const counts = await Copy.aggregate([
    { $match: { book: { $in: books.map((book) => book._id) }, status: { $ne: 'retired' } } },
    {
      $group: {
        _id: '$book',
        total: { $sum: 1 },
        available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
      },
    },
  ])
  res.json({
    items: books.map((book) => ({
      ...book,
      categoryName: categoryNames.get(String(book.category)) ?? book.genre,
      copies: counts.find((count) => String(count._id) === String(book._id)) ?? {
        total: 0,
        available: 0,
      },
    })),
    total,
    genres,
    categories: categories
      .map((category) => ({ _id: category._id, name: pick(category.name, query.lang) }))
      .sort((a, b) => a.name.localeCompare(b.name, query.lang)),
    languages,
    page: query.page,
    pages: Math.ceil(total / query.limit),
  })
}
export const getId = async (req, res) => {
  const book = requireRecord(
    await Book.findOne({ _id: idSchema.parse(req.params.id), archived: false })
      .populate('publisher', 'name')
      .populate('category', 'name')
      .populate('authors', 'name country')
      .lean(),
  )
  const lang = z.enum(LANGUAGES).catch('en').parse(req.query.lang)
  const copies = await Copy.find({ book: book._id, status: { $ne: 'retired' } }).lean()
  res.json({
    ...book,
    categoryName: book.category ? pick(book.category.name, lang) : book.genre,
    publisherName: book.publisher?.name ?? '',
    copies: {
      total: copies.length,
      available: copies.filter((copy) => copy.status === 'available').length,
    },
    inventory: copies,
  })
}
// Public, aggregate-only figures for the About page (no personal data).
export const getStats = async (_req, res) => {
  const [titles, copies, members, loans, genres] = await Promise.all([
    Book.countDocuments({ archived: false }),
    Copy.countDocuments({ status: { $ne: 'retired' } }),
    User.countDocuments({ role: 'member', status: 'active' }),
    Loan.countDocuments(),
    Book.distinct('genre', { archived: false }),
  ])
  res.json({ titles, copies, members, loans, genres: genres.filter(Boolean).length })
}

// Everything the public home page shows, in one request.
export const getHome = async (req, res) => {
  const lang = z.enum(LANGUAGES).catch('en').parse(req.query.lang)
  const live = { archived: false }
  const [
    featured,
    recent,
    categories,
    titles,
    copies,
    available,
    members,
    services,
    announcements,
  ] = await Promise.all([
    Book.find({ ...live, featured: true })
      .sort({ updatedAt: -1 })
      .limit(4)
      .lean(),
    Book.find(live).sort({ createdAt: -1, _id: -1 }).limit(4).lean(),
    Category.find({ status: 'active' }).lean(),
    Book.countDocuments(live),
    Copy.countDocuments({ status: { $ne: 'retired' } }),
    Copy.countDocuments({ status: 'available' }),
    User.countDocuments({ role: 'member', status: 'active' }),
    Content.find({ kind: 'service', archived: false, published: true })
      .sort({ order: 1, createdAt: 1 })
      .limit(6)
      .lean(),
    Content.find({ kind: { $in: ['news', 'event'] }, archived: false, published: true })
      .sort({ featured: -1, createdAt: -1 })
      .limit(3)
      .lean(),
  ])
  const names = new Map(
    categories.map((category) => [String(category._id), pick(category.name, lang)]),
  )
  const books = [...featured, ...recent]
  const counts = await Copy.aggregate([
    { $match: { book: { $in: books.map((book) => book._id) }, status: { $ne: 'retired' } } },
    {
      $group: {
        _id: '$book',
        total: { $sum: 1 },
        available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
      },
    },
  ])
  const decorate = (book) => ({
    ...book,
    categoryName: names.get(String(book.category)) ?? book.genre,
    copies: counts.find((count) => String(count._id) === String(book._id)) ?? {
      total: 0,
      available: 0,
    },
  })
  const perCategory = await Book.aggregate([
    { $match: { ...live, category: { $ne: null } } },
    { $group: { _id: '$category', books: { $sum: 1 } } },
    { $sort: { books: -1, _id: 1 } },
    { $limit: 8 },
  ])
  res.json({
    featured: featured.map(decorate),
    recent: recent.map(decorate),
    categories: perCategory
      .filter((row) => names.has(String(row._id)))
      .map((row) => ({ _id: row._id, name: names.get(String(row._id)), books: row.books })),
    stats: {
      titles,
      copies,
      available,
      members,
      services: await Content.countDocuments({ kind: 'service', archived: false, published: true }),
    },
    services: services.map((item) => ({
      _id: item._id,
      title: pick(item.title, lang),
      body: pick(item.body, lang),
    })),
    announcements: announcements.map((item) => ({
      _id: item._id,
      kind: item.kind,
      title: pick(item.title, lang),
      body: pick(item.body, lang),
      eventDate: item.eventDate,
      featured: item.featured,
      createdAt: item.createdAt,
    })),
  })
}
