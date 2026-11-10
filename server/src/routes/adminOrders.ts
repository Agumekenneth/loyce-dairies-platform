
import { Router } from 'express'
import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'
import { getCurrentSession } from '../lib/session.js'

const router = Router()

// ==========================================
// VALIDATION
// ==========================================

const statusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'COMPLETED',
  'CANCELLED',
])

type OrderStatus = z.infer<typeof statusSchema>

const listSchema = z.object({
  status: statusSchema.optional(),
  cursor: z.string().min(1).max(100).optional(),
  limit: z.coerce.number()
    .int()
    .min(1)
    .max(50)
    .default(25),
}).strict()

const updateStatusSchema = z.object({
  status: statusSchema,
  note: z.string()
    .trim()
    .min(3)
    .max(300)
    .optional(),
}).strict()

// ==========================================
// ALLOWED ORDER STATUS TRANSITIONS
// ==========================================

const allowedTransitions: Record<
  OrderStatus,
  readonly OrderStatus[]
> = {
  PENDING: [
    'CONFIRMED',
    'CANCELLED',
  ],

  CONFIRMED: [
    'PREPARING',
    'CANCELLED',
  ],

  PREPARING: [
    'READY_FOR_PICKUP',
    'OUT_FOR_DELIVERY',
    'CANCELLED',
  ],

  READY_FOR_PICKUP: [
    'COMPLETED',
  ],

  OUT_FOR_DELIVERY: [
    'COMPLETED',
  ],

  COMPLETED: [],
  CANCELLED: [],
}

// ==========================================
// ERROR HANDLING
// ==========================================

class StaffOrderError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'StaffOrderError'
  }
}

// ==========================================
// STAFF AUTHORIZATION
// ==========================================

const requireStaff: RequestHandler = async (
  req,
  res,
  next,
) => {
  const session = await getCurrentSession(req)

  if (!session) {
    res.status(401).json({
      success: false,
      message: 'Authentication required.',
    })
    return
  }

  // Recheck the current database role on every request.
  // Never trust a role provided by the browser.
  const account = await prisma.customer.findUnique({
    where: {
      id: session.customer.id,
    },

    select: {
      role: true,
      isActive: true,
      emailVerifiedAt: true,
    },
  })

  if (
    !account ||
    !account.isActive ||
    account.role !== 'STAFF' ||
    !account.emailVerifiedAt
  ) {
    res.status(403).json({
      success: false,
      message: 'Staff access required.',
    })
    return
  }

  res.locals.staffId = session.customer.id
  next()
}

// All admin order endpoints require staff authorization.
router.use(requireStaff)

// ==========================================
// STRICT ORIGIN CHECK FOR UPDATES
// ==========================================

const requireTrustedUpdate: RequestHandler = (
  req,
  res,
  next,
) => {
  const allowedOrigin = new URL(
    process.env.CLIENT_URL ??
      'http://localhost:5173',
  ).origin

  const origin = req.get('Origin')

  if (origin !== allowedOrigin) {
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
// RATE LIMIT STATUS CHANGES
// ==========================================

const updateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,

  message: {
    success: false,
    message:
      'Too many order updates. Please try again later.',
  },
})

// ==========================================
// RESPONSE FIELD SELECTION
// ==========================================

const orderListSelect = {
  id: true,
  orderNumber: true,

  status: true,
  paymentStatus: true,
  paymentMethod: true,
  fulfillmentMethod: true,

  recipientName: true,
  contactPhone: true,

  totalUgx: true,
  createdAt: true,
  updatedAt: true,

  customer: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },

  _count: {
    select: {
      items: true,
    },
  },
} as const

const orderDetailsSelect = {
  ...orderListSelect,

  deliveryAddress: true,
  deliveryInstructions: true,
  deliveryZoneName: true,

  subtotalUgx: true,
  deliveryFeeUgx: true,

  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      productUnit: true,
      unitPriceUgx: true,
      quantity: true,
      lineTotalUgx: true,
    },
  },

  statusEvents: {
    orderBy: {
      createdAt: 'asc',
    },

    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      createdAt: true,

      changedBy: {
        select: {
          fullName: true,
        },
      },
    },
  },
} as const

// ==========================================
// GET /api/admin/orders
// ==========================================

router.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store')

  const parsed = listSchema.safeParse(req.query)

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid order search parameters.',
    })
    return
  }

  const {
    status,
    cursor,
    limit,
  } = parsed.data

  const orders = await prisma.order.findMany({
    where: status ? { status } : undefined,

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

    select: orderListSelect,
  })

  const hasMore = orders.length > limit
  const visibleOrders = orders.slice(0, limit)

  const nextCursor = hasMore
    ? visibleOrders[visibleOrders.length - 1].id
    : null

  res.status(200).json({
    success: true,
    count: visibleOrders.length,
    nextCursor,
    data: visibleOrders,
  })
})

// ==========================================
// GET /api/admin/orders/:orderId
// ==========================================

router.get('/:orderId', async (req, res) => {
  res.set('Cache-Control', 'no-store')

  const orderId = req.params.orderId

  if (
    typeof orderId !== 'string' ||
    !orderId ||
    orderId.length > 100
  ) {
    res.status(404).json({
      success: false,
      message: 'Order not found.',
    })
    return
  }

  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
    select: orderDetailsSelect,
  })

  if (!order) {
    res.status(404).json({
      success: false,
      message: 'Order not found.',
    })
    return
  }

  res.status(200).json({
    success: true,
    data: order,
  })
})

// ==========================================
// PATCH /api/admin/orders/:orderId/status
// ==========================================

router.patch(
  '/:orderId/status',
  requireTrustedUpdate,
  updateLimiter,
  async (req, res) => {
    res.set('Cache-Control', 'no-store')

    const orderId = req.params.orderId

    if (
      typeof orderId !== 'string' ||
      !orderId ||
      orderId.length > 100
    ) {
      res.status(404).json({
        success: false,
        message: 'Order not found.',
      })
      return
    }

    if (!req.is('application/json')) {
      res.status(415).json({
        success: false,
        message:
          'Content-Type must be application/json.',
      })
      return
    }

    const parsed = updateStatusSchema.safeParse(
      req.body,
    )

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid status update.',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      })
      return
    }

    const { status: nextStatus, note } = parsed.data

    if (
      nextStatus === 'CANCELLED' &&
      !note
    ) {
      res.status(400).json({
        success: false,
        message:
          'A reason is required to cancel an order.',
      })
      return
    }

    const staffId = res.locals.staffId as string

    try {
      const updatedOrder = await prisma.$transaction(
        async (tx) => {
          // Read current order status.
          const currentOrder =
            await tx.order.findUnique({
              where: {
                id: orderId,
              },

              select: {
                id: true,
                status: true,
                fulfillmentMethod: true,
              },
            })

          if (!currentOrder) {
            throw new StaffOrderError(
              404,
              'Order not found.',
            )
          }

          const allowed =
            allowedTransitions[currentOrder.status]

          if (!allowed.includes(nextStatus)) {
            throw new StaffOrderError(
              422,
              `Cannot change order status from ${currentOrder.status} to ${nextStatus}.`,
            )
          }

          // Enforce fulfillment-specific statuses.
          if (
            nextStatus === 'READY_FOR_PICKUP' &&
            currentOrder.fulfillmentMethod !== 'PICKUP'
          ) {
            throw new StaffOrderError(
              422,
              'Only pickup orders can be marked ready for pickup.',
            )
          }

          if (
            nextStatus === 'OUT_FOR_DELIVERY' &&
            currentOrder.fulfillmentMethod !== 'DELIVERY'
          ) {
            throw new StaffOrderError(
              422,
              'Only delivery orders can be marked out for delivery.',
            )
          }

          // Optimistic concurrency control:
          // update only if the current status
          // still matches what we read.
          const result = await tx.order.updateMany({
            where: {
              id: currentOrder.id,
              status: currentOrder.status,
            },

            data: {
              status: nextStatus,
            },
          })

          if (result.count !== 1) {
            throw new StaffOrderError(
              409,
              'This order changed during the update. Refresh and try again.',
            )
          }

          // Record who changed the order.
          // This is saved in the same transaction.
          await tx.orderStatusEvent.create({
            data: {
              order: {
                connect: {
                  id: currentOrder.id,
                },
              },

              changedBy: {
                connect: {
                  id: staffId,
                },
              },

              fromStatus: currentOrder.status,
              toStatus: nextStatus,
              note: note ?? null,
            },
          })

          return tx.order.findUniqueOrThrow({
            where: {
              id: currentOrder.id,
            },

            select: orderDetailsSelect,
          })
        },
      )

      res.status(200).json({
        success: true,
        message: 'Order status updated successfully.',
        data: updatedOrder,
      })
    } catch (error: unknown) {
      if (error instanceof StaffOrderError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        })
        return
      }

      throw error
    }
  },
)

export default router
