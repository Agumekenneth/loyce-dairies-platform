
import { Router } from 'express'
import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'
import { getCurrentSession } from '../lib/session.js'

// ==========================================
// LOYCE DAIRIES PLATFORM
// MILESTONE 4.13
// STAFF ORDER NOTIFICATIONS API
// ==========================================

const router = Router()

// ==========================================
// REQUEST VALIDATION
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

  unreadOnly: z.enum([
    'true',
    'false',
  ]).optional(),
}).strict()

// ==========================================
// DISABLE NOTIFICATION RESPONSE CACHING
// ==========================================

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// ==========================================
// VERIFY STAFF SESSION AND AUTHORIZATION
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

    // Always verify the current account
    // and role directly against PostgreSQL.

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
// PROTECT NOTIFICATION WRITE REQUESTS
// ==========================================

const requireTrustedWrite: RequestHandler = (
  req,
  res,
  next,
) => {
  const allowedOrigin = new URL(
    process.env.CLIENT_URL ??
      'http://localhost:5173',
  ).origin

  if (req.get('Origin') !== allowedOrigin) {
    res.status(403).json({
      success: false,
      message: 'Request origin is not allowed.',
    })
    return
  }

  if (req.get('X-Loyce-Request') !== '1') {
    res.status(403).json({
      success: false,
      message: 'Required request header is missing.',
    })
    return
  }

  next()
}

// ==========================================
// RATE LIMIT NOTIFICATION UPDATES
// ==========================================

const notificationWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 90,
  standardHeaders: 'draft-8',
  legacyHeaders: false,

  message: {
    success: false,
    message:
      'Too many notification updates. Please try again later.',
  },
})

// ==========================================
// SHARED UNREAD COUNT
// ==========================================

function countUnreadAlerts(staffId: string) {
  return prisma.staffOrderAlert.count({
    where: {
      reads: {
        none: {
          staffId,
        },
      },
    },
  })
}

// ==========================================
// GET /api/admin/notifications
// LIST STAFF NOTIFICATIONS
// ==========================================

router.get('/', async (req, res, next) => {
  try {
    const parsed = listSchema.safeParse(
      req.query,
    )

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message:
          'Invalid notification search parameters.',
      })
      return
    }

    const staffId = res.locals.staffId as string

    const {
      cursor,
      limit,
      unreadOnly,
    } = parsed.data

    // Read receipts belong to individual
    // staff members, not the shared alert.

    const unreadFilter = {
      reads: {
        none: {
          staffId,
        },
      },
    }

    const [alerts, unreadCount] =
      await Promise.all([
        prisma.staffOrderAlert.findMany({
          where:
            unreadOnly === 'true'
              ? unreadFilter
              : undefined,

          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],

          take: limit + 1,

          ...(cursor
            ? {
                cursor: { id: cursor },
                skip: 1,
              }
            : {}),

          select: {
            id: true,
            orderId: true,
            createdAt: true,

            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                fulfillmentMethod: true,
                recipientName: true,
                totalUgx: true,
                createdAt: true,
              },
            },

            reads: {
              where: {
                staffId,
              },

              select: {
                readAt: true,
              },

              take: 1,
            },
          },
        }),

        countUnreadAlerts(staffId),
      ])

    const hasMore = alerts.length > limit
    const visibleAlerts = alerts.slice(0, limit)

    const nextCursor = hasMore
      ? visibleAlerts[visibleAlerts.length - 1]?.id ??
        null
      : null

    const notifications = visibleAlerts.map(
      (alert) => {
        const readAt =
          alert.reads[0]?.readAt ?? null

        return {
          id: alert.id,
          type: 'NEW_ORDER' as const,
          title: 'New customer order',

          message:
            `Order ${alert.order.orderNumber} ` +
            'has been placed.',

          orderId: alert.orderId,
          order: alert.order,
          createdAt: alert.createdAt,
          readAt,
          isRead: readAt !== null,
        }
      },
    )

    res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      hasMore,
      nextCursor,
      data: notifications,
    })
  } catch (error) {
    next(error)
  }
})

// ==========================================
// GET /api/admin/notifications/unread-count
// ==========================================

router.get(
  '/unread-count',
  async (_req, res, next) => {
    try {
      const staffId =
        res.locals.staffId as string

      const unreadCount =
        await countUnreadAlerts(staffId)

      res.status(200).json({
        success: true,
        unreadCount,
      })
    } catch (error) {
      next(error)
    }
  },
)

// ==========================================
// PATCH /api/admin/notifications/:alertId/read
// MARK ONE NOTIFICATION AS READ
// ==========================================

router.patch(
  '/:alertId/read',
  requireTrustedWrite,
  notificationWriteLimiter,

  async (req, res, next) => {
    try {
      const alertId = req.params.alertId

      if (
        typeof alertId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,100}$/.test(alertId)
      ) {
        res.status(404).json({
          success: false,
          message: 'Notification not found.',
        })
        return
      }

      const staffId =
        res.locals.staffId as string

      // Verify that the notification
      // actually exists.

      const alert =
        await prisma.staffOrderAlert.findUnique({
          where: {
            id: alertId,
          },

          select: {
            id: true,
          },
        })

      if (!alert) {
        res.status(404).json({
          success: false,
          message: 'Notification not found.',
        })
        return
      }

      // Create a read receipt only if none
      // exists for this staff member.
      //
      // The composite primary key prevents
      // duplicate receipts.
      //
      // Repeated requests are idempotent:
      // the original readAt is preserved.

      await prisma.staffOrderAlertRead.createMany({
        data: [{
          staffId,
          alertId,
        }],

        skipDuplicates: true,
      })

      const receipt =
        await prisma.staffOrderAlertRead.findUnique({
          where: {
            staffId_alertId: {
              staffId,
              alertId,
            },
          },

          select: {
            readAt: true,
          },
        })

      const unreadCount =
        await countUnreadAlerts(staffId)

      res.status(200).json({
        success: true,
        message: 'Notification marked as read.',

        data: {
          alertId,
          readAt: receipt?.readAt ?? null,
          isRead: true,
        },

        unreadCount,
      })
    } catch (error) {
      next(error)
    }
  },
)

// ==========================================
// EXPORT STAFF NOTIFICATION ROUTER
// ==========================================

export default router
