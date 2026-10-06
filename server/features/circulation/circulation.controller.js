import { pagination, sendPage } from '../../shared/pagination.js'
import { z } from 'zod'
import { Loan } from './loan.model.js'
import { Audit } from '../audit/audit.model.js'
import { getPolicy } from '../policies/policy.model.js'
import { computeFine, daysLate } from './fines.js'
import { requireRecord } from '../../shared/errors.js'
import { idSchema } from '../../contracts/schemas.js'
import { issueLoan, renewLoan, returnLoan } from './circulation.service.js'
// End of the current day in East Africa Time (UTC+3), the library's time zone.
function endOfToday() {
  const local = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10)
  return new Date(`${local}T23:59:59.999+03:00`)
}
export const getList = async (req, res) => {
  const page = pagination(req, 250)
  const filter = {
    ...(req.user.role === 'member' || req.query.scope === 'mine' ? { member: req.user.id } : {}),
    ...(req.query.status === 'active'
      ? { returnedAt: null }
      : req.query.status === 'overdue'
        ? { returnedAt: null, dueAt: { $lt: new Date() } }
        : req.query.status === 'due-today'
          ? { returnedAt: null, dueAt: { $gte: new Date(), $lte: endOfToday() } }
          : {}),
  }
  const policy = await getPolicy()
  const [rows, total] = await Promise.all([
    Loan.find(filter)
      .populate('book', 'title author')
      .populate('member', 'name email')
      .populate('copy', 'barcode shelf')
      .sort({ createdAt: -1, _id: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .lean(),
    Loan.countDocuments(filter),
  ])
  // Overdue loans carry their days late and the fine they would incur if returned now.
  const items = rows.map((loan) =>
    loan.returnedAt || new Date(loan.dueAt) >= new Date()
      ? loan
      : {
          ...loan,
          daysOverdue: daysLate(loan.dueAt),
          projectedFine: computeFine(loan.dueAt, policy).amount,
        },
  )
  sendPage(res, items, total, page)
}
export const postList = async (req, res) => {
  const input = z
    .object({
      memberId: idSchema,
      copyId: idSchema,
      returnDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    })
    .parse(req.body)
  res.status(201).json(await issueLoan(input.memberId, input.copyId, req.user.id, input.returnDate))
}
export const postIdReturn = async (req, res) => {
  const input = z
    .object({
      condition: z.enum(['good', 'damaged', 'lost']).default('good'),
      notes: z.string().trim().max(500).default(''),
    })
    .parse(req.body ?? {})
  const result = await returnLoan(idSchema.parse(req.params.id), req.user.id, input)
  res.json({
    ...result,
    message: result.fine
      ? `Return recorded. A fine of ${result.fine.amount} was created (${result.late} days late).`
      : input.condition === 'lost'
        ? 'Recorded as lost.'
        : 'Book returned.',
  })
}
// Staff note what they did to chase an overdue loan (call, message, visit).
export const postIdFollowUp = async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const { note } = z.object({ note: z.string().trim().min(3).max(500) }).parse(req.body)
  const loan = requireRecord(
    await Loan.findOneAndUpdate(
      { _id: id, returnedAt: null },
      { $push: { followUps: { note, by: req.user.id } } },
      { returnDocument: 'after' },
    ),
    'Active loan not found',
  )
  await Audit.create({ actor: req.user.id, action: 'loan.followup', entity: id })
  res.json({ message: 'Follow-up recorded.', followUps: loan.followUps })
}
export const postIdRenew = async (req, res) =>
  res.json(await renewLoan(idSchema.parse(req.params.id), req.user.id, req.user.role === 'member'))
