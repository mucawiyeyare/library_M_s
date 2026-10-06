import { Audit } from '../audit/audit.model.js'
import { Book } from '../inventory/book.model.js'
import { Copy } from '../inventory/copy.model.js'
import { Loan } from '../circulation/loan.model.js'
import { Reservation } from '../reservations/reservation.model.js'
import { User } from '../members/user.model.js'
import { Fine } from '../fines/fine.model.js'
import { Application } from '../applications/application.routes.js'
export const getReports = async (_req, res) => {
  const [titles, copies, members, activeLoans, overdue, waiting, recent, inventory, overdueTotal] =
    await Promise.all([
      Book.countDocuments({ archived: false }),
      Copy.countDocuments({ status: { $ne: 'retired' } }),
      User.countDocuments({ status: 'active', role: 'member' }),
      Loan.countDocuments({ returnedAt: null }),
      Loan.find({ returnedAt: null, dueAt: { $lt: new Date() } })
        .populate('member', 'name email')
        .populate('book', 'title')
        .sort({ dueAt: 1 })
        .limit(10)
        .lean(),
      Reservation.countDocuments({ status: 'waiting' }),
      Audit.find().populate('actor', 'name').sort({ createdAt: -1 }).limit(8).lean(),
      Copy.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Loan.countDocuments({ returnedAt: null, dueAt: { $lt: new Date() } }),
    ])
  const fineRows = await Fine.aggregate([
    { $group: { _id: '$status', amount: { $sum: '$amount' }, paid: { $sum: '$paid' } } },
  ])
  const fines = {
    collected: fineRows.reduce((sum, row) => sum + row.paid, 0),
    outstanding: fineRows
      .filter((row) => ['outstanding', 'partially_paid'].includes(row._id))
      .reduce((sum, row) => sum + row.amount - row.paid, 0),
    waived: fineRows.find((row) => row._id === 'waived')?.amount ?? 0,
  }
  const pendingApplications = await Application.countDocuments({ status: 'pending' })
  const since = new Date()
  since.setUTCMonth(since.getUTCMonth() - 11, 1)
  since.setUTCHours(0, 0, 0, 0)
  const [
    totalLoans,
    returnedLoans,
    membership,
    reservationStatuses,
    monthly,
    popularTitles,
    genres,
  ] = await Promise.all([
    Loan.countDocuments(),
    Loan.countDocuments({ returnedAt: { $ne: null } }),
    User.aggregate([{ $group: { _id: { role: '$role', status: '$status' }, count: { $sum: 1 } } }]),
    Reservation.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Loan.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' } },
          issued: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Loan.aggregate([
      { $group: { _id: '$book', loans: { $sum: 1 } } },
      { $sort: { loans: -1, _id: 1 } },
      { $limit: 10 },
      { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'book' } },
      { $project: { loans: 1, title: { $arrayElemAt: ['$book.title', 0] } } },
    ]),
    Book.aggregate([
      { $match: { archived: false } },
      { $group: { _id: '$genre', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]),
  ])
  res.json({
    totalLoans,
    returnedLoans,
    membership,
    reservationStatuses,
    monthly,
    popularTitles,
    genres,
    titles,
    pendingApplications,
    fines,
    copies,
    members,
    activeLoans,
    overdue,
    waiting,
    recent,
    inventory,
    overdueTotal,
  })
}
