import { Audit } from './audit.model.js'
import { pagination, sendPage } from '../../shared/pagination.js'
export const getAudit = async (req, res) => {
  const page = pagination(req, 500)
  const [items, total] = await Promise.all([
    Audit.find()
      .populate('actor', 'name email')
      .sort({ createdAt: -1, _id: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .lean(),
    Audit.countDocuments(),
  ])
  sendPage(res, items, total, page)
}
