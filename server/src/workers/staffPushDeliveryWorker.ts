import {
  applicationDefault,
  getApps,
  initializeApp,
} from 'firebase-admin/app'

import { getMessaging } from 'firebase-admin/messaging'
import { prisma } from '../lib/prisma.js'

// ==========================================
// LOYCE DAIRIES
// PERSISTENT FIREBASE DELIVERY WORKER
// ==========================================

const FIREBASE_APP_NAME = 'loyce-staff-push'
const ORDER_CHANNEL_ID = 'loyce_orders_v1'

const MAX_ATTEMPTS = 5
const BATCH_SIZE = 10
const LEASE_MS = 120_000
const DEFAULT_INTERVAL_MS = 15_000
const DEVICE_FRESHNESS_MS = 30 * 24 * 60 * 60 * 1000

type ClaimedJob = {
  id: string
  orderId: string
  deviceId: string
  attempts: number
}

type Outcome =
  | 'sent'
  | 'retried'
  | 'failed'
  | 'cancelled'
  | 'stale'

export type PushQueueSweepResult = {
  claimed: number
  sent: number
  retried: number
  failed: number
  cancelled: number
}

// ==========================================
// FIREBASE ADMIN INITIALIZATION
// ==========================================

function messaging() {
  const existing = getApps().find(
    (app) => app.name === FIREBASE_APP_NAME,
  )

  const app = existing ?? initializeApp(
    {
      credential: applicationDefault(),
      projectId: 'loyce-dairies',
    },
    FIREBASE_APP_NAME,
  )

  return getMessaging(app)
}

// ==========================================
// SANITIZED ERROR CODES
// ==========================================

function errorCode(error: unknown): string {
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^[a-zA-Z0-9/_-]{1,120}$/.test(error.code)
  ) {
    return error.code
  }

  return 'unknown_error'
}

// ==========================================
// EXPONENTIAL BACKOFF
// ==========================================

function nextRetryTime(attempts: number): Date {
  const baseDelay = Math.min(
    15_000 * 2 ** Math.max(0, attempts - 1),
    600_000,
  )

  const jitter = Math.floor(Math.random() * 5_000)

  return new Date(Date.now() + baseDelay + jitter)
}

// ==========================================
// ATOMIC POSTGRESQL JOB CLAIM
// ==========================================

async function claimDueJobs(
  now: Date,
): Promise<ClaimedJob[]> {
  const leaseUntil = new Date(
    now.getTime() + LEASE_MS,
  )

  // SKIP LOCKED prevents concurrent workers
  // from claiming the same available job.
  //
  // An expired processing lease makes a
  // job eligible for another attempt.

  return prisma.$queryRaw<ClaimedJob[]>`
    WITH due AS (
      SELECT j."id"
      FROM "StaffPushDeliveryJob" AS j
      WHERE
        j."attempts" < ${MAX_ATTEMPTS}
        AND (
          (
            j."status" =
              'PENDING'::"StaffPushDeliveryStatus"
            AND j."nextAttemptAt" <= ${now}
          )
          OR
          (
            j."status" =
              'PROCESSING'::"StaffPushDeliveryStatus"
            AND (
              j."lockedUntil" <= ${now}
              OR j."lockedUntil" IS NULL
            )
          )
        )
      ORDER BY j."nextAttemptAt", j."createdAt"
      LIMIT ${BATCH_SIZE}
      FOR UPDATE OF j SKIP LOCKED
    )

    UPDATE "StaffPushDeliveryJob" AS job
    SET
      "status" =
        'PROCESSING'::"StaffPushDeliveryStatus",
      "attempts" = job."attempts" + 1,
      "lockedUntil" = ${leaseUntil},
      "updatedAt" = ${now}
    FROM due
    WHERE job."id" = due."id"

    RETURNING
      job."id",
      job."orderId",
      job."deviceId",
      job."attempts"
  `
}

// ==========================================
// FINALIZE ONLY CURRENT JOB ATTEMPT
// ==========================================

async function finishJob(
  job: ClaimedJob,
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED',
  options: {
    code?: string | null
    nextAttemptAt?: Date
    sentAt?: Date
  } = {},
): Promise<boolean> {
  const result = await prisma.staffPushDeliveryJob.updateMany({
    where: {
      id: job.id,
      status: 'PROCESSING',
      attempts: job.attempts,
    },

    data: {
      status,
      lockedUntil: null,
      lastErrorCode: options.code ?? null,
      ...(options.nextAttemptAt
        ? { nextAttemptAt: options.nextAttemptAt }
        : {}),
      ...(options.sentAt
        ? { sentAt: options.sentAt }
        : {}),
    },
  })

  return result.count === 1
}

// ==========================================
// PROCESS ONE QUEUED NOTIFICATION
// ==========================================

async function processJob(
  job: ClaimedJob,
): Promise<Outcome> {
  const [order, device] = await Promise.all([
    prisma.order.findUnique({
      where: { id: job.orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
      },
    }),

    prisma.staffPushDevice.findUnique({
      where: { id: job.deviceId },
      select: {
        id: true,
        token: true,
        platform: true,
        isActive: true,
        revokedAt: true,
        lastSeenAt: true,

        staff: {
          select: {
            role: true,
            isActive: true,
            emailVerifiedAt: true,
          },
        },
      },
    }),
  ])

  // ========================================
  // RECHECK ORDER AND STAFF AUTHORIZATION
  // ========================================

  const eligible =
    order !== null &&
    order.status === 'PENDING' &&
    device !== null &&
    device.platform === 'ANDROID' &&
    device.isActive &&
    device.revokedAt === null &&
    device.lastSeenAt.getTime() >=
      Date.now() - DEVICE_FRESHNESS_MS &&
    device.staff.isActive &&
    device.staff.role === 'STAFF' &&
    device.staff.emailVerifiedAt !== null

  if (!eligible || !order || !device) {
    const updated = await finishJob(
      job,
      'CANCELLED',
      { code: 'target_ineligible' },
    )

    return updated ? 'cancelled' : 'stale'
  }

  // ========================================
  // SEND TO EXACTLY ONE REGISTERED DEVICE
  // ========================================

  try {
    await messaging().send({
      token: device.token,

      notification: {
        title: 'New Loyce Dairies order',
        body:
          `Order ${order.orderNumber} is awaiting review.`,
      },

      data: {
        type: 'NEW_ORDER',
        orderId: order.id,
        route:
          `/staff/orders?orderId=${encodeURIComponent(order.id)}`,
      },

      android: {
        priority: 'high',
        notification: {
          channelId: ORDER_CHANNEL_ID,
        },
      },
    })

    // SENT means accepted by FCM,
    // not confirmed displayed by Android.

    const updated = await finishJob(
      job,
      'SENT',
      { sentAt: new Date() },
    )

    return updated ? 'sent' : 'stale'

  } catch (error: unknown) {
    const code = errorCode(error)

    // ======================================
    // INVALID FIREBASE REGISTRATION TOKEN
    // ======================================

    const invalidToken =
      code ===
        'messaging/registration-token-not-registered' ||
      code ===
        'messaging/invalid-registration-token'

    if (invalidToken) {
      await prisma.staffPushDevice.updateMany({
        where: {
          id: device.id,
          token: device.token,
          isActive: true,
        },

        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      })
    }

    // Non-retryable configuration or
    // invalid-target errors.

    const permanentError =
      invalidToken ||
      code === 'messaging/invalid-argument' ||
      code === 'messaging/mismatched-credential' ||
      code === 'messaging/invalid-package-name' ||
      code === 'messaging/third-party-auth-error'

    if (
      permanentError ||
      job.attempts >= MAX_ATTEMPTS
    ) {
      const updated = await finishJob(
        job,
        'FAILED',
        { code },
      )

      return updated ? 'failed' : 'stale'
    }

    // ======================================
    // RETRY TRANSIENT FAILURES
    // ======================================

    const updated = await finishJob(
      job,
      'PENDING',
      {
        code,
        nextAttemptAt:
          nextRetryTime(job.attempts),
      },
    )

    return updated ? 'retried' : 'stale'
  }
}

// ==========================================
// PROCESS ONE QUEUE SWEEP
// ==========================================

export async function runStaffPushDeliverySweep():
  Promise<PushQueueSweepResult> {
  const now = new Date()

  // Recover jobs that exhausted their
  // attempts before the process stopped.

  const exhausted =
    await prisma.staffPushDeliveryJob.updateMany({
      where: {
        attempts: { gte: MAX_ATTEMPTS },

        OR: [
          { status: 'PENDING' },
          {
            status: 'PROCESSING',
            OR: [
              { lockedUntil: { lte: now } },
              { lockedUntil: null },
            ],
          },
        ],
      },

      data: {
        status: 'FAILED',
        lockedUntil: null,
        lastErrorCode: 'max_attempts_exceeded',
      },
    })

  const jobs = await claimDueJobs(now)

  const result: PushQueueSweepResult = {
    claimed: jobs.length,
    sent: 0,
    retried: 0,
    failed: exhausted.count,
    cancelled: 0,
  }

  // Process sequentially to limit FCM load
  // on the current lightweight server.

  for (const job of jobs) {
    try {
      const outcome = await processJob(job)

      switch (outcome) {
        case 'sent':
          result.sent += 1
          break

        case 'retried':
          result.retried += 1
          break

        case 'failed':
          result.failed += 1
          break

        case 'cancelled':
          result.cancelled += 1
          break

        case 'stale':
          // Another attempt may have
          // acquired the expired lease.
          break
      }
    } catch {
      // Leave an unsuccessful claim under
      // its lease. Once it expires, another
      // sweep can recover the job.

      console.error(
        '[Staff Push Worker] Job processing failed.',
      )
    }
  }

  return result
}

// ==========================================
// START AND STOP BACKGROUND WORKER
// ==========================================

export function startStaffPushDeliveryWorker():
  () => void {
  // Explicit switch prevents accidental
  // activation during implementation.

  if (
    process.env.LOYCE_FCM_QUEUE_WORKER_ENABLED !== '1'
  ) {
    console.log(
      '[Staff Push Worker] Disabled.',
    )

    return () => {}
  }

  const interval = Number(
    process.env.LOYCE_FCM_QUEUE_INTERVAL_MS ??
      DEFAULT_INTERVAL_MS,
  )

  if (
    !Number.isSafeInteger(interval) ||
    interval < 5_000 ||
    interval > 3_600_000
  ) {
    throw new Error(
      'LOYCE_FCM_QUEUE_INTERVAL_MS must be between 5000 and 3600000.',
    )
  }

  let running = false
  let stopped = false

  const tick = async (): Promise<void> => {
    if (running || stopped) {
      return
    }

    running = true

    try {
      const result =
        await runStaffPushDeliverySweep()

      if (
        result.claimed > 0 ||
        result.failed > 0
      ) {
        console.info(
          '[Staff Push Worker] Sweep:',
          result,
        )
      }
    } catch {
      console.error(
        '[Staff Push Worker] Sweep failed.',
      )
    } finally {
      running = false
    }
  }

  void tick()

  const timer = setInterval(
    () => { void tick() },
    interval,
  )

  console.log(
    '[Staff Push Worker] Started.',
    `Interval: ${interval}ms`,
  )

  return () => {
    stopped = true
    clearInterval(timer)

    console.log(
      '[Staff Push Worker] Stopped.',
    )
  }
}
