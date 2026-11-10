
import express from 'express'
import cors from 'cors'

import type { ErrorRequestHandler } from 'express'

import catalogRoutes from './routes/catalog.js'

const app = express()

// Basic security
app.disable('x-powered-by')

// Allow requests from the frontend
app.use(
  cors({
    origin:
      process.env.CLIENT_URL ??
      'http://localhost:5173',
  }),
)

// Parse JSON requests
app.use(
  express.json({
    limit: '1mb',
  }),
)

// API welcome endpoint
app.get('/api', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Loyce Dairies API',
  })
})

// API health check
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    service: 'loyce-dairies-api',
    timestamp: new Date().toISOString(),
  })
})

// Catalogue routes
app.use('/api', catalogRoutes)

// Handle undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  })
})

// Centralized error handling
const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  console.error('API error:', error)

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  })
}

app.use(errorHandler)

export default app
