import { randomBytes } from 'node:crypto'
import express from 'express'
import rateLimit from 'express-rate-limit'
import mongoose, { Schema } from 'mongoose'
import * as argon2 from '@node-rs/argon2'
import { z } from 'zod'
import { authenticate, authorize } from '../../shared/middleware/auth.js'
import { pagination, sendPage } from '../../shared/pagination.js'
import { ApiError, requireRecord } from '../../shared/errors.js'
import { idSchema } from '../../contracts/schemas.js'
import { User } from '../members/user.model.js'
import { Audit } from '../audit/audit.model.js'
import { Notification } from '../notifications/notification.model.js'
import { queueEmail } from '../email/email.service.js'
import { sendSecurityLink } from '../auth/recovery.controller.js'
import { message } from '../../shared/messages.js'
import { notice } from '../../shared/notices.js'
import { LANGUAGES } from '../../shared/localized.js'

// Membership applications start PENDING; a librarian approves (creating the member account) or rejects.
export const Application = mongoose.model(
  'Application',
  new Schema(
    {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, default: '' },
      address: { type: String, default: '' },
      dateOfBirth: { type: Date, default: null },
      preferredContact: { type: String, enum: ['email', 'phone'], default: 'phone' },
      lang: { type: String, enum: LANGUAGES, default: 'en' },
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      reviewedAt: { type: Date, default: null },
      reason: { type: String, default: '' },
      member: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    },
    { timestamps: true },
  ),
)
Application.schema.index({ status: 1, createdAt: -1 })

const input = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(5).max(30),
  email: z.union([z.literal(''), z.string().trim().email().max(254).toLowerCase()]).default(''),
  address: z.string().trim().max(200).default(''),
  dateOfBirth: z.union([z.literal(''), z.coerce.date()]).optional(),
  preferredContact: z.enum(['email', 'phone']).default('phone'),
  lang: z.enum(LANGUAGES).catch('en'),
})

export const publicApplicationRouter = express.Router()
publicApplicationRouter.post(
  '/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many applications. Please try again later.' },
  }),
  async (req, res) => {
    const data = input.parse(req.body)
    const application = await Application.create({
      ...data,
      dateOfBirth: data.dateOfBirth || null,
    })
    res.status(201).json({ status: application.status, reference: String(application._id) })
  },
)
// Applicants can check progress with their reference; only the status is revealed.
publicApplicationRouter.get('/:reference', async (req, res) => {
  const application = requireRecord(
    await Application.findById(idSchema.parse(req.params.reference)).select('status').lean(),
  )
  res.json({ status: application.status })
})

export const staffApplicationRouter = express.Router()
staffApplicationRouter.use(authenticate, authorize('admin', 'librarian'))
staffApplicationRouter.get('/', async (req, res) => {
  const page = pagination(req, 100)
  const filter = z
    .object({ status: z.enum(['pending', 'approved', 'rejected']).optional() })
    .parse(req.query)
  const query = filter.status ? { status: filter.status } : {}
  const [items, total] = await Promise.all([
    Application.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .lean(),
    Application.countDocuments(query),
  ])
  sendPage(res, items, total, page)
})

// Claims a pending application atomically so two staff members cannot both review it.
const claim = (id, session, update) =>
  Application.findOneAndUpdate({ _id: id, status: 'pending' }, update, {
    session,
    returnDocument: 'after',
  })

staffApplicationRouter.post('/:id/approve', async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const { email: staffEmail } = z
    .object({ email: z.string().trim().email().max(254).toLowerCase().optional() })
    .parse(req.body ?? {})
  await mongoose.connection.transaction(async (session) => {
    const application = await claim(id, session, {
      $set: { status: 'approved', reviewedBy: req.user.id, reviewedAt: new Date() },
    })
    if (!application) throw new ApiError(409, 'This application was already reviewed.')
    const email = staffEmail || application.email
    if (!email)
      throw new ApiError(400, 'Enter an email address to create the member’s sign-in account.')
    if (await User.exists({ email }).session(session))
      throw new ApiError(409, 'A member with this email already exists.')
    const [member] = await User.create(
      [
        {
          role: 'member',
          name: application.fullName,
          email,
          lang: application.lang,
          // Unknown to anyone: the applicant sets their own password from the emailed link.
          passwordHash: await argon2.hash(randomBytes(32).toString('hex')),
        },
      ],
      { session },
    )
    await sendSecurityLink(member, 'reset', session, {
      minutes: 7 * 24 * 60,
      subject: message('approved', 'subject', application.lang),
      text: (url) => `${message('approved', 'body', application.lang)}\n${url}`,
    })
    await Notification.create([{ member: member._id, ...notice('membershipApproved') }], {
      session,
    })
    await Application.updateOne({ _id: id }, { $set: { member: member._id } }, { session })
    await Audit.create(
      [{ actor: req.user.id, action: 'member.approved', entity: String(member._id) }],
      {
        session,
      },
    )
  })
  res.json({ message: 'Application approved. The member was emailed a link to set a password.' })
})

staffApplicationRouter.post('/:id/reject', async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const { reason } = z
    .object({ reason: z.string().trim().max(500).default('') })
    .parse(req.body ?? {})
  await mongoose.connection.transaction(async (session) => {
    const application = await claim(id, session, {
      $set: { status: 'rejected', reason, reviewedBy: req.user.id, reviewedAt: new Date() },
    })
    if (!application) throw new ApiError(409, 'This application was already reviewed.')
    if (application.email) {
      const lang = application.lang
      await queueEmail(
        application.email,
        message('rejected', 'subject', lang),
        `${message('rejected', 'body', lang)}${reason ? `\n\n${message('rejected', 'reason', lang)}: ${reason}` : ''}`,
        { session },
      )
    }
    await Audit.create(
      [{ actor: req.user.id, action: 'application.rejected', entity: String(id) }],
      {
        session,
      },
    )
  })
  res.json({ message: 'Application rejected.' })
})
