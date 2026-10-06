import express from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { Fine } from './fine.model.js'
import { notice } from '../../shared/notices.js'
import { Audit } from '../audit/audit.model.js'
import { Notification } from '../notifications/notification.model.js'
import { authenticate, authorize } from '../../shared/middleware/auth.js'
import { ApiError, requireRecord } from '../../shared/errors.js'
import { pagination, sendPage } from '../../shared/pagination.js'
import { idSchema } from '../../contracts/schemas.js'

const router = express.Router()
router.use(authenticate)
const staff = authorize('admin', 'librarian')
const statuses = ['outstanding', 'partially_paid', 'paid', 'waived']

// Members only ever see their own fines; staff see everyone's.
router.get('/', async (req, res) => {
  const page = pagination(req, 250)
  const { status } = z.object({ status: z.enum(statuses).optional() }).parse(req.query)
  const mine = req.user.role === 'member' || req.query.scope === 'mine'
  const filter = { ...(mine ? { member: req.user.id } : {}), ...(status ? { status } : {}) }
  const [items, total] = await Promise.all([
    Fine.find(filter)
      .populate('member', 'name email')
      .populate({
        path: 'loan',
        select: 'book dueAt returnedAt',
        populate: { path: 'book', select: 'title' },
      })
      .sort({ createdAt: -1, _id: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .lean(),
    Fine.countDocuments(filter),
  ])
  sendPage(res, items, total, page)
})

router.get('/summary', authorize('admin', 'librarian', 'director'), async (_req, res) => {
  const rows = await Fine.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        amount: { $sum: '$amount' },
        paid: { $sum: '$paid' },
      },
    },
  ])
  const total = (status, field) => rows.find((row) => row._id === status)?.[field] ?? 0
  const outstanding = rows
    .filter((row) => ['outstanding', 'partially_paid'].includes(row._id))
    .reduce((sum, row) => sum + row.amount - row.paid, 0)
  res.json({
    collected: rows.reduce((sum, row) => sum + row.paid, 0),
    outstanding: Math.round(outstanding * 100) / 100,
    waived: total('waived', 'amount'),
    count: rows.reduce((sum, row) => sum + row.count, 0),
  })
})

const owed = (fine) => Math.round((fine.amount - fine.paid) * 100) / 100

router.post('/:id/payment', staff, async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const input = z
    .object({
      amount: z.coerce.number().positive().max(1000000),
      note: z.string().trim().max(300).default(''),
    })
    .parse(req.body)
  await mongoose.connection.transaction(async (session) => {
    const fine = requireRecord(await Fine.findById(id).session(session))
    if (['paid', 'waived'].includes(fine.status))
      throw new ApiError(409, 'This fine is already settled.')
    if (input.amount > owed(fine) + 0.001)
      throw new ApiError(400, `The payment is more than the amount owed (${owed(fine)}).`)
    fine.paid = Math.round((fine.paid + input.amount) * 100) / 100
    fine.status = owed(fine) <= 0 ? 'paid' : 'partially_paid'
    fine.history.push({
      action: 'payment',
      amount: input.amount,
      note: input.note,
      by: req.user.id,
    })
    await fine.save({ session })
    await Audit.create([{ actor: req.user.id, action: 'fine.payment', entity: id }], { session })
  })
  res.json({ message: 'Payment recorded.' })
})

router.post('/:id/waive', staff, async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const { note } = z.object({ note: z.string().trim().min(3).max(300) }).parse(req.body)
  await mongoose.connection.transaction(async (session) => {
    const fine = requireRecord(await Fine.findById(id).session(session))
    if (['paid', 'waived'].includes(fine.status))
      throw new ApiError(409, 'This fine is already settled.')
    fine.history.push({ action: 'waiver', amount: owed(fine), note, by: req.user.id })
    fine.status = 'waived'
    await fine.save({ session })
    await Notification.create([{ member: fine.member, ...notice('fineWaived') }], { session })
    await Audit.create([{ actor: req.user.id, action: 'fine.waived', entity: id }], { session })
  })
  res.json({ message: 'Fine waived.' })
})

export default router
