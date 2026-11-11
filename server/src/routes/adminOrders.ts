
import { Router } from 'express'
import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'
import { getCurrentSession } from '../lib/session.js'

// ==========================================
// LOYCE DAIRIES PLATFORM
// MILESTONE 4.7.2
// STAFF ORDER MANAGEMENT
// WITH AUTOMATIC INVENTORY RESTORATION
// ==========================================

const router = Router()

const MAX_DATABASE_INTEGER = 2_147_483_647

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
// STAFF ORDER ERROR
// ==========================================

class StaffOrderError extends Error {
  readonly statusCode: number

  constructor(
    statusCode: number,
    message: string,
  ) {
    super(message)

    this.name = 'StaffOrderError'
    this.statusCode = statusCode
  }
}

// ==========================================
// STAFF AUTHENTICATION AND AUTHORIZATION
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

  // Recheck staff permissions against
  // PostgreSQL on every request.

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
    account.role !== 'STAFF' ||
    !account.emailVerifiedAt
  ) {
    res.status(403).json({
      success: false,
      message: 'Staff access required.',
    })
    return
  }

  res.locals.staffId = account.id

  next()
}

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
// ORDER RESPONSE FIELD SELECTION
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
//
// STAFF ORDER LIST
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

  const visibleOrders = orders.slice(
    0,
    limit,
  )

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
//
// STAFF ORDER DETAILS
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
//
// UPDATE ORDER STATUS AND RESTORE STOCK
// ==========================================

router.patch(
  '/:orderId/status',
  requireTrustedUpdate,
  updateLimiter,

  async (req, res) => {
    res.set('Cache-Control', 'no-store')

    // ======================================
    // VALIDATE ORDER ID
    // ======================================

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

    // ======================================
    // VALIDATE CONTENT TYPE
    // ======================================

    if (!req.is('application/json')) {
      res.status(415).json({
        success: false,
        message:
          'Content-Type must be application/json.',
      })
      return
    }

    // ======================================
    // VALIDATE STATUS CHANGE
    // ======================================

    const parsed = updateStatusSchema.safeParse(
      req.body,
    )

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid status update.',

        errors: parsed.error.issues.map(
          (issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }),
        ),
      })
      return
    }

    const {
      status: nextStatus,
      note,
    } = parsed.data

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
      // ====================================
      // ATOMIC ORDER-STATUS TRANSACTION
      // ====================================

      const updatedOrder = await prisma.$transaction(
        async (tx) => {
          // ==================================
          // 1. RETRIEVE CURRENT ORDER
          // ==================================

          const currentOrder =
            await tx.order.findUnique({
              where: {
                id: orderId,
              },

              select: {
                id: true,
                status: true,
                fulfillmentMethod: true,

                // Needed to verify that the
                // inventory events correspond
                // to purchased quantities.
                items: {
                  select: {
                    productId: true,
                    quantity: true,
                  },
                },
              },
            })

          if (!currentOrder) {
            throw new StaffOrderError(
              404,
              'Order not found.',
            )
          }

          // ==================================
          // 2. VERIFY ALLOWED TRANSITION
          // ==================================

          const allowed =
            allowedTransitions[currentOrder.status]

          if (!allowed.includes(nextStatus)) {
            throw new StaffOrderError(
              422,
              `Cannot change order status from ${currentOrder.status} to ${nextStatus}.`,
            )
          }

          // ==================================
          // 3. CHECK FULFILLMENT METHOD
          // ==================================

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

          // ==================================
          // 4. CONDITIONAL STATUS UPDATE
          // ==================================

          // Only one request can successfully
          // transition this order from its
          // current status.
          //
          // This protects against repeated
          // cancellation and duplicate
          // stock restoration.

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

          // ==================================
          // 5. RESTORE STOCK ON CANCELLATION
          // ==================================

          if (nextStatus === 'CANCELLED') {
            // Only inventory movements
            // recorded at checkout are
            // eligible for restoration.
            //
            // Historical orders created
            // before inventory tracking
            // have no ORDER_PLACED events
            // and must not gain stock.

            const placementEvents =
              await tx.inventoryEvent.findMany({
                where: {
                  orderId: currentOrder.id,
                  action: 'ORDER_PLACED',
                },

                select: {
                  productId: true,
                  productName: true,
                  productUnit: true,
                  quantityChange: true,
                },

                orderBy: {
                  productId: 'asc',
                },
              })

            // Detect any previously recorded
            // restoration event.
            //
            // This is an additional safeguard
            // alongside the conditional
            // order-status update.

            const previousRestoration =
              await tx.inventoryEvent.findFirst({
                where: {
                  orderId: currentOrder.id,
                  action: 'ORDER_CANCELLED',
                },

                select: {
                  id: true,
                },
              })

            if (previousRestoration) {
              throw new StaffOrderError(
                409,
                'Inventory has already been restored for this order. Review its history.',
              )
            }

            if (placementEvents.length > 0) {
              // =================================
              // VERIFY ALL PURCHASED ITEMS
              // =================================

              // Every item in an inventory-
              // tracked order should have
              // exactly one matching checkout
              // deduction event.

              if (
                placementEvents.length !==
                currentOrder.items.length
              ) {
                throw new StaffOrderError(
                  409,
                  'Inventory records for this order are incomplete. Manual reconciliation is required.',
                )
              }

              const purchasedItems = new Map(
                currentOrder.items.map(
                  (item) => [
                    item.productId,
                    item.quantity,
                  ],
                ),
              )

              if (
                purchasedItems.size !==
                currentOrder.items.length
              ) {
                throw new StaffOrderError(
                  409,
                  'Order items require inventory reconciliation.',
                )
              }

              const restorationRecords: Array<{
                productId: number
                productName: string
                productUnit: string
                orderId: string
                changedById: string
                action: 'ORDER_CANCELLED'
                quantityChange: number
                quantityBefore: number
                quantityAfter: number
                note: string
              }> = []

              // =================================
              // RESTORE PRODUCT QUANTITIES
              // =================================

              // The events are processed in
              // product ID order, reducing
              // potential database deadlocks.

              for (const movement of placementEvents) {
                const productId =
                  movement.productId

                // A deleted product cannot
                // be restored automatically.
                // Fail rather than silently
                // recording incomplete stock.

                if (productId === null) {
                  throw new StaffOrderError(
                    409,
                    'A purchased product no longer exists. Manual stock reconciliation is required.',
                  )
                }

                const restoreQuantity =
                  -movement.quantityChange

                const purchasedQuantity =
                  purchasedItems.get(productId)

                if (
                  !Number.isSafeInteger(restoreQuantity) ||
                  restoreQuantity <= 0 ||
                  restoreQuantity > MAX_DATABASE_INTEGER ||
                  purchasedQuantity !== restoreQuantity
                ) {
                  throw new StaffOrderError(
                    409,
                    'Inventory movement quantities are inconsistent with this order.',
                  )
                }

                // Read the current balance.

                const product =
                  await tx.product.findUnique({
                    where: {
                      id: productId,
                    },

                    select: {
                      id: true,
                      stockQuantity: true,
                    },
                  })

                if (!product) {
                  throw new StaffOrderError(
                    409,
                    'A purchased product could not be found. Stock reconciliation is required.',
                  )
                }

                const quantityBefore =
                  product.stockQuantity

                const quantityAfter =
                  quantityBefore +
                  restoreQuantity

                // Prevent overflow beyond
                // PostgreSQL INTEGER limits.

                if (
                  !Number.isSafeInteger(quantityAfter) ||
                  quantityAfter > MAX_DATABASE_INTEGER
                ) {
                  throw new StaffOrderError(
                    409,
                    'Restoring this stock would exceed the supported inventory limit.',
                  )
                }

                // =================================
                // ATOMIC CONDITIONAL INCREMENT
                // =================================

                // If another transaction has
                // changed this product's stock,
                // reject this attempt instead
                // of writing incorrect audit
                // quantities.

                const stockUpdate =
                  await tx.product.updateMany({
                    where: {
                      id: productId,
                      stockQuantity: quantityBefore,
                    },

                    data: {
                      stockQuantity: {
                        increment: restoreQuantity,
                      },
                    },
                  })

                if (stockUpdate.count !== 1) {
                  throw new StaffOrderError(
                    409,
                    'Product stock changed during restoration. Refresh and retry.',
                  )
                }

                // Prepare the inventory event.

                restorationRecords.push({
                  productId,

                  productName:
                    movement.productName,

                  productUnit:
                    movement.productUnit,

                  orderId:
                    currentOrder.id,

                  changedById:
                    staffId,

                  action:
                    'ORDER_CANCELLED',

                  quantityChange:
                    restoreQuantity,

                  quantityBefore,
                  quantityAfter,

                  note:
                    `Stock restored after order cancellation: ${note}`,
                })
              }

              // =================================
              // RECORD INVENTORY RESTORATION
              // =================================

              // Store all inventory events
              // in the same transaction as
              // the order-status change.

              await tx.inventoryEvent.createMany({
                data: restorationRecords,
              })
            }

            // Historical orders with zero
            // ORDER_PLACED events receive
            // no artificial stock changes.
          }

          // ==================================
          // 6. RECORD ORDER STATUS HISTORY
          // ==================================

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

              fromStatus:
                currentOrder.status,

              toStatus:
                nextStatus,

              note: note ?? null,
            },
          })

          // ==================================
          // 7. RETURN UPDATED ORDER
          // ==================================

          return tx.order.findUniqueOrThrow({
            where: {
              id: currentOrder.id,
            },

            select: orderDetailsSelect,
          })
        },
      )

      // ====================================
      // SUCCESS RESPONSE
      // ====================================

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

// ==========================================
// EXPORT STAFF ORDER ROUTER
// ==========================================

export default router
