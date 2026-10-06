import { Copy } from '../inventory/copy.model.js'
import { Loan } from '../circulation/loan.model.js'
import { Reservation } from '../reservations/reservation.model.js'
import { exportFilters } from './export-filters.js'
function waitForDrain(res) {
  if (res.destroyed) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      res.off('drain', done)
      res.off('close', done)
      resolve()
    }
    res.once('drain', done)
    res.once('close', done)
  })
}
function cell(value) {
  let text = String(value ?? '')
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text
  return `"${text.replaceAll('"', '""')}"`
}
export const activityCsv = async (req, res) => {
  const reservations = req.path.endsWith('reservations.csv')
  const filter = await exportFilters(req, reservations ? 'reservations' : 'loans')
  res
    .set('Content-Type', 'text/csv; charset=utf-8')
    .attachment(reservations ? 'reservations.csv' : 'loans.csv')
  res.write(
    '\ufeff' +
      (reservations
        ? 'Book,Member,Email,Status,Requested at\r\n'
        : 'Book,Member,Email,Issued at,Due date,Returned at,Renewals\r\n'),
  )
  const cursor = reservations
    ? Reservation.find(filter)
        .populate('member', 'name email')
        .populate('book', 'title')
        .sort({ createdAt: -1, _id: -1 })
        .cursor()
    : Loan.find(filter)
        .populate('member', 'name email')
        .populate('book', 'title')
        .sort({ createdAt: -1, _id: -1 })
        .cursor()
  try {
    for await (const record of cursor) {
      if (res.destroyed) break
      const item = record.toObject()
      const row = [
        item.book?.title,
        item.member?.name,
        item.member?.email,
        ...(reservations
          ? [item.status, item.createdAt.toISOString()]
          : [
              item.createdAt.toISOString(),
              item.dueAt?.toISOString(),
              item.returnedAt?.toISOString(),
              item.renewals,
            ]),
      ]
      if (!res.write(row.map(cell).join(',') + '\r\n')) await waitForDrain(res)
    }
  } finally {
    await cursor.close()
  }
  res.end()
}
export const inventoryCsv = async (req, res) => {
  const filter = await exportFilters(req, 'inventory')
  res.set('Content-Type', 'text/csv; charset=utf-8').attachment('library-inventory.csv')
  res.write('\ufeffBarcode,Title,Shelf,Status\r\n')
  const cursor = Copy.find(filter).populate('book', 'title').sort({ barcode: 1, _id: 1 }).cursor()
  try {
    for await (const copy of cursor) {
      if (res.destroyed) break
      const book = copy.book
      if (
        !res.write(
          [copy.barcode, book?.title, copy.shelf, copy.status].map(cell).join(',') + '\r\n',
        )
      )
        await waitForDrain(res)
    }
  } finally {
    await cursor.close()
  }
  res.end()
}
export const overdueCsv = async (req, res) => {
  const filter = await exportFilters(req, 'overdue')
  res.set('Content-Type', 'text/csv; charset=utf-8').attachment('overdue-loans.csv')
  res.write('\ufeffBook,Member,Email,Due date\r\n')
  const cursor = Loan.find(filter)
    .populate('member', 'name email')
    .populate('book', 'title')
    .sort({ dueAt: 1, _id: 1 })
    .cursor()
  try {
    for await (const loan of cursor) {
      if (res.destroyed) break
      const member = loan.member,
        book = loan.book
      if (
        !res.write(
          [book?.title, member?.name, member?.email, loan.dueAt.toISOString()].map(cell).join(',') +
            '\r\n',
        )
      )
        await waitForDrain(res)
    }
  } finally {
    await cursor.close()
  }
  res.end()
}
