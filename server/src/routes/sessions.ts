
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

const router = Router()

// Validate login information.
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

// Check the browser request origin.
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

    if (!req.is('application/json')) {
      res.status(415).json({
        success: false,
        message: 'Content-Type must be application/json.',
      })
      return
    }

    const result = loginSchema.safeParse(req.body)

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid login request.',
      })
      return
    }

    const { email, password } = result.data

    const customer = await prisma.customer.findUnique({
      where: { email },
    })

    // Use one response for invalid login credentials.
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

    const passwordValid = await argon2.verify(
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

    // Revoke any existing session on this client.
    await revokeCurrentSession(req)

    // Issue a new unpredictable session token.
    await createSession(customer.id, res)

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        emailVerifiedAt: customer.emailVerifiedAt,
      },
    })
  },
)

// ==========================================
// GET /api/auth/me
// ==========================================

router.get('/me', async (req, res) => {
  res.set('Cache-Control', 'no-store')

  const session = await getCurrentSession(req)

  if (!session) {
    res.status(401).json({
      success: false,
      message: 'Authentication required.',
    })
    return
  }

  const { isActive, ...customer } = session.customer

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

    // Require a custom header for this cookie-authenticated
    // state-changing request.
    if (req.get('X-Loyce-Request') !== '1') {
      res.status(403).json({
        success: false,
        message: 'Required request header is missing.',
      })
      return
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
