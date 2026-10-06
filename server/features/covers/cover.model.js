import mongoose, { Schema } from 'mongoose'
export const Cover = mongoose.model(
  'Cover',
  new Schema(
    {
      data: { type: Buffer, required: true },
      uploadedBy: { type: Schema.Types.ObjectId, required: true },
    },
    { timestamps: true },
  ),
)
