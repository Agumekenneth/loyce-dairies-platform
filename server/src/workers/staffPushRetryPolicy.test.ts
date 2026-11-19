import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_PUSH_ATTEMPTS,
  isInvalidPushToken,
  isPermanentPushError,
  shouldRetryPush,
  nextPushRetryTime,
} from './staffPushRetryPolicy.js'

// ==========================================
// LOYCE DAIRIES
// FIREBASE RETRY POLICY UNIT TESTS
// ==========================================

test('Maximum delivery attempts is five', () => {
  assert.equal(MAX_PUSH_ATTEMPTS, 5)
})

test('Invalid registration tokens are recognized', () => {
  assert.equal(
    isInvalidPushToken(
      'messaging/registration-token-not-registered',
    ),
    true,
  )

  assert.equal(
    isInvalidPushToken(
      'messaging/invalid-registration-token',
    ),
    true,
  )

  assert.equal(
    isInvalidPushToken('messaging/unavailable'),
    false,
  )
})

test('Permanent Firebase errors are not retried', () => {
  const permanentCodes = [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
    'messaging/mismatched-credential',
    'messaging/invalid-package-name',
    'messaging/third-party-auth-error',
  ]

  for (const code of permanentCodes) {
    assert.equal(isPermanentPushError(code), true)
    assert.equal(shouldRetryPush(code, 1), false)
  }
})

test('Transient failures are retried before limit', () => {
  const transientCodes = [
    'messaging/unavailable',
    'messaging/internal-error',
    'unknown_error',
  ]

  for (const code of transientCodes) {
    assert.equal(shouldRetryPush(code, 1), true)
    assert.equal(shouldRetryPush(code, 4), true)
  }
})

test('Retry stops after five attempts', () => {
  assert.equal(
    shouldRetryPush('messaging/unavailable', 5),
    false,
  )

  assert.equal(
    shouldRetryPush('messaging/unavailable', 6),
    false,
  )
})

test('Exponential retry delays are correct', () => {
  const now = 1_700_000_000_000

  const cases = [
    { attempts: 1, delay: 15_000 },
    { attempts: 2, delay: 30_000 },
    { attempts: 3, delay: 60_000 },
    { attempts: 4, delay: 120_000 },
    { attempts: 5, delay: 240_000 },
    { attempts: 8, delay: 600_000 },
  ]

  for (const item of cases) {
    const retryTime = nextPushRetryTime(
      item.attempts,
      now,
      0,
    )

    assert.equal(
      retryTime.getTime(),
      now + item.delay,
    )
  }
})

test('Retry jitter is applied correctly', () => {
  const now = 1_700_000_000_000

  assert.equal(
    nextPushRetryTime(1, now, 4_999).getTime(),
    now + 15_000 + 4_999,
  )
})

test('Invalid retry timing inputs are rejected', () => {
  const now = 1_700_000_000_000

  assert.throws(
    () => nextPushRetryTime(0, now, 0),
    /Invalid push attempt count/,
  )

  assert.throws(
    () => nextPushRetryTime(1, now, 5_000),
    /Invalid retry timing inputs/,
  )
})
