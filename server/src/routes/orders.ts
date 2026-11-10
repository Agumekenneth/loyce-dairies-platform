
import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'
import { getCurrentSession } from '../lib/session.js'

// ==========================================
// LOYCE DAIRIES PLATFORM
// MILESTONE 4.7.1
// SECURE CHECKOUT AND INVENTORY MANAGEMENT
// ==========================================

const router = Router()

// PostgreSQL signed 32-bit integer limit.
const MAX_DATABASE_INTEGER = 2_147_483_647

// ==========================================
// CHECKOUT INPUT VALIDATION
// ==========================================

const itemSchema = z.object({
  productId: z.number()
    .int()
    .positive()
    .max(MAX_DATABASE_INTEGER),

  quantity: z.number()
    .int()
    .min(1)
    .max(99),
}).strict()

const commonCheckoutFields = {
  recipientName: z.string()
    .trim()
    .min(2)
    .max(100),

  contactPhone: z.string()
    .trim()
    .min(7)
    .max(20),

  items: z.array(itemSchema)
    .min(1)
    .max(20),
}

// ==========================================
// PICKUP CHECKOUT
// ==========================================

const pickupCheckoutSchema = z.object({
  ...commonCheckoutFields,

  fulfillmentMethod: z.literal('PICKUP'),

  paymentMethod: z.literal('CASH_ON_PICKUP'),
}).strict()

// ==========================================
// DELIVERY CHECKOUT
// ==========================================

const deliveryCheckoutSchema = z.object({
  ...commonCheckoutFields,

  fulfillmentMethod: z.literal('DELIVERY'),

  paymentMethod: z.literal('CASH_ON_DELIVERY'),

  deliveryZoneId: z.number()
    .int()
    .positive()
    .max(MAX_DATABASE_INTEGER),

  deliveryAddress: z.string()
    .trim()
    .min(8)
    .max(250),

  deliveryInstructions: z.string()
    .trim()
    .max(500)
    .optional(),
}).strict()

// ==========================================
// COMBINED CHECKOUT VALIDATION
// ==========================================

const checkoutSchema = z.discriminatedUnion(
  'fulfillmentMethod',
  [
    pickupCheckoutSchema,
    deliveryCheckoutSchema,
  ],
)

// ==========================================
// CUSTOMER ORDER RESPONSE
// ==========================================

// Preserve the API response structure
// used by the existing React checkout and
// customer order-history components.

const orderSelect = {
  id: true,
  orderNumber: true,

  fulfillmentMethod: true,
  status: true,

  paymentMethod: true,
  paymentStatus: true,

  recipientName: true,
  contactPhone: true,

  deliveryAddress: true,
  deliveryInstructions: true,
  deliveryZoneName: true,

  subtotalUgx: true,
  deliveryFeeUgx: true,
  totalUgx: true,

  createdAt: true,
  updatedAt: true,

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
} as const

// ==========================================
// INVENTORY MOVEMENT TYPE
// ==========================================

type InventoryMovement = {
  productId: number
  productName: string
  productUnit: string

  quantity: number

  quantityBefore: number
  quantityAfter: number
}

// ==========================================
// CHECKOUT ERROR
// ==========================================

class CheckoutError extends Error {
  readonly statusCode: number

  constructor(
    statusCode: number,
    message: string,
  ) {
    super(message)

    this.name = 'CheckoutError'
    this.statusCode = statusCode
  }
}

// ==========================================
// TRUSTED CHECKOUT REQUEST PROTECTION
// ==========================================

const requireTrustedCheckoutRequest: RequestHandler = (
  req,
  res,
  next,
) => {
  const allowedOrigin = new URL(
    process.env.CLIENT_URL ??
      'http://localhost:5173',
  ).origin

  const origin = req.get('Origin')

  // Preserve the existing origin-checking
  // behavior of the checkout API.

  if (origin && origin !== allowedOrigin) {
    res.status(403).json({
      success: false,
      message: 'Request origin not allowed.',
    })

    return
  }

  if (req.get('X-Loyce-Request') !== '1') {
    res.status(403).json({
      success: false,
      message:
        'Required request header is missing.',
    })

    return
  }

  next()
}

// ==========================================
// CHECKOUT RATE LIMIT
// ==========================================

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 10,

  standardHeaders: 'draft-8',

  legacyHeaders: false,

  message: {
    success: false,
    message:
      'Too many checkout attempts. Please try again later.',
  },
})

// ==========================================
// ORDER NUMBER GENERATION
// ==========================================

function generateOrderNumber(): string {
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll('-', '')

  const suffix = randomBytes(10)
    .toString('hex')
    .toUpperCase()

  return `LD-${date}-${suffix}`
}

// ==========================================
// VALIDATE UGX AMOUNTS
// ==========================================

function validateAmount(amount: number): void {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    amount > MAX_DATABASE_INTEGER
  ) {
    throw new CheckoutError(
      422,
      'The calculated order amount is not supported.',
    )
  }
}

// ==========================================
// GET /api/delivery-zones
//
// PUBLIC ACTIVE DELIVERY ZONES
// ==========================================

router.get(
  '/delivery-zones',
  async (_req, res) => {
    res.set('Cache-Control', 'no-store')

    const zones =
      await prisma.deliveryZone.findMany({
        where: {
          isActive: true,
        },

        select: {
          id: true,
          name: true,
          slug: true,
          feeUgx: true,
        },

        orderBy: {
          name: 'asc',
        },
      })

    res.status(200).json({
      success: true,
      count: zones.length,
      data: zones,
    })
  },
)

// ==========================================
// POST /api/orders/checkout
//
// CUSTOMER CHECKOUT WITH INVENTORY DEDUCTION
// ==========================================

router.post(
  '/orders/checkout',
  requireTrustedCheckoutRequest,
  checkoutLimiter,

  async (req, res) => {
    res.set('Cache-Control', 'no-store')

    // ======================================
    // 1. VERIFY CUSTOMER SESSION
    // ======================================

    const session = await getCurrentSession(req)

    if (!session) {
      res.status(401).json({
        success: false,
        message:
          'Please sign in before checking out.',
      })

      return
    }

    // ======================================
    // 2. VERIFY CONTENT TYPE
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
    // 3. VALIDATE CHECKOUT BODY
    // ======================================

    const parsed = checkoutSchema.safeParse(
      req.body,
    )

    if (!parsed.success) {
      res.status(400).json({
        success: false,

        message:
          'Invalid checkout details or unsupported payment method.',

        errors: parsed.error.issues.map(
          (issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }),
        ),
      })

      return
    }

    const checkout = parsed.data

    // ======================================
    // 4. CHECK DUPLICATE PRODUCTS
    // ======================================

    const productIds = checkout.items.map(
      (item) => item.productId,
    )

    const uniqueProductIds = new Set(
      productIds,
    )

    if (
      uniqueProductIds.size !==
      productIds.length
    ) {
      res.status(400).json({
        success: false,

        message:
          'Each product must appear only once in the order.',
      })

      return
    }

    try {
      // ====================================
      // 5. START ATOMIC CHECKOUT TRANSACTION
      // ====================================

      // All stock deductions, order creation
      // and inventory audit records must
      // either succeed together or roll back.

      const order = await prisma.$transaction(
        async (tx) => {
          // ==================================
          // 6. LOAD ACTIVE PRODUCTS
          // ==================================

          const products =
            await tx.product.findMany({
              where: {
                id: {
                  in: productIds,
                },

                isActive: true,
              },

              select: {
                id: true,
                name: true,
                unit: true,
                priceUgx: true,
              },
            })

          if (
            products.length !==
            productIds.length
          ) {
            throw new CheckoutError(
              422,
              'One or more selected products are unavailable.',
            )
          }

          const productMap = new Map(
            products.map((product) => [
              product.id,
              product,
            ]),
          )

          // ==================================
          // 7. CALCULATE PRODUCT PRICES
          // ==================================

          // Do not trust prices or totals
          // submitted from the browser.
          //
          // Prices are retrieved directly
          // from PostgreSQL.

          const orderItems = checkout.items.map(
            (item) => {
              const product = productMap.get(
                item.productId,
              )

              if (!product) {
                throw new CheckoutError(
                  422,
                  'A selected product is unavailable.',
                )
              }

              if (
                !Number.isInteger(
                  product.priceUgx,
                ) ||
                product.priceUgx <= 0
              ) {
                throw new CheckoutError(
                  422,
                  'A selected product has an invalid price.',
                )
              }

              const lineTotalUgx =
                product.priceUgx *
                item.quantity

              validateAmount(lineTotalUgx)

              return {
                product: {
                  connect: {
                    id: product.id,
                  },
                },

                productName: product.name,
                productUnit: product.unit,

                unitPriceUgx:
                  product.priceUgx,

                quantity: item.quantity,

                lineTotalUgx,
              }
            },
          )

          // ==================================
          // 8. CALCULATE SUBTOTAL
          // ==================================

          const subtotalUgx =
            orderItems.reduce(
              (sum, item) =>
                sum + item.lineTotalUgx,
              0,
            )

          validateAmount(subtotalUgx)

          // ==================================
          // 9. VALIDATE DELIVERY CONFIGURATION
          // ==================================

          let deliveryZone: {
            id: number
            name: string
            feeUgx: number
          } | null = null

          if (
            checkout.fulfillmentMethod ===
            'DELIVERY'
          ) {
            // Read the approved delivery zone
            // under a PostgreSQL row-share lock.
            //
            // This prevents concurrent updates
            // or deactivation from changing the
            // validated delivery fee before
            // checkout commits.

            const eligibleZones =
              await tx.$queryRaw<
                Array<{
                  id: number
                  name: string
                  feeUgx: number
                }>
              >`
                SELECT
                  "id",
                  "name",
                  "feeUgx"
                FROM "DeliveryZone"
                WHERE
                  "id" = ${checkout.deliveryZoneId}
                  AND "isActive" = true
                FOR SHARE
              `

            deliveryZone =
              eligibleZones[0] ?? null

            if (!deliveryZone) {
              throw new CheckoutError(
                422,
                'The selected delivery zone is unavailable.',
              )
            }

            validateAmount(
              deliveryZone.feeUgx,
            )
          }

          // ==================================
          // 10. CALCULATE TOTAL
          // ==================================

          const deliveryFeeUgx =
            deliveryZone?.feeUgx ?? 0

          const totalUgx =
            subtotalUgx +
            deliveryFeeUgx

          validateAmount(totalUgx)

          // ==================================
          // 11. ATOMIC INVENTORY DEDUCTION
          // ==================================

          // Always process products in the
          // same ID order to reduce deadlock
          // risk during concurrent checkouts.

          const sortedItems = [
            ...checkout.items,
          ].sort(
            (a, b) =>
              a.productId - b.productId,
          )

          const inventoryMovements:
            InventoryMovement[] = []

          for (const item of sortedItems) {
            // Update only if enough stock
            // still exists in PostgreSQL.
            //
            // This condition and decrement
            // execute atomically.

            const stockUpdate =
              await tx.product.updateMany({
                where: {
                  id: item.productId,

                  isActive: true,

                  stockQuantity: {
                    gte: item.quantity,
                  },
                },

                data: {
                  stockQuantity: {
                    decrement:
                      item.quantity,
                  },
                },
              })

            // =================================
            // REJECT INSUFFICIENT STOCK
            // =================================

            if (
              stockUpdate.count !== 1
            ) {
              throw new CheckoutError(
                409,
                'Insufficient stock for one or more products. Please review your cart.',
              )
            }

            // =================================
            // READ UPDATED STOCK BALANCE
            // =================================

            const stockBalance =
              await tx.product.findUniqueOrThrow({
                where: {
                  id: item.productId,
                },

                select: {
                  stockQuantity: true,
                },
              })

            const product = productMap.get(
              item.productId,
            )

            if (!product) {
              throw new CheckoutError(
                422,
                'A selected product is unavailable.',
              )
            }

            // =================================
            // PREPARE INVENTORY AUDIT EVENT
            // =================================

            inventoryMovements.push({
              productId: item.productId,

              productName:
                product.name,

              productUnit:
                product.unit,

              quantity:
                item.quantity,

              quantityBefore:
                stockBalance.stockQuantity +
                item.quantity,

              quantityAfter:
                stockBalance.stockQuantity,
            })
          }

          // ==================================
          // 12. CREATE CUSTOMER ORDER
          // ==================================

          // Stock has been conditionally
          // deducted, but the transaction
          // has not yet committed.
          //
          // If order creation fails,
          // the deductions will roll back.

          const savedOrder =
            await tx.order.create({
              data: {
                orderNumber:
                  generateOrderNumber(),

                customer: {
                  connect: {
                    id:
                      session.customer.id,
                  },
                },

                fulfillmentMethod:
                  checkout.fulfillmentMethod,

                paymentMethod:
                  checkout.paymentMethod,

                status: 'PENDING',

                paymentStatus: 'PENDING',

                recipientName:
                  checkout.recipientName,

                contactPhone:
                  checkout.contactPhone,

                // Delivery zone
                deliveryZone:
                  deliveryZone
                    ? {
                        connect: {
                          id:
                            deliveryZone.id,
                        },
                      }
                    : undefined,

                // Preserve zone name
                // at the time of checkout.
                deliveryZoneName:
                  deliveryZone?.name ??
                  null,

                deliveryAddress:
                  checkout.fulfillmentMethod ===
                  'DELIVERY'
                    ? checkout.deliveryAddress
                    : null,

                deliveryInstructions:
                  checkout.fulfillmentMethod ===
                  'DELIVERY'
                    ? checkout.deliveryInstructions ??
                      null
                    : null,

                subtotalUgx,
                deliveryFeeUgx,
                totalUgx,

                // Order item snapshots
                items: {
                  create: orderItems,
                },
              },

              select: orderSelect,
            })

          // ==================================
          // 13. RECORD INVENTORY HISTORY
          // ==================================

          // These records connect each stock
          // deduction to the new customer
          // order and preserve the stock
          // quantities before and after.

          await tx.inventoryEvent.createMany({
            data: inventoryMovements.map(
              (movement) => ({
                productId:
                  movement.productId,

                productName:
                  movement.productName,

                productUnit:
                  movement.productUnit,

                orderId:
                  savedOrder.id,

                action:
                  'ORDER_PLACED' as const,

                quantityChange:
                  -movement.quantity,

                quantityBefore:
                  movement.quantityBefore,

                quantityAfter:
                  movement.quantityAfter,

                note:
                  'Customer checkout stock deduction',
              }),
            ),
          })

          // ==================================
          // 14. COMMIT TRANSACTION
          // ==================================

          // Returning successfully commits:
          //
          // - Stock deductions
          // - Customer order
          // - Order item snapshots
          // - Inventory audit history

          return savedOrder
        },
      )

      // ====================================
      // 15. CHECKOUT SUCCESS RESPONSE
      // ====================================

      res.status(201).json({
        success: true,

        message:
          'Your order has been received and is pending confirmation.',

        data: order,
      })
    } catch (error: unknown) {
      // ====================================
      // 16. CHECKOUT ERROR RESPONSE
      // ====================================

      if (
        error instanceof CheckoutError
      ) {
        res.status(
          error.statusCode,
        ).json({
          success: false,
          message: error.message,
        })

        return
      }

      // Unexpected errors are passed
      // to the existing Express error
      // handler for safe logging.

      throw error
    }
  },
)

// ==========================================
// GET /api/orders
//
// CUSTOMER ORDER HISTORY
// ==========================================

router.get(
  '/orders',
  async (req, res) => {
    res.set('Cache-Control', 'no-store')

    // ======================================
    // AUTHENTICATE CUSTOMER
    // ======================================

    const session =
      await getCurrentSession(req)

    if (!session) {
      res.status(401).json({
        success: false,
        message:
          'Authentication required.',
      })

      return
    }

    // ======================================
    // RETRIEVE CUSTOMER ORDERS
    // ======================================

    const orders =
      await prisma.order.findMany({
        where: {
          customerId:
            session.customer.id,
        },

        orderBy: {
          createdAt: 'desc',
        },

        take: 50,

        select: orderSelect,
      })

    // ======================================
    // SUCCESS RESPONSE
    // ======================================

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    })
  },
)

// ==========================================
// GET /api/orders/:orderId
//
// CUSTOMER ORDER DETAILS
// ==========================================

router.get(
  '/orders/:orderId',
  async (req, res) => {
    res.set('Cache-Control', 'no-store')

    // ======================================
    // AUTHENTICATE CUSTOMER
    // ======================================

    const session =
      await getCurrentSession(req)

    if (!session) {
      res.status(401).json({
        success: false,
        message:
          'Authentication required.',
      })

      return
    }

    // ======================================
    // VALIDATE ORDER ID
    // ======================================

    const orderId =
      req.params.orderId

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
    // RETRIEVE OWN ORDER ONLY
    // ======================================

    const order =
      await prisma.order.findFirst({
        where: {
          id: orderId,

          customerId:
            session.customer.id,
        },

        select: orderSelect,
      })

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found.',
      })

      return
    }

    // ======================================
    // SUCCESS RESPONSE
    // ======================================

    res.status(200).json({
      success: true,
      data: order,
    })
  },
)

// ==========================================
// EXPORT CUSTOMER ORDER ROUTER
// ==========================================

export default router
