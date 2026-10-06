import {
  getMe,
  getMeSummary,
  patchMe,
  patchPreferences,
  getMeSaved,
  putMeSavedId,
  deleteMeSavedId,
  getNotifications,
  patchNotificationsId,
} from './account.controller.js'
import express from 'express'
import { authenticate } from '../../shared/middleware/auth.js'
import { uploadAvatar } from './avatar.controller.js'
const router = express.Router()
router.use(authenticate)
router.get('/me', getMe)
router.get('/me/summary', getMeSummary)
router.patch('/me', patchMe)
router.patch('/me/preferences', patchPreferences)
router.post(
  '/me/avatar',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }),
  uploadAvatar,
)
router.get('/me/saved', getMeSaved)
router.put('/me/saved/:id', putMeSavedId)
router.delete('/me/saved/:id', deleteMeSavedId)
router.get('/notifications', getNotifications)
router.patch('/notifications/:id', patchNotificationsId)
export default router
