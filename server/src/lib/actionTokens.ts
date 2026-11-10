
import {
  createHash,
  randomBytes,
} from 'node:crypto'

// Hash a token before it is stored or looked up.
export function hashActionToken(token: string): string {
  return createHash('sha256')
    .update(token)
    .digest('hex')
}

// Create a cryptographically random one-time token.
export function generateActionToken() {
  const token = randomBytes(32).toString('base64url')

  return {
    token,
    tokenHash: hashActionToken(token),
  }
}

// Check that a submitted token has the expected format.
export function isValidActionToken(
  token: unknown,
): token is string {
  return (
    typeof token === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(token)
  )
}
