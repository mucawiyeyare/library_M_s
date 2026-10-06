import mongoose, { Schema } from 'mongoose'
const options = { timestamps: true }
export const Audit = mongoose.model(
  'Audit',
  new Schema(
    {
      actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      action: { type: String, required: true },
      entity: { type: String, required: true },
    },
    options,
  ),
)
