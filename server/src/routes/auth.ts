
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import argon2 from 'argon2'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'

const router = Router()

// Validate incoming registration data.
const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2)
    .max(100),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email()),

  phone: z
    .string()
    .trim()
    .min(7)
    .max(20)
    .optional(),

  password: z
    .string()
    .min(12)
    .max(128),
}).strict()

// Limit repeated registration attempts.
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many registration attempts. Please try again later.',
  },
})

// POST /api/auth/register
router.post(
  '/register',
  registerLimiter,
  async (req, res) => {
    const result = registerSchema.safeParse(req.body)

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid registration details.',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      })
      return
    }

    const {
      fullName,
      email,
      phone,
      password,
    } = result.data

    // Check for an existing customer.
    const existingCustomer =
      await prisma.customer.findUnique({
        where: { email },
        select: { id: true },
      })

    if (existingCustomer) {
      res.status(409).json({
        success: false,
        message:
          'Unable to register this email address.',
      })
      return
    }

    // Hash the password before database storage.
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    })

    try {
      const customer = await prisma.customer.create({
        data: {
          fullName,
          email,
          phone: phone ?? null,
          passwordHash,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      })

      res.status(201).json({
        success: true,
        message: 'Customer account created successfully.',
        data: customer,
      })
    } catch (error: unknown) {
      // Handle concurrent registrations for the same email.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        res.status(409).json({
          success: false,
          message:
            'Unable to register this email address.',
        })
        return
      }

      throw error
    }
  },
)

export default router
