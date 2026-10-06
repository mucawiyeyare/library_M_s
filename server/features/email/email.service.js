import nodemailer from 'nodemailer'
import { randomUUID, randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto'
import { config } from '../../config/env.js'
import { EmailMessage } from './email.model.js'
import { getLibrarySettings } from '../settings/settings.model.js'
function emailKey() {
  return createHash('sha256').update('khaliil-email-body-v1').update(config.JWT_SECRET).digest()
}
function encryptEmailBody(text) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', emailKey(), iv)
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return [
    'enc',
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    data.toString('base64url'),
  ].join(':')
}
export function readEmailBody(text) {
  if (!text.startsWith('enc:v1:')) return text
  const [, , iv, tag, data] = text.split(':')
  const decipher = createDecipheriv('aes-256-gcm', emailKey(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
export async function queueEmail(to, subject, text, options = {}) {
  if (!to) return
  return EmailMessage.updateOne(
    { dedupeKey: options.key ?? randomUUID() },
    {
      $setOnInsert: {
        to,
        subject,
        text: encryptEmailBody(text),
        replyTo: options.replyTo,
        status: config.MAIL_TRANSPORT === 'preview' ? 'preview' : 'pending',
      },
    },
    { upsert: true, session: options.session, setDefaultsOnInsert: true },
  )
}
export async function deliverEmails() {
  if (config.MAIL_TRANSPORT !== 'smtp' || !config.SMTP_USER || !config.SMTP_PASSWORD) return
  const settings = await getLibrarySettings()
  if (!settings.emailEnabled) return
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    requireTLS: config.SMTP_PORT !== 465,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    dnsTimeout: 10000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true,
  })
  try {
    for (let i = 0; i < 20; i++) {
      const now = new Date()
      const mail = await EmailMessage.findOneAndUpdate(
        {
          $or: [
            { status: 'pending', nextAttemptAt: { $lte: now } },
            { status: 'sending', leaseUntil: { $lt: now } },
          ],
        },
        {
          $set: { status: 'sending', leaseUntil: new Date(Date.now() + 120000) },
          $inc: { attempts: 1 },
        },
        { sort: { createdAt: 1 }, returnDocument: 'after' },
      )
      if (!mail) break
      try {
        const info = await transport.sendMail({
          from: { name: settings.name, address: config.SMTP_USER },
          to: mail.to,
          subject: mail.subject,
          text: readEmailBody(mail.text),
          replyTo: mail.replyTo || settings.email || undefined,
          messageId: `<${mail._id}@khaliil-library.local>`,
        })
        if (!info.accepted.length) throw new Error('Email not accepted')
        await EmailMessage.updateOne(
          { _id: mail._id },
          {
            $set: { status: 'sent', sentAt: new Date(), lastError: '', text: '' },
            $unset: { leaseUntil: 1 },
          },
        )
      } catch {
        await EmailMessage.updateOne(
          { _id: mail._id },
          {
            $set: {
              status: mail.attempts >= 5 ? 'failed' : 'pending',
              nextAttemptAt: new Date(Date.now() + Math.min(60, 2 ** mail.attempts) * 60000),
              lastError: 'Delivery failed. Check Gmail credentials and connection.',
            },
            $unset: { leaseUntil: 1 },
          },
        )
      }
    }
  } finally {
    transport.close()
  }
}
