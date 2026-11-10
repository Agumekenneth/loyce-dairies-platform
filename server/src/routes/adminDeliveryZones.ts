
import { Router } from 'express'
import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'
import { getCurrentSession } from '../lib/session.js'

// ==========================================
// LOYCE DAIRIES
// STAFF DELIVERY ZONE MANAGEMENT
// ==========================================

const router = Router()

const MAX_DATABASE_INTEGER = 2_147_483_647

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const zoneNameSchema = z.string()
  .trim()
  .min(2)
  .max(100)

const zoneSlugSchema = z.string()
  .trim()
  .min(2)
  .max(100)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and hyphens.',
  )

const deliveryFeeSchema = z.number()
  .int()
  .min(0)
  .max(MAX_DATABASE_INTEGER)

const createZoneSchema = z.object({
  name: zoneNameSchema,
  slug: zoneSlugSchema,
  feeUgx: deliveryFeeSchema,
}).strict()

const updateZoneSchema = createZoneSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    'At least one field must be provided.',
  )

// Activation requires explicit staff confirmation.
//
// The confirmation is an acknowledgement,
// not independent verification of actual fees.
const activationSchema = z.discriminatedUnion(
  'isActive',
  [
    z.object({
      isActive: z.literal(true),
      confirmation: z.literal(
        'ZONE_AND_FEE_APPROVED',
      ),
    }).strict(),

    z.object({
      isActive: z.literal(false),
    }).strict(),
  ],
)

// ==========================================
// PUBLIC RESPONSE FIELDS
// ==========================================

const zoneSelect = {
  id: true,
  name: true,
  slug: true,
  feeUgx: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const

// ==========================================
// ERROR UTILITIES
// ==========================================

function isUniqueConstraintError(
  error: unknown,
): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
}

function parseZoneId(
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
    id > MAX_DATABASE_INTEGER
  ) {
    return null
  }

  return id
}

function validationErrors(
  issues: z.ZodIssue[],
) {
  return issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }))
}

// ==========================================
// DISABLE RESPONSE CACHING
// ==========================================

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// ==========================================
// STAFF AUTHENTICATION & AUTHORIZATION
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

  // Retrieve the role from the database.
  // Never trust a browser-supplied role.
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

  next()
}

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
// RATE LIMIT MUTATIONS
// ==========================================

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,

  message: {
    success: false,
    message:
      'Too many delivery-zone updates. Try again later.',
  },
})

// ==========================================
// GET /api/admin/delivery-zones
// ==========================================

router.get('/', async (_req, res) => {
  const zones = await prisma.deliveryZone.findMany({
    select: zoneSelect,

    orderBy: {
      name: 'asc',
    },

    take: 200,
  })

  res.status(200).json({
    success: true,
    count: zones.length,
    data: zones,
  })
})

// ==========================================
// POST /api/admin/delivery-zones
// ==========================================

router.post(
  '/',
  requireTrustedWrite,
  writeLimiter,
  async (req, res) => {
    const parsed = createZoneSchema.safeParse(
      req.body,
    )

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid delivery-zone details.',
        errors: validationErrors(
          parsed.error.issues,
        ),
      })
      return
    }

    try {
      const zone = await prisma.deliveryZone.create({
        data: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          feeUgx: parsed.data.feeUgx,

          // Never activate a newly created zone
          // automatically.
          isActive: false,
        },

        select: zoneSelect,
      })

      res.status(201).json({
        success: true,
        message:
          'Delivery zone created. It remains inactive.',
        data: zone,
      })
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        res.status(409).json({
          success: false,
          message:
            'A delivery zone with this name or slug already exists.',
        })
        return
      }

      throw error
    }
  },
)

// ==========================================
// PATCH /api/admin/delivery-zones/:zoneId
// ==========================================

router.patch(
  '/:zoneId',
  requireTrustedWrite,
  writeLimiter,
  async (req, res) => {
    const zoneId = parseZoneId(
      req.params.zoneId,
    )

    if (zoneId === null) {
      res.status(400).json({
        success: false,
        message: 'Invalid delivery-zone ID.',
      })
      return
    }

    const parsed = updateZoneSchema.safeParse(
      req.body,
    )

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid delivery-zone update.',
        errors: validationErrors(
          parsed.error.issues,
        ),
      })
      return
    }

    const existing = await prisma.deliveryZone.findUnique({
      where: {
        id: zoneId,
      },

      select: {
        id: true,
      },
    })

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Delivery zone not found.',
      })
      return
    }

    try {
      const zone = await prisma.deliveryZone.update({
        where: {
          id: zoneId,
        },

        data: parsed.data,

        select: zoneSelect,
      })

      res.status(200).json({
        success: true,
        message:
          'Delivery-zone details updated successfully.',
        data: zone,
      })
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        res.status(409).json({
          success: false,
          message:
            'Another delivery zone already uses this name or slug.',
        })
        return
      }

      throw error
    }
  },
)

// ==========================================
// PATCH /api/admin/delivery-zones
//       /:zoneId/activation
// ==========================================

router.patch(
  '/:zoneId/activation',
  requireTrustedWrite,
  writeLimiter,
  async (req, res) => {
    const zoneId = parseZoneId(
      req.params.zoneId,
    )

    if (zoneId === null) {
      res.status(400).json({
        success: false,
        message: 'Invalid delivery-zone ID.',
      })
      return
    }

    const parsed = activationSchema.safeParse(
      req.body,
    )

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message:
          'Invalid activation request. Activating a zone requires explicit approval confirmation.',
        errors: validationErrors(
          parsed.error.issues,
        ),
      })
      return
    }

    const existing = await prisma.deliveryZone.findUnique({
      where: {
        id: zoneId,
      },

      select: {
        id: true,
        feeUgx: true,
        isActive: true,
      },
    })

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Delivery zone not found.',
      })
      return
    }

    const nextActive = parsed.data.isActive

    if (existing.isActive === nextActive) {
      res.status(409).json({
        success: false,
        message: nextActive
          ? 'This delivery zone is already active.'
          : 'This delivery zone is already inactive.',
      })
      return
    }

    if (
      !Number.isInteger(existing.feeUgx) ||
      existing.feeUgx < 0
    ) {
      res.status(422).json({
        success: false,
        message:
          'This delivery zone does not have a valid fee.',
      })
      return
    }

    // Apply the change only if the active state
    // still matches what we previously read.
    const result =
      await prisma.deliveryZone.updateMany({
        where: {
          id: zoneId,
          isActive: existing.isActive,
        },

        data: {
          isActive: nextActive,
        },
      })

    if (result.count !== 1) {
      res.status(409).json({
        success: false,
        message:
          'The delivery zone changed during this request. Refresh and try again.',
      })
      return
    }

    const zone = await prisma.deliveryZone.findUniqueOrThrow({
      where: {
        id: zoneId,
      },

      select: zoneSelect,
    })

    res.status(200).json({
      success: true,
      message: nextActive
        ? 'Delivery zone activated successfully.'
        : 'Delivery zone deactivated successfully.',
      data: zone,
    })
  },
)

export default router
