import mongoose from 'mongoose'
import sharp from 'sharp'
import { User } from '../members/user.model.js'
import { Cover } from '../covers/cover.model.js'
import { ApiError, requireRecord } from '../../shared/errors.js'
export const uploadAvatar = async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length)
    throw new ApiError(400, 'Choose a JPEG, PNG, or WebP profile photo up to 5 MB.')
  let data
  try {
    const photo = sharp(req.body, { limitInputPixels: 25000000, animated: false })
    const metadata = await photo.metadata()
    if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? ''))
      throw new Error('Unsupported image')
    data = await photo.rotate().resize(320, 320, { fit: 'cover' }).webp({ quality: 82 }).toBuffer()
  } catch {
    throw new ApiError(
      400,
      'This photo could not be read. Choose a valid JPEG, PNG, or WebP image.',
    )
  }
  const user = await mongoose.connection.transaction(async (session) => {
    const current = requireRecord(await User.findById(req.user.id).session(session))
    const previous = current.avatarId
    const [photo] = await Cover.create([{ data, uploadedBy: current._id }], { session })
    current.avatarId = photo._id
    await current.save({ session })
    if (previous) await Cover.deleteOne({ _id: previous, uploadedBy: current._id }, { session })
    return current
  })
  res.json(user)
}
