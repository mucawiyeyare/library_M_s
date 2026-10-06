import {
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
} from './recovery.controller.js'
import { authenticate } from '../../shared/middleware/auth.js'
import { postRegister, postLogin, postRefresh, postLogout } from './auth.controller.js'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { config } from '../../config/env.js'
const router = express.Router()
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.NODE_ENV === 'test' ? 200 : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})
router.post('/forgot-password', authLimiter, forgotPassword)
router.post('/reset-password', authLimiter, resetPassword)
router.post('/verify-email', authLimiter, verifyEmail)
router.post('/resend-verification', authLimiter, authenticate, resendVerification)
router.post('/register', authLimiter, postRegister)
router.post('/login', authLimiter, postLogin)
router.post('/refresh', authLimiter, postRefresh)
router.post('/logout', postLogout)
export default router
