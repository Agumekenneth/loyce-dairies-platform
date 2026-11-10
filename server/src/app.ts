
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import type { ErrorRequestHandler } from 'express'

// ==========================================
// LOYCE DAIRIES PLATFORM
// EXPRESS APPLICATION CONFIGURATION
// ==========================================

// ==========================================
// PUBLIC PRODUCT CATALOGUE
// ==========================================

import catalogRoutes from './routes/catalog.js'

// ==========================================
// CUSTOMER AUTHENTICATION
// ==========================================

import authRoutes from './routes/auth.js'
import sessionRoutes from './routes/sessions.js'

// ==========================================
// EMAIL VERIFICATION AND PASSWORD RECOVERY
// ==========================================

import emailVerificationRoutes from './routes/emailVerification.js'
import passwordRecoveryRoutes from './routes/passwordRecovery.js'

// ==========================================
// CUSTOMER CHECKOUT AND ORDER HISTORY
// ==========================================

import orderRoutes from './routes/orders.js'

// ==========================================
// STAFF ORDER MANAGEMENT
// ==========================================

import adminOrdersRouter from './routes/adminOrders.js'

// ==========================================
// STAFF DELIVERY-ZONE MANAGEMENT
// ==========================================

import adminDeliveryZonesRouter from './routes/adminDeliveryZones.js'

// ==========================================
// STAFF INVENTORY MANAGEMENT
// MILESTONE 4.7.1
// ==========================================

import adminInventoryRouter from './routes/adminInventory.js'

// ==========================================
// INITIALIZE EXPRESS APPLICATION
// ==========================================

const app = express()

// Remove the default technology-identification
// header from HTTP responses.

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

// Allow the configured React frontend
// to communicate with the Express API.
//
// credentials: true allows authenticated
// requests using HTTP-only session cookies.

app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  }),
)

// ==========================================
// REQUEST BODY PARSING
// ==========================================

// Parse JSON request bodies.
// Apply a size limit to reduce exposure
// to unexpectedly large requests.

app.use(
  express.json({
    limit: '1mb',
  }),
)

// ==========================================
// COOKIE PARSING
// ==========================================

// Required by customer authentication
// and session-based staff authorization.

app.use(cookieParser())

// ==========================================
// APPLICATION HEALTH CHECK
// ==========================================

// GET /api/health
//
// Indicates that the Express process
// is responding.
//
// This is not a database health check.

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    message: 'Loyce Dairies API is running.',
  })
})

// ==========================================
// PUBLIC PRODUCT CATALOGUE ROUTES
// ==========================================

// GET /api/categories
// GET /api/products
// GET /api/products/:id

app.use('/api', catalogRoutes)

// ==========================================
// CUSTOMER AUTHENTICATION ROUTES
// ==========================================

// Customer registration and login.

app.use('/api/auth', authRoutes)

// Customer session management,
// including session validation and logout.

app.use('/api/auth', sessionRoutes)

// ==========================================
// EMAIL VERIFICATION ROUTES
// ==========================================

app.use(
  '/api/auth/email',
  emailVerificationRoutes,
)

// ==========================================
// PASSWORD RECOVERY ROUTES
// ==========================================

app.use(
  '/api/auth/password',
  passwordRecoveryRoutes,
)

// ==========================================
// CUSTOMER CHECKOUT AND ORDER ROUTES
// ==========================================

// GET  /api/delivery-zones
// POST /api/orders/checkout
// GET  /api/orders
// GET  /api/orders/:orderId

// Checkout validates product availability,
// retrieves prices from PostgreSQL,
// and performs inventory deductions.

app.use('/api', orderRoutes)

// ==========================================
// STAFF ORDER MANAGEMENT ROUTES
// ==========================================

// GET   /api/admin/orders
// GET   /api/admin/orders/:orderId
// PATCH /api/admin/orders/:orderId/status

// Staff authorization is enforced inside
// the administrative router.

app.use(
  '/api/admin/orders',
  adminOrdersRouter,
)

// ==========================================
// STAFF DELIVERY-ZONE MANAGEMENT ROUTES
// ==========================================

// Staff can configure delivery zones,
// manage activation and review audit events.

app.use(
  '/api/admin/delivery-zones',
  adminDeliveryZonesRouter,
)

// ==========================================
// STAFF INVENTORY MANAGEMENT ROUTES
// MILESTONE 4.7.1
// ==========================================

// GET /api/admin/inventory
//
// Lists product stock balances.

// GET /api/admin/inventory/:productId/events
//
// Retrieves inventory movement history.

// PATCH /api/admin/inventory/:productId
//
// Changes a product's stock quantity and
// records an inventory audit event.

// Authentication, staff role verification,
// trusted write-request checks and rate
// limiting are handled by adminInventoryRouter.

app.use(
  '/api/admin/inventory',
  adminInventoryRouter,
)

// ==========================================
// UNKNOWN ROUTE HANDLER
// ==========================================

// Register this after all valid routes.

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.',
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
  // Delegate errors if the response
  // headers have already been sent.

  if (res.headersSent) {
    next(error)
    return
  }

  // Express/body-parser errors may contain
  // an HTTP status code.

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

  // Log server-side errors without exposing
  // database details or stack traces
  // to clients.

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

// Register the centralized error handler last.

app.use(errorHandler)

// ==========================================
// EXPORT EXPRESS APPLICATION
// ==========================================

export { app }

export default app
