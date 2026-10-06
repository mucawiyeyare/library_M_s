import { User } from '../members/user.model.js'
import { queueEmail } from '../email/email.service.js'
import { pagination, sendPage } from '../../shared/pagination.js'
import mongoose from 'mongoose'
import { z } from 'zod'
import { requireRecord } from '../../shared/errors.js'
import { Audit } from '../audit/audit.model.js'
import { Book } from '../inventory/book.model.js'
import { Reservation } from './reservation.model.js'
import { markNextReady } from './reservation.service.js'
import { idSchema } from '../../contracts/schemas.js'
export const getList = async (req, res) => {
  const page = pagination(req, 250)
  const filter = {
    ...(req.user.role === 'member' || req.query.scope === 'mine' ? { member: req.user.id } : {}),
    ...(req.query.status === 'waiting' ? { status: 'waiting' } : {}),
  }
  const [items, total] = await Promise.all([
    Reservation.find(filter)
      .populate('book', 'title author')
      .populate('member', 'name email')
      .sort({ createdAt: 1, _id: 1 })
      .skip(page.skip)
      .limit(page.limit)
      .lean(),
    Reservation.countDocuments(filter),
  ])
  sendPage(res, items, total, page)
}
export const postList = async (req, res) => {
  const { bookId } = z.object({ bookId: idSchema }).parse(req.body)
  const reservation = await mongoose.connection.transaction(async (session) => {
    requireRecord(
      await Book.findOneAndUpdate(
        { _id: bookId, archived: false },
        { $inc: { circulationVersion: 1 } },
        { returnDocument: 'after', session },
      ),
      'Title unavailable',
    )
    const [hold] = await Reservation.create([{ book: bookId, member: req.user.id }], { session })
    await Audit.create(
      [{ actor: req.user.id, action: 'reservation.created', entity: String(hold._id) }],
      { session },
    )
    const reader = await User.findById(req.user.id).session(session)
    if (reader?.emailVerified)
      await queueEmail(
        reader.email,
        'Library reservation received',
        'Your reservation is recorded. Track it in My library; staff will issue a physical copy when it is your turn.',
        { session },
      )
    return hold
  })
  res.status(201).json(reservation)
}
export const postIdCancel = async (req, res) => {
  const id = idSchema.parse(req.params.id)
  await mongoose.connection.transaction(async (session) => {
    const hold = requireRecord(
      await Reservation.findOneAndUpdate(
        {
          _id: id,
          status: 'waiting',
          ...(req.user.role === 'member' || req.query.scope === 'mine'
            ? { member: req.user.id }
            : {}),
        },
        { status: 'cancelled' },
        { returnDocument: 'after', session },
      ),
    )
    await Book.updateOne({ _id: hold.book }, { $inc: { circulationVersion: 1 } }, { session })
    if (hold.ready) await markNextReady(hold.book, session)
    await Audit.create([{ actor: req.user.id, action: 'reservation.cancelled', entity: id }], {
      session,
    })
    const reader = await User.findById(hold.member).session(session)
    if (reader?.emailVerified)
      await queueEmail(
        reader.email,
        'Library reservation cancelled',
        'Your reservation has been cancelled.',
        { session },
      )
  })
  res.status(204).end()
}
