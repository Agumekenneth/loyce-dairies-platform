
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5000/api'
).replace(/\/+$/, '')

export type FulfillmentMethod = 'PICKUP' | 'DELIVERY'

export type DeliveryZone = {
  id: number
  name: string
  slug: string
  feeUgx: number
}

type CheckoutItem = {
  productId: number
  quantity: number
}

type CheckoutCommon = {
  recipientName: string
  contactPhone: string
  items: CheckoutItem[]
}

export type CheckoutPayload =
  | (CheckoutCommon & {
      fulfillmentMethod: 'PICKUP'
      paymentMethod: 'CASH_ON_PICKUP'
    })
  | (CheckoutCommon & {
      fulfillmentMethod: 'DELIVERY'
      paymentMethod: 'CASH_ON_DELIVERY'
      deliveryZoneId: number
      deliveryAddress: string
      deliveryInstructions?: string
    })

export type CreatedOrder = {
  id: string
  orderNumber: string
  fulfillmentMethod: FulfillmentMethod
  status: string
  paymentMethod: string
  paymentStatus: string
  recipientName: string
  contactPhone: string
  deliveryAddress: string | null
  deliveryZoneName: string | null
  subtotalUgx: number
  deliveryFeeUgx: number
  totalUgx: number
  createdAt: string
  items: {
    id: string
    productId: number | null
    productName: string
    productUnit: string
    unitPriceUgx: number
    quantity: number
    lineTotalUgx: number
  }[]
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

async function readApiResponse<T>(
  response: Response,
): Promise<T> {
  let result: ApiResponse<T>

  try {
    result = (await response.json()) as ApiResponse<T>
  } catch {
    throw new Error('Invalid response from the server.')
  }

  if (!response.ok || !result.success) {
    throw new Error(
      result.message ??
        `Request failed with status ${response.status}.`,
    )
  }

  if (result.data === undefined) {
    throw new Error('The server response is incomplete.')
  }

  return result.data
}

// ==========================================
// GET CONFIGURED DELIVERY ZONES
// ==========================================

export async function fetchDeliveryZones():
  Promise<DeliveryZone[]> {
  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}/delivery-zones`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
    )
  } catch {
    throw new Error('Unable to load delivery zones.')
  }

  return readApiResponse<DeliveryZone[]>(response)
}

// ==========================================
// SUBMIT AUTHENTICATED CHECKOUT
// ==========================================

export async function submitCheckout(
  payload: CheckoutPayload,
): Promise<CreatedOrder> {
  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}/orders/checkout`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Loyce-Request': '1',
        },

        // Send the HTTP-only customer session cookie.
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(payload),
      },
    )
  } catch {
    throw new Error(
      'We could not confirm whether your order reached ' +
      'the server. Check your order history before ' +
      'submitting another order.',
    )
  }

  return readApiResponse<CreatedOrder>(response)
}
