import { z } from 'zod'
export const policySchema = z.object({
  loanDays: z.coerce.number().int().min(1).max(90),
  maxLoans: z.coerce.number().int().min(1).max(50),
  maxRenewals: z.coerce.number().int().min(0).max(10),
  renewalDays: z.coerce.number().int().min(1).max(90),
  fineEnabled: z.boolean().default(false),
  finePerDay: z.coerce.number().min(0).max(100000).default(0),
  graceDays: z.coerce.number().int().min(0).max(90).default(0),
  maxFine: z.coerce.number().min(0).max(1000000).default(0),
  currency: z.string().trim().max(10).default(''),
  reservationHoldDays: z.coerce.number().int().min(0).max(90).default(0),
})
