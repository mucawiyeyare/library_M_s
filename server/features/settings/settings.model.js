import mongoose, { Schema } from 'mongoose'
export const LibrarySettings = mongoose.model(
  'LibrarySettings',
  new Schema(
    {
      key: { type: String, default: 'library', unique: true },
      name: { type: String, default: 'Garbaharey Public Library' },
      logoId: { type: Schema.Types.ObjectId, ref: 'Cover', default: null },
      showName: { type: Boolean, default: true },
      primaryColor: { type: String, default: '#29C5E0' },
      secondaryColor: { type: String, default: '#F47920' },
      email: { type: String, default: 'ibrahimahmedabdirahmaan@gmail.com' },
      phone: { type: String, default: '+252 616875280' },
      address: { type: String, default: 'Somalia' },
      hours: { type: String, default: 'Open 24 hours, every day' },
      timezone: { type: String, default: 'Africa/Mogadishu' },
      emailEnabled: { type: Boolean, default: true },
      reminderDays: { type: Number, default: 2 },
    },
    { timestamps: true },
  ),
)
export async function getLibrarySettings() {
  const current = await LibrarySettings.findOne({ key: 'library' })
  if (current) return current
  return LibrarySettings.findOneAndUpdate(
    { key: 'library' },
    { $setOnInsert: { key: 'library' } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  )
}
