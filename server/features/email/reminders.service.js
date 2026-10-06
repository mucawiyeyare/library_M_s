import { Loan } from '../circulation/loan.model.js'
import { User } from '../members/user.model.js'
import { Book } from '../inventory/book.model.js'
import { getLibrarySettings } from '../settings/settings.model.js'
import { queueEmail } from './email.service.js'
export async function queueReminders(now = new Date()) {
  const settings = await getLibrarySettings()
  if (!settings.emailEnabled) return
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: settings.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const cursor = Loan.find({
    returnedAt: null,
    dueAt: { $lte: new Date(now.getTime() + settings.reminderDays * 86400000) },
  }).cursor()
  for await (const loan of cursor) {
    const member = await User.findOne({ _id: loan.member, status: 'active', emailVerified: true })
    if (!member) continue
    const book = await Book.findById(loan.book)
    const overdue = loan.dueAt < now
    const due = new Intl.DateTimeFormat('en', {
      timeZone: settings.timezone,
      dateStyle: 'medium',
    }).format(loan.dueAt)
    await queueEmail(
      member.email,
      overdue ? 'Library overdue reminder' : 'Your library book is due soon',
      `${book?.title ?? 'Your book'} is ${overdue ? 'overdue' : 'due soon'}. Due date: ${due}. Open your library account to review the loan, or contact library staff.`,
      { key: `reminder:${loan._id}:${day}` },
    )
  }
}
