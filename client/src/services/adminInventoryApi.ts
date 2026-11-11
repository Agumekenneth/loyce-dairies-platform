
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5000/api'
).replace(/\/+$/, '')

// ==========================================
// LOYCE DAIRIES PLATFORM
// MILESTONE 4.7.3
// STAFF INVENTORY API SERVICE
// ==========================================

const MAX_STOCK_QUANTITY = 2_147_483_647

// ==========================================
// INVENTORY PRODUCT TYPES
// ==========================================

export type InventoryCategory = {
  id: number
  name: string
  slug: string
}

export type InventoryProduct = {
  id: number
  name: string
  unit: string
  priceUgx: number
  isActive: boolean
  stockQuantity: number
  updatedAt: string
  category: InventoryCategory
}

// ==========================================
// INVENTORY AUDIT ACTIONS
// ==========================================

export type InventoryAction =
  | 'STAFF_SET'
  | 'ORDER_PLACED'
  | 'ORDER_CANCELLED'

// ==========================================
// INVENTORY AUDIT EVENT
// ==========================================

export type InventoryAuditEvent = {
  id: string
  action: InventoryAction

  quantityBefore: number
  quantityAfter: number
  quantityChange: number

  note: string | null
  orderId: string | null
  createdAt: string

  changedBy: {
    id: string
    fullName: string
  } | null
}

// ==========================================
// INVENTORY ADJUSTMENT REQUEST
// ==========================================

export type InventoryAdjustment = {
  expectedStockQuantity: number
  stockQuantity: number
  note: string
}

// ==========================================
// UPDATED INVENTORY PRODUCT
// ==========================================

export type UpdatedInventoryProduct = {
  id: number
  name: string
  unit: string
  stockQuantity: number
  isActive: boolean
  updatedAt: string
}

// ==========================================
// BACKEND RESPONSE
// ==========================================

type ApiResponse<T> = {
  success: boolean
  count?: number
  message?: string
  data?: T
}

// ==========================================
// INVENTORY API ERROR
// ==========================================

export class InventoryApiError extends Error {
  readonly status: number

  constructor(
    status: number,
    message: string,
  ) {
    super(message)

    this.name = 'InventoryApiError'
    this.status = status
  }
}

// ==========================================
// VALIDATION HELPERS
// ==========================================

function isValidStockQuantity(
  value: number,
): boolean {
  return (
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_STOCK_QUANTITY
  )
}

function validateProductId(
  productId: number,
): void {
  if (
    !Number.isSafeInteger(productId) ||
    productId <= 0 ||
    productId > MAX_STOCK_QUANTITY
  ) {
    throw new Error('Invalid product ID.')
  }
}

// ==========================================
// SHARED AUTHENTICATED API REQUEST
// ==========================================

async function inventoryRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'PATCH'
    body?: InventoryAdjustment
    signal?: AbortSignal
  } = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  const isWrite = method === 'PATCH'

  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        method,

        // Include the existing authenticated
        // HTTP-only customer/staff cookie.
        credentials: 'include',

        // Always retrieve fresh stock data.
        cache: 'no-store',

        signal: options.signal,

        headers: {
          Accept: 'application/json',

          ...(isWrite
            ? {
                'Content-Type':
                  'application/json',

                // Required by the existing
                // staff inventory backend.
                'X-Loyce-Request': '1',
              }
            : {}),
        },

        ...(isWrite
          ? {
              body: JSON.stringify(
                options.body,
              ),
            }
          : {}),
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

    // Do not automatically retry writes:
    // the server may have already saved
    // the change before a network failure.

    throw new Error(
      'Unable to reach the inventory server. ' +
      'Refresh the stock balances before ' +
      'attempting another adjustment.',
    )
  }

  let result: ApiResponse<T>

  try {
    result =
      (await response.json()) as ApiResponse<T>
  } catch {
    throw new InventoryApiError(
      response.status,
      'The inventory server returned an ' +
      'invalid response. Refresh before ' +
      'making further changes.',
    )
  }

  if (!response.ok || !result.success) {
    throw new InventoryApiError(
      response.status,
      result.message ??
        'The inventory request failed.',
    )
  }

  if (result.data === undefined) {
    throw new InventoryApiError(
      response.status,
      'The inventory response is incomplete.',
    )
  }

  return result.data
}

// ==========================================
// GET STAFF INVENTORY
//
// GET /api/admin/inventory
// ==========================================

export async function getStaffInventory(
  signal?: AbortSignal,
): Promise<InventoryProduct[]> {
  return inventoryRequest<InventoryProduct[]>(
    '/admin/inventory',
    {
      signal,
    },
  )
}

// ==========================================
// GET PRODUCT INVENTORY HISTORY
//
// GET /api/admin/inventory/:productId/events
//
// The backend returns the latest
// 100 audit events.
// ==========================================

export async function getInventoryEvents(
  productId: number,
  signal?: AbortSignal,
): Promise<InventoryAuditEvent[]> {
  validateProductId(productId)

  return inventoryRequest<InventoryAuditEvent[]>(
    `/admin/inventory/${productId}/events`,
    {
      signal,
    },
  )
}

// ==========================================
// UPDATE PRODUCT STOCK
//
// PATCH /api/admin/inventory/:productId
// ==========================================

export async function updateStaffInventory(
  productId: number,
  adjustment: InventoryAdjustment,
): Promise<UpdatedInventoryProduct> {
  validateProductId(productId)

  const {
    expectedStockQuantity,
    stockQuantity,
  } = adjustment

  const note = adjustment.note.trim()

  // ========================================
  // VALIDATE STOCK QUANTITIES
  // ========================================

  if (
    !isValidStockQuantity(
      expectedStockQuantity,
    ) ||
    !isValidStockQuantity(stockQuantity)
  ) {
    throw new Error(
      'Stock quantities must be whole numbers ' +
      'between 0 and 2,147,483,647.',
    )
  }

  if (
    expectedStockQuantity ===
    stockQuantity
  ) {
    throw new Error(
      'The new stock quantity must differ ' +
      'from the current stock quantity.',
    )
  }

  // ========================================
  // VALIDATE AUDIT EXPLANATION
  // ========================================

  if (
    note.length < 5 ||
    note.length > 300
  ) {
    throw new Error(
      'Provide an inventory adjustment ' +
      'reason containing 5–300 characters.',
    )
  }

  // ========================================
  // SUBMIT AUTHORIZED STOCK ADJUSTMENT
  // ========================================

  return inventoryRequest<UpdatedInventoryProduct>(
    `/admin/inventory/${productId}`,
    {
      method: 'PATCH',

      body: {
        expectedStockQuantity,
        stockQuantity,
        note,
      },
    },
  )
}
