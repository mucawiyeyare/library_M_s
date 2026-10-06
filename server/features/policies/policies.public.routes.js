import { Router } from 'express'
import { getPolicy } from './policy.model.js'
const router = Router()
router.get('/', async (_req, res) => {
  const policy = await getPolicy()
  res.json({
    loanDays: policy.loanDays,
    maxLoans: policy.maxLoans,
    maxRenewals: policy.maxRenewals,
    renewalDays: policy.renewalDays,
    fineEnabled: policy.fineEnabled,
    finePerDay: policy.finePerDay,
    graceDays: policy.graceDays,
    maxFine: policy.maxFine,
    currency: policy.currency,
    reservationHoldDays: policy.reservationHoldDays,
  })
})
export default router
