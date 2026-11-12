
import { prisma } from '../lib/prisma.js'

// ==========================================
// LOYCE DAIRIES PLATFORM
// MILESTONE 4.17
// AUTOMATIC ORDER ESCALATION WORKER
// ==========================================

const MINUTE_MS = 60_000

const REMINDER_MINUTES = 5
const ESCALATED_MINUTES = 10
const CRITICAL_MINUTES = 15

const DEFAULT_INTERVAL_MS = 30_000

type EscalationLevel =
  | 'REMINDER'
  | 'ESCALATED'
  | 'CRITICAL'

interface CreatedEscalationRow {
  level: EscalationLevel
  count: number
}

export interface EscalationSweepResult {
  reminder: number
  escalated: number
  critical: number
  total: number
}

// ==========================================
// PROCESS DUE ESCALATIONS
// ==========================================

export async function runOrderEscalationSweep(
  evaluatedAt: Date = new Date(),
): Promise<EscalationSweepResult> {
  if (!Number.isFinite(evaluatedAt.getTime())) {
    throw new Error('Invalid escalation evaluation time.')
  }

  const reminderCutoff = new Date(
    evaluatedAt.getTime() -
      REMINDER_MINUTES * MINUTE_MS,
  )

  const escalatedCutoff = new Date(
    evaluatedAt.getTime() -
      ESCALATED_MINUTES * MINUTE_MS,
  )

  const criticalCutoff = new Date(
    evaluatedAt.getTime() -
      CRITICAL_MINUTES * MINUTE_MS,
  )

  // ========================================
  // ATOMIC POSTGRESQL ESCALATION INSERT
  // ========================================

  // Only PENDING orders qualify.
  //
  // FOR UPDATE SKIP LOCKED protects
  // against competing workers and
  // concurrent order-status changes.
  //
  // ON CONFLICT DO NOTHING prevents
  // duplicate stage records.
  //
  // An order already older than 15 minutes
  // may receive all three historical stage
  // records during the same sweep.

  const createdRows =
    await prisma.$queryRaw<CreatedEscalationRow[]>`
      WITH eligible_orders AS (
        SELECT
          o."id" AS "orderId",
          o."createdAt"
        FROM "Order" AS o
        WHERE
          o."status" = 'PENDING'::"OrderStatus"
          AND o."createdAt" <= ${reminderCutoff}
        FOR UPDATE OF o SKIP LOCKED
      ),

      due_stages AS (
        SELECT
          o."orderId",
          'REMINDER'::"OrderEscalationLevel"
            AS "level"
        FROM eligible_orders AS o

        UNION ALL

        SELECT
          o."orderId",
          'ESCALATED'::"OrderEscalationLevel"
            AS "level"
        FROM eligible_orders AS o
        WHERE o."createdAt" <= ${escalatedCutoff}

        UNION ALL

        SELECT
          o."orderId",
          'CRITICAL'::"OrderEscalationLevel"
            AS "level"
        FROM eligible_orders AS o
        WHERE o."createdAt" <= ${criticalCutoff}
      ),

      inserted AS (
        INSERT INTO "OrderEscalationEvent" (
          "id",
          "orderId",
          "level",
          "createdAt"
        )
        SELECT
          gen_random_uuid()::text,
          d."orderId",
          d."level",
          ${evaluatedAt}
        FROM due_stages AS d
        ON CONFLICT ("orderId", "level")
          DO NOTHING
        RETURNING "level"
      )

      SELECT
        "level",
        COUNT(*)::int AS "count"
      FROM inserted
      GROUP BY "level"
    `

  const result: EscalationSweepResult = {
    reminder: 0,
    escalated: 0,
    critical: 0,
    total: 0,
  }

  for (const row of createdRows) {
    switch (row.level) {
      case 'REMINDER':
        result.reminder += row.count
        break

      case 'ESCALATED':
        result.escalated += row.count
        break

      case 'CRITICAL':
        result.critical += row.count
        break
    }

    result.total += row.count
  }

  return result
}

// ==========================================
// START BACKGROUND WORKER
// ==========================================

export function startOrderEscalationWorker():
  () => void {
  const configuredInterval = Number(
    process.env.ORDER_ESCALATION_INTERVAL_MS ??
      DEFAULT_INTERVAL_MS,
  )

  if (
    !Number.isSafeInteger(configuredInterval) ||
    configuredInterval < 5_000 ||
    configuredInterval > 3_600_000
  ) {
    throw new Error(
      'ORDER_ESCALATION_INTERVAL_MS must be ' +
        'between 5000 and 3600000.',
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
        await runOrderEscalationSweep()

      if (result.total > 0) {
        console.log(
          '[Order Escalation Worker]',
          `Created ${result.total} event(s):`,
          result,
        )
      }
    } catch (error) {
      console.error(
        '[Order Escalation Worker] Sweep failed:',
        error,
      )
    } finally {
      running = false
    }
  }

  // Process existing overdue orders
  // when the worker starts.

  void tick()

  // Continue monitoring automatically.

  const timer = setInterval(
    () => {
      void tick()
    },
    configuredInterval,
  )

  console.log(
    '[Order Escalation Worker] Started.',
    `Interval: ${configuredInterval}ms`,
  )

  // Stop scheduling new work when called.

  return () => {
    stopped = true
    clearInterval(timer)

    console.log(
      '[Order Escalation Worker] Stopped.',
    )
  }
}
