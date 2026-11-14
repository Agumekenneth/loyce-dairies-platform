
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import {
  dirname,
  extname,
  join,
  resolve,
} from 'node:path'

import { fileURLToPath } from 'node:url'
import type { ErrorRequestHandler } from 'express'

// ==========================================
// LOYCE DAIRIES PLATFORM
// EXPRESS APPLICATION CONFIGURATION
// MULTI-DEVICE LOCAL DEVELOPMENT
// ==========================================

// Public product catalogue
import catalogRoutes from './routes/catalog.js'

// Customer authentication
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

// Staff notifications
import staffNotificationsRouter from './routes/staffNotifications.js'
import staffPushDevicesRouter from './routes/staffPushDevices.js'

// Unattended-order monitoring
import staffOrderAttentionRouter from './routes/staffOrderAttention.js'

// ==========================================
// INITIALIZE EXPRESS
// ==========================================

const app = express()

const isProduction =
  process.env.NODE_ENV === 'production'

app.disable('x-powered-by')

// ==========================================
// FRONTEND ORIGIN CONFIGURATION
// ==========================================

// Production must explicitly configure
// its authorized frontend origin.

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

const clientOrigin = new URL(clientUrl).origin

// ==========================================
// MULTI-DEVICE DEVELOPMENT ORIGINS
// ==========================================

// Support simultaneous testing using:
//
// MacBook browser:
// http://localhost:5173
//
// Physical Android phone:
// http://127.0.0.1
//
// Android emulator:
// https://localhost
//
// Additional development origins are
// permitted only in non-production mode
// when explicitly enabled.

const isAndroidLocalDevelopment =
  !isProduction &&
  process.env.LOYCE_ANDROID_LOCAL_DEV === '1'

const allowedClientOrigins = new Set<string>([
  clientOrigin,
])

if (isAndroidLocalDevelopment) {
  allowedClientOrigins.add(
    'http://localhost:5173',
  )

  allowedClientOrigins.add(
    'http://127.0.0.1',
  )

  allowedClientOrigins.add(
    'https://localhost',
  )
}

// ==========================================
// CORS
// ==========================================

app.use(
  cors({
    origin: [...allowedClientOrigins],
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
// EMAIL VERIFICATION AND RECOVERY
// ==========================================

app.use(
  '/api/auth/email',
  emailVerificationRoutes,
)

app.use(
  '/api/auth/password',
  passwordRecoveryRoutes,
)

// ==========================================
// CUSTOMER CHECKOUT AND ORDERS
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
// STAFF ORDER NOTIFICATIONS
// ==========================================

app.use(
  '/api/admin/notifications',
  staffNotificationsRouter,
)

// ==========================================
// FIREBASE STAFF PUSH-DEVICE REGISTRATION
// ==========================================

app.use(
  '/api/admin/push-devices',
  staffPushDevicesRouter,
)

// ==========================================
// UNATTENDED ORDER MONITORING
// ==========================================

app.use(
  '/api/admin/order-attention',
  staffOrderAttentionRouter,
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

if (isProduction) {
  const serverDirectory = dirname(
    fileURLToPath(import.meta.url),
  )

  const clientDistDirectory = resolve(
    serverDirectory,
    '../../client/dist',
  )

  // Serve compiled React frontend assets.

  app.use(
    express.static(clientDistDirectory, {
      index: false,
      maxAge: '1h',
    }),
  )

  // React Router fallback for Express 5.

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

      res.set('Cache-Control', 'no-cache')

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
// EXPORT EXPRESS APPLICATION
// ==========================================

export { app }

export default app
