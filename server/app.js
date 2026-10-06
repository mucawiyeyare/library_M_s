import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import rateLimit from 'express-rate-limit'
import { config } from './config/env.js'
import finesRouter from './features/fines/fines.routes.js'
import { staffTaxonomyRouter, publicTaxonomyRouter } from './features/taxonomy/taxonomy.routes.js'
import { publicContentRouter, staffContentRouter } from './features/content/content.routes.js'
import {
  publicApplicationRouter,
  staffApplicationRouter,
} from './features/applications/application.routes.js'
import { emailRouter } from './features/email/email.routes.js'
import { publicSettingsRouter, adminSettingsRouter } from './features/settings/settings.routes.js'
import { contactRouter, staffContactRouter } from './features/contact/contact.routes.js'
import { publicCovers, staffCovers } from './features/covers/cover.routes.js'
import authRouter from './features/auth/auth.routes.js'
import catalogRouter from './features/catalog/catalog.routes.js'
import accountRouter from './features/account/account.routes.js'
import circulationRouter from './features/circulation/circulation.routes.js'
import reservationsRouter from './features/reservations/reservations.routes.js'
import inventoryRouter from './features/inventory/inventory.routes.js'
import membersRouter from './features/members/members.routes.js'
import reportsRouter from './features/reports/reports.routes.js'
import auditRouter from './features/audit/audit.routes.js'
import policiesRouter from './features/policies/policies.routes.js'
import publicPoliciesRouter from './features/policies/policies.public.routes.js'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import mongoose from 'mongoose'
import { ZodError } from 'zod'
import { ApiError } from './shared/errors.js'
import { isTrustedOrigin } from './shared/middleware/trusted-origin.js'
export const app = express()
app.disable('x-powered-by')
// Behind a reverse proxy, trust its forwarded address so each visitor is limited separately.
if (config.TRUST_PROXY > 0) app.set('trust proxy', config.TRUST_PROXY)
app.use(
  helmet(),
  cors({
    origin: (origin, callback) => callback(null, !origin || isTrustedOrigin(origin)),
    credentials: true,
  }),
  express.json({ limit: '100kb' }),
  cookieParser(),
)
app.use('/api', (req, _res, next) => {
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.headers.origin &&
    !isTrustedOrigin(req.headers.origin)
  )
    return next(new ApiError(403, 'Untrusted request origin'))
  next()
})
// A broad ceiling on the whole API (specific limits on sign-in and public forms still apply).
if (config.NODE_ENV === 'production')
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 600,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (req) => req.path === '/health',
      message: { message: 'Too many requests. Please slow down and try again shortly.' },
    }),
  )
app.get('/api/health', (_req, res) =>
  res
    .status(mongoose.connection.readyState === 1 ? 200 : 503)
    .json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'database_unavailable' }),
)
app.use('/api/library/settings', publicSettingsRouter)
app.use('/api/staff/email', emailRouter)
app.use('/api/staff/settings', adminSettingsRouter)
app.use('/api/contact', contactRouter)
app.use('/api/staff/contact', staffContactRouter)
app.use('/api/covers', publicCovers)
app.use('/api/staff/covers', staffCovers)
app.use('/api/auth', authRouter)
app.use('/api/library/policies', publicPoliciesRouter)
app.use('/api/library/content', publicContentRouter)
app.use('/api/library', publicTaxonomyRouter)
app.use('/api/library/applications', publicApplicationRouter)
app.use('/api/staff/reports', reportsRouter)
app.use('/api/staff/audit', auditRouter)
app.use('/api/staff/content', staffContentRouter)
app.use('/api/staff', staffTaxonomyRouter)
app.use('/api/staff/applications', staffApplicationRouter)
app.use('/api/books', catalogRouter)
app.use('/api', accountRouter)
app.use('/api/loans', circulationRouter)
app.use('/api/reservations', reservationsRouter)
app.use('/api/fines', finesRouter)
app.use('/api/staff', inventoryRouter)
app.use('/api/staff', membersRouter)
app.use('/api/staff/policies', policiesRouter)
// Optionally serve the built website from this same server (SERVE_CLIENT=true after `npm run build`).
if (config.SERVE_CLIENT === 'true') {
  const dist = fileURLToPath(new URL('../client/dist', import.meta.url))
  app.use(express.static(dist, { index: false, maxAge: '7d', immutable: true }))
  app.get(/^\/(?!api\/).*/, (_req, res) =>
    res.set('Cache-Control', 'no-cache').sendFile(join(dist, 'index.html')),
  )
}
app.use((_req, _res, next) => next(new ApiError(404, 'Endpoint not found')))
const errorHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error)
    return
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      message: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
    })
    return
  }
  if (error instanceof ApiError) {
    res.status(error.status).json({ message: error.message })
    return
  }
  if (error?.code === 11000) {
    res.status(409).json({ message: 'This email, ISBN, barcode, or reservation already exists' })
    return
  }
  if (error?.type === 'entity.too.large') {
    res.status(413).json({
      message: 'The upload or request is too large. Images must be no larger than 5 MB.',
    })
    return
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'Invalid JSON request' })
    return
  }
  console.error(error)
  res.status(500).json({ message: 'An unexpected error occurred. Please try again.' })
}
app.use(errorHandler)
