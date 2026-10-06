import express from 'express'
import { authenticate, authorize } from '../../shared/middleware/auth.js'
import { getPolicies, putPolicies } from './policies.controller.js'
const router = express.Router()
router.use(authenticate, authorize('librarian', 'admin'))
router.get('/', getPolicies)
router.put('/', authorize('admin'), putPolicies)
export default router
