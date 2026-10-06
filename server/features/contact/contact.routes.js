import { pagination, sendPage } from '../../shared/pagination.js'
import mongoose from 'mongoose'
import { queueEmail } from '../email/email.service.js'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { ContactMessage } from './contact.model.js'
import { authenticate, authorize } from '../../shared/middleware/auth.js'
import { requireRecord } from '../../shared/errors.js'
import { idSchema } from '../../contracts/schemas.js'
const input = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  subject: z.enum(['Borrowing', 'Membership', 'Reservations', 'Other']),
  message: z.string().trim().min(10).max(3000),
})
export const contactRouter = express.Router()
contactRouter.post(
  '/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many messages. Please try again later.' },
  }),
  async (req, res) => {
    await ContactMessage.create(input.parse(req.body))
    res.status(201).json({ message: 'Your message has been sent to the library team.' })
  },
)
export const staffContactRouter = express.Router()
staffContactRouter.use(authenticate, authorize('admin', 'librarian'))
staffContactRouter.get('/', async (req, res) => {
  const page = pagination(req, 100)
  const [items, total] = await Promise.all([
    ContactMessage.find().sort({ createdAt: -1, _id: -1 }).skip(page.skip).limit(page.limit).lean(),
    ContactMessage.countDocuments(),
  ])
  sendPage(res, items, total, page)
})
staffContactRouter.patch('/:id', async (req, res) => {
  const { status } = z.object({ status: z.enum(['new', 'handled']) }).parse(req.body)
  res.json(
    requireRecord(
      await ContactMessage.findByIdAndUpdate(
        idSchema.parse(req.params.id),
        { $set: { status } },
        { returnDocument: 'after' },
      ),
    ),
  )
})
staffContactRouter.post('/:id/reply', async (req, res) => {
  const { message } = z.object({ message: z.string().trim().min(10).max(3000) }).parse(req.body)
  await mongoose.connection.transaction(async (session) => {
    const contact = requireRecord(
      await ContactMessage.findById(idSchema.parse(req.params.id)).session(session),
    )
    await queueEmail(contact.email, `Re: ${contact.subject}`, message, { session })
    await ContactMessage.updateOne(
      { _id: contact._id },
      { $set: { reply: message, repliedAt: new Date(), status: 'handled' } },
      { session },
    )
  })
  res.json({ message: 'Your reply has been queued for email delivery.' })
})
