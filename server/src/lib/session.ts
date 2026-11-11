
import { createHash, randomBytes } from 'node:crypto'

import type {
  CookieOptions,
  Request,
  Response,
} from 'express'

import { prisma } from './prisma.js'

// ==========================================
// LOYCE DAIRIES PLATFORM
// AUTHENTICATED SESSION MANAGEMENT
// ==========================================

const isProduction =
  process.env.NODE_ENV === 'production'

const SESSION_DURATION_MS =
  24 * 60 * 60 * 1000

// ==========================================
// SESSION COOKIE CONFIGURATION
// ==========================================

export const SESSION_COOKIE_NAME =
  isProduction
    ? '__Host-ld_session'
    : 'ld_session'

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
}

// ==========================================
// HASH SESSION TOKEN
// ==========================================

function hashSessionToken(
  token: string,
): string {
  return createHash('sha256')
    .update(token)
    .digest('hex')
}

// ==========================================
// READ SESSION COOKIE
// ==========================================

function readSessionToken(
  req: Request,
): string | null {
  const token: unknown =
    req.cookies?.[SESSION_COOKIE_NAME]

  if (
    typeof token !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  ) {
    return null
  }

  return token
}

// ==========================================
// CREATE AUTHENTICATED SESSION
// ==========================================

export async function createSession(
  customerId: string,
  res: Response,
): Promise<void> {
  const token =
    randomBytes(32).toString('base64url')

  const tokenHash =
    hashSessionToken(token)

  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_MS,
  )

  await prisma.customerSession.create({
    data: {
      customerId,
      tokenHash,
      expiresAt,
    },
  })

  res.cookie(
    SESSION_COOKIE_NAME,
    token,
    {
      ...cookieOptions,
      maxAge: SESSION_DURATION_MS,
    },
  )
}

// ==========================================
// RETRIEVE CURRENT SESSION
// ==========================================

export async function getCurrentSession(
  req: Request,
) {
  const token = readSessionToken(req)

  if (!token) {
    return null
  }

  const session =
    await prisma.customerSession.findUnique({
      where: {
        tokenHash: hashSessionToken(token),
      },

      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            emailVerifiedAt: true,

            // Required for frontend
            // staff workspace visibility.
            //
            // Always retrieved from
            // PostgreSQL, never from
            // a browser-supplied role.

            role: true,

            isActive: true,
            createdAt: true,
          },
        },
      },
    })

  if (!session) {
    return null
  }

  // Reject revoked sessions.

  if (session.revokedAt !== null) {
    return null
  }

  // Reject expired sessions.

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    return null
  }

  // Reject inactive customer accounts.

  if (!session.customer.isActive) {
    return null
  }

  return session
}

// ==========================================
// REVOKE CURRENT SESSION
// ==========================================

export async function revokeCurrentSession(
  req: Request,
): Promise<void> {
  const token = readSessionToken(req)

  if (!token) {
    return
  }

  await prisma.customerSession.updateMany({
    where: {
      tokenHash: hashSessionToken(token),
      revokedAt: null,
    },

    data: {
      revokedAt: new Date(),
    },
  })
}

// ==========================================
// CLEAR SESSION COOKIE
// ==========================================

export function clearSessionCookie(
  res: Response,
): void {
  res.clearCookie(
    SESSION_COOKIE_NAME,
    cookieOptions,
  )
}
