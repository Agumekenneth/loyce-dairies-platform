
import { createHash, randomBytes } from 'node:crypto'
import type { CookieOptions, Request, Response } from 'express'

import { prisma } from './prisma.js'

const isProduction = process.env.NODE_ENV === 'production'

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000

export const SESSION_COOKIE_NAME = isProduction
  ? '__Host-ld_session'
  : 'ld_session'

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
}

// Hash an unpredictable session token before database storage.
function hashSessionToken(token: string): string {
  return createHash('sha256')
    .update(token)
    .digest('hex')
}

// Extract and validate the session cookie.
function readSessionToken(req: Request): string | null {
  const token: unknown = req.cookies?.[SESSION_COOKIE_NAME]

  if (
    typeof token !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  ) {
    return null
  }

  return token
}

// Create a new authenticated session.
export async function createSession(
  customerId: string,
  res: Response,
): Promise<void> {
  const token = randomBytes(32).toString('base64url')

  const tokenHash = hashSessionToken(token)

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

  res.cookie(SESSION_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: SESSION_DURATION_MS,
  })
}

// Retrieve a valid, unexpired, non-revoked session.
export async function getCurrentSession(req: Request) {
  const token = readSessionToken(req)

  if (!token) return null

  const session = await prisma.customerSession.findUnique({
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
          isActive: true,
          createdAt: true,
        },
      },
    },
  })

  if (!session) return null

  if (session.revokedAt !== null) return null

  if (session.expiresAt.getTime() <= Date.now()) {
    return null
  }

  if (!session.customer.isActive) return null

  return session
}

// Revoke the session identified by the incoming cookie.
export async function revokeCurrentSession(
  req: Request,
): Promise<void> {
  const token = readSessionToken(req)

  if (!token) return

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

// Remove the browser session cookie.
export function clearSessionCookie(res: Response): void {
  res.clearCookie(
    SESSION_COOKIE_NAME,
    cookieOptions,
  )
}
