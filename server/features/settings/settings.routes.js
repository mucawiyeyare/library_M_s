import express from 'express'
import { z } from 'zod'
import { LibrarySettings, getLibrarySettings } from './settings.model.js'
import { authenticate, authorize } from '../../shared/middleware/auth.js'
import { Audit } from '../audit/audit.model.js'
import { Cover } from '../covers/cover.model.js'
import sharp from 'sharp'
import { ApiError } from '../../shared/errors.js'
import { idSchema } from '../../contracts/schemas.js'
export const publicSettingsRouter = express.Router()
publicSettingsRouter.get('/', async (_req, res) => {
  const s = await getLibrarySettings()
  res.json({
    name: s.name,
    logoId: s.logoId,
    showName: s.showName,
    primaryColor: s.primaryColor,
    secondaryColor: s.secondaryColor,
    email: s.email,
    phone: s.phone,
    address: s.address,
    hours: s.hours,
    timezone: s.timezone,
  })
})
const schema = z.object({
  name: z.string().trim().min(2).max(100),
  logoId: idSchema.nullable().optional(),
  showName: z.boolean().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  email: z.string().trim().max(254).email().or(z.literal('')),
  phone: z.string().trim().max(80),
  address: z.string().trim().max(500),
  hours: z.string().trim().max(500),
  timezone: z.string().refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value })
      return true
    } catch {
      return false
    }
  }, 'Choose a valid IANA timezone'),
  emailEnabled: z.boolean(),
  reminderDays: z.coerce.number().int().min(0).max(14),
})
export const adminSettingsRouter = express.Router()
adminSettingsRouter.use(authenticate, authorize('admin'))
adminSettingsRouter.post(
  '/logo',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length)
      throw new ApiError(400, 'Choose a JPEG, PNG, or WebP logo.')
    let data
    try {
      const image = sharp(req.body, { limitInputPixels: 25000000, animated: false })
      const metadata = await image.metadata()
      if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '')) throw new Error('Invalid image')
      data = await image
        .rotate()
        .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90 })
        .toBuffer()
    } catch {
      throw new ApiError(400, 'Choose a valid JPEG, PNG, or WebP logo.')
    }
    const logo = await Cover.create({ data, uploadedBy: req.user.id })
    res.status(201).json({ logoId: String(logo._id) })
  },
)
adminSettingsRouter.get('/', async (_req, res) => {
  res.json(await getLibrarySettings())
})
adminSettingsRouter.put('/', async (req, res) => {
  const input = schema.parse(req.body)
  const current = await getLibrarySettings()
  if (
    input.logoId &&
    input.logoId !== String(current.logoId) &&
    !(await Cover.exists({ _id: input.logoId, uploadedBy: req.user.id }))
  )
    throw new ApiError(400, 'Upload your business logo before saving.')
  const s = await LibrarySettings.findOneAndUpdate(
    { key: 'library' },
    { $set: input },
    { upsert: true, returnDocument: 'after' },
  )
  await Audit.create({
    actor: req.user.id,
    action: 'library.settings.updated',
    entity: String(s._id),
  })
  res.json(s)
})
