import { Router } from 'express'
import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'
import { getCurrentSession } from '../lib/session.js'

// ==========================================
// LOYCE DAIRIES PLATFORM
// SECURE STAFF FCM DEVICE REGISTRATION
// ==========================================

const router = Router()

// ==========================================
// REQUEST VALIDATION
// ==========================================

const tokenSchema = z.string()
  .min(20)
  .max(2048)
  .refine(
    (value) => !/[\s\x00-\x1f\x7f]/.test(value),
    'Invalid Firebase registration token.',
  )

const registrationSchema = z.object({
  token: tokenSchema,
  platform: z.literal('ANDROID'),
}).strict()

const revocationSchema = z.object({
  token: tokenSchema,
}).strict()

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// ==========================================
// VERIFY AUTHENTICATED STAFF
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

    const staff = await prisma.customer.findUnique({
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
      !staff ||
      staff.role !== 'STAFF' ||
      !staff.isActive ||
      !staff.emailVerifiedAt
    ) {
      res.status(403).json({
        success: false,
        message: 'Verified staff access required.',
      })
      return
    }

    res.locals.staffId = staff.id
    next()
  } catch (error) {
    next(error)
  }
}

router.use(requireStaff)

// ==========================================
// TRUSTED ORIGIN AND CSRF PROTECTION
// ==========================================

const requireTrustedWrite: RequestHandler = (
  req,
  res,
  next,
) => {
  const primaryOrigin = new URL(
    process.env.CLIENT_URL ??
      'http://localhost:5173',
  ).origin

  const allowedOrigins = new Set([
    primaryOrigin,
  ])

  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.LOYCE_ANDROID_LOCAL_DEV === '1'
  ) {
    allowedOrigins.add('http://localhost:5173')
    allowedOrigins.add('http://127.0.0.1')
    allowedOrigins.add('https://localhost')
  }

  const origin = req.get('Origin')

  if (
    !origin ||
    !allowedOrigins.has(origin)
  ) {
    res.status(403).json({
      success: false,
      message: 'Request origin not allowed.',
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
      message: 'Content-Type must be application/json.',
    })
    return
  }

  next()
}

// ==========================================
// RATE LIMIT DEVICE UPDATES
// ==========================================

const deviceWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many device registration requests.',
  },
})

// ==========================================
// POST /api/admin/push-devices
// REGISTER OR REFRESH DEVICE
// ==========================================

router.post(
  '/',
  requireTrustedWrite,
  deviceWriteLimiter,

  async (req, res, next) => {
    try {
      const parsed =
        registrationSchema.safeParse(req.body)

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message:
            'Invalid push-device registration request.',
        })
        return
      }

      const staffId = res.locals.staffId as string

      const { token, platform } = parsed.data

      // A Firebase token identifies one app
      // installation. Re-registration may
      // refresh or reassign its staff owner.

      await prisma.staffPushDevice.upsert({
        where: {
          token,
        },

        create: {
          token,
          platform,
          isActive: true,
          lastSeenAt: new Date(),

          staff: {
            connect: { id: staffId },
          },
        },

        update: {
          platform,
          isActive: true,
          revokedAt: null,
          lastSeenAt: new Date(),

          staff: {
            connect: { id: staffId },
          },
        },
      })

      // Never return the Firebase token.

      res.status(200).json({
        success: true,
        message:
          'Staff push device registered successfully.',
      })
    } catch (error) {
      next(error)
    }
  },
)

// ==========================================
// DELETE /api/admin/push-devices
// REVOKE CURRENT STAFF DEVICE
// ==========================================

router.delete(
  '/',
  requireTrustedWrite,
  deviceWriteLimiter,

  async (req, res, next) => {
    try {
      const parsed =
        revocationSchema.safeParse(req.body)

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message:
            'Invalid device revocation request.',
        })
        return
      }

      const staffId = res.locals.staffId as string

      // Staff can revoke only a device
      // registered to their own account.

      await prisma.staffPushDevice.updateMany({
        where: {
          token: parsed.data.token,
          staffId,
        },

        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      })

      res.status(200).json({
        success: true,
        message:
          'Staff push device registration revoked.',
      })
    } catch (error) {
      next(error)
    }
  },
)

export default router
