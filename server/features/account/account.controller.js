import { z } from 'zod'
import { requireRecord } from '../../shared/errors.js'
import { Book } from '../inventory/book.model.js'
import { Loan } from '../circulation/loan.model.js'
import { Reservation } from '../reservations/reservation.model.js'
import { Notification } from '../notifications/notification.model.js'
import { User } from '../members/user.model.js'
import { getLibrarySettings } from '../settings/settings.model.js'
import { idSchema } from '../../contracts/schemas.js'
import mongoose from 'mongoose'
import * as argon2 from '@node-rs/argon2'
import { ApiError } from '../../shared/errors.js'
import { RefreshSession } from '../auth/refreshsession.model.js'
import { SecurityToken } from '../auth/securitytoken.model.js'
import { sendSecurityLink } from '../auth/recovery.controller.js'
import { clearRefresh } from '../../shared/middleware/auth.js'
import { queueEmail } from '../email/email.service.js'
export const getMe = async (req, res) =>
  res.json(await User.findById(req.user.id).select('-circulationVersion'))
export const patchPreferences = async (req, res) => {
  const input = z
    .object({
      lang: z.enum(['en', 'so', 'ar']).optional(),
      theme: z.enum(['light', 'dark', 'system']).optional(),
    })
    .strict()
    .parse(req.body)
  const user = requireRecord(
    await User.findByIdAndUpdate(req.user.id, { $set: input }, { returnDocument: 'after' }),
  )
  res.json({ lang: user.lang, theme: user.theme })
}
export const getMeSummary = async (req, res) => {
  const member = req.user.id
  const settings = await getLibrarySettings()
  const now = new Date()
  const soon = new Date(now.getTime() + (settings.reminderDays ?? 2) * 86400000)
  const [currentLoans, reservations, unreadNotices, dueSoon, overdue, account] = await Promise.all([
    Loan.countDocuments({ member, returnedAt: null }),
    Reservation.countDocuments({ member, status: 'waiting' }),
    Notification.countDocuments({ member, read: false }),
    Loan.countDocuments({ member, returnedAt: null, dueAt: { $gte: now, $lte: soon } }),
    Loan.countDocuments({ member, returnedAt: null, dueAt: { $lt: now } }),
    User.findById(member).select('status createdAt').lean(),
  ])
  res.json({
    currentLoans,
    reservations,
    unreadNotices,
    dueSoon,
    overdue,
    membershipStatus: account?.status ?? 'active',
    memberSince: account?.createdAt,
  })
}
export const patchMe = async (req, res) => {
  const input = z
    .object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email().max(254).toLowerCase().optional(),
      currentPassword: z.string().max(128).optional(),
      password: z.string().min(12).max(128).optional(),
      confirmPassword: z.string().optional(),
    })
    .refine((value) => !value.password || value.password === value.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Passwords do not match.',
    })
    .parse(req.body)
  const result = await mongoose.connection.transaction(async (session) => {
    const user = requireRecord(
      await User.findById(req.user.id).select('+passwordHash').session(session),
    )
    const emailChanged = !!input.email && input.email !== user.email
    const sensitive = emailChanged || !!input.password
    if (
      sensitive &&
      (!input.currentPassword || !(await argon2.verify(user.passwordHash, input.currentPassword)))
    )
      throw new ApiError(400, 'Your current password is incorrect.')
    const oldEmail = user.email
    user.name = input.name
    if (emailChanged) {
      user.email = input.email
      user.emailVerified = false
    }
    if (input.password) user.passwordHash = await argon2.hash(input.password)
    if (sensitive) {
      user.authVersion += 1
      await RefreshSession.deleteMany({ user: user._id }, { session })
      await SecurityToken.deleteMany({ user: user._id }, { session })
      if (emailChanged) await sendSecurityLink(user, 'verify', session)
      await queueEmail(
        oldEmail,
        'Your library account details changed',
        'Your library email address or password has changed. Contact the library if you did not make this change.',
        { session },
      )
    }
    await user.save({ session })
    return {
      _id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      avatarId: user.avatarId ? String(user.avatarId) : null,
      requiresSignIn: sensitive,
    }
  })
  if (result.requiresSignIn) clearRefresh(res)
  res.json({
    ...result,
    message: result.requiresSignIn
      ? 'Account updated. Sign in again with your updated details.'
      : 'Changes saved.',
  })
}
export const getMeSaved = async (req, res) => {
  const user = requireRecord(await User.findById(req.user.id))
  res.json(await Book.find({ _id: { $in: user.savedBooks }, archived: false }).lean())
}
export const putMeSavedId = async (req, res) => {
  const id = idSchema.parse(req.params.id)
  requireRecord(await Book.findById(id))
  await User.updateOne({ _id: req.user.id }, { $addToSet: { savedBooks: id } })
  res.status(204).end()
}
export const deleteMeSavedId = async (req, res) => {
  await User.updateOne(
    { _id: req.user.id },
    { $pull: { savedBooks: idSchema.parse(req.params.id) } },
  )
  res.status(204).end()
}
export const getNotifications = async (req, res) => {
  const notifications = await Notification.find({ member: req.user.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()
  const overdue = await Loan.find({
    member: req.user.id,
    returnedAt: null,
    dueAt: { $lt: new Date() },
  })
    .populate('book', 'title')
    .lean()
  res.json({ items: notifications, overdue })
}
export const patchNotificationsId = async (req, res) => {
  requireRecord(
    await Notification.findOneAndUpdate(
      { _id: idSchema.parse(req.params.id), member: req.user.id },
      { read: true },
    ),
  )
  res.status(204).end()
}
