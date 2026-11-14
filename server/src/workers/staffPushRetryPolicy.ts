// ==========================================
// LOYCE DAIRIES
// STAFF PUSH NOTIFICATION RETRY POLICY
// ==========================================

// Maximum delivery attempts per job.
export const MAX_PUSH_ATTEMPTS = 5

const BASE_RETRY_DELAY_MS = 15_000
const MAX_RETRY_DELAY_MS = 600_000
const MAX_JITTER_MS = 5_000

// ==========================================
// INVALID DEVICE TOKENS
// ==========================================

export function isInvalidPushToken(
  code: string,
): boolean {
  return (
    code ===
      'messaging/registration-token-not-registered' ||
    code ===
      'messaging/invalid-registration-token'
  )
}

// ==========================================
// PERMANENT DELIVERY ERRORS
// ==========================================

export function isPermanentPushError(
  code: string,
): boolean {
  return (
    isInvalidPushToken(code) ||
    code === 'messaging/invalid-argument' ||
    code === 'messaging/mismatched-credential' ||
    code === 'messaging/invalid-package-name' ||
    code === 'messaging/third-party-auth-error'
  )
}

// ==========================================
// RETRY ELIGIBILITY
// ==========================================

export function shouldRetryPush(
  code: string,
  attempts: number,
): boolean {
  return (
    !isPermanentPushError(code) &&
    attempts < MAX_PUSH_ATTEMPTS
  )
}

// ==========================================
// EXPONENTIAL BACKOFF WITH JITTER
// ==========================================

export function nextPushRetryTime(
  attempts: number,
  nowMs: number = Date.now(),
  jitterMs: number = Math.floor(
    Math.random() * MAX_JITTER_MS,
  ),
): Date {
  if (
    !Number.isSafeInteger(attempts) ||
    attempts < 1
  ) {
    throw new Error('Invalid push attempt count.')
  }

  if (
    !Number.isFinite(nowMs) ||
    !Number.isInteger(jitterMs) ||
    jitterMs < 0 ||
    jitterMs >= MAX_JITTER_MS
  ) {
    throw new Error('Invalid retry timing inputs.')
  }

  const baseDelay = Math.min(
    BASE_RETRY_DELAY_MS *
      2 ** Math.max(0, attempts - 1),
    MAX_RETRY_DELAY_MS,
  )

  return new Date(
    nowMs + baseDelay + jitterMs,
  )
}
