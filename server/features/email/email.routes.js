import { readEmailBody } from './email.service.js'
import express from 'express'
import { config } from '../../config/env.js'
import { authenticate, authorize } from '../../shared/middleware/auth.js'
import { idSchema } from '../../contracts/schemas.js'
import { EmailMessage } from './email.model.js'
import { pagination, sendPage } from '../../shared/pagination.js'
import { requireRecord } from '../../shared/errors.js'
import { ApiError } from '../../shared/errors.js'
import { z } from 'zod'
import { persistMailConfiguration } from './email-config.service.js'
import { Audit } from '../audit/audit.model.js'
import nodemailer from 'nodemailer'
export const emailRouter = express.Router()
emailRouter.use(authenticate, authorize('admin'))
emailRouter.post('/configuration/test', async (_req, res) => {
  if (config.MAIL_TRANSPORT !== 'smtp' || !config.SMTP_USER || !config.SMTP_PASSWORD)
    throw new ApiError(400, 'Save Gmail SMTP credentials first.')
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    requireTLS: config.SMTP_PORT !== 465,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    dnsTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true,
  })
  try {
    await transport.verify()
  } catch {
    throw new ApiError(
      400,
      'Gmail connection failed. Check the sender, app password, and server network connection.',
    )
  } finally {
    transport.close()
  }
  res.json({ message: 'Gmail SMTP connection verified. No test email was sent.' })
})
emailRouter.get('/status', (_req, res) => {
  res.json({
    transport: config.MAIL_TRANSPORT,
    configured: config.MAIL_TRANSPORT === 'smtp' && !!config.SMTP_USER && !!config.SMTP_PASSWORD,
    sender: config.SMTP_USER || '',
    host: config.SMTP_HOST,
    passwordConfigured: !!config.SMTP_PASSWORD,
  })
})
emailRouter.put('/configuration', async (req, res) => {
  const input = z
    .object({
      transport: z.enum(['preview', 'smtp']),
      user: z.string().trim().email().max(254),
      password: z
        .string()
        .max(256)
        .regex(/^[^\r\n]*$/)
        .optional(),
    })
    .parse(req.body)
  if (
    input.transport === 'smtp' &&
    !input.password?.trim() &&
    (!config.SMTP_PASSWORD || input.user !== config.SMTP_USER)
  )
    throw new ApiError(400, 'Enter your Gmail app password to enable SMTP delivery.')
  const normalized = { ...input, password: input.password?.replace(/\s/g, '') }
  await persistMailConfiguration(normalized)
  await Audit.create({
    actor: req.user.id,
    action: 'email.configuration.updated',
    entity: 'gmail',
  })
  res.json({
    message:
      'Email configuration saved to server/.env and applied. Gmail delivery has not yet been verified.',
  })
})
emailRouter.get('/', async (req, res) => {
  const page = pagination(req)
  const [items, total] = await Promise.all([
    EmailMessage.find()
      .select(
        config.MAIL_TRANSPORT === 'preview' && config.NODE_ENV !== 'production' ? '' : '-text',
      )
      .sort({ createdAt: -1, _id: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .lean(),
    EmailMessage.countDocuments(),
  ])
  const visible = items.map((item) => ({
    ...item,
    ...(item.text ? { text: readEmailBody(item.text) } : {}),
  }))
  sendPage(res, visible, total, page)
})
emailRouter.post('/:id/retry', async (req, res) => {
  requireRecord(
    await EmailMessage.findOneAndUpdate(
      { _id: idSchema.parse(req.params.id), status: { $in: ['failed', 'preview'] } },
      {
        $set: {
          status: config.MAIL_TRANSPORT === 'preview' ? 'preview' : 'pending',
          attempts: 0,
          nextAttemptAt: new Date(),
          lastError: '',
        },
      },
    ),
  )
  res.json({ message: 'Email queued according to the configured delivery mode.' })
})
