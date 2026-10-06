import mongoose from 'mongoose'
import { sendSecurityLink } from './recovery.controller.js'
import * as argon2 from '@node-rs/argon2'
import { clearRefresh, hashToken, issueTokens } from '../../shared/middleware/auth.js'
import { ApiError, requireRecord } from '../../shared/errors.js'
import { RefreshSession } from './refreshsession.model.js'
import { User } from '../members/user.model.js'
import { Audit } from '../audit/audit.model.js'
import { loginSchema, registerSchema } from '../../contracts/schemas.js'
export const postRegister = async (req, res) => {
  const input = registerSchema.parse(req.body)
  const user = await mongoose.connection.transaction(async (session) => {
    const [created] = await User.create(
      [
        {
          role: 'member',
          name: input.name,
          email: input.email,
          passwordHash: await argon2.hash(input.password),
        },
      ],
      { session },
    )
    await sendSecurityLink(created, 'verify', session)
    return created
  })
  res.status(201).json(await issueTokens(user, res))
}
// Checked when the email is unknown so a missing account takes as long as a wrong password.
const decoy = await argon2.hash('decoy-password-for-timing-only')
export const postLogin = async (req, res) => {
  const input = loginSchema.parse(req.body)
  const user = await User.findOne({ email: input.email }).select('+passwordHash')
  const passwordOk = await argon2.verify(user?.passwordHash ?? decoy, input.password)
  if (!user || !passwordOk || user.status !== 'active')
    throw new ApiError(401, 'Email or password is incorrect, or the account is unavailable')
  await Audit.create({ actor: user._id, action: 'user.login', entity: String(user._id) })
  res.json(await issueTokens(user, res))
}
export const REUSE_GRACE_MS = 10_000
export const postRefresh = async (req, res) => {
  const token = req.cookies.refreshToken
  if (typeof token !== 'string') throw new ApiError(401, 'Please sign in')
  // A used refresh token keeps working for a few seconds, so a page reload that races an
  // in-flight refresh does not sign the reader out. After that it is rejected.
  const now = new Date()
  const session = await RefreshSession.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: now },
  })
  if (session && !session.rotatedAt)
    await RefreshSession.updateOne(
      { _id: session._id },
      { $set: { rotatedAt: now, expiresAt: new Date(now.getTime() + REUSE_GRACE_MS) } },
    )
  if (!session) {
    clearRefresh(res)
    throw new ApiError(401, 'Session expired')
  }
  const user = requireRecord(
    await User.findOne({ _id: session.user, status: 'active' }),
    'Account unavailable',
  )
  if ((session.authVersion ?? 0) !== (user.authVersion ?? 0))
    throw new ApiError(401, 'Session expired')
  res.json(await issueTokens(user, res))
}
export const postLogout = async (req, res) => {
  if (typeof req.cookies.refreshToken === 'string')
    await RefreshSession.deleteOne({ tokenHash: hashToken(req.cookies.refreshToken) })
  clearRefresh(res)
  res.status(204).end()
}
