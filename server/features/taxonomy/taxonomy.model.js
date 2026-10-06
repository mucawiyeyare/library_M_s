import mongoose, { Schema } from 'mongoose'

const localized = new Schema({ en: String, so: String, ar: String }, { _id: false })

// Categories have translatable names and descriptions; they can be deactivated, never erased.
export const Category = mongoose.model(
  'Category',
  new Schema(
    {
      name: { type: localized, default: () => ({}) },
      description: { type: localized, default: () => ({}) },
      status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    },
    { timestamps: true },
  ),
)
Category.schema.index({ status: 1 })

// nameKey is the lowercase name, so "Chinua Achebe" and "chinua achebe" are one author.
export const Author = mongoose.model(
  'Author',
  new Schema(
    {
      name: { type: String, required: true, trim: true },
      nameKey: { type: String, required: true, unique: true },
      biography: { type: String, default: '' },
      country: { type: String, default: '' },
      archived: { type: Boolean, default: false },
    },
    { timestamps: true },
  ),
)
Author.schema.index({ name: 1 })

export const Publisher = mongoose.model(
  'Publisher',
  new Schema(
    {
      name: { type: String, required: true, trim: true },
      nameKey: { type: String, required: true, unique: true },
      contact: { type: String, default: '' },
      archived: { type: Boolean, default: false },
    },
    { timestamps: true },
  ),
)
Publisher.schema.index({ name: 1 })

export const nameKey = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase()
