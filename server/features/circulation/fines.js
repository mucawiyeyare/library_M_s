const DAY = 86400000

// Days a loan is late, before any grace period is applied.
export function daysLate(dueAt, until = new Date()) {
  return Math.max(0, Math.ceil((until.getTime() - new Date(dueAt).getTime()) / DAY))
}

// Fine owed for a late loan under the library's configured policy.
// Fines are off until an administrator enables them and sets a daily rate.
export function computeFine(dueAt, policy, until = new Date()) {
  const late = daysLate(dueAt, until)
  if (!policy.fineEnabled || !(policy.finePerDay > 0)) return { late, amount: 0 }
  const billable = Math.max(0, late - (policy.graceDays ?? 0))
  let amount = billable * policy.finePerDay
  if (policy.maxFine > 0) amount = Math.min(amount, policy.maxFine)
  return { late, amount: Math.round(amount * 100) / 100 }
}
