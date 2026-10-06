import mongoose from 'mongoose'
import { Copy } from '../inventory/copy.model.js'
import { Book } from '../inventory/book.model.js'
import { Notification } from '../notifications/notification.model.js'
import { User } from '../members/user.model.js'
import { queueEmail } from '../email/email.service.js'
import { getPolicy } from '../policies/policy.model.js'
import { notice } from '../../shared/notices.js'
import { Reservation } from './reservation.model.js'

// The first waiting reader becomes READY when a copy is free. A hold period of 0 means
// a ready reservation does not expire; otherwise it expires after that many days.
export async function markNextReady(bookId, session) {
  if (!(await Copy.exists({ book: bookId, status: 'available' }).session(session))) return null
  const hold = await Reservation.findOne({ book: bookId, status: 'waiting', ready: false })
    .sort({ createdAt: 1, _id: 1 })
    .session(session)
  if (!hold) return null
  // A reservation already ready for this title keeps the queue position.
  if (await Reservation.exists({ book: bookId, status: 'waiting', ready: true }).session(session))
    return null
  const policy = await getPolicy()
  hold.ready = true
  hold.readyAt = new Date()
  hold.expiresAt =
    policy.reservationHoldDays > 0
      ? new Date(Date.now() + policy.reservationHoldDays * 86400000)
      : null
  await hold.save({ session })
  const book = await Book.findById(bookId).session(session)
  const ready = notice('reservationReady', { title: book?.title })
  await Notification.create([{ member: hold.member, ...ready }], { session })
  const reader = await User.findById(hold.member).session(session)
  if (reader?.emailVerified)
    await queueEmail(reader.email, 'Your reserved title is ready', ready.message, { session })
  return hold
}

// Expires ready reservations that were not collected in time, then offers the copy to the next reader.
export async function expireReservations() {
  const due = await Reservation.find({
    status: 'waiting',
    ready: true,
    expiresAt: { $ne: null, $lt: new Date() },
  })
  for (const hold of due) {
    await mongoose.connection.transaction(async (session) => {
      const expired = await Reservation.findOneAndUpdate(
        { _id: hold._id, status: 'waiting', ready: true },
        { $set: { status: 'expired' } },
        { session },
      )
      if (!expired) return
      await Notification.create([{ member: hold.member, ...notice('reservationExpired') }], {
        session,
      })
      await Book.updateOne({ _id: hold.book }, { $inc: { circulationVersion: 1 } }, { session })
      await markNextReady(hold.book, session)
    })
  }
  return due.length
}

export function startReservationWorker(intervalMs = 30 * 60 * 1000) {
  const run = () =>
    void expireReservations().catch((error) => console.error('Reservation expiry failed:', error))
  run()
  const timer = setInterval(run, intervalMs)
  timer.unref()
  return () => clearInterval(timer)
}
