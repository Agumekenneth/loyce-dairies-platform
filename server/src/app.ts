
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import type {
  ErrorRequestHandler,
} from 'express'

// ==========================================
// LOYCE DAIRIES PLATFORM
// EXPRESS APPLICATION CONFIGURATION
// MILESTONE 4.8.2
// ==========================================

// Public product catalogue

import catalogRoutes from './routes/catalog.js'

// Customer authentication and sessions

import authRoutes from './routes/auth.js'
import sessionRoutes from './routes/sessions.js'

// Email verification and password recovery

import emailVerificationRoutes from './routes/emailVerification.js'
import passwordRecoveryRoutes from './routes/passwordRecovery.js'

// Customer checkout and order history

import orderRoutes from './routes/orders.js'

// Staff administration

import adminOrdersRouter from './routes/adminOrders.js'

import adminDeliveryZonesRouter from './routes/adminDeliveryZones.js'

import adminInventoryRouter from './routes/adminInventory.js'

// Staff product management — Milestone 4.8

import adminProductsRouter from './routes/adminProducts.js'

// ==========================================
// INITIALIZE EXPRESS APPLICATION
// ==========================================

const app = express()

// Avoid exposing the Express version or
// implementation via its default header.

app.disable('x-powered-by')

// ==========================================
// FRONTEND ORIGIN CONFIGURATION
// ==========================================

const clientUrl =
  process.env.CLIENT_URL ||
  'http://localhost:5173'

// ==========================================
// CROSS-ORIGIN RESOURCE SHARING
// ==========================================

app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  }),
)

// ==========================================
// REQUEST BODY PARSING
// ==========================================

app.use(
  express.json({
    limit: '1mb',
  }),
)

// ==========================================
// COOKIE PARSING
// ==========================================

app.use(cookieParser())

// ==========================================
// HEALTH CHECK
//
// GET /api/health
// ==========================================

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    message: 'Loyce Dairies API is running.',
  })
})

// ==========================================
// PUBLIC CATALOGUE ROUTES
//
// GET /api/categories
// GET /api/products
// GET /api/products/:id
// ==========================================

app.use('/api', catalogRoutes)

// ==========================================
// CUSTOMER AUTHENTICATION
//
// Registration, login, current session
// and logout.
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
// CUSTOMER ORDERS
//
// GET  /api/delivery-zones
// POST /api/orders/checkout
// GET  /api/orders
// GET  /api/orders/:orderId
//
// Inventory deduction remains part of
// the existing checkout implementation.
// ==========================================

app.use('/api', orderRoutes)

// ==========================================
// STAFF ORDER MANAGEMENT
//
// GET   /api/admin/orders
// GET   /api/admin/orders/:orderId
// PATCH /api/admin/orders/:orderId/status
// ==========================================

app.use(
  '/api/admin/orders',
  adminOrdersRouter,
)

// ==========================================
// STAFF DELIVERY-ZONE MANAGEMENT
// ==========================================

app.use(
  '/api/admin/delivery-zones',
  adminDeliveryZonesRouter,
)

// ==========================================
// STAFF INVENTORY MANAGEMENT
//
// GET   /api/admin/inventory
// GET   /api/admin/inventory/:productId/events
// PATCH /api/admin/inventory/:productId
//
// Stock reconciliation and audit events
// remain exclusively in this router.
// ==========================================

app.use(
  '/api/admin/inventory',
  adminInventoryRouter,
)

// ==========================================
// STAFF PRODUCT MANAGEMENT
// MILESTONE 4.8.2
//
// GET   /api/admin/products
// GET   /api/admin/products/:productId
// POST  /api/admin/products
// PATCH /api/admin/products/:productId
//
// Product management cannot directly
// change stockQuantity.
//
// Authentication and write protection
// are enforced inside adminProductsRouter.
// ==========================================

app.use(
  '/api/admin/products',
  adminProductsRouter,
)

// ==========================================
// UNKNOWN API ENDPOINTS
// ==========================================

// Keep this handler after all routers.

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.',
  })
})

// ==========================================
// CENTRALIZED ERROR HANDLING
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

  // Preserve existing HTTP error handling.

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

  // Log internal errors on the server,
  // without exposing implementation
  // details to clients.

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

// The error handler must remain last.

app.use(errorHandler)

// ==========================================
// EXPORT EXPRESS APPLICATION
// ==========================================

export { app }

export default app
