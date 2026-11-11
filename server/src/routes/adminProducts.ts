
import { Router } from 'express'

import type {
  RequestHandler,
  Response,
  NextFunction,
} from 'express'

import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'
import { getCurrentSession } from '../lib/session.js'

// ==========================================
// LOYCE DAIRIES PLATFORM
// STAFF PRODUCT MANAGEMENT API
//
// MILESTONE 4.8.4
// TRANSACTIONAL PRODUCT AUDIT HISTORY
// ==========================================

const router = Router()

const MAX_INTEGER = 2_147_483_647

// ==========================================
// PRODUCT VALIDATION SCHEMAS
// ==========================================

const positiveIdSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_INTEGER)

const productNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)

const descriptionSchema = z
  .string()
  .trim()
  .max(2000)
  .nullable()

const priceSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_INTEGER)

const unitSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)

const badgeSchema = z
  .string()
  .trim()
  .max(80)
  .nullable()

// ==========================================
// IMAGE URL VALIDATION
// ==========================================

// Accept HTTP/HTTPS image URLs and
// application asset paths.
//
// Reject javascript: URLs, credentials
// inside URLs, and protocol-relative URLs.

const imageUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => {
      if (
        value.startsWith('/') &&
        !value.startsWith('//') &&
        !value.includes('\\')
      ) {
        return true
      }

      try {
        const url = new URL(value)

        return (
          (
            url.protocol === 'https:' ||
            url.protocol === 'http:'
          ) &&
          url.hostname.length > 0 &&
          url.username === '' &&
          url.password === ''
        )
      } catch {
        return false
      }
    },
    {
      message:
        'Image URL must be HTTP, HTTPS, or an application asset path.',
    },
  )
  .nullable()

// ==========================================
// TIMESTAMP VALIDATION
// ==========================================

// Product updatedAt is used for
// optimistic concurrency control.

const timestampSchema = z
  .string()
  .refine(
    (value) => {
      const date = new Date(value)

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString() === value
      )
    },
    {
      message:
        'A valid expectedUpdatedAt timestamp is required.',
    },
  )

// ==========================================
// PRODUCT CREATION SCHEMA
// ==========================================

const createProductSchema = z
  .object({
    name: productNameSchema,

    description:
      descriptionSchema.optional(),

    priceUgx: priceSchema,

    unit: unitSchema,

    imageUrl:
      imageUrlSchema.optional(),

    badge:
      badgeSchema.optional(),

    categoryId:
      positiveIdSchema,

    // New products default to inactive
    // until explicitly activated.

    isActive:
      z.boolean().optional(),
  })
  .strict()

// ==========================================
// PRODUCT UPDATE SCHEMA
// ==========================================

// IMPORTANT:
//
// stockQuantity is intentionally absent.
//
// Stock must only be changed through
// the separate Inventory Management API.

const updateProductSchema = z
  .object({
    expectedUpdatedAt:
      timestampSchema,

    name:
      productNameSchema.optional(),

    description:
      descriptionSchema.optional(),

    priceUgx:
      priceSchema.optional(),

    unit:
      unitSchema.optional(),

    imageUrl:
      imageUrlSchema.optional(),

    badge:
      badgeSchema.optional(),

    categoryId:
      positiveIdSchema.optional(),

    isActive:
      z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => {
      return Object.keys(value).some(
        (key) =>
          key !== 'expectedUpdatedAt',
      )
    },
    {
      message:
        'At least one product field must be provided.',
    },
  )

// ==========================================
// PRODUCT ID PARSING
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

  const id = Number(value)

  if (
    !Number.isSafeInteger(id) ||
    id > MAX_INTEGER
  ) {
    return null
  }

  return id
}

// ==========================================
// PRODUCT CATEGORY RELATION
// ==========================================

const categoryRelation = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} as const

// ==========================================
// PRODUCT AUDIT SNAPSHOT TYPES
// ==========================================

// Only product metadata is included in
// management audit snapshots.
//
// Stock quantities are deliberately
// excluded because their changes are
// recorded by InventoryEvent.

type ProductSnapshotSource = {
  id: number
  name: string
  description: string | null
  priceUgx: number
  unit: string
  imageUrl: string | null
  badge: string | null
  categoryId: number
  isActive: boolean
}

// ==========================================
// BUILD PRODUCT AUDIT SNAPSHOT
// ==========================================

function createProductSnapshot(
  product: ProductSnapshotSource,
) {
  return {
    id: product.id,

    name: product.name,

    description:
      product.description,

    priceUgx:
      product.priceUgx,

    unit: product.unit,

    imageUrl:
      product.imageUrl,

    badge:
      product.badge,

    categoryId:
      product.categoryId,

    isActive:
      product.isActive,
  }
}

// ==========================================
// COMPARE PRODUCT SNAPSHOTS
// ==========================================

function snapshotsAreEqual(
  previous: ReturnType<
    typeof createProductSnapshot
  >,
  next: ReturnType<
    typeof createProductSnapshot
  >,
): boolean {
  return (
    JSON.stringify(previous) ===
    JSON.stringify(next)
  )
}

// ==========================================
// APPLICATION ERROR
// ==========================================

class ProductRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)

    this.name = 'ProductRequestError'
  }
}

// ==========================================
// PRISMA ERROR RECOGNITION
// ==========================================

function isPrismaError(
  error: unknown,
  code: string,
): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  )
}

// ==========================================
// PRODUCT ERROR HANDLER
// ==========================================

function handleProductError(
  error: unknown,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof ProductRequestError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    })
    return
  }

  // A referenced category or related
  // record changed during a write.

  if (isPrismaError(error, 'P2003')) {
    res.status(409).json({
      success: false,
      message:
        'A related record changed. Refresh and try again.',
    })
    return
  }

  // Transaction conflict or deadlock.

  if (isPrismaError(error, 'P2034')) {
    res.status(409).json({
      success: false,
      message:
        'The product could not be saved because of a concurrent change. Refresh and try again.',
    })
    return
  }

  next(error)
}

// ==========================================
// DISABLE RESPONSE CACHING
// ==========================================

router.use((_req, res, next) => {
  res.set(
    'Cache-Control',
    'no-store',
  )

  next()
})

// ==========================================
// STAFF AUTHORIZATION
// ==========================================

const requireStaff: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
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

    // Recheck the current role against
    // PostgreSQL on every request.

    const account =
      await prisma.customer.findUnique({
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
      !account.emailVerifiedAt ||
      account.role !== 'STAFF'
    ) {
      res.status(403).json({
        success: false,
        message:
          'Staff access required.',
      })
      return
    }

    // The database-verified staff ID
    // is available to subsequent handlers.

    res.locals.staffId =
      session.customer.id

    next()
  } catch (error) {
    next(error)
  }
}

// Protect every product endpoint.

router.use(requireStaff)

// ==========================================
// TRUSTED WRITE REQUESTS
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

  const requestOrigin =
    req.get('Origin')

  if (
    requestOrigin !== allowedOrigin
  ) {
    res.status(403).json({
      success: false,
      message:
        'Request origin is not allowed.',
    })
    return
  }

  if (
    req.get('X-Loyce-Request') !== '1'
  ) {
    res.status(403).json({
      success: false,
      message:
        'Required request header is missing.',
    })
    return
  }

  if (
    !req.is('application/json')
  ) {
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
// PRODUCT WRITE RATE LIMITING
// ==========================================

const productWriteLimiter = rateLimit({
  windowMs:
    15 * 60 * 1000,

  limit: 30,

  standardHeaders:
    'draft-8',

  legacyHeaders:
    false,

  message: {
    success: false,

    message:
      'Too many product changes. Please try again later.',
  },
})

// ==========================================
// GET /api/admin/products
//
// LIST ALL PRODUCTS
// ==========================================

router.get(
  '/',
  async (_req, res, next) => {
    try {
      const products =
        await prisma.product.findMany({
          include: categoryRelation,

          orderBy: {
            id: 'asc',
          },
        })

      res.status(200).json({
        success: true,

        count:
          products.length,

        data:
          products,
      })
    } catch (error) {
      next(error)
    }
  },
)

// ==========================================
// GET /api/admin/products/:productId/events
//
// PRODUCT MANAGEMENT AUDIT HISTORY
// ==========================================

router.get(
  '/:productId/events',

  async (req, res, next) => {
    try {
      const productId =
        parseProductId(
          req.params.productId,
        )

      if (productId === null) {
        res.status(400).json({
          success: false,
          message:
            'Invalid product ID.',
        })
        return
      }

      const product =
        await prisma.product.findUnique({
          where: {
            id: productId,
          },

          select: {
            id: true,
            name: true,
          },
        })

      if (!product) {
        res.status(404).json({
          success: false,
          message:
            'Product not found.',
        })
        return
      }

      // Retrieve the most recent
      // 100 product management changes.

      const events =
        await prisma.productAuditEvent.findMany({
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

          include: {
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

        product,

        count:
          events.length,

        data:
          events,
      })
    } catch (error) {
      next(error)
    }
  },
)

// ==========================================
// GET /api/admin/products/:productId
//
// RETRIEVE ONE PRODUCT
// ==========================================

router.get(
  '/:productId',

  async (req, res, next) => {
    try {
      const productId =
        parseProductId(
          req.params.productId,
        )

      if (productId === null) {
        res.status(400).json({
          success: false,
          message:
            'Invalid product ID.',
        })
        return
      }

      const product =
        await prisma.product.findUnique({
          where: {
            id: productId,
          },

          include: categoryRelation,
        })

      if (!product) {
        res.status(404).json({
          success: false,
          message:
            'Product not found.',
        })
        return
      }

      res.status(200).json({
        success: true,
        data: product,
      })
    } catch (error) {
      next(error)
    }
  },
)

// ==========================================
// POST /api/admin/products
//
// CREATE PRODUCT WITH AUDIT HISTORY
// ==========================================

router.post(
  '/',
  requireTrustedWrite,
  productWriteLimiter,

  async (req, res, next) => {
    try {
      // ====================================
      // VALIDATE REQUEST BODY
      // ====================================

      const parsed =
        createProductSchema.safeParse(
          req.body,
        )

      if (!parsed.success) {
        res.status(400).json({
          success: false,

          message:
            'Invalid product information.',

          errors:
            parsed.error.flatten(),
        })
        return
      }

      const input =
        parsed.data

      const staffId =
        res.locals.staffId as string

      // ====================================
      // ATOMIC PRODUCT CREATION
      // ====================================

      // Both operations must succeed:
      //
      // 1. Create the product.
      // 2. Create its audit record.
      //
      // If either fails, PostgreSQL
      // rolls back the transaction.

      const product =
        await prisma.$transaction(
          async (tx) => {
            // ============================
            // VERIFY CATEGORY
            // ============================

            const category =
              await tx.category.findUnique({
                where: {
                  id: input.categoryId,
                },

                select: {
                  id: true,
                },
              })

            if (!category) {
              throw new ProductRequestError(
                400,
                'The selected category does not exist.',
              )
            }

            // ============================
            // CREATE PRODUCT
            // ============================

            // Stock starts at zero.
            //
            // Inventory Management must
            // be used to record actual
            // available quantities.

            const createdProduct =
              await tx.product.create({
                data: {
                  name:
                    input.name,

                  description:
                    input.description ?? null,

                  priceUgx:
                    input.priceUgx,

                  unit:
                    input.unit,

                  imageUrl:
                    input.imageUrl ?? null,

                  badge:
                    input.badge ?? null,

                  categoryId:
                    input.categoryId,

                  isActive:
                    input.isActive ?? false,

                  stockQuantity: 0,
                },

                include:
                  categoryRelation,
              })

            // ============================
            // RECORD CREATION AUDIT
            // ============================

            await tx.productAuditEvent.create({
              data: {
                productId:
                  createdProduct.id,

                changedById:
                  staffId,

                action:
                  'CREATED',

                // The product did not
                // exist before this event.

                newValues:
                  createProductSnapshot(
                    createdProduct,
                  ),
              },
            })

            return createdProduct
          },
        )

      res.status(201).json({
        success: true,

        message:
          'Product created successfully.',

        data:
          product,
      })
    } catch (error) {
      handleProductError(
        error,
        res,
        next,
      )
    }
  },
)

// ==========================================
// PATCH /api/admin/products/:productId
//
// UPDATE PRODUCT WITH AUDIT HISTORY
// ==========================================

router.patch(
  '/:productId',
  requireTrustedWrite,
  productWriteLimiter,

  async (req, res, next) => {
    try {
      // ====================================
      // VALIDATE PRODUCT ID
      // ====================================

      const productId =
        parseProductId(
          req.params.productId,
        )

      if (productId === null) {
        res.status(400).json({
          success: false,
          message:
            'Invalid product ID.',
        })
        return
      }

      // ====================================
      // VALIDATE UPDATE BODY
      // ====================================

      const parsed =
        updateProductSchema.safeParse(
          req.body,
        )

      if (!parsed.success) {
        res.status(400).json({
          success: false,

          message:
            'Invalid product update.',

          errors:
            parsed.error.flatten(),
        })
        return
      }

      const {
        expectedUpdatedAt,
        ...changes
      } = parsed.data

      const staffId =
        res.locals.staffId as string

      // ====================================
      // ATOMIC PRODUCT UPDATE
      // ====================================

      const product =
        await prisma.$transaction(
          async (tx) => {
            // ============================
            // RETRIEVE CURRENT PRODUCT
            // ============================

            const existing =
              await tx.product.findUnique({
                where: {
                  id: productId,
                },
              })

            if (!existing) {
              throw new ProductRequestError(
                404,
                'Product not found.',
              )
            }

            // ============================
            // CONCURRENCY CHECK
            // ============================

            // If another operation changed
            // this product after the staff
            // member loaded the form,
            // reject the stale update.

            if (
              existing.updatedAt.toISOString() !==
              expectedUpdatedAt
            ) {
              throw new ProductRequestError(
                409,
                'This product changed since it was loaded. Refresh before saving.',
              )
            }

            // ============================
            // BEFORE SNAPSHOT
            // ============================

            const previousValues =
              createProductSnapshot(
                existing,
              )

            // ============================
            // PROJECT NEW VALUES
            // ============================

            const projectedValues = {
              ...previousValues,
              ...changes,
            }

            // ============================
            // REJECT NO-OP UPDATES
            // ============================

            if (
              snapshotsAreEqual(
                previousValues,
                projectedValues,
              )
            ) {
              throw new ProductRequestError(
                400,
                'No product information has changed.',
              )
            }

            // ============================
            // VALIDATE CATEGORY
            // ============================

            if (
              changes.categoryId !== undefined
            ) {
              const category =
                await tx.category.findUnique({
                  where: {
                    id: changes.categoryId,
                  },

                  select: {
                    id: true,
                  },
                })

              if (!category) {
                throw new ProductRequestError(
                  400,
                  'The selected category does not exist.',
                )
              }
            }

            // ============================
            // CONDITIONAL UPDATE
            // ============================

            // The where clause checks
            // both product ID and the
            // expected updatedAt value.
            //
            // The update does not include
            // stockQuantity.

            const updated =
              await tx.product.updateMany({
                where: {
                  id: productId,

                  updatedAt:
                    new Date(
                      expectedUpdatedAt,
                    ),
                },

                data:
                  changes,
              })

            if (updated.count !== 1) {
              throw new ProductRequestError(
                409,
                'Product information changed while saving. Refresh and try again.',
              )
            }

            // ============================
            // RETRIEVE UPDATED PRODUCT
            // ============================

            const updatedProduct =
              await tx.product.findUniqueOrThrow({
                where: {
                  id: productId,
                },

                include:
                  categoryRelation,
              })

            // ============================
            // DETERMINE AUDIT ACTION
            // ============================

            // Activation and deactivation
            // receive specific audit action
            // values.
            //
            // Metadata-only changes use
            // UPDATED.
            //
            // A request changing both
            // activation and metadata
            // still preserves all changes
            // in the snapshots.

            const activationChanged =
              changes.isActive !== undefined &&
              changes.isActive !==
                existing.isActive

            const action =
              activationChanged
                ? updatedProduct.isActive
                  ? 'ACTIVATED'
                  : 'DEACTIVATED'
                : 'UPDATED'

            // ============================
            // RECORD PRODUCT AUDIT
            // ============================

            await tx.productAuditEvent.create({
              data: {
                productId,

                changedById:
                  staffId,

                action,

                previousValues,

                newValues:
                  createProductSnapshot(
                    updatedProduct,
                  ),
              },
            })

            // Everything is committed
            // together when this
            // transaction succeeds.

            return updatedProduct
          },
        )

      res.status(200).json({
        success: true,

        message:
          'Product updated successfully.',

        data:
          product,
      })
    } catch (error) {
      handleProductError(
        error,
        res,
        next,
      )
    }
  },
)

// ==========================================
// EXPORT PRODUCT MANAGEMENT ROUTER
// ==========================================

export default router
