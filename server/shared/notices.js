// In-app notices are stored as { key, params } plus an English message. The website translates
// the key into the reader's language (English, Somali, Arabic) and falls back to the message.
const templates = {
  borrowed: ({ title, due }) => `You borrowed ${title}. Due ${due}.`,
  fineRecorded: ({ amount, currency, days }) =>
    `A late-return fine of ${amount}${currency ? ' ' + currency : ''} was recorded for a book returned ${days} day(s) late.`,
  fineWaived: () => 'A library fine on your account was waived.',
  reservationReady: ({ title }) =>
    `${title || 'A title you reserved'} is ready for you. Contact the library to collect it.`,
  reservationExpired: () => 'Your reservation expired because it was not collected in time.',
  membershipApproved: () => 'Your membership was approved. Welcome to the library!',
}

export const noticeKeys = Object.keys(templates)

// Fields to spread into Notification.create(...) alongside `member`.
export function notice(key, params = {}) {
  return { key, params, message: templates[key](params) }
}
