import 'dotenv/config'

import app from './app.js'

import {
  startOrderEscalationWorker,
} from './workers/orderEscalationWorker.js'

import {
  startStaffPushDeliveryWorker,
} from './workers/staffPushDeliveryWorker.js'

// ==========================================
// LOYCE DAIRIES PLATFORM
// BACKEND APPLICATION ENTRY POINT
//
// - Express REST API
// - Order escalation worker
// - Persistent Firebase delivery worker
// - Controlled worker activation
// - Graceful shutdown
// ==========================================

// ==========================================
// SERVER CONFIGURATION
// ==========================================

const port = Number(
  process.env.PORT ?? 5000,
)

if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  throw new Error(
    'Invalid server PORT configuration.',
  )
}

// ==========================================
// FIREBASE DELIVERY MODE
// ==========================================

const queueEnabled =
  process.env.LOYCE_FCM_QUEUE_ENABLED === '1'

const queueWorkerEnabled =
  process.env.LOYCE_FCM_QUEUE_WORKER_ENABLED === '1'

const directPushEnabled =
  process.env.LOYCE_FCM_ORDER_PUSH_ENABLED === '1'

// Prevent accidental queue activation
// without its delivery worker.
//
// Both queue flags must be enabled together.

if (queueEnabled !== queueWorkerEnabled) {
  throw new Error(
    'Firebase queue configuration mismatch. ' +
    'LOYCE_FCM_QUEUE_ENABLED and ' +
    'LOYCE_FCM_QUEUE_WORKER_ENABLED must ' +
    'both equal 1 or both remain disabled.',
  )
}

// ==========================================
// WORKER LIFECYCLE
// ==========================================

let stopEscalationWorker:
  (() => void) | null = null

let stopPushWorker:
  (() => void) | null = null

let shuttingDown = false

// ==========================================
// START EXPRESS SERVER
// ==========================================

const server = app.listen(
  port,
  () => {
    console.log(
      '----------------------------------',
    )

    console.log('Loyce Dairies API')

    console.log(
      `Server: http://localhost:${port}`,
    )

    console.log(
      `Health: http://localhost:${port}/api/health`,
    )

    console.log(
      'Firebase delivery mode:',
      queueEnabled
        ? 'Persistent PostgreSQL queue'
        : directPushEnabled
          ? 'Direct Firebase delivery'
          : 'Disabled',
    )

    console.log(
      '----------------------------------',
    )

    // ======================================
    // START BACKGROUND WORKERS
    // ======================================

    try {
      // Existing unattended-order
      // escalation worker.

      stopEscalationWorker =
        startOrderEscalationWorker()

      // New persistent Firebase worker.
      //
      // Only start when queue mode is
      // explicitly enabled.

      if (queueEnabled) {
        stopPushWorker =
          startStaffPushDeliveryWorker()
      }

    } catch (error) {
      console.error(
        '[Server] Worker startup failed:',
        error,
      )

      stopEscalationWorker?.()
      stopPushWorker?.()

      process.exitCode = 1

      server.close()
    }
  },
)

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

function shutdown(signal: string): void {
  if (shuttingDown) {
    return
  }

  shuttingDown = true

  console.log(
    `[Server] Received ${signal}`,
  )

  // Stop scheduling new sweeps.
  // Already-running database operations
  // may finish during process shutdown.

  stopPushWorker?.()
  stopEscalationWorker?.()

  server.close(() => {
    console.log(
      '[Server] HTTP server stopped.',
    )
  })
}

process.once('SIGINT', () => {
  shutdown('SIGINT')
})

process.once('SIGTERM', () => {
  shutdown('SIGTERM')
})
