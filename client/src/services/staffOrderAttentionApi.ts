
import type {
  FulfillmentMethod,
} from './adminOrdersApi'

// ==========================================
// LOYCE DAIRIES PLATFORM
// MILESTONE 4.16
// STAFF ORDER ATTENTION API
// ==========================================

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5000/api'
).replace(/\/+$/, '')

// ==========================================
// ATTENTION LEVELS
// ==========================================

export type OrderAttentionLevel =
  | 'NORMAL'
  | 'REMINDER'
  | 'ESCALATED'
  | 'CRITICAL'

// ==========================================
// ORDER ATTENTION RECORD
// ==========================================

export type StaffAttentionOrder = {
  orderId: string
  orderNumber: string
  customerName: string
  recipientName: string
  fulfillmentMethod: FulfillmentMethod
  totalUgx: number
  status: 'PENDING'
  createdAt: string
  waitingMinutes: number
  attentionLevel: OrderAttentionLevel
  nextAttentionAt: string | null
  reviewPath: string
}

// ==========================================
// MONITORING SUMMARY
// ==========================================

export type OrderAttentionSummary = {
  totalPending: number
  normal: number
  reminder: number
  escalated: number
  critical: number
  requiringAttention: number
}

// ==========================================
// MONITORING RESPONSE
// ==========================================

export type StaffOrderAttentionData = {
  evaluatedAt: string

  thresholdsMinutes: {
    reminder: number
    escalation: number
    critical: number
  }

  summary: OrderAttentionSummary

  orders: StaffAttentionOrder[]

  nextCursor: string | null
  hasMore: boolean
}

// ==========================================
// REQUEST OPTIONS
// ==========================================

export type StaffOrderAttentionOptions = {
  cursor?: string
  limit?: number
  signal?: AbortSignal
}

// ==========================================
// API ERROR
// ==========================================

export class StaffOrderAttentionApiError extends Error {
  readonly status: number

  constructor(
    status: number,
    message: string,
  ) {
    super(message)

    this.name = 'StaffOrderAttentionApiError'
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
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

// ==========================================
// GET STAFF ORDER ATTENTION
//
// GET /api/admin/order-attention
// ==========================================

export async function getStaffOrderAttention(
  options: StaffOrderAttentionOptions = {},
): Promise<StaffOrderAttentionData> {
  const params = new URLSearchParams()

  params.set(
    'limit',
    String(options.limit ?? 25),
  )

  if (options.cursor) {
    params.set('cursor', options.cursor)
  }

  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}/admin/order-attention?${params.toString()}`,
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
        signal: options.signal,
      },
    )
  } catch (error: unknown) {
    if (
      options.signal?.aborted ||
      (
        error instanceof Error &&
        error.name === 'AbortError'
      )
    ) {
      throw error
    }

    throw new StaffOrderAttentionApiError(
      0,
      'Unable to connect to the Loyce Dairies server.',
    )
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    throw new StaffOrderAttentionApiError(
      response.status,
      'The server returned an invalid response.',
    )
  }

  if (!isRecord(payload)) {
    throw new StaffOrderAttentionApiError(
      response.status,
      'Invalid order monitoring response.',
    )
  }

  if (
    !response.ok ||
    payload.success !== true
  ) {
    throw new StaffOrderAttentionApiError(
      response.status,
      typeof payload.message === 'string'
        ? payload.message
        : 'Unable to retrieve unattended orders.',
    )
  }

  const data = payload.data

  if (
    !isRecord(data) ||
    !isRecord(data.summary) ||
    !isRecord(data.thresholdsMinutes) ||
    !Array.isArray(data.orders) ||
    typeof data.evaluatedAt !== 'string' ||
    typeof data.hasMore !== 'boolean' ||
    !(
      data.nextCursor === null ||
      typeof data.nextCursor === 'string'
    )
  ) {
    throw new StaffOrderAttentionApiError(
      response.status,
      'The order monitoring data is incomplete.',
    )
  }

  return data as StaffOrderAttentionData
}
