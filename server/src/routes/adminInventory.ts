
import { Router } from 'express'
import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'
import { getCurrentSession } from '../lib/session.js'

// ==========================================
// LOYCE DAIRIES PLATFORM
// MILESTONE 4.7.1
// STAFF INVENTORY MANAGEMENT API
// ==========================================

const router = Router()

const MAX_DATABASE_INTEGER = 2_147_483_647

// ==========================================
// INVENTORY VALIDATION
// ==========================================

// The expected quantity prevents a stale
// staff form from overwriting newer stock
// adjustments or customer purchases.

const stockChangeSchema = z.object({
  expectedStockQuantity: z.number()
    .int()
    .min(0)
    .max(MAX_DATABASE_INTEGER),

  stockQuantity: z.number()
    .int()
    .min(0)
    .max(MAX_DATABASE_INTEGER),

  note: z.string()
    .trim()
    .min(5)
    .max(300),
}).strict()

// ==========================================
// PRODUCT ID VALIDATION
// ==========================================

function parseProductId(
  value: string | string[] | undefined,
): number | null {
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d*$/.test(value)
  ) {
    return null
  }

  const productId = Number(value)

  if (
    !Number.isSafeInteger(productId) ||
    productId > MAX_DATABASE_INTEGER
  ) {
    return null
  }

  return productId
}

// ==========================================
// INVENTORY ERROR CLASS
// ==========================================

class InventoryError extends Error {
  readonly status: number

  constructor(
    status: number,
    message: string,
  ) {
    super(message)

    this.name = 'InventoryError'
    this.status = status
  }
}

// ==========================================
// DISABLE CACHING OF STAFF DATA
// ==========================================

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

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

  // Recheck account privileges directly
  // against PostgreSQL on every request.

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
    account.role !== 'STAFF' ||
    !account.isActive ||
    !account.emailVerifiedAt
  ) {
    res.status(403).json({
      success: false,
      message: 'Staff access required.',
    })

    return
  }

  // Record authenticated staff identity
  // for inventory audit operations.

  res.locals.staffCustomerId = account.id

  next()
}

// All inventory endpoints require staff access.
router.use(requireStaff)

// ==========================================
// PROTECT STATE-CHANGING REQUESTS
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

  const requestOrigin = req.get('Origin')

  if (requestOrigin !== allowedOrigin) {
    res.status(403).json({
      success: false,
      message: 'Request origin is not allowed.',
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

  if (!req.is('application/json')) {
    res.status(415).json({
      success: false,
      message:
        'Content-Type must be application/json.',
    })

    return
  }

  next()
}

// ==========================================
// RATE LIMIT INVENTORY CHANGES
// ==========================================

const inventoryWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 30,

  standardHeaders: 'draft-8',

  legacyHeaders: false,

  message: {
    success: false,
    message:
      'Too many inventory adjustments. Please try again later.',
  },
})

// ==========================================
// GET /api/admin/inventory
//
// LIST ALL PRODUCTS AND STOCK BALANCES
// ==========================================

router.get('/', async (_req, res) => {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      unit: true,
      priceUgx: true,
      isActive: true,
      stockQuantity: true,
      updatedAt: true,

      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },

    orderBy: {
      id: 'asc',
    },
  })

  res.status(200).json({
    success: true,
    count: products.length,
    data: products,
  })
})

// ==========================================
// GET /api/admin/inventory/:productId/events
//
// VIEW INVENTORY AUDIT HISTORY
// ==========================================

router.get(
  '/:productId/events',
  async (req, res) => {
    const productId = parseProductId(
      req.params.productId,
    )

    if (productId === null) {
      res.status(400).json({
        success: false,
        message: 'Invalid product ID.',
      })

      return
    }

    // Confirm that the requested product
    // exists before retrieving its history.

    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },

      select: {
        id: true,
      },
    })

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found.',
      })

      return
    }

    // Retrieve the latest 100 stock events.

    const events = await prisma.inventoryEvent.findMany({
      where: {
        productId,
      },

      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],

      take: 100,

      select: {
        id: true,
        action: true,

        quantityBefore: true,
        quantityAfter: true,
        quantityChange: true,

        note: true,
        orderId: true,
        createdAt: true,

        changedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    })

    res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    })
  },
)

// ==========================================
// PATCH /api/admin/inventory/:productId
//
// UPDATE VERIFIED PRODUCT STOCK
// ==========================================

router.patch(
  '/:productId',
  requireTrustedWrite,
  inventoryWriteLimiter,

  async (req, res) => {
    const productId = parseProductId(
      req.params.productId,
    )

    if (productId === null) {
      res.status(400).json({
        success: false,
        message: 'Invalid product ID.',
      })

      return
    }

    // ======================================
    // VALIDATE REQUEST BODY
    // ======================================

    const parsed = stockChangeSchema.safeParse(
      req.body,
    )

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid inventory adjustment.',

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
      expectedStockQuantity,
      stockQuantity,
      note,
    } = parsed.data

    // A change must modify the current
    // inventory balance.

    if (stockQuantity === expectedStockQuantity) {
      res.status(400).json({
        success: false,
        message:
          'The new stock balance must differ from the current balance.',
      })

      return
    }

    try {
      // ====================================
      // ATOMIC DATABASE TRANSACTION
      // ====================================

      const updated = await prisma.$transaction(
        async (tx) => {
          // Read the existing stock balance.

          const product = await tx.product.findUnique({
            where: {
              id: productId,
            },

            select: {
              id: true,
              name: true,
              unit: true,
              stockQuantity: true,
            },
          })

          if (!product) {
            throw new InventoryError(
              404,
              'Product not found.',
            )
          }

          // Reject an outdated staff adjustment.

          if (
            product.stockQuantity !==
            expectedStockQuantity
          ) {
            throw new InventoryError(
              409,
              'Inventory changed since it was loaded. Refresh and review before saving.',
            )
          }

          // ==================================
          // CONDITIONAL STOCK UPDATE
          // ==================================

          // PostgreSQL applies the update
          // only if the quantity still matches
          // the expected value.
          //
          // This helps prevent lost updates
          // during simultaneous operations.

          const result = await tx.product.updateMany({
            where: {
              id: productId,

              stockQuantity:
                expectedStockQuantity,
            },

            data: {
              stockQuantity,
            },
          })

          if (result.count !== 1) {
            throw new InventoryError(
              409,
              'Inventory changed while saving. Refresh and try again.',
            )
          }

          // ==================================
          // INVENTORY AUDIT RECORD
          // ==================================

          // The audit event and stock update
          // belong to the same transaction.

          await tx.inventoryEvent.create({
            data: {
              productId,

              productName: product.name,
              productUnit: product.unit,

              changedById:
                res.locals.staffCustomerId as string,

              action: 'STAFF_SET',

              quantityChange:
                stockQuantity -
                expectedStockQuantity,

              quantityBefore:
                expectedStockQuantity,

              quantityAfter:
                stockQuantity,

              note,
            },
          })

          // Return the updated product.

          return tx.product.findUniqueOrThrow({
            where: {
              id: productId,
            },

            select: {
              id: true,
              name: true,
              unit: true,
              stockQuantity: true,
              isActive: true,
              updatedAt: true,
            },
          })
        },
      )

      // ====================================
      // SUCCESS RESPONSE
      // ====================================

      res.status(200).json({
        success: true,

        message:
          'Inventory updated and audit event recorded.',

        data: updated,
      })
    } catch (error: unknown) {
      if (error instanceof InventoryError) {
        res.status(error.status).json({
          success: false,
          message: error.message,
        })

        return
      }

      // Unexpected errors are handled by
      // the application's Express error handler.
      throw error
    }
  },
)

// ==========================================
// EXPORT STAFF INVENTORY ROUTER
// ==========================================

export default router
