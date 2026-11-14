
import { Router } from 'express'
import type { RequestHandler } from 'express'

import { rateLimit } from 'express-rate-limit'
import argon2 from 'argon2'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'

import {
  createSession,
  getCurrentSession,
  revokeCurrentSession,
  clearSessionCookie,
} from '../lib/session.js'

// ==========================================
// LOYCE DAIRIES PLATFORM
// CUSTOMER AUTHENTICATION ROUTES
// MULTI-DEVICE LOCAL DEVELOPMENT
// ==========================================

const router = Router()

// ==========================================
// LOGIN VALIDATION
// ==========================================

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email()),

  password: z
    .string()
    .min(1)
    .max(128),
}).strict()

// ==========================================
// LOGIN RATE LIMITING
// ==========================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,

  message: {
    success: false,
    message:
      'Too many login attempts. Please try again later.',
  },
})

// ==========================================
// TRUSTED REQUEST ORIGINS
// ==========================================

const checkTrustedOrigin: RequestHandler = (
  req,
  res,
  next,
) => {
  const origin = req.get('Origin')

  const webOrigin = new URL(
    process.env.CLIENT_URL ??
      'http://localhost:5173',
  ).origin

  const allowedOrigins = new Set<string>([
    webOrigin,
  ])

  // Permit both desktop and native Android
  // development origins only when explicitly
  // enabled outside production.

  const allowLocalDevelopment =
    process.env.NODE_ENV !== 'production' &&
    process.env.LOYCE_ANDROID_LOCAL_DEV === '1'

  if (allowLocalDevelopment) {
    // MacBook browser
    allowedOrigins.add(
      'http://localhost:5173',
    )

    // Physical LG Android phone
    allowedOrigins.add(
      'http://127.0.0.1',
    )

    // Capacitor emulator development
    allowedOrigins.add(
      'https://localhost',
    )
  }

  if (
    origin &&
    !allowedOrigins.has(origin)
  ) {
    res.status(403).json({
      success: false,
      message: 'Request origin not allowed.',
    })
    return
  }

  next()
}

// ==========================================
// POST /api/auth/login
// ==========================================

router.post(
  '/login',
  checkTrustedOrigin,
  loginLimiter,

  async (req, res) => {
    res.set('Cache-Control', 'no-store')

    if (!req.is('application/json')) {
      res.status(415).json({
        success: false,
        message:
          'Content-Type must be application/json.',
      })
      return
    }

    const result = loginSchema.safeParse(
      req.body,
    )

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid login request.',
      })
      return
    }

    const { email, password } = result.data

    const customer =
      await prisma.customer.findUnique({
        where: {
          email,
        },
      })

    if (
      !customer ||
      !customer.isActive ||
      !customer.passwordHash
    ) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      })
      return
    }

    const passwordValid =
      await argon2.verify(
        customer.passwordHash,
        password,
      )

    if (!passwordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      })
      return
    }

    // Revoke an existing client session,
    // then issue a new HTTP-only session.

    // Deactivate staff push devices before
    // ending or replacing this login session.
    // This prevents signed-out staff accounts
    // from continuing to receive order pushes.

    const previousSession =
      await getCurrentSession(req)

    if (previousSession?.customer.role === 'STAFF') {
      await prisma.staffPushDevice.updateMany({
        where: {
          staffId: previousSession.customer.id,
          isActive: true,
        },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      })
    }

    await revokeCurrentSession(req)

    await createSession(
      customer.id,
      res,
    )

    res.status(200).json({
      success: true,
      message: 'Login successful.',

      data: {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        emailVerifiedAt:
          customer.emailVerifiedAt,
        role: customer.role,
      },
    })
  },
)

// ==========================================
// GET /api/auth/me
// ==========================================

router.get('/me', async (req, res) => {
  res.set('Cache-Control', 'no-store')

  const session =
    await getCurrentSession(req)

  if (!session) {
    res.status(401).json({
      success: false,
      message: 'Authentication required.',
    })
    return
  }

  const {
    isActive,
    ...customer
  } = session.customer

  res.status(200).json({
    success: true,

    data: {
      customer,

      session: {
        expiresAt: session.expiresAt,
      },
    },
  })
})

// ==========================================
// POST /api/auth/logout
// ==========================================

router.post(
  '/logout',
  checkTrustedOrigin,

  async (req, res) => {
    res.set('Cache-Control', 'no-store')

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

    // Deactivate staff push devices before
    // ending or replacing this login session.
    // This prevents signed-out staff accounts
    // from continuing to receive order pushes.

    const previousSession =
      await getCurrentSession(req)

    if (previousSession?.customer.role === 'STAFF') {
      await prisma.staffPushDevice.updateMany({
        where: {
          staffId: previousSession.customer.id,
          isActive: true,
        },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      })
    }

    await revokeCurrentSession(req)

    clearSessionCookie(res)

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    })
  },
)

export default router
