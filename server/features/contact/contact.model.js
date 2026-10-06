import mongoose, { Schema } from 'mongoose'
export const ContactMessage = mongoose.model(
  'ContactMessage',
  new Schema(
    {
      reply: String,
      repliedAt: Date,
      name: String,
      email: String,
      subject: String,
      message: String,
      status: { type: String, enum: ['new', 'handled'], default: 'new' },
    },
    { timestamps: true },
  ),
)
