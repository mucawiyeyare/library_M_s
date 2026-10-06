import mongoose, { Schema } from 'mongoose'
export const SecurityToken = mongoose.model(
  'SecurityToken',
  new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      kind: { type: String, enum: ['reset', 'verify'], required: true },
      tokenHash: { type: String, unique: true, required: true },
      expiresAt: { type: Date, required: true, index: { expires: 0 } },
    },
    { timestamps: true },
  ),
)
