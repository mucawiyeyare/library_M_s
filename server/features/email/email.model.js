import mongoose, { Schema } from 'mongoose'
export const EmailMessage = mongoose.model(
  'EmailMessage',
  new Schema(
    {
      dedupeKey: { type: String, unique: true },
      to: String,
      subject: String,
      text: String,
      replyTo: String,
      status: {
        type: String,
        enum: ['pending', 'sending', 'sent', 'failed', 'preview'],
        default: 'pending',
      },
      attempts: { type: Number, default: 0 },
      nextAttemptAt: { type: Date, default: Date.now },
      sentAt: Date,
      leaseUntil: Date,
      lastError: String,
    },
    { timestamps: true },
  ),
)
EmailMessage.schema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 })
EmailMessage.schema.index({ status: 1, leaseUntil: 1 })
