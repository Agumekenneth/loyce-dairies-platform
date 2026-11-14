// ==========================================
// LOYCE DAIRIES
// STAFF PUSH DELIVERY QUEUE HEALTH API
// ==========================================

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5000/api'
).replace(/\/+$/, '')

// ==========================================
// RESPONSE TYPES
// ==========================================

export type PushQueueSummary = {
  totalJobs: number
  PENDING: number
  PROCESSING: number
  SENT: number
  FAILED: number
  CANCELLED: number
  activeDevices: number
}

export type PushDeliveryFailure = {
  orderNumber: string
  orderStatus: string
  attempts: number
  lastErrorCode: string | null
  updatedAt: string
}

export type StaffPushQueueHealth = {
  evaluatedAt: string
  summary: PushQueueSummary
  recentFailures: PushDeliveryFailure[]
}

// ==========================================
// API ERROR
// ==========================================

export class PushQueueHealthApiError extends Error {
  readonly status: number

  constructor(
    status: number,
    message: string,
  ) {
    super(message)

    this.name = 'PushQueueHealthApiError'
    this.status = status
  }
}

// ==========================================
// RESPONSE VALIDATION
// ==========================================

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function isCount(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  )
}

// ==========================================
// GET DELIVERY QUEUE HEALTH
// GET /api/admin/push-queue/health
// ==========================================

export async function getStaffPushQueueHealth(
  signal?: AbortSignal,
): Promise<StaffPushQueueHealth> {
  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}/admin/push-queue/health`,
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
        signal,
      },
    )
  } catch (error: unknown) {
    if (
      signal?.aborted ||
      (
        error instanceof Error &&
        error.name === 'AbortError'
      )
    ) {
      throw error
    }

    throw new PushQueueHealthApiError(
      0,
      'Unable to connect to the Loyce Dairies server.',
    )
  }

  // ========================================
  // PARSE RESPONSE
  // ========================================

  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    throw new PushQueueHealthApiError(
      response.status,
      'The server returned an invalid response.',
    )
  }

  if (
    !isRecord(payload) ||
    !response.ok ||
    payload.success !== true
  ) {
    throw new PushQueueHealthApiError(
      response.status,
      isRecord(payload) &&
        typeof payload.message === 'string'
        ? payload.message
        : 'Unable to retrieve notification health.',
    )
  }

  // ========================================
  // VALIDATE DELIVERY DATA
  // ========================================

  const data = payload.data

  if (
    !isRecord(data) ||
    typeof data.evaluatedAt !== 'string' ||
    !isRecord(data.summary) ||
    !Array.isArray(data.recentFailures)
  ) {
    throw new PushQueueHealthApiError(
      response.status,
      'Notification health data is incomplete.',
    )
  }

  const summary = data.summary

  const fields = [
    'totalJobs',
    'PENDING',
    'PROCESSING',
    'SENT',
    'FAILED',
    'CANCELLED',
    'activeDevices',
  ] as const

  if (
    fields.some(
      (field) => !isCount(summary[field]),
    )
  ) {
    throw new PushQueueHealthApiError(
      response.status,
      'Invalid delivery queue statistics.',
    )
  }

  // ========================================
  // VALIDATE FAILURE RECORDS
  // ========================================

  const validFailures =
    data.recentFailures.every(
      (entry: unknown) =>
        isRecord(entry) &&
        typeof entry.orderNumber === 'string' &&
        typeof entry.orderStatus === 'string' &&
        isCount(entry.attempts) &&
        (
          entry.lastErrorCode === null ||
          typeof entry.lastErrorCode === 'string'
        ) &&
        typeof entry.updatedAt === 'string',
    )

  if (!validFailures) {
    throw new PushQueueHealthApiError(
      response.status,
      'Invalid delivery failure records.',
    )
  }

  return data as StaffPushQueueHealth
}
