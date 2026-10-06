import mongoose, { Schema } from 'mongoose'

// One fine per late loan. Payments and waivers are recorded, never deleted.
export const Fine = mongoose.model(
  'Fine',
  new Schema(
    {
      member: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      loan: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, unique: true },
      amount: { type: Number, required: true, min: 0 },
      paid: { type: Number, default: 0, min: 0 },
      daysOverdue: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ['outstanding', 'partially_paid', 'paid', 'waived'],
        default: 'outstanding',
      },
      history: [
        {
          action: { type: String, enum: ['payment', 'waiver'] },
          amount: Number,
          note: String,
          by: { type: Schema.Types.ObjectId, ref: 'User' },
          at: { type: Date, default: Date.now },
          _id: false,
        },
      ],
    },
    { timestamps: true },
  ),
)
Fine.schema.index({ status: 1, createdAt: -1 })
