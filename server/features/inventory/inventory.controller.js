import { pagination, sendPage, textSearch } from '../../shared/pagination.js'
import mongoose from 'mongoose'
import { z } from 'zod'
import { ApiError, requireRecord } from '../../shared/errors.js'
import { Audit } from '../audit/audit.model.js'
import { Book } from './book.model.js'
import { Copy } from './copy.model.js'
import { Loan } from '../circulation/loan.model.js'
import { Reservation } from '../reservations/reservation.model.js'
import { markNextReady } from '../reservations/reservation.service.js'
import { resolveBookInput } from '../taxonomy/book-links.js'
import { bookSchema, copySchema, idSchema } from '../../contracts/schemas.js'
export const getBooks = async (req, res) => {
  const page = pagination(req, 500),
    search = textSearch(req.query.q)
  const filter = search ? { $or: [{ title: search }, { author: search }, { isbn: search }] } : {}
  const [items, total] = await Promise.all([
    Book.find(filter).sort({ title: 1, _id: 1 }).skip(page.skip).limit(page.limit).lean(),
    Book.countDocuments(filter),
  ])
  sendPage(res, items, total, page)
}
export const postBooks = async (req, res) => {
  const input = bookSchema.parse(req.body)
  const book = await mongoose.connection.transaction(async (session) => {
    const [created] = await Book.create([await resolveBookInput(input, session)], { session })
    await Audit.create(
      [{ actor: req.user.id, action: 'book.created', entity: String(created._id) }],
      { session },
    )
    return created
  })
  res.status(201).json(book)
}
export const patchBooksId = async (req, res) => {
  const id = idSchema.parse(req.params.id),
    input = bookSchema.parse(req.body)
  const book = await mongoose.connection.transaction(async (session) => {
    const updated = requireRecord(
      await Book.findByIdAndUpdate(
        id,
        { $set: await resolveBookInput(input, session), $inc: { circulationVersion: 1 } },
        { returnDocument: 'after', session },
      ),
    )
    if (
      input.archived &&
      ((await Loan.exists({ book: id, returnedAt: null }).session(session)) ||
        (await Reservation.exists({ book: id, status: 'waiting' }).session(session)))
    )
      throw new ApiError(409, 'Resolve active loans and reservations before archiving')
    await Audit.create(
      [
        {
          actor: req.user.id,
          action: input.archived ? 'book.archived' : 'book.updated',
          entity: id,
        },
      ],
      { session },
    )
    return updated
  })
  res.json(book)
}
export const getCopies = async (req, res) => {
  const page = pagination(req, 1000),
    search = textSearch(req.query.q)
  const books = search
    ? await Book.find({ $or: [{ title: search }, { author: search }] }).distinct('_id')
    : []
  const filter = {
    ...(req.query.book ? { book: idSchema.parse(req.query.book) } : {}),
    ...(req.query.status === 'available' ? { status: 'available' } : {}),
    ...(search ? { $or: [{ barcode: search }, { shelf: search }, { book: { $in: books } }] } : {}),
  }
  const [items, total] = await Promise.all([
    Copy.find(filter)
      .populate('book', 'title')
      .sort({ barcode: 1, _id: 1 })
      .skip(page.skip)
      .limit(page.limit)
      .lean(),
    Copy.countDocuments(filter),
  ])
  sendPage(res, items, total, page)
}
export const postBooksIdCopies = async (req, res) => {
  const id = idSchema.parse(req.params.id),
    input = copySchema.parse(req.body)
  const copy = await mongoose.connection.transaction(async (session) => {
    requireRecord(
      await Book.findOneAndUpdate(
        { _id: id, archived: false },
        { $inc: { circulationVersion: 1 } },
        { session, returnDocument: 'after' },
      ),
    )
    const [created] = await Copy.create([{ ...input, book: id }], { session })
    await Audit.create(
      [{ actor: req.user.id, action: 'copy.created', entity: String(created._id) }],
      { session },
    )
    return created
  })
  res.status(201).json(copy)
}
export const patchCopiesId = async (req, res) => {
  const id = idSchema.parse(req.params.id),
    input = z
      .object({
        shelf: z.string().trim().min(1).max(80),
        status: z.enum(['available', 'retired', 'damaged', 'lost']),
      })
      .parse(req.body)
  const copy = await mongoose.connection.transaction(async (session) => {
    const changed = requireRecord(
      await Copy.findOneAndUpdate({ _id: id, status: { $ne: 'on_loan' } }, input, {
        returnDocument: 'after',
        session,
      }),
      'Return the copy before changing its status',
    )
    await Book.updateOne({ _id: changed.book }, { $inc: { circulationVersion: 1 } }, { session })
    if (changed.status === 'available') await markNextReady(changed.book, session)
    await Audit.create([{ actor: req.user.id, action: 'copy.updated', entity: id }], { session })
    return changed
  })
  res.json(copy)
}
