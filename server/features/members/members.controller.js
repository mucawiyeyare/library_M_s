import { sendSecurityLink } from '../auth/recovery.controller.js'
import { pagination, sendPage, textSearch } from '../../shared/pagination.js'
import * as argon2 from '@node-rs/argon2'
import { z } from 'zod'
import mongoose from 'mongoose'
import { ApiError, requireRecord } from '../../shared/errors.js'
import { Audit } from '../audit/audit.model.js'
import { User } from './user.model.js'
import { roles } from '../../contracts/common/common.schema.js'
import { idSchema, memberSchema, registerSchema } from '../../contracts/schemas.js'
export const getMembers = async (req, res) => {
  const page = pagination(req, 500),
    search = textSearch(req.query.q)
  const filter = {
    ...(req.query.group === 'team'
      ? { role: { $in: ['admin', 'librarian', 'director'] } }
      : req.query.group === 'members' || req.user.role !== 'admin'
        ? { role: 'member' }
        : {}),
    ...(search ? { $or: [{ name: search }, { email: search }] } : {}),
    ...(req.query.status === 'active' ? { status: 'active' } : {}),
  }
  if (req.query.group === 'team' && req.user.role !== 'admin')
    throw new ApiError(403, 'Only administrators can view staff accounts')
  const [items, total] = await Promise.all([
    User.find(filter)
      .select('-savedBooks -circulationVersion')
      .sort({ name: 1, _id: 1 })
      .skip(page.skip)
      .limit(page.limit)
      .lean(),
    User.countDocuments(filter),
  ])
  sendPage(res, items, total, page)
}
export const postMembers = async (req, res) => {
  const input = registerSchema.parse(req.body)
  const role = z.enum(roles).parse(req.body.role ?? 'member')
  if (role !== 'member' && req.user.role !== 'admin')
    throw new ApiError(403, 'Only administrators can create staff accounts')
  const member = await mongoose.connection.transaction(async (session) => {
    const [created] = await User.create(
      [{ ...input, role, passwordHash: await argon2.hash(input.password) }],
      { session },
    )
    await Audit.create(
      [{ actor: req.user.id, action: 'member.created', entity: String(created._id) }],
      { session },
    )
    await sendSecurityLink(created, 'verify', session)
    return created
  })
  res.status(201).json({
    _id: member._id,
    name: member.name,
    email: member.email,
    role: member.role,
    status: member.status,
  })
}
export const patchMembersId = async (req, res) => {
  const id = idSchema.parse(req.params.id),
    input = memberSchema.parse(req.body)
  const member = await mongoose.connection.transaction(async (session) => {
    const current = requireRecord(await User.findById(id).session(session))
    if (id === req.user.id && (input.role !== current.role || input.status !== current.status))
      throw new ApiError(409, 'You cannot change your own access')
    if (req.user.role !== 'admin' && (input.role !== current.role || current.role !== 'member'))
      throw new ApiError(403, 'Only administrators can manage staff access')
    current.name = input.name
    current.status = input.status
    current.role = input.role
    await current.save({ session })
    await Audit.create([{ actor: req.user.id, action: 'member.updated', entity: id }], { session })
    return current
  })
  res.json(member)
}
