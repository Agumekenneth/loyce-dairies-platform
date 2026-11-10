
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5000/api'
).replace(/\/+$/, '')

// ==========================================
// ORDER TYPES
// ==========================================

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED'
  | 'CANCELLED'

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'

export type OrderItem = {
  id: string
  productId: number | null
  productName: string
  productUnit: string
  unitPriceUgx: number
  quantity: number
  lineTotalUgx: number
}

export type CustomerOrder = {
  id: string
  orderNumber: string

  fulfillmentMethod: 'PICKUP' | 'DELIVERY'
  status: OrderStatus

  paymentMethod: string
  paymentStatus: PaymentStatus

  recipientName: string
  contactPhone: string

  deliveryAddress: string | null
  deliveryInstructions: string | null
  deliveryZoneName: string | null

  subtotalUgx: number
  deliveryFeeUgx: number
  totalUgx: number

  createdAt: string
  updatedAt: string

  items: OrderItem[]
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

// ==========================================
// SHARED AUTHENTICATED REQUEST
// ==========================================

async function orderRequest<T>(
  endpoint: string,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
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
    if (signal?.aborted) {
      throw error
    }

    throw new Error(
      'Unable to connect to the Loyce Dairies server.',
    )
  }

  let result: ApiResponse<T>

  try {
    result = (await response.json()) as ApiResponse<T>
  } catch {
    throw new Error(
      'The server returned an invalid response.',
    )
  }

  if (response.status === 401) {
    throw new Error(
      'Your session may have expired. Please sign in again.',
    )
  }

  if (!response.ok || !result.success) {
    throw new Error(
      result.message ??
        `Request failed with status ${response.status}.`,
    )
  }

  if (result.data === undefined) {
    throw new Error(
      'The order response is incomplete.',
    )
  }

  return result.data
}

// ==========================================
// GET /api/orders
// ==========================================

export async function fetchCustomerOrders(
  signal?: AbortSignal,
): Promise<CustomerOrder[]> {
  return orderRequest<CustomerOrder[]>(
    '/orders',
    signal,
  )
}

// ==========================================
// GET /api/orders/:orderId
// ==========================================

export async function fetchCustomerOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<CustomerOrder> {
  return orderRequest<CustomerOrder>(
    `/orders/${encodeURIComponent(orderId)}`,
    signal,
  )
}
