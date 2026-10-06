import mongoose, { Schema } from 'mongoose'
const options = { timestamps: true }
export const Loan = mongoose.model(
  'Loan',
  new Schema(
    {
      member: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
      copy: { type: Schema.Types.ObjectId, ref: 'Copy', required: true },
      dueAt: { type: Date, required: true },
      returnedAt: { type: Date, default: null },
      renewals: { type: Number, default: 0 },
      outcome: { type: String, enum: ['returned', 'lost', null], default: null },
      returnCondition: { type: String, enum: ['good', 'damaged', 'lost', null], default: null },
      returnNotes: { type: String, default: '' },
      processedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      followUps: [
        {
          note: String,
          by: { type: Schema.Types.ObjectId, ref: 'User' },
          at: { type: Date, default: Date.now },
          _id: false,
        },
      ],
    },
    options,
  ),
)
Loan.schema.index({ copy: 1 }, { unique: true, partialFilterExpression: { returnedAt: null } })
Loan.schema.index({ returnedAt: 1, dueAt: 1 })
