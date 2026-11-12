
import { Router } from 'express'
import type { RequestHandler } from 'express'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'
import { getCurrentSession } from '../lib/session.js'

// ==========================================
// LOYCE DAIRIES PLATFORM
// MILESTONE 4.16
// UNATTENDED ORDER MONITORING
// ==========================================

const router = Router()

// ==========================================
// INITIAL SERVICE-LEVEL THRESHOLDS
// ==========================================

// These are provisional operational targets.
// They may be made configurable later.

const REMINDER_MINUTES = 5
const ESCALATION_MINUTES = 10
const CRITICAL_MINUTES = 15

const MILLISECONDS_PER_MINUTE = 60_000

// ==========================================
// ATTENTION LEVELS
// ==========================================

type AttentionLevel =
  | 'NORMAL'
  | 'REMINDER'
  | 'ESCALATED'
  | 'CRITICAL'

// ==========================================
// QUERY VALIDATION
// ==========================================

const listSchema = z.object({
  cursor: z.string()
    .min(1)
    .max(100)
    .optional(),

  limit: z.coerce.number()
    .int()
    .min(1)
    .max(50)
    .default(25),
}).strict()

// ==========================================
// DISABLE RESPONSE CACHING
// ==========================================

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// ==========================================
// STAFF AUTHENTICATION
// ==========================================

const requireStaff: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const session = await getCurrentSession(req)

    if (!session) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
      return
    }

    // Recheck the current account directly
    // against PostgreSQL.

    const account = await prisma.customer.findUnique({
      where: {
        id: session.customer.id,
      },

      select: {
        id: true,
        role: true,
        isActive: true,
        emailVerifiedAt: true,
      },
    })

    if (
      !account ||
      !account.isActive ||
      !account.emailVerifiedAt ||
      account.role !== 'STAFF'
    ) {
      res.status(403).json({
        success: false,
        message: 'Staff access required.',
      })
      return
    }

    res.locals.staffId = account.id

    next()
  } catch (error) {
    next(error)
  }
}

router.use(requireStaff)

// ==========================================
// ATTENTION LEVEL CALCULATION
// ==========================================

function getAttentionLevel(
  waitingMinutes: number,
): AttentionLevel {
  if (waitingMinutes >= CRITICAL_MINUTES) {
    return 'CRITICAL'
  }

  if (waitingMinutes >= ESCALATION_MINUTES) {
    return 'ESCALATED'
  }

  if (waitingMinutes >= REMINDER_MINUTES) {
    return 'REMINDER'
  }

  return 'NORMAL'
}

// ==========================================
// WAITING TIME
// ==========================================

function getWaitingMinutes(
  createdAt: Date,
  evaluatedAt: Date,
): number {
  const elapsedMilliseconds = Math.max(
    0,
    evaluatedAt.getTime() -
      createdAt.getTime(),
  )

  return Math.floor(
    elapsedMilliseconds /
      MILLISECONDS_PER_MINUTE,
  )
}

// ==========================================
// NEXT ATTENTION THRESHOLD
// ==========================================

function getNextAttentionAt(
  createdAt: Date,
  level: AttentionLevel,
): string | null {
  let threshold: number

  switch (level) {
    case 'NORMAL':
      threshold = REMINDER_MINUTES
      break

    case 'REMINDER':
      threshold = ESCALATION_MINUTES
      break

    case 'ESCALATED':
      threshold = CRITICAL_MINUTES
      break

    case 'CRITICAL':
      return null
  }

  return new Date(
    createdAt.getTime() +
      threshold * MILLISECONDS_PER_MINUTE,
  ).toISOString()
}

// ==========================================
// GET /api/admin/order-attention
// ==========================================

// An order is unattended while its status
// remains PENDING.
//
// Reading an in-app notification does not
// remove an order from this monitoring list.
//
// Once staff confirm or cancel an order,
// its status changes and it no longer
// qualifies as unattended.

router.get('/', async (req, res, next) => {
  try {
    const parsed = listSchema.safeParse(
      req.query,
    )

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid monitoring query.',
      })
      return
    }

    const {
      cursor,
      limit,
    } = parsed.data

    const evaluatedAt = new Date()
    const nowMilliseconds =
      evaluatedAt.getTime()

    const reminderCutoff = new Date(
      nowMilliseconds -
        REMINDER_MINUTES *
          MILLISECONDS_PER_MINUTE,
    )

    const escalationCutoff = new Date(
      nowMilliseconds -
        ESCALATION_MINUTES *
          MILLISECONDS_PER_MINUTE,
    )

    const criticalCutoff = new Date(
      nowMilliseconds -
        CRITICAL_MINUTES *
          MILLISECONDS_PER_MINUTE,
    )

    // ======================================
    // QUERY PENDING ORDERS AND COUNTS
    // ======================================

    const [
      totalPending,
      reminderOrOlder,
      escalatedOrOlder,
      criticalCount,
      pendingOrders,
    ] = await Promise.all([
      prisma.order.count({
        where: {
          status: 'PENDING',
        },
      }),

      prisma.order.count({
        where: {
          status: 'PENDING',
          createdAt: {
            lte: reminderCutoff,
          },
        },
      }),

      prisma.order.count({
        where: {
          status: 'PENDING',
          createdAt: {
            lte: escalationCutoff,
          },
        },
      }),

      prisma.order.count({
        where: {
          status: 'PENDING',
          createdAt: {
            lte: criticalCutoff,
          },
        },
      }),

      prisma.order.findMany({
        where: {
          status: 'PENDING',
        },

        orderBy: [
          {
            createdAt: 'asc',
          },
          {
            id: 'asc',
          },
        ],

        take: limit + 1,

        ...(cursor
          ? {
              cursor: {
                id: cursor,
              },
              skip: 1,
            }
          : {}),

        select: {
          id: true,
          orderNumber: true,
          status: true,
          recipientName: true,
          fulfillmentMethod: true,
          totalUgx: true,
          createdAt: true,

          customer: {
            select: {
              fullName: true,
            },
          },
        },
      }),
    ])

    // ======================================
    // DISJOINT ATTENTION COUNTS
    // ======================================

    const normalCount =
      totalPending - reminderOrOlder

    const reminderCount =
      reminderOrOlder - escalatedOrOlder

    const escalatedCount =
      escalatedOrOlder - criticalCount

    // ======================================
    // CURSOR PAGINATION
    // ======================================

    const hasMore =
      pendingOrders.length > limit

    const pageOrders =
      pendingOrders.slice(0, limit)

    const nextCursor = hasMore
      ? pageOrders[pageOrders.length - 1]?.id ??
        null
      : null

    // ======================================
    // CLASSIFY EACH PENDING ORDER
    // ======================================

    const attentionOrders = pageOrders.map(
      (order) => {
        const waitingMinutes =
          getWaitingMinutes(
            order.createdAt,
            evaluatedAt,
          )

        const attentionLevel =
          getAttentionLevel(waitingMinutes)

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customer.fullName,
          recipientName: order.recipientName,
          fulfillmentMethod:
            order.fulfillmentMethod,
          totalUgx: order.totalUgx,
          status: order.status,
          createdAt:
            order.createdAt.toISOString(),
          waitingMinutes,
          attentionLevel,

          nextAttentionAt:
            getNextAttentionAt(
              order.createdAt,
              attentionLevel,
            ),

          // Reuse Milestone 4.14's
          // exact-order navigation.

          reviewPath:
            `/staff/orders?orderId=${encodeURIComponent(
              order.id,
            )}`,
        }
      },
    )

    // ======================================
    // API RESPONSE
    // ======================================

    res.status(200).json({
      success: true,

      data: {
        evaluatedAt:
          evaluatedAt.toISOString(),

        thresholdsMinutes: {
          reminder: REMINDER_MINUTES,
          escalation: ESCALATION_MINUTES,
          critical: CRITICAL_MINUTES,
        },

        summary: {
          totalPending,
          normal: normalCount,
          reminder: reminderCount,
          escalated: escalatedCount,
          critical: criticalCount,

          // Total requiring attention,
          // including reminder, escalated
          // and critical orders.

          requiringAttention:
            reminderOrOlder,
        },

        orders: attentionOrders,
        nextCursor,
        hasMore,
      },
    })
  } catch (error) {
    next(error)
  }
})

// ==========================================
// EXPORT ROUTER
// ==========================================

export default router
