
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5000/api'
).replace(/\/+$/, '')

// ==========================================
// DELIVERY ZONE TYPES
// ==========================================

export type DeliveryZone = {
  id: number
  name: string
  slug: string
  feeUgx: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type ZoneInput = {
  name: string
  slug: string
  feeUgx: number
}

export type ZoneUpdate = Partial<ZoneInput>

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

// ==========================================
// API ERROR
// ==========================================

export class DeliveryZoneApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)

    this.name = 'DeliveryZoneApiError'
    this.status = status
  }
}

// ==========================================
// SHARED STAFF REQUEST
// ==========================================

async function staffRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH'
    body?: object
    signal?: AbortSignal
  } = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  const isWrite = method !== 'GET'

  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        method,
        credentials: 'include',
        cache: 'no-store',
        signal: options.signal,

        headers: {
          Accept: 'application/json',

          ...(isWrite
            ? {
                'Content-Type': 'application/json',
                'X-Loyce-Request': '1',
              }
            : {}),
        },

        ...(isWrite
          ? { body: JSON.stringify(options.body) }
          : {}),
      },
    )
  } catch (error: unknown) {
    if (options.signal?.aborted) {
      throw error
    }

    throw new Error(
      'Unable to reach the server. If you were saving ' +
      'a change, refresh the delivery zones before ' +
      'trying again.',
    )
  }

  let result: ApiResponse<T>

  try {
    result = (await response.json()) as ApiResponse<T>
  } catch {
    throw new DeliveryZoneApiError(
      response.status,
      'The server returned an invalid response.',
    )
  }

  if (!response.ok || !result.success) {
    throw new DeliveryZoneApiError(
      response.status,
      result.message ?? 'The request failed.',
    )
  }

  if (result.data === undefined) {
    throw new DeliveryZoneApiError(
      response.status,
      'The server response is incomplete.',
    )
  }

  return result.data
}

// ==========================================
// GET ALL STAFF DELIVERY ZONES
// ==========================================

export async function getStaffDeliveryZones(
  signal?: AbortSignal,
): Promise<DeliveryZone[]> {
  return staffRequest<DeliveryZone[]>(
    '/admin/delivery-zones',
    { signal },
  )
}

// ==========================================
// CREATE INACTIVE DELIVERY ZONE
// ==========================================

export async function createDeliveryZone(
  input: ZoneInput,
): Promise<DeliveryZone> {
  return staffRequest<DeliveryZone>(
    '/admin/delivery-zones',
    {
      method: 'POST',
      body: input,
    },
  )
}

// ==========================================
// UPDATE DELIVERY ZONE DETAILS
// ==========================================

export async function updateDeliveryZone(
  id: number,
  input: ZoneUpdate,
): Promise<DeliveryZone> {
  return staffRequest<DeliveryZone>(
    `/admin/delivery-zones/${id}`,
    {
      method: 'PATCH',
      body: input,
    },
  )
}

// ==========================================
// ACTIVATE OR DEACTIVATE DELIVERY ZONE
// ==========================================

export async function setDeliveryZoneActivation(
  id: number,
  isActive: boolean,
): Promise<DeliveryZone> {
  const body = isActive
    ? {
        isActive: true,
        confirmation: 'ZONE_AND_FEE_APPROVED',
      }
    : {
        isActive: false,
      }

  return staffRequest<DeliveryZone>(
    `/admin/delivery-zones/${id}/activation`,
    {
      method: 'PATCH',
      body,
    },
  )
}
