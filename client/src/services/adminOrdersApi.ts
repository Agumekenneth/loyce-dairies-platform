
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5000/api'
).replace(/\/+$/, '')

// ==========================================
// ORDER STATUS TYPES
// ==========================================

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'COMPLETED',
  'CANCELLED',
] as const

export type OrderStatus =
  (typeof ORDER_STATUSES)[number]

export type OrderFilter = OrderStatus | 'ALL'

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'

export type FulfillmentMethod =
  | 'PICKUP'
  | 'DELIVERY'

// ==========================================
// STAFF ORDER SUMMARY
// ==========================================

export type StaffOrderSummary = {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: string
  fulfillmentMethod: FulfillmentMethod

  recipientName: string
  contactPhone: string
  totalUgx: number

  createdAt: string
  updatedAt: string

  customer: {
    id: string
    fullName: string
    email: string
  }

  _count: {
    items: number
  }
}

// ==========================================
// ORDER DETAIL TYPES
// ==========================================

export type StaffOrderItem = {
  id: string
  productId: number | null
  productName: string
  productUnit: string
  unitPriceUgx: number
  quantity: number
  lineTotalUgx: number
}

export type OrderStatusEvent = {
  id: string
  fromStatus: OrderStatus
  toStatus: OrderStatus
  note: string | null
  createdAt: string
  changedBy: {
    fullName: string
  }
}

export type StaffOrderDetail = StaffOrderSummary & {
  deliveryAddress: string | null
  deliveryInstructions: string | null
  deliveryZoneName: string | null

  subtotalUgx: number
  deliveryFeeUgx: number

  items: StaffOrderItem[]
  statusEvents: OrderStatusEvent[]
}

export type StaffOrderPage = {
  orders: StaffOrderSummary[]
  nextCursor: string | null
}

// ==========================================
// API ERROR
// ==========================================


export class StaffApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)

    this.name = 'StaffApiError'
    this.status = status
  }
}


// ==========================================
// API RESPONSE WRAPPER
// ==========================================

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
  nextCursor?: string | null
}

async function staffRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T> & { data: T }> {
  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          ...options.headers,
        },
      },
    )
  } catch (error: unknown) {
    if (
      options.signal?.aborted ||
      (error instanceof Error &&
        error.name === 'AbortError')
    ) {
      throw error
    }

    throw new Error(
      'Unable to reach the server. If you were ' +
      'updating an order, refresh its details before ' +
      'trying again.',
    )
  }

  let result: ApiResponse<T>

  try {
    result = (await response.json()) as ApiResponse<T>
  } catch {
    throw new StaffApiError(
      response.status,
      'The server returned an invalid response. ' +
      'Refresh before repeating an order update.',
    )
  }

  if (!response.ok || !result.success) {
    throw new StaffApiError(
      response.status,
      result.message ??
        'The administrative request failed.',
    )
  }

  if (result.data === undefined) {
    throw new StaffApiError(
      response.status,
      'The server response is incomplete.',
    )
  }

  return {
    ...result,
    data: result.data,
  }
}

// ==========================================
// GET /api/admin/orders
// ==========================================

export async function getStaffOrders(
  options: {
    status?: OrderStatus
    cursor?: string
    limit?: number
    signal?: AbortSignal
  } = {},
): Promise<StaffOrderPage> {
  const params = new URLSearchParams()

  params.set(
    'limit',
    String(options.limit ?? 20),
  )

  if (options.status) {
    params.set('status', options.status)
  }

  if (options.cursor) {
    params.set('cursor', options.cursor)
  }

  const result = await staffRequest<
    StaffOrderSummary[]
  >(`/admin/orders?${params.toString()}`, {
    signal: options.signal,
  })

  return {
    orders: result.data,
    nextCursor: result.nextCursor ?? null,
  }
}

// ==========================================
// GET /api/admin/orders/:orderId
// ==========================================

export async function getStaffOrderDetails(
  orderId: string,
  signal?: AbortSignal,
): Promise<StaffOrderDetail> {
  const result = await staffRequest<StaffOrderDetail>(
    `/admin/orders/${encodeURIComponent(orderId)}`,
    { signal },
  )

  return result.data
}

// ==========================================
// PATCH /api/admin/orders/:orderId/status
// ==========================================

export async function changeStaffOrderStatus(
  orderId: string,
  status: OrderStatus,
  note?: string,
): Promise<StaffOrderDetail> {
  const result = await staffRequest<StaffOrderDetail>(
    `/admin/orders/${encodeURIComponent(orderId)}/status`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Loyce-Request': '1',
      },
      body: JSON.stringify({
        status,
        ...(note?.trim()
          ? { note: note.trim() }
          : {}),
      }),
    },
  )

  return result.data
}
