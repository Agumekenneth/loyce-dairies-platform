
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import argon2 from 'argon2'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'
import { sendEmail } from '../lib/mail.js'
import { clearSessionCookie } from '../lib/session.js'

import {
  generateActionToken,
  hashActionToken,
  isValidActionToken,
} from '../lib/actionTokens.js'

const router = Router()

// ==========================================
// CONFIGURATION
// ==========================================

const TOKEN_PURPOSE = 'PASSWORD_RESET' as const

const RESET_DURATION_MS = 30 * 60 * 1000
const RESEND_COOLDOWN_MS = 5 * 60 * 1000

const genericResponse = {
  success: true,
  message:
    'If this email belongs to an eligible account, ' +
    'password reset instructions will be sent.',
}

// ==========================================
// REQUEST VALIDATION
// ==========================================

const forgotSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email()),
}).strict()

const resetSchema = z.object({
  token: z.string(),

  newPassword: z
    .string()
    .min(12)
    .max(128),

  confirmPassword: z
    .string()
    .min(12)
    .max(128),
}).strict().refine(
  (data) =>
    data.newPassword === data.confirmPassword,
  {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  },
)

// ==========================================
// RATE LIMITING
// ==========================================

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many requests. Please try again later.',
  },
})

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many reset attempts. Try again later.',
  },
})

// ==========================================
// POST /api/auth/password/forgot
// ==========================================

router.post(
  '/forgot',
  forgotLimiter,
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

    const parsed = forgotSchema.safeParse(req.body)

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid email.',
      })
      return
    }

    const { email } = parsed.data

    const customer = await prisma.customer.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        isActive: true,
        passwordHash: true,
      },
    })

    // Do not expose account existence or eligibility.
    if (
      !customer ||
      !customer.isActive ||
      !customer.passwordHash
    ) {
      res.status(200).json(genericResponse)
      return
    }

    const tokenKey = {
      customerId: customer.id,
      purpose: TOKEN_PURPOSE,
    }

    const existingToken =
      await prisma.customerActionToken.findUnique({
        where: {
          customerId_purpose: tokenKey,
        },
        select: {
          createdAt: true,
          usedAt: true,
        },
      })

    // Prevent excessive reset emails.
    if (
      existingToken &&
      existingToken.usedAt === null &&
      Date.now() -
        existingToken.createdAt.getTime() <
        RESEND_COOLDOWN_MS
    ) {
      res.status(200).json(genericResponse)
      return
    }

    const { token, tokenHash } =
      generateActionToken()

    const now = new Date()

    const expiresAt = new Date(
      now.getTime() + RESET_DURATION_MS,
    )

    // Replace any existing password reset token.
    await prisma.customerActionToken.upsert({
      where: {
        customerId_purpose: tokenKey,
      },

      create: {
        customerId: customer.id,
        purpose: TOKEN_PURPOSE,
        tokenHash,
        expiresAt,
      },

      update: {
        tokenHash,
        expiresAt,
        usedAt: null,
        createdAt: now,
      },
    })

    // Use the configured frontend URL.
    const frontendUrl =
      process.env.CLIENT_URL ??
      'http://localhost:5173'

    const resetUrl = new URL(
      '/reset-password',
      frontendUrl,
    )

    resetUrl.searchParams.set('token', token)

    try {
      await sendEmail({
        to: customer.email,

        subject: 'Reset your Loyce Dairies password',

        text: [
          'Loyce Dairies Password Recovery',
          '',
          'A password reset was requested for your account.',
          '',
          'Use this link to set a new password:',
          resetUrl.toString(),
          '',
          'The link expires in 30 minutes.',
          'It can only be used once.',
          '',
          'If you did not request this,',
          'you can ignore this email.',
        ].join('\n'),

        html: `
          <div style="
            font-family:Arial,sans-serif;
            max-width:560px;
            margin:auto;
            padding:28px;
            color:#174D36;
          ">
            <h1 style="color:#174D36;">
              Loyce Dairies
            </h1>

            <h2>Reset your password</h2>

            <p>
              We received a request to reset
              the password for your account.
            </p>

            <p style="margin:30px 0;">
              <a
                href="${resetUrl.toString()}"
                style="
                  background:#174D36;
                  color:#ffffff;
                  padding:14px 24px;
                  border-radius:30px;
                  text-decoration:none;
                "
              >
                Reset password
              </a>
            </p>

            <p>
              This link expires in 30 minutes
              and can only be used once.
            </p>

            <p>
              If you did not request a password
              reset, you can ignore this email.
            </p>
          </div>
        `,
      })
    } catch (error: unknown) {
      // Remove this token if delivery failed,
      // allowing another request to retry.
      await prisma.customerActionToken.deleteMany({
        where: {
          customerId: customer.id,
          purpose: TOKEN_PURPOSE,
          tokenHash,
          usedAt: null,
        },
      })

      // Never log the secret token or reset link.
      console.error(
        'Password reset email delivery failed:',
        error instanceof Error
          ? error.name
          : 'Unknown error',
      )
    }

    res.status(200).json(genericResponse)
  },
)

// ==========================================
// POST /api/auth/password/reset
// ==========================================

router.post(
  '/reset',
  resetLimiter,
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

    const parsed = resetSchema.safeParse(req.body)

    if (
      !parsed.success ||
      !isValidActionToken(parsed.data.token)
    ) {
      res.status(400).json({
        success: false,
        message:
          'Invalid password reset details.',
      })
      return
    }

    const tokenHash = hashActionToken(
      parsed.data.token,
    )

    const now = new Date()

    // Validate the reset token and customer.
    const storedToken =
      await prisma.customerActionToken.findUnique({
        where: { tokenHash },

        select: {
          id: true,
          customerId: true,
          purpose: true,
          expiresAt: true,
          usedAt: true,

          customer: {
            select: {
              email: true,
              isActive: true,
              passwordHash: true,
            },
          },
        },
      })

    if (
      !storedToken ||
      storedToken.purpose !== TOKEN_PURPOSE ||
      storedToken.usedAt !== null ||
      storedToken.expiresAt <= now ||
      !storedToken.customer.isActive ||
      !storedToken.customer.passwordHash
    ) {
      res.status(400).json({
        success: false,
        message:
          'Password reset link is invalid, ' +
          'expired, or already used.',
      })
      return
    }

    // Hash outside the transaction to avoid
    // holding a database transaction open
    // during expensive password hashing.
    const passwordHash = await argon2.hash(
      parsed.data.newPassword,
      {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      },
    )

    const resetSucceeded = await prisma.$transaction(
      async (tx) => {
        const resetTime = new Date()

        // Atomically consume the token.
        const consumed =
          await tx.customerActionToken.updateMany({
            where: {
              id: storedToken.id,
              purpose: TOKEN_PURPOSE,
              tokenHash,
              usedAt: null,
              expiresAt: {
                gt: resetTime,
              },
            },

            data: {
              usedAt: resetTime,
            },
          })

        if (consumed.count !== 1) {
          return false
        }

        // Update the stored password hash.
        const updated = await tx.customer.updateMany({
          where: {
            id: storedToken.customerId,
            isActive: true,
          },

          data: {
            passwordHash,
          },
        })

        if (updated.count !== 1) {
          // Roll back the entire transaction.
          throw new Error(
            'Customer unavailable during reset.',
          )
        }

        // Revoke every existing customer session.
        await tx.customerSession.updateMany({
          where: {
            customerId: storedToken.customerId,
            revokedAt: null,
          },

          data: {
            revokedAt: resetTime,
          },
        })

        return true
      },
    )

    if (!resetSucceeded) {
      res.status(400).json({
        success: false,
        message:
          'Password reset link is invalid, ' +
          'expired, or already used.',
      })
      return
    }

    // Remove any old session cookie from this browser.
    clearSessionCookie(res)

    // Notify the customer of the password change.
    // Failure of this notification must not undo
    // a successfully committed password reset.
    try {
      await sendEmail({
        to: storedToken.customer.email,
        subject:
          'Your Loyce Dairies password was changed',

        text: [
          'Your Loyce Dairies password has been changed.',
          '',
          'All previous account sessions have been signed out.',
          '',
          'If you did not make this change,',
          'contact Loyce Dairies support.',
        ].join('\n'),

        html: `
          <div style="
            font-family:Arial,sans-serif;
            max-width:560px;
            margin:auto;
            padding:24px;
            color:#174D36;
          ">
            <h1>Loyce Dairies</h1>
            <h2>Password changed</h2>

            <p>
              Your password was successfully changed.
            </p>

            <p>
              All previous sessions have been revoked.
            </p>

            <p>
              If you did not make this change,
              contact Loyce Dairies support.
            </p>
          </div>
        `,
      })
    } catch (error: unknown) {
      console.error(
        'Password change notification failed:',
        error instanceof Error
          ? error.name
          : 'Unknown error',
      )
    }

    res.status(200).json({
      success: true,
      message:
        'Password reset successful. ' +
        'Please sign in again.',
    })
  },
)

export default router
