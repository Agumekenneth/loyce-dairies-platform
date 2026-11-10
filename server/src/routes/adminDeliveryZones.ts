
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

// The audit contains only delivery-zone configuration,
// never payment credentials or customer order information.
type ZoneState = {
  name: string
  slug: string
  feeUgx: number
  isActive: boolean
}

function zoneSnapshot(zone: ZoneState) {
  return {
    name: zone.name,
    slug: zone.slug,
    feeUgx: zone.feeUgx,
    isActive: zone.isActive,
  }
}

class ZoneMutationError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ZoneMutationError'
    this.status = status
  }
}

function respondToMutationError(
  error: unknown,
  res: import('express').Response,
): boolean {
  if (error instanceof ZoneMutationError) {
    res.status(error.status).json({
      success: false,
      message: error.message,
    })
    return true
  }

  return false
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

  // Downstream mutations use the verified session identity
  // rather than any client-provided staff identifier.
  res.locals.staffCustomerId = session.customer.id

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
    const parsed = createZoneSchema.safeParse(req.body)

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid delivery-zone details.',
        errors: validationErrors(parsed.error.issues),
      })
      return
    }

    const staffId = res.locals.staffCustomerId as string

    try {
      // Zone and audit record must commit or roll back together.
      const zone = await prisma.$transaction(async (tx) => {
        const created = await tx.deliveryZone.create({
          data: {
            name: parsed.data.name,
            slug: parsed.data.slug,
            feeUgx: parsed.data.feeUgx,
            isActive: false,
          },
          select: zoneSelect,
        })

        await tx.deliveryZoneAuditEvent.create({
          data: {
            zoneId: created.id,
            changedById: staffId,
            action: 'CREATED',
            newValues: zoneSnapshot(created),
          },
        })

        return created
      })

      res.status(201).json({
        success: true,
        message: 'Delivery zone created. It remains inactive.',
        data: zone,
      })
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        res.status(409).json({
          success: false,
          message: 'A delivery zone with this name or slug already exists.',
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
    const zoneId = parseZoneId(req.params.zoneId)

    if (zoneId === null) {
      res.status(400).json({
        success: false,
        message: 'Invalid delivery-zone ID.',
      })
      return
    }

    const parsed = updateZoneSchema.safeParse(req.body)

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid delivery-zone update.',
        errors: validationErrors(parsed.error.issues),
      })
      return
    }

    const staffId = res.locals.staffCustomerId as string

    try {
      const result = await prisma.$transaction(async (tx) => {
        const before = await tx.deliveryZone.findUnique({
          where: { id: zoneId },
          select: zoneSelect,
        })

        if (!before) {
          throw new ZoneMutationError(404, 'Delivery zone not found.')
        }

        if (before.isActive) {
          throw new ZoneMutationError(
            409,
            'Deactivate this delivery zone before editing its name, slug or fee.',
          )
        }

        const hasChanges = (
          (parsed.data.name !== undefined && parsed.data.name !== before.name) ||
          (parsed.data.slug !== undefined && parsed.data.slug !== before.slug) ||
          (parsed.data.feeUgx !== undefined && parsed.data.feeUgx !== before.feeUgx)
        )

        if (!hasChanges) {
          return { zone: before, changed: false }
        }

        // Conditional database update enforces inactivity even
        // when another request acts concurrently. A frontend-only
        // disabled button would not provide this protection.
        const applied = await tx.deliveryZone.updateMany({
          where: {
            id: zoneId,
            isActive: false,
            name: before.name,
            slug: before.slug,
            feeUgx: before.feeUgx,
          },
          data: parsed.data,
        })

        if (applied.count !== 1) {
          throw new ZoneMutationError(
            409,
            'This zone changed during the request. Refresh and try again.',
          )
        }

        const zone = await tx.deliveryZone.findUniqueOrThrow({
          where: { id: zoneId },
          select: zoneSelect,
        })

        await tx.deliveryZoneAuditEvent.create({
          data: {
            zoneId,
            changedById: staffId,
            action: 'UPDATED',
            previousValues: zoneSnapshot(before),
            newValues: zoneSnapshot(zone),
          },
        })

        return { zone, changed: true }
      })

      res.status(200).json({
        success: true,
        message: result.changed
          ? 'Delivery-zone details updated successfully.'
          : 'No delivery-zone changes were needed.',
        data: result.zone,
      })
    } catch (error: unknown) {
      if (respondToMutationError(error, res)) return

      if (isUniqueConstraintError(error)) {
        res.status(409).json({
          success: false,
          message: 'Another delivery zone already uses this name or slug.',
        })
        return
      }

      throw error
    }
  },
)

// ==========================================
// PATCH /api/admin/delivery-zones/:zoneId/activation
// ==========================================

router.patch(
  '/:zoneId/activation',
  requireTrustedWrite,
  writeLimiter,
  async (req, res) => {
    const zoneId = parseZoneId(req.params.zoneId)

    if (zoneId === null) {
      res.status(400).json({
        success: false,
        message: 'Invalid delivery-zone ID.',
      })
      return
    }

    const parsed = activationSchema.safeParse(req.body)

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message:
          'Invalid activation request. Activating a zone requires explicit approval confirmation.',
        errors: validationErrors(parsed.error.issues),
      })
      return
    }

    const staffId = res.locals.staffCustomerId as string
    const nextActive = parsed.data.isActive

    try {
      const zone = await prisma.$transaction(async (tx) => {
        const before = await tx.deliveryZone.findUnique({
          where: { id: zoneId },
          select: zoneSelect,
        })

        if (!before) {
          throw new ZoneMutationError(404, 'Delivery zone not found.')
        }

        if (before.isActive === nextActive) {
          throw new ZoneMutationError(
            409,
            nextActive
              ? 'This delivery zone is already active.'
              : 'This delivery zone is already inactive.',
          )
        }

        if (
          !Number.isSafeInteger(before.feeUgx) ||
          before.feeUgx < 0 ||
          before.feeUgx > MAX_DATABASE_INTEGER
        ) {
          throw new ZoneMutationError(
            422,
            'This delivery zone does not have a valid fee.',
          )
        }

        // Freeze the precise configuration we validated. If any
        // fee/name/slug/state changed concurrently, abort rather
        // than activating a different configuration.
        const applied = await tx.deliveryZone.updateMany({
          where: {
            id: zoneId,
            isActive: before.isActive,
            name: before.name,
            slug: before.slug,
            feeUgx: before.feeUgx,
          },
          data: { isActive: nextActive },
        })

        if (applied.count !== 1) {
          throw new ZoneMutationError(
            409,
            'This zone changed during the request. Refresh and try again.',
          )
        }

        const updated = await tx.deliveryZone.findUniqueOrThrow({
          where: { id: zoneId },
          select: zoneSelect,
        })

        await tx.deliveryZoneAuditEvent.create({
          data: {
            zoneId,
            changedById: staffId,
            action: nextActive ? 'ACTIVATED' : 'DEACTIVATED',
            previousValues: zoneSnapshot(before),
            newValues: zoneSnapshot(updated),
          },
        })

        return updated
      })

      res.status(200).json({
        success: true,
        message: nextActive
          ? 'Delivery zone activated successfully.'
          : 'Delivery zone deactivated successfully.',
        data: zone,
      })
    } catch (error: unknown) {
      if (respondToMutationError(error, res)) return
      throw error
    }
  },
)

// ==========================================
// GET /api/admin/delivery-zones/:zoneId/audit
// ==========================================

router.get('/:zoneId/audit', async (req, res) => {
  const zoneId = parseZoneId(req.params.zoneId)

  if (zoneId === null) {
    res.status(400).json({
      success: false,
      message: 'Invalid delivery-zone ID.',
    })
    return
  }

  const zone = await prisma.deliveryZone.findUnique({
    where: { id: zoneId },
    select: { id: true, name: true },
  })

  if (!zone) {
    res.status(404).json({
      success: false,
      message: 'Delivery zone not found.',
    })
    return
  }

  const events = await prisma.deliveryZoneAuditEvent.findMany({
    where: { zoneId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 100,
    select: {
      id: true,
      action: true,
      previousValues: true,
      newValues: true,
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
})

export default router
