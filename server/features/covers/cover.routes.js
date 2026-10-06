import express from 'express'
import sharp from 'sharp'
import { Cover } from './cover.model.js'
import { authenticate, authorize } from '../../shared/middleware/auth.js'
import { ApiError, requireRecord } from '../../shared/errors.js'
import { idSchema } from '../../contracts/schemas.js'
export const publicCovers = express.Router()
publicCovers.get('/:id', async (req, res) => {
  const cover = requireRecord(
    await Cover.findById(idSchema.parse(req.params.id)),
    'Cover not found',
  )
  res
    .set('Content-Type', 'image/webp')
    .set('Cache-Control', 'public, max-age=86400')
    .send(cover.data)
})
export const staffCovers = express.Router()
staffCovers.post(
  '/',
  authenticate,
  authorize('admin', 'librarian'),
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length)
      throw new ApiError(400, 'Choose a JPEG, PNG, or WebP image (maximum 5 MB)')
    let data
    try {
      const image = sharp(req.body, { limitInputPixels: 25000000, animated: false })
      const metadata = await image.metadata()
      if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? ''))
        throw new Error('Unsupported image')
      data = await image
        .rotate()
        .resize({ width: 900, height: 1350, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer()
    } catch {
      throw new ApiError(
        400,
        'This image could not be read. Choose a valid JPEG, PNG, or WebP image.',
      )
    }
    const cover = await Cover.create({ data, uploadedBy: req.user.id })
    res.status(201).json({ coverId: String(cover._id) })
  },
)
