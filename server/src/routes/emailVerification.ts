
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { prisma } from '../lib/prisma.js'
import { sendEmail } from '../lib/mail.js'

import {
  generateActionToken,
  hashActionToken,
  isValidActionToken,
} from '../lib/actionTokens.js'

const router = Router()

const TOKEN_PURPOSE = 'EMAIL_VERIFICATION'
const TOKEN_DURATION_MS = 24 * 60 * 60 * 1000
const RESEND_COOLDOWN_MS = 5 * 60 * 1000

const requestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email()),
}).strict()

const confirmSchema = z.object({
  token: z.string(),
}).strict()

// Initial single-server request protection.
const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
})

const confirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please try again later.',
  },
})

function requireJson(
  contentType: string | undefined,
): boolean {
  return (
    typeof contentType === 'string' &&
    /^application\/json(?:\s*;|$)/i.test(contentType)
  )
}

// ==========================================
// POST /api/auth/email/verification/request
// ==========================================

router.post(
  '/verification/request',
  requestLimiter,
  async (req, res) => {
    res.set('Cache-Control', 'no-store')

    if (!requireJson(req.get('Content-Type'))) {
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
        message: 'Please provide a valid email address.',
      })
      return
    }

    const { email } = parsed.data

    // Do not disclose whether the email is registered.
    const genericResponse = {
      success: true,
      message:
        'If this address belongs to an eligible account, ' +
        'a verification email will be sent.',
    }

    const customer = await prisma.customer.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        isActive: true,
        emailVerifiedAt: true,
      },
    })

    if (
      !customer ||
      !customer.isActive ||
      customer.emailVerifiedAt !== null
    ) {
      res.status(200).json(genericResponse)
      return
    }

    const tokenKey = {
      customerId: customer.id,
      purpose: TOKEN_PURPOSE,
    } as const

    const existingToken =
      await prisma.customerActionToken.findUnique({
        where: {
          customerId_purpose: tokenKey,
        },
        select: {
          createdAt: true,
        },
      })

    // Avoid repeatedly issuing new email links.
    if (
      existingToken &&
      Date.now() - existingToken.createdAt.getTime() <
        RESEND_COOLDOWN_MS
    ) {
      res.status(200).json(genericResponse)
      return
    }

    const { token, tokenHash } =
      generateActionToken()

    const now = new Date()

    const expiresAt = new Date(
      now.getTime() + TOKEN_DURATION_MS,
    )

    // Replace any previous verification token.
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

    // Use a configured frontend URL, never a
    // user-controlled Host header.
    const frontendUrl =
      process.env.CLIENT_URL ??
      'http://localhost:5173'

    const verificationUrl = new URL(
      '/verify-email',
      frontendUrl,
    )

    verificationUrl.searchParams.set('token', token)

    try {
      await sendEmail({
        to: customer.email,

        subject: 'Verify your Loyce Dairies email',

        text: [
          'Welcome to Loyce Dairies!',
          '',
          'Please verify your email address:',
          verificationUrl.toString(),
          '',
          'This link expires in 24 hours.',
          'If you did not request this, ignore this email.',
        ].join('\n'),

        html: `
          <div style="font-family:Arial,sans-serif;
                      max-width:560px;margin:auto;
                      padding:24px;color:#174D36;">
            <h1 style="color:#174D36;">
              Loyce Dairies
            </h1>

            <h2>Verify your email address</h2>

            <p>
              Thank you for joining Loyce Dairies.
              Confirm your email address to complete
              verification of your account.
            </p>

            <p style="margin:30px 0;">
              <a href="${verificationUrl.toString()}"
                 style="background:#174D36;
                        color:white;
                        padding:14px 24px;
                        border-radius:30px;
                        text-decoration:none;">
                Verify email
              </a>
            </p>

            <p>
              This link expires in 24 hours.
            </p>

            <p>
              If you did not request this email,
              you can safely ignore it.
            </p>
          </div>
        `,
      })
    } catch (error: unknown) {
      // Never log the secret link or token.
      console.error(
        'Email verification delivery failed:',
        error instanceof Error
          ? error.name
          : 'Unknown error',
      )
    }

    res.status(200).json(genericResponse)
  },
)

// ==========================================
// POST /api/auth/email/verification/confirm
// ==========================================

router.post(
  '/verification/confirm',
  confirmLimiter,
  async (req, res) => {
    res.set('Cache-Control', 'no-store')

    if (!requireJson(req.get('Content-Type'))) {
      res.status(415).json({
        success: false,
        message: 'Content-Type must be application/json.',
      })
      return
    }

    const parsed = confirmSchema.safeParse(req.body)

    if (
      !parsed.success ||
      !isValidActionToken(parsed.data.token)
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid verification token.',
      })
      return
    }

    const tokenHash = hashActionToken(
      parsed.data.token,
    )

    const now = new Date()

    const verified = await prisma.$transaction(
      async (tx) => {
        const storedToken =
          await tx.customerActionToken.findUnique({
            where: { tokenHash },
            select: {
              id: true,
              customerId: true,
              purpose: true,
              expiresAt: true,
              usedAt: true,
              customer: {
                select: {
                  isActive: true,
                  emailVerifiedAt: true,
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
          storedToken.customer.emailVerifiedAt !== null
        ) {
          return false
        }

        // Atomically consume the token.
        const consumed =
          await tx.customerActionToken.updateMany({
            where: {
              id: storedToken.id,
              purpose: TOKEN_PURPOSE,
              usedAt: null,
              expiresAt: {
                gt: now,
              },
            },
            data: {
              usedAt: now,
            },
          })

        if (consumed.count !== 1) {
          return false
        }

        // Mark the customer's email as verified.
        await tx.customer.update({
          where: {
            id: storedToken.customerId,
          },
          data: {
            emailVerifiedAt: now,
          },
        })

        return true
      },
    )

    if (!verified) {
      res.status(400).json({
        success: false,
        message:
          'Verification link is invalid, expired, ' +
          'or has already been used.',
      })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Email verified successfully.',
    })
  },
)

export default router
