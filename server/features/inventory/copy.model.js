import mongoose, { Schema } from 'mongoose'
const options = { timestamps: true }
export const Copy = mongoose.model(
  'Copy',
  new Schema(
    {
      book: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
      barcode: { type: String, required: true, unique: true },
      shelf: String,
      status: {
        type: String,
        enum: ['available', 'on_loan', 'retired', 'damaged', 'lost'],
        default: 'available',
      },
    },
    options,
  ),
)
