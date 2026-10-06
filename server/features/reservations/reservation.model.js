import mongoose, { Schema } from 'mongoose'
const options = { timestamps: true }
export const Reservation = mongoose.model(
  'Reservation',
  new Schema(
    {
      member: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
      // A waiting reservation becomes ready when a copy is set aside for the reader.
      ready: { type: Boolean, default: false },
      readyAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      status: {
        type: String,
        enum: ['waiting', 'fulfilled', 'cancelled', 'expired'],
        default: 'waiting',
      },
    },
    options,
  ),
)
Reservation.schema.index(
  { member: 1, book: 1 },
  { unique: true, partialFilterExpression: { status: 'waiting' } },
)
