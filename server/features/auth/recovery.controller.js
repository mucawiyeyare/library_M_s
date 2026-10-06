import { randomBytes } from 'node:crypto'
import mongoose from 'mongoose'
import * as argon2 from '@node-rs/argon2'
import { z } from 'zod'
import { SecurityToken } from './securitytoken.model.js'
import { User } from '../members/user.model.js'
import { RefreshSession } from './refreshsession.model.js'
import { queueEmail } from '../email/email.service.js'
import { hashToken, clearRefresh } from '../../shared/middleware/auth.js'
import { config } from '../../config/env.js'
import { ApiError } from '../../shared/errors.js'
export async function sendSecurityLink(user, kind, session, options = {}) {
  const token = randomBytes(32).toString('hex')
  const minutes = options.minutes ?? (kind === 'reset' ? 30 : 1440)
  const expiresAt = new Date(Date.now() + minutes * 60000)
  await SecurityToken.deleteMany({ user: String(user._id), kind }, { session })
  await SecurityToken.create(
    [{ user: String(user._id), kind, tokenHash: hashToken(token), expiresAt }],
    { session },
  )
  const url = `${config.CLIENT_ORIGIN}/${kind === 'reset' ? 'reset-password' : 'verify-email'}?token=${token}`
  const subject =
    options.subject ??
    (kind === 'reset' ? 'Reset your library password' : 'Verify your library email')
  const text =
    options.text?.(url) ??
    `${kind === 'reset' ? 'Reset your password within 30 minutes' : 'Verify your email within 24 hours'} using this one-time link:
${url}

If you did not request this, ignore this message.`
  await queueEmail(user.email, subject, text, { session })
}
export const forgotPassword = async (req, res) => {
  const { email } = z.object({ email: z.string().trim().email().toLowerCase() }).parse(req.body)
  await mongoose.connection.transaction(async (session) => {
    const user = await User.findOne({ email, status: 'active' }).session(session)
    if (user) await sendSecurityLink(user, 'reset', session)
  })
  res.json({ message: 'If an active account matches this email, a reset link has been queued.' })
}
export const resetPassword = async (req, res) => {
  const input = z
    .object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(12).max(128) })
    .parse(req.body)
  const passwordHash = await argon2.hash(input.password)
  await mongoose.connection.transaction(async (session) => {
    const token = await SecurityToken.findOneAndDelete(
      { kind: 'reset', tokenHash: hashToken(input.token), expiresAt: { $gt: new Date() } },
      { session },
    )
    if (!token) throw new ApiError(400, 'This reset link is invalid or expired. Request a new one.')
    const user = await User.findOneAndUpdate(
      { _id: token.user, status: 'active' },
      { $set: { passwordHash }, $inc: { authVersion: 1 } },
      { session, returnDocument: 'after' },
    )
    if (!user) throw new ApiError(400, 'Account unavailable')
    await RefreshSession.deleteMany({ user: token.user }, { session })
    await queueEmail(
      user.email,
      'Your library password was changed',
      'Your password was changed. If this was not you, contact the library immediately.',
      { session },
    )
  })
  clearRefresh(res)
  res.json({ message: 'Password updated. Sign in with your new password.' })
}
export const verifyEmail = async (req, res) => {
  const { token } = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(req.body)
  await mongoose.connection.transaction(async (session) => {
    const link = await SecurityToken.findOneAndDelete(
      { kind: 'verify', tokenHash: hashToken(token), expiresAt: { $gt: new Date() } },
      { session },
    )
    if (!link) throw new ApiError(400, 'This verification link is invalid or expired.')
    await User.updateOne({ _id: link.user }, { $set: { emailVerified: true } }, { session })
  })
  res.json({ message: 'Your email is verified.' })
}
export const resendVerification = async (req, res) => {
  await mongoose.connection.transaction(async (session) => {
    const user = await User.findById(req.user.id).session(session)
    if (user && !user.emailVerified) await sendSecurityLink(user, 'verify', session)
  })
  res.json({ message: 'A verification link has been queued if your email is not yet verified.' })
}
