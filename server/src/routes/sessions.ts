
import { Router } from 'express'
import type { RequestHandler } from 'express'

import { rateLimit } from 'express-rate-limit'
import argon2 from 'argon2'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'

import {
  createSession,
  createMobileSession,
  getCurrentSession,
  revokeCurrentSession,
  clearSessionCookie,
} from '../lib/session.js'

// ==========================================
// LOYCE DAIRIES
// WEB AND NATIVE MOBILE AUTHENTICATION
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
// WEB ORIGIN VALIDATION
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

  const allowLocalDevelopment =
    process.env.NODE_ENV !== 'production' &&
    process.env.LOYCE_ANDROID_LOCAL_DEV === '1'

  if (allowLocalDevelopment) {
    allowedOrigins.add('http://localhost:5173')
    allowedOrigins.add('http://127.0.0.1')
    allowedOrigins.add('https://localhost')
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
// NATIVE MOBILE ORIGIN VALIDATION
// ==========================================

// These are the expected bundled Capacitor
// WebView origins.
//
// Origin checking is an additional browser
// security boundary, not proof that a
// request came from a genuine installed app.
//
// Authentication still requires the user's
// credentials or a valid session token.

const nativeOrigins = new Set([
  'https://localhost',
  'capacitor://localhost',
])

const requireNativeOrigin: RequestHandler = (
  req,
  res,
  next,
) => {
  const origin = req.get('Origin')

  if (
    !origin ||
    !nativeOrigins.has(origin)
  ) {
    res.status(403).json({
      success: false,
      message:
        'Native mobile request origin not allowed.',
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

  next()
}

// ==========================================
// SHARED CREDENTIAL VERIFICATION
// ==========================================

async function authenticateCredentials(
  email: string,
  password: string,
) {
  const customer =
    await prisma.customer.findUnique({
      where: { email },
    })

  if (
    !customer ||
    !customer.isActive ||
    !customer.passwordHash
  ) {
    return null
  }

  const passwordValid =
    await argon2.verify(
      customer.passwordHash,
      password,
    )

  return passwordValid
    ? customer
    : null
}

// ==========================================
// DEACTIVATE STAFF PUSH REGISTRATIONS
// ==========================================

// Retain the existing web logout behavior.
// Staff devices must be registered again
// following account sign-out.

async function deactivateStaffPushDevices(
  staffId: string,
): Promise<void> {
  await prisma.staffPushDevice.updateMany({
    where: {
      staffId,
      isActive: true,
    },

    data: {
      isActive: false,
      revokedAt: new Date(),
    },
  })
}

// ==========================================
// POST /api/auth/login
// EXISTING WEBSITE LOGIN
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

    const customer =
      await authenticateCredentials(
        result.data.email,
        result.data.password,
      )

    if (!customer) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      })
      return
    }

    const previousSession =
      await getCurrentSession(req)

    if (
      previousSession?.customer.role ===
      'STAFF'
    ) {
      await deactivateStaffPushDevices(
        previousSession.customer.id,
      )
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
// POST /api/auth/mobile/login
// ANDROID AND IOS LOGIN
// ==========================================

router.post(
  '/mobile/login',
  requireNativeOrigin,
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

    const customer =
      await authenticateCredentials(
        result.data.email,
        result.data.password,
      )

    if (!customer) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      })
      return
    }

    // Create a separate, revocable mobile
    // session in PostgreSQL.
    //
    // The token is returned only through
    // the HTTPS response to the native
    // client. Device storage is implemented
    // separately using platform-protected
    // storage.

    const mobileSession =
      await createMobileSession(customer.id)

    res.status(200).json({
      success: true,
      message: 'Mobile login successful.',

      data: {
        customer: {
          id: customer.id,
          fullName: customer.fullName,
          email: customer.email,
          phone: customer.phone,
          emailVerifiedAt:
            customer.emailVerifiedAt,
          role: customer.role,
        },

        session: {
          accessToken: mobileSession.token,
          expiresAt:
            mobileSession.expiresAt.toISOString(),
        },
      },
    })
  },
)

// ==========================================
// GET /api/auth/me
// WEB COOKIE OR MOBILE BEARER SESSION
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
// EXISTING WEBSITE LOGOUT
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

    const previousSession =
      await getCurrentSession(req)

    if (
      previousSession?.customer.role ===
      'STAFF'
    ) {
      await deactivateStaffPushDevices(
        previousSession.customer.id,
      )
    }

    await revokeCurrentSession(req)

    clearSessionCookie(res)

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    })
  },
)

// ==========================================
// POST /api/auth/mobile/logout
// REVOKE MOBILE BEARER SESSION
// ==========================================

router.post(
  '/mobile/logout',
  requireNativeOrigin,

  async (req, res) => {
    res.set('Cache-Control', 'no-store')

    // Mobile logout requires a bearer token.
    // A browser cookie cannot substitute
    // for the Authorization header.

    const authorization =
      req.get('Authorization')

    if (
      !authorization ||
      !/^Bearer [A-Za-z0-9_-]{43}$/i.test(
        authorization,
      )
    ) {
      res.status(401).json({
        success: false,
        message:
          'Mobile authentication required.',
      })
      return
    }

    const session =
      await getCurrentSession(req)

    if (!session) {
      res.status(401).json({
        success: false,
        message:
          'Mobile session is invalid or expired.',
      })
      return
    }

    if (session.customer.role === 'STAFF') {
      await deactivateStaffPushDevices(
        session.customer.id,
      )
    }

    await revokeCurrentSession(req)

    res.status(200).json({
      success: true,
      message:
        'Mobile session revoked successfully.',
    })
  },
)

export default router
