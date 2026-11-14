
import { createHash, randomBytes } from 'node:crypto'

import type {
  CookieOptions,
  Request,
  Response,
} from 'express'

import { prisma } from './prisma.js'

// ==========================================
// LOYCE DAIRIES
// WEB AND MOBILE SESSION MANAGEMENT
// ==========================================

const isProduction =
  process.env.NODE_ENV === 'production'

const SESSION_DURATION_MS =
  24 * 60 * 60 * 1000

const SESSION_TOKEN_PATTERN =
  /^[A-Za-z0-9_-]{43}$/

// ==========================================
// BROWSER SESSION COOKIE
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
// SESSION TOKEN HASHING
// ==========================================

function hashSessionToken(
  token: string,
): string {
  return createHash('sha256')
    .update(token)
    .digest('hex')
}

// ==========================================
// ISSUE A DATABASE-BACKED SESSION
// ==========================================

async function issueSession(
  customerId: string,
): Promise<{
  token: string
  expiresAt: Date
}> {
  const token =
    randomBytes(32).toString('base64url')

  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_MS,
  )

  await prisma.customerSession.create({
    data: {
      customerId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    },
  })

  return {
    token,
    expiresAt,
  }
}

// ==========================================
// BROWSER LOGIN SESSION
// ==========================================

export async function createSession(
  customerId: string,
  res: Response,
): Promise<void> {
  const { token } =
    await issueSession(customerId)

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
// NATIVE MOBILE LOGIN SESSION
// ==========================================

// Reserved for the authenticated mobile
// login endpoint implemented next.
//
// The returned token must be transmitted
// over HTTPS and stored in Android Keystore
// or iOS Keychain-backed secure storage.
//
// Never put this token in localStorage,
// application logs, or a Git repository.

export async function createMobileSession(
  customerId: string,
): Promise<{
  token: string
  expiresAt: Date
}> {
  return issueSession(customerId)
}

// ==========================================
// READ BROWSER OR MOBILE TOKEN
// ==========================================

function readSessionToken(
  req: Request,
): string | null {
  const authorization =
    req.get('Authorization')

  // When an Authorization header is
  // supplied, it takes precedence over
  // cookies. Invalid bearer credentials
  // must not fall back to cookie auth.

  if (authorization !== undefined) {
    const match =
      /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(
        authorization,
      )

    return match?.[1] ?? null
  }

  const token: unknown =
    req.cookies?.[SESSION_COOKIE_NAME]

  if (
    typeof token !== 'string' ||
    !SESSION_TOKEN_PATTERN.test(token)
  ) {
    return null
  }

  return token
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

  if (session.revokedAt !== null) {
    return null
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    return null
  }

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
// CLEAR BROWSER SESSION COOKIE
// ==========================================

export function clearSessionCookie(
  res: Response,
): void {
  res.clearCookie(
    SESSION_COOKIE_NAME,
    cookieOptions,
  )
}
