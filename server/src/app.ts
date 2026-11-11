
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import {
  dirname,
  extname,
  join,
  resolve,
} from 'node:path'

import {
  fileURLToPath,
} from 'node:url'

import type {
  ErrorRequestHandler,
} from 'express'

// ==========================================
// LOYCE DAIRIES PLATFORM
// EXPRESS APPLICATION CONFIGURATION
//
// MILESTONE 4.12I
// SINGLE-ORIGIN PRODUCTION HOSTING
// ==========================================

// Public catalogue

import catalogRoutes from './routes/catalog.js'

// Authentication

import authRoutes from './routes/auth.js'
import sessionRoutes from './routes/sessions.js'

// Email verification and recovery

import emailVerificationRoutes from './routes/emailVerification.js'
import passwordRecoveryRoutes from './routes/passwordRecovery.js'

// Customer orders

import orderRoutes from './routes/orders.js'

// Staff administration

import adminOrdersRouter from './routes/adminOrders.js'
import adminDeliveryZonesRouter from './routes/adminDeliveryZones.js'
import adminInventoryRouter from './routes/adminInventory.js'
import adminProductsRouter from './routes/adminProducts.js'

// ==========================================
// INITIALIZE EXPRESS
// ==========================================

const app = express()

const isProduction =
  process.env.NODE_ENV === 'production'

app.disable('x-powered-by')

// ==========================================
// FRONTEND ORIGIN
// ==========================================

/**
 * The same CLIENT_URL is used by:
 *
 * - Express CORS
 * - Checkout origin protection
 *
 * Production must explicitly configure it.
 */

if (
  isProduction &&
  !process.env.CLIENT_URL
) {
  throw new Error(
    'CLIENT_URL must be configured in production.',
  )
}

const clientUrl =
  process.env.CLIENT_URL ||
  'http://localhost:5173'

const clientOrigin = new URL(
  clientUrl,
).origin

// ==========================================
// CORS
// ==========================================

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  }),
)

// ==========================================
// REQUEST PARSING
// ==========================================

app.use(
  express.json({
    limit: '1mb',
  }),
)

app.use(cookieParser())

// ==========================================
// API HEALTH CHECK
// ==========================================

app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-store')

  res.status(200).json({
    success: true,
    status: 'ok',
    message: 'Loyce Dairies API is running.',
  })
})

// ==========================================
// PUBLIC PRODUCT CATALOGUE
// ==========================================

app.use('/api', catalogRoutes)

// ==========================================
// CUSTOMER AUTHENTICATION
// ==========================================

app.use('/api/auth', authRoutes)

app.use('/api/auth', sessionRoutes)

// ==========================================
// EMAIL VERIFICATION
// ==========================================

app.use(
  '/api/auth/email',
  emailVerificationRoutes,
)

// ==========================================
// PASSWORD RECOVERY
// ==========================================

app.use(
  '/api/auth/password',
  passwordRecoveryRoutes,
)

// ==========================================
// CHECKOUT AND CUSTOMER ORDERS
// ==========================================

app.use('/api', orderRoutes)

// ==========================================
// STAFF ORDER MANAGEMENT
// ==========================================

app.use(
  '/api/admin/orders',
  adminOrdersRouter,
)

// ==========================================
// STAFF DELIVERY ZONES
// ==========================================

app.use(
  '/api/admin/delivery-zones',
  adminDeliveryZonesRouter,
)

// ==========================================
// STAFF INVENTORY
// ==========================================

app.use(
  '/api/admin/inventory',
  adminInventoryRouter,
)

// ==========================================
// STAFF PRODUCT MANAGEMENT
// ==========================================

app.use(
  '/api/admin/products',
  adminProductsRouter,
)

// ==========================================
// PRODUCTION FRONTEND HOSTING
// ==========================================

/**
 * Expected deployed project layout:
 *
 * project/
 *   client/dist/
 *   server/dist/app.js
 *
 * Build both the React frontend and
 * Express backend before starting.
 */

if (isProduction) {
  const serverDirectory = dirname(
    fileURLToPath(import.meta.url),
  )

  const clientDistDirectory = resolve(
    serverDirectory,
    '../../client/dist',
  )

  // Serve compiled React assets.

  app.use(
    express.static(
      clientDistDirectory,
      {
        index: false,
        maxAge: '1h',
      },
    ),
  )

  // ======================================
  // REACT ROUTER FALLBACK
  // ======================================

  /**
   * Express 5 requires a named wildcard.
   *
   * Serve index.html for frontend routes,
   * including:
   *
   * /products
   * /products/:id
   * /account
   * /checkout
   * /staff/orders
   *
   * API endpoints and missing assets
   * must not be replaced with HTML.
   */

  app.get(
    '/{*splat}',
    (req, res, next) => {
      const isApiRequest =
        req.path === '/api' ||
        req.path.startsWith('/api/')

      const isAssetRequest =
        req.path.startsWith('/assets/') ||
        extname(req.path) !== ''

      if (
        isApiRequest ||
        isAssetRequest
      ) {
        next()
        return
      }

      res.set(
        'Cache-Control',
        'no-cache',
      )

      res.sendFile(
        join(
          clientDistDirectory,
          'index.html',
        ),
        (error) => {
          if (error) {
            next(error)
          }
        },
      )
    },
  )
}

// ==========================================
// UNKNOWN ENDPOINTS
// ==========================================

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found.',
  })
})

// ==========================================
// CENTRALIZED ERROR HANDLER
// ==========================================

const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error)
    return
  }

  const errorStatus =
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number'
      ? error.status
      : 500

  const statusCode =
    Number.isInteger(errorStatus) &&
    errorStatus >= 400 &&
    errorStatus <= 599
      ? errorStatus
      : 500

  if (statusCode >= 500) {
    console.error(
      'Loyce Dairies API error:',
      error,
    )
  }

  const message =
    statusCode === 500
      ? 'An internal server error occurred.'
      : statusCode === 400
        ? 'Invalid request body.'
        : statusCode === 413
          ? 'Request body is too large.'
          : 'The request could not be processed.'

  res.status(statusCode).json({
    success: false,
    message,
  })
}

app.use(errorHandler)

// ==========================================
// EXPORT EXPRESS APP
// ==========================================

export { app }

export default app
