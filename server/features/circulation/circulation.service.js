import { queueEmail } from '../email/email.service.js'
import mongoose from 'mongoose'
import { Audit } from '../audit/audit.model.js'
import { Book } from '../inventory/book.model.js'
import { Copy } from '../inventory/copy.model.js'
import { Loan } from './loan.model.js'
import { Notification } from '../notifications/notification.model.js'
import { Reservation } from '../reservations/reservation.model.js'
import { User } from '../members/user.model.js'
import { getPolicy } from '../policies/policy.model.js'
import { notice } from '../../shared/notices.js'
import { Fine } from '../fines/fine.model.js'
import { computeFine } from './fines.js'
import { markNextReady } from '../reservations/reservation.service.js'
import { ApiError, requireRecord } from '../../shared/errors.js'
// `returnDate` (YYYY-MM-DD) is the date the librarian picked; without it the policy's
// loan period applies. The borrow time itself is always set by the system.
export function dueDateFor(returnDate, policy, now = new Date()) {
  if (!returnDate) return new Date(now.getTime() + policy.loanDays * 86400000)
  // Due at the end of the chosen day (East Africa Time, UTC+3).
  const due = new Date(`${returnDate}T23:59:59+03:00`)
  if (!Number.isFinite(due.getTime()) || due.toISOString().slice(0, 10) > returnDate)
    throw new ApiError(400, 'Choose a valid return date.')
  if (due <= now) throw new ApiError(400, 'The return date must be after today.')
  if (due.getTime() - now.getTime() > 365 * 86400000)
    throw new ApiError(400, 'The return date must be within one year.')
  return due
}
export async function issueLoan(memberId, copyId, actorId, returnDate) {
  const policy = await getPolicy()
  const dueAt = dueDateFor(returnDate, policy)
  return mongoose.connection.transaction(async (session) => {
    const member = requireRecord(
      await User.findOneAndUpdate(
        { _id: memberId, status: 'active' },
        { $inc: { circulationVersion: 1 } },
        { returnDocument: 'after', session },
      ),
      'Active member not found',
    )
    if (
      (await Loan.countDocuments({ member: member._id, returnedAt: null }).session(session)) >=
      policy.maxLoans
    )
      throw new ApiError(409, 'This member has reached the borrowing limit')
    if (
      await Loan.exists({
        member: member._id,
        returnedAt: null,
        dueAt: { $lt: new Date() },
      }).session(session)
    )
      throw new ApiError(409, 'Return overdue books before borrowing again')
    const copy = requireRecord(
      await Copy.findOneAndUpdate(
        { _id: copyId, status: 'available' },
        { $set: { status: 'on_loan' } },
        { returnDocument: 'after', session },
      ),
      'This copy is unavailable',
    )
    const book = requireRecord(
      await Book.findOneAndUpdate(
        { _id: copy.book, archived: false },
        { $inc: { circulationVersion: 1 } },
        { session, returnDocument: 'after' },
      ),
      'This title is archived',
    )
    const firstHold = await Reservation.findOne({ book: book._id, status: 'waiting' })
      .sort({ createdAt: 1, _id: 1 })
      .session(session)
    if (firstHold && String(firstHold.member) !== memberId)
      throw new ApiError(409, 'This title is reserved for another member')
    if (firstHold) {
      firstHold.status = 'fulfilled'
      await firstHold.save({ session })
    }
    const [loan] = await Loan.create(
      [
        {
          member: member._id,
          copy: copy._id,
          book: book._id,
          dueAt,
        },
      ],
      { session },
    )
    await Audit.create([{ actor: actorId, action: 'loan.issued', entity: String(loan._id) }], {
      session,
    })
    await Notification.create(
      [
        {
          member: memberId,
          ...notice('borrowed', { title: book.title, due: loan.dueAt.toISOString().slice(0, 10) }),
        },
      ],
      { session },
    )
    if (member.emailVerified)
      await queueEmail(
        member.email,
        'Your library loan',
        `You borrowed ${book.title}. Due ${loan.dueAt.toISOString().slice(0, 10)}.`,
        { session },
      )
    return loan
  })
}
const copyStatusFor = { good: 'available', damaged: 'damaged', lost: 'lost' }
export async function returnLoan(loanId, actorId, { condition = 'good', notes = '' } = {}) {
  const policy = await getPolicy()
  return mongoose.connection.transaction(async (session) => {
    const returnedAt = new Date()
    const loan = requireRecord(
      await Loan.findOneAndUpdate(
        { _id: loanId, returnedAt: null },
        {
          $set: {
            returnedAt,
            returnCondition: condition,
            returnNotes: notes,
            processedBy: actorId,
            outcome: condition === 'lost' ? 'lost' : 'returned',
          },
        },
        { session, returnDocument: 'after' },
      ),
      'Active loan not found',
    )
    await Copy.updateOne(
      { _id: loan.copy },
      { $set: { status: copyStatusFor[condition] } },
      { session },
    )
    // A late return creates a fine only when the library has configured fines.
    const { late, amount } = computeFine(loan.dueAt, policy, returnedAt)
    let fine = null
    if (amount > 0) {
      ;[fine] = await Fine.create(
        [{ member: loan.member, loan: loan._id, amount, daysOverdue: late }],
        { session },
      )
      await Audit.create([{ actor: actorId, action: 'fine.recorded', entity: String(fine._id) }], {
        session,
      })
      await Notification.create(
        [
          {
            member: loan.member,
            ...notice('fineRecorded', { amount, currency: policy.currency, days: late }),
          },
        ],
        { session },
      )
    }
    await Book.updateOne({ _id: loan.book }, { $inc: { circulationVersion: 1 } }, { session })
    await User.updateOne({ _id: loan.member }, { $inc: { circulationVersion: 1 } }, { session })
    await markNextReady(loan.book, session)
    await Audit.create(
      [
        {
          actor: actorId,
          action: condition === 'lost' ? 'loan.lost' : 'loan.returned',
          entity: loanId,
        },
      ],
      { session },
    )
    const reader = await User.findById(loan.member).session(session)
    if (reader?.emailVerified)
      await queueEmail(
        reader.email,
        'Library return recorded',
        'Your book return has been recorded. Thank you.',
        { session },
      )
    return { ...loan.toObject(), fine: fine?.toObject() ?? null, late }
  })
}
export async function renewLoan(loanId, actorId, memberOnly) {
  const policy = await getPolicy()
  return mongoose.connection.transaction(async (session) => {
    const loan = requireRecord(
      await Loan.findOne({
        _id: loanId,
        returnedAt: null,
        ...(memberOnly ? { member: actorId } : {}),
      }).session(session),
      'Active loan not found',
    )
    await Book.updateOne({ _id: loan.book }, { $inc: { circulationVersion: 1 } }, { session })
    if (loan.dueAt < new Date()) throw new ApiError(409, 'Overdue loans cannot be renewed')
    if (loan.renewals >= policy.maxRenewals) throw new ApiError(409, 'Renewal limit reached')
    if (await Reservation.exists({ book: loan.book, status: 'waiting' }).session(session))
      throw new ApiError(409, 'Another reader has reserved this title')
    loan.dueAt = new Date(loan.dueAt.getTime() + policy.renewalDays * 86400000)
    loan.renewals = loan.renewals + 1
    await loan.save({ session })
    await Audit.create([{ actor: actorId, action: 'loan.renewed', entity: loanId }], { session })
    const reader = await User.findById(loan.member).session(session)
    if (reader?.emailVerified)
      await queueEmail(
        reader.email,
        'Library loan renewed',
        `Your loan was renewed. New due date: ${loan.dueAt.toISOString().slice(0, 10)}.`,
        { session },
      )
    return loan
  })
}
