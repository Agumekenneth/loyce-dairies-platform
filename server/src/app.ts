
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import type { ErrorRequestHandler } from 'express'

// Product catalogue
import catalogRoutes from './routes/catalog.js'

// Customer registration
import authRoutes from './routes/auth.js'

// Customer login, sessions and logout
import sessionRoutes from './routes/sessions.js'

// Email verification
import emailVerificationRoutes from './routes/emailVerification.js'

// Password recovery
import passwordRecoveryRoutes from './routes/passwordRecovery.js'

// ==========================================
// INITIALIZE EXPRESS
// ==========================================

const app = express()

// ==========================================
// BASIC SECURITY
// ==========================================

app.disable('x-powered-by')

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(
  cors({
    origin:
      process.env.CLIENT_URL ??
      'http://localhost:5173',

    credentials: true,
  }),
)

app.use(
  express.json({
    limit: '1mb',
  }),
)

app.use(cookieParser())

// ==========================================
// API INFORMATION
// ==========================================

app.get('/api', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Loyce Dairies API',
  })
})

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    service: 'loyce-dairies-api',
    timestamp: new Date().toISOString(),
  })
})

// ==========================================
// PRODUCT CATALOGUE
// ==========================================

app.use('/api', catalogRoutes)

// ==========================================
// CUSTOMER REGISTRATION
// ==========================================

// POST /api/auth/register
app.use('/api/auth', authRoutes)

// ==========================================
// CUSTOMER LOGIN AND SESSIONS
// ==========================================

// POST /api/auth/login
// GET  /api/auth/me
// POST /api/auth/logout
app.use('/api/auth', sessionRoutes)

// ==========================================
// EMAIL VERIFICATION
// ==========================================

// POST /api/auth/email/verification/request
// POST /api/auth/email/verification/confirm
app.use('/api/auth/email', emailVerificationRoutes)

// ==========================================
// PASSWORD RECOVERY
// ==========================================

// POST /api/auth/password/forgot
// POST /api/auth/password/reset
app.use('/api/auth/password', passwordRecoveryRoutes)

// ==========================================
// 404 HANDLER
// ==========================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  })
})

// ==========================================
// CENTRALIZED ERROR HANDLER
// ==========================================

const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  console.error('Loyce Dairies API error:', error)

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  })
}

app.use(errorHandler)

export default app
