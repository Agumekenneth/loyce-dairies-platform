
import 'dotenv/config'

import app from './app.js'
import { startOrderEscalationWorker } from './workers/orderEscalationWorker.js'

// ==========================================
// LOYCE DAIRIES PLATFORM
// BACKEND APPLICATION ENTRY POINT
//
// MILESTONE 4.17
// AUTOMATIC ORDER ESCALATION WORKER
// ==========================================

const port = Number(process.env.PORT ?? 5000)

if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  throw new Error('Invalid server PORT configuration')
}

// ==========================================
// WORKER LIFECYCLE
// ==========================================

let stopEscalationWorker: (() => void) | null = null

// ==========================================
// START THE API SERVER
// ==========================================

const server = app.listen(port, () => {
  console.log('----------------------------------')
  console.log('Loyce Dairies API')
  console.log(`Server: http://localhost:${port}`)
  console.log(`Health: http://localhost:${port}/api/health`)
  console.log('----------------------------------')

  // Begin background monitoring after
  // the API server is listening.

  try {
    stopEscalationWorker = startOrderEscalationWorker()
  } catch (error) {
    console.error(
      '[Order Escalation Worker] Startup failed:',
      error,
    )

    process.exitCode = 1

    server.close()
  }
})

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

function shutdown(signal: string): void {
  console.log(`[Server] Received ${signal}`)

  // Stop scheduling additional sweeps.
  stopEscalationWorker?.()

  server.close(() => {
    console.log('[Server] HTTP server stopped.')
  })
}

process.once('SIGINT', () => {
  shutdown('SIGINT')
})

process.once('SIGTERM', () => {
  shutdown('SIGTERM')
})
