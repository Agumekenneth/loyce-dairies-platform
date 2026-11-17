import { Router } from 'express'
import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import argon2 from 'argon2'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'
import { getCurrentSession } from '../lib/session.js'
import { getTrustedClientOrigins } from '../lib/trustedOrigins.js'

// Customers may initiate an account-deletion request from
// the website or native Android app. Requesting deletion
// does not immediately erase existing order records.

const router = Router()

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

const requireCustomer: RequestHandler = async (req, res, next) => {
  try {
    const session = await getCurrentSession(req)

    if (!session) {
      res.status(401).json({
        success: false,
        message: 'Please sign in to manage account deletion.',
      })
      return
    }

    if (session.customer.role !== 'CUSTOMER') {
      res.status(403).json({
        success: false,
        message: 'This process is for customer accounts only.',
      })
      return
    }

    res.locals.customerId = session.customer.id
    next()
  } catch (error) {
    next(error)
  }
}

const requireTrustedWrite: RequestHandler = (req, res, next) => {
  const origin = req.get('Origin')

  if (!origin || !getTrustedClientOrigins().has(origin)) {
    res.status(403).json({
      success: false,
      message: 'Request origin not permitted.',
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

  next()
}

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many deletion requests. Try again later.',
  },
})

const requestSchema = z.object({
  password: z.string().min(1).max(128),
  confirmation: z.literal('DELETE ACCOUNT'),
}).strict()

router.use(requireCustomer)

// GET /api/account-deletion
// Shows only this authenticated customer's request status.
router.get('/', async (_req, res, next) => {
  try {
    const customerId = res.locals.customerId as string
    const request = await prisma.accountDeletionRequest.findUnique({
      where: { customerId },
      select: {
        status: true,
        requestedAt: true,
        processedAt: true,
      },
    })

    res.status(200).json({
      success: true,
      data: request,
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/account-deletion
// Re-authenticate with password to protect against
// accidental or unattended deletion requests.
router.post(
  '/',
  requireTrustedWrite,
  requestLimiter,
  async (req, res, next) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({
          success: false,
          message: 'Content-Type must be application/json.',
        })
        return
      }

      const parsed = requestSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: 'Enter your password and confirm DELETE ACCOUNT.',
        })
        return
      }

      const customerId = res.locals.customerId as string
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          isActive: true,
          role: true,
          passwordHash: true,
        },
      })

      if (
        !customer ||
        !customer.isActive ||
        customer.role !== 'CUSTOMER' ||
        !customer.passwordHash
      ) {
        res.status(403).json({
          success: false,
          message: 'This account cannot submit a deletion request.',
        })
        return
      }

      const validPassword = await argon2.verify(
        customer.passwordHash,
        parsed.data.password,
      )

      if (!validPassword) {
        res.status(401).json({
          success: false,
          message: 'Incorrect account password.',
        })
        return
      }

      const request = await prisma.accountDeletionRequest.upsert({
        where: { customerId },
        create: { customerId },
        update: {},
        select: {
          status: true,
          requestedAt: true,
          processedAt: true,
        },
      })

      res.status(202).json({
        success: true,
        message: request.status === 'PENDING'
          ? 'Your account-deletion request has been recorded. Your account has not yet been deleted.'
          : 'Your previous account-deletion request has already been processed.',
        data: request,
      })
    } catch (error) {
      next(error)
    }
  },
)

export default router
