
import 'dotenv/config'

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app'

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
// - Secure Railway Firebase credentials
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

if (queueEnabled !== queueWorkerEnabled) {
  throw new Error(
    'Firebase queue configuration mismatch. ' +
    'LOYCE_FCM_QUEUE_ENABLED and ' +
    'LOYCE_FCM_QUEUE_WORKER_ENABLED must ' +
    'both equal 1 or both remain disabled.',
  )
}

// ==========================================
// FIREBASE ADMIN AUTHENTICATION
// ==========================================

// Must match the existing delivery worker.
const FIREBASE_APP_NAME = 'loyce-staff-push'
const FIREBASE_PROJECT_ID = 'loyce-dairies'

function initializeStaffQueueFirebase(): void {
  // Do not initialize cloud push credentials
  // when the delivery queue is disabled.

  if (!queueEnabled) {
    return
  }

  const existing = getApps().find(
    (firebaseApp) =>
      firebaseApp.name === FIREBASE_APP_NAME,
  )

  if (existing) {
    return
  }

  const credentialsJson =
    process.env.LOYCE_FIREBASE_SERVICE_ACCOUNT_JSON

  // Retain Application Default Credentials
  // for local development only.
  //
  // Railway production must explicitly
  // provide its sealed service-account JSON.

  if (!credentialsJson) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Firebase Admin service-account secret ' +
        'is required for cloud push delivery.',
      )
    }

    initializeApp(
      {
        credential: applicationDefault(),
        projectId: FIREBASE_PROJECT_ID,
      },
      FIREBASE_APP_NAME,
    )

    console.log(
      '[Firebase] Local credentials initialized.',
    )

    return
  }

  // ========================================
  // PARSE THE RAILWAY SECRET SAFELY
  // ========================================

  let parsedCredentials: unknown

  try {
    parsedCredentials =
      JSON.parse(credentialsJson)
  } catch {
    // Do not log the JSON or parsing details:
    // they may expose secret material.

    throw new Error(
      'Firebase Admin secret must contain valid JSON.',
    )
  }

  if (
    parsedCredentials === null ||
    typeof parsedCredentials !== 'object' ||
    Array.isArray(parsedCredentials)
  ) {
    throw new Error(
      'Firebase Admin secret has an invalid structure.',
    )
  }

  const credentials =
    parsedCredentials as Record<string, unknown>

  const projectId = credentials.project_id
  const clientEmail = credentials.client_email
  const privateKey = credentials.private_key

  // ========================================
  // VALIDATE REQUIRED FIELDS
  // ========================================

  if (projectId !== FIREBASE_PROJECT_ID) {
    throw new Error(
      'Firebase Admin project ID does not match ' +
      'the Loyce Dairies Firebase project.',
    )
  }

  if (
    typeof clientEmail !== 'string' ||
    clientEmail.trim().length === 0 ||
    typeof privateKey !== 'string' ||
    !privateKey.includes('BEGIN PRIVATE KEY')
  ) {
    throw new Error(
      'Firebase Admin secret is missing ' +
      'required service-account credentials.',
    )
  }

  // ========================================
  // INITIALIZE FIREBASE ADMIN
  // ========================================

  try {
    initializeApp(
      {
        credential: cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail,
          privateKey,
        }),

        projectId: FIREBASE_PROJECT_ID,
      },

      FIREBASE_APP_NAME,
    )
  } catch {
    throw new Error(
      'Firebase Admin credentials could not ' +
      'be initialized.',
    )
  }

  // Never log service-account values.
  console.log(
    '[Firebase] Cloud service-account ' +
    'credentials initialized.',
  )
}

// Validate credentials before starting
// a queue-enabled API server.

initializeStaffQueueFirebase()

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
      stopEscalationWorker =
        startOrderEscalationWorker()

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
