import { createHash, randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from '../../config/env.js'
import { RefreshSession } from '../../features/auth/refreshsession.model.js'
import { User } from '../../features/members/user.model.js'
import { ApiError } from '../errors.js'
export const hashToken = (token) => createHash('sha256').update(token).digest('hex')
const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
}
export function clearRefresh(res) {
  res.clearCookie('refreshToken', cookieOptions)
}
export async function issueTokens(user, res) {
  const token = randomBytes(48).toString('hex')
  await RefreshSession.create({
    user: String(user._id),
    authVersion: user.authVersion ?? 0,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 7 * 86400000),
  })
  res.cookie('refreshToken', token, { ...cookieOptions, maxAge: 7 * 86400000 })
  return {
    accessToken: jwt.sign({ version: user.authVersion ?? 0 }, config.JWT_SECRET, {
      subject: String(user._id),
      expiresIn: '15m',
      issuer: 'biblioteca',
      audience: 'biblioteca-client',
      algorithm: 'HS256',
    }),
    user: {
      _id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      lang: user.lang ?? 'en',
      theme: user.theme ?? 'system',
      emailVerified: user.emailVerified ?? false,
      avatarId: user.avatarId ? String(user.avatarId) : null,
    },
  }
}
export const authenticate = async (req, _res, next) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer /, '')
    if (!token) throw new ApiError(401, 'Please sign in')
    let subject
    let version
    try {
      const payload = jwt.verify(token, config.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'biblioteca',
        audience: 'biblioteca-client',
      })
      if (typeof payload === 'string' || !payload.sub) throw new Error('Invalid token')
      subject = payload.sub
      version = typeof payload.version === 'number' ? payload.version : 0
    } catch {
      throw new ApiError(401, 'Your session has expired. Please sign in again.')
    }
    const user = await User.findById(subject)
    if (!user || user.status !== 'active' || (user.authVersion ?? 0) !== version)
      throw new ApiError(401, 'Account unavailable')
    req.user = { id: String(user._id), role: user.role, name: user.name }
    next()
  } catch (error) {
    next(error)
  }
}
export const authorize =
  (...allowed) =>
  (req, _res, next) => {
    if (!req.user || !allowed.includes(req.user.role))
      return next(new ApiError(403, 'You do not have permission for this action'))
    next()
  }
