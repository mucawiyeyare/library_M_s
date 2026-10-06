import mongoose, { Schema } from 'mongoose'
const options = { timestamps: true }
export const Book = mongoose.model(
  'Book',
  new Schema(
    {
      title: { type: String, required: true },
      author: { type: String, required: true },
      isbn: { type: String, required: true, unique: true },
      genre: String,
      category: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
      authors: [{ type: Schema.Types.ObjectId, ref: 'Author' }],
      publisher: { type: Schema.Types.ObjectId, ref: 'Publisher', default: null },
      language: { type: String, default: 'en' },
      edition: { type: String, default: '' },
      // Staff-chosen titles shown on the public home page.
      featured: { type: Boolean, default: false },
      year: Number,
      description: String,
      coverId: { type: Schema.Types.ObjectId, ref: 'Cover', default: null },
      archived: { type: Boolean, default: false },
      circulationVersion: { type: Number, default: 0 },
    },
    options,
  ),
)
Book.schema.index({ category: 1, archived: 1 })
Book.schema.index({ authors: 1 })
Book.schema.index({ publisher: 1 })
Book.schema.index({ language: 1, year: 1 })
Book.schema.index({ title: 1 })
