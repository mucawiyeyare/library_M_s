import express from 'express'
import { authenticate, authorize } from '../../shared/middleware/auth.js'
import { getAudit } from './audit.controller.js'
const router = express.Router()
// Administrators and directors can review activity; it is read-only.
router.use(authenticate, authorize('director', 'admin'))
router.get('/', getAudit)
export default router
