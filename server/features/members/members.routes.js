import { getMembers, postMembers, patchMembersId } from './members.controller.js'
import express from 'express'
import { authenticate, authorize } from '../../shared/middleware/auth.js'
const router = express.Router()
router.use(authenticate)
router.use(authorize('librarian', 'admin'))
router.get('/members', getMembers)
router.post('/members', postMembers)
router.patch('/members/:id', patchMembersId)
export default router
