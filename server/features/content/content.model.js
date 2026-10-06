import mongoose, { Schema } from 'mongoose'

export const contentKinds = ['service', 'joininfo', 'rule', 'about', 'news', 'event']
const localized = new Schema({ en: String, so: String, ar: String }, { _id: false })

// Editable, multilingual public content: services, membership info, rules, news, events.
// Only human-readable text is translated; nothing is pre-filled, so the library supplies it.
export const Content = mongoose.model(
  'Content',
  new Schema(
    {
      kind: { type: String, enum: contentKinds, required: true },
      title: { type: localized, default: () => ({}) },
      body: { type: localized, default: () => ({}) },
      eventDate: { type: Date, default: null },
      featured: { type: Boolean, default: false },
      published: { type: Boolean, default: true },
      archived: { type: Boolean, default: false },
      order: { type: Number, default: 0 },
      createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true },
  ),
)
Content.schema.index({ kind: 1, archived: 1, published: 1, order: 1, createdAt: -1 })
