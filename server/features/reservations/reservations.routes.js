import { getList, postList, postIdCancel } from './reservations.controller.js'
import express from 'express'
import { authenticate } from '../../shared/middleware/auth.js'
const router = express.Router()
router.use(authenticate)
router.get('/', getList)
router.post('/', postList)
router.post('/:id/cancel', postIdCancel)
export default router
