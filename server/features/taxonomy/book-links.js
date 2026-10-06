import { ApiError } from '../../shared/errors.js'
import { pick } from '../../shared/localized.js'
import { Book } from '../inventory/book.model.js'
import { Author, Category, nameKey } from './taxonomy.model.js'

// Finds or creates an Author record for each comma-separated name.
export async function authorIdsFor(names, session) {
  const ids = []
  for (const raw of names.split(',')) {
    const name = raw.trim().replace(/\s+/g, ' ')
    if (!name) continue
    const author = await Author.findOneAndUpdate(
      { nameKey: nameKey(name) },
      { $setOnInsert: { name, nameKey: nameKey(name) } },
      { upsert: true, returnDocument: 'after', session },
    )
    ids.push(author._id)
  }
  return ids
}

// Turns form input into book fields: links authors and category, and keeps the display
// strings (`author`, `genre`) in step so search and existing screens keep working.
export async function resolveBookInput(input, session) {
  const fields = { ...input, authors: await authorIdsFor(input.author, session) }
  if (input.category) {
    const category = await Category.findById(input.category).session(session)
    if (!category || category.status !== 'active')
      throw new ApiError(400, 'Choose an active category.')
    fields.genre = pick(category.name, 'en')
  } else {
    fields.category = null
  }
  fields.publisher = input.publisher || null
  return fields
}

// Idempotent upgrade for books created before categories and authors were records.
export async function linkCatalogReferences() {
  if (!(await Book.exists({ category: null, genre: { $nin: ['', null] } }))) return
  const genres = await Book.distinct('genre', { category: null, genre: { $nin: ['', null] } })
  for (const genre of genres) {
    let category = await Category.findOne({ 'name.en': genre })
    category ??= await Category.create({ name: { en: genre } })
    await Book.updateMany({ category: null, genre }, { $set: { category: category._id } })
  }
  for (const book of await Book.find({ 'authors.0': { $exists: false } })
    .select('author')
    .lean()) {
    const ids = await authorIdsFor(book.author ?? '')
    if (ids.length) await Book.updateOne({ _id: book._id }, { $set: { authors: ids } })
  }
}
