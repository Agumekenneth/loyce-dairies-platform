
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
// STAFF ROLE SUPPORT
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

// Restrict repeated login attempts.

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
// TRUSTED ORIGIN CHECK
// ==========================================

const checkTrustedOrigin: RequestHandler = (
  req,
  res,
  next,
) => {
  const origin = req.get('Origin')

  const allowedOrigin =
    process.env.CLIENT_URL ??
    'http://localhost:5173'

  if (origin && origin !== allowedOrigin) {
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

    // ======================================
    // VALIDATE REQUEST CONTENT TYPE
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
    // VALIDATE LOGIN CREDENTIALS
    // ======================================

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

    const { email, password } =
      result.data

    // ======================================
    // RETRIEVE CUSTOMER ACCOUNT
    // ======================================

    const customer =
      await prisma.customer.findUnique({
        where: {
          email,
        },
      })

    // ======================================
    // VALIDATE CUSTOMER ACCOUNT
    // ======================================

    // Do not reveal whether the supplied
    // email address belongs to an account.

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

    // ======================================
    // VERIFY PASSWORD
    // ======================================

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

    // ======================================
    // REVOKE PREVIOUS CLIENT SESSION
    // ======================================

    await revokeCurrentSession(req)

    // ======================================
    // CREATE AUTHENTICATED SESSION
    // ======================================

    await createSession(
      customer.id,
      res,
    )

    // ======================================
    // LOGIN RESPONSE
    // ======================================

    // Return only the customer details
    // required by the frontend.
    //
    // The role comes directly from
    // PostgreSQL and is not supplied
    // or controlled by the browser.

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

        // Required for staff workspace
        // navigation in the React app.

        role: customer.role,
      },
    })
  },
)

// ==========================================
// GET /api/auth/me
// ==========================================

// Retrieve authenticated customer details
// from the current HTTP-only session cookie.

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

  // ========================================
  // EXCLUDE INTERNAL ACCOUNT STATE
  // ========================================

  // getCurrentSession() now selects
  // role from PostgreSQL.
  //
  // Exclude isActive from the response.
  // Retain the customer role for frontend
  // navigation and account display.

  const {
    isActive,
    ...customer
  } = session.customer

  // ========================================
  // SESSION RESPONSE
  // ========================================

  res.status(200).json({
    success: true,

    data: {
      customer,

      session: {
        expiresAt:
          session.expiresAt,
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

    // ======================================
    // REQUIRE TRUSTED REQUEST HEADER
    // ======================================

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

    // ======================================
    // REVOKE AUTHENTICATED SESSION
    // ======================================

    await revokeCurrentSession(req)

    // ======================================
    // CLEAR SESSION COOKIE
    // ======================================

    clearSessionCookie(res)

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    })
  },
)

// ==========================================
// EXPORT AUTHENTICATION ROUTER
// ==========================================

export default router
