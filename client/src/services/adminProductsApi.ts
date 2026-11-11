
/**
 * Loyce Dairies Platform — Staff Product Management API
 * Milestone 4.8.8C: independent category loading
 *
 * Product metadata is managed here. Inventory quantities must be
 * adjusted only through the dedicated inventory API.
 */

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api'
).replace(/\/+$/, '')

// -----------------------------------------------------------------------------
// Domain types
// -----------------------------------------------------------------------------

export type ProductCategory = {
  id: number
  name: string
  slug: string
}

export type StaffProduct = {
  id: number
  name: string
  description: string | null
  priceUgx: number
  unit: string
  imageUrl: string | null
  badge: string | null
  isActive: boolean
  stockQuantity: number
  categoryId: number
  category: ProductCategory
  createdAt: string
  updatedAt: string
}

export type ProductAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'ACTIVATED'
  | 'DEACTIVATED'

export type ProductAuditSnapshot = {
  id: number
  name: string
  description: string | null
  priceUgx: number
  unit: string
  imageUrl: string | null
  badge: string | null
  categoryId: number
  isActive: boolean
}

export type ProductAuditEvent = {
  id: string
  productId: number
  changedById: string
  action: ProductAuditAction
  previousValues: ProductAuditSnapshot | null
  newValues: ProductAuditSnapshot
  createdAt: string
  changedBy: {
    id: string
    fullName: string
  }
}

// Stock quantity is deliberately excluded from every product write type.
export type ProductEditableFields = {
  name: string
  description: string | null
  priceUgx: number
  unit: string
  imageUrl: string | null
  badge: string | null
  categoryId: number
  isActive: boolean
}

export type CreateProductInput = {
  name: string
  priceUgx: number
  unit: string
  categoryId: number
  description?: string | null
  imageUrl?: string | null
  badge?: string | null
  isActive?: boolean
}

export type UpdateProductInput = {
  expectedUpdatedAt: string
} & Partial<ProductEditableFields>

export type ProductHistoryResponse = {
  product: {
    id: number
    name: string
  }
  count: number
  data: ProductAuditEvent[]
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  count?: number
  data?: T
  errors?: unknown
}

type ProductHistoryApiResponse = ApiResponse<ProductAuditEvent[]> & {
  product?: ProductHistoryResponse['product']
}

// -----------------------------------------------------------------------------
// Error handling and shared HTTP client
// -----------------------------------------------------------------------------

export class ProductApiError extends Error {
  readonly statusCode: number
  readonly details?: unknown

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ProductApiError'
    this.statusCode = statusCode
    this.details = details
  }
}

async function productRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers)

  headers.set('Accept', 'application/json')

  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('Content-Type', 'application/json')
    headers.set('X-Loyce-Request', '1')
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error
    }

    throw new ProductApiError(
      0,
      'Unable to connect to the Loyce Dairies server.',
    )
  }

  let result: ApiResponse<T> | null

  try {
    result = (await response.json()) as ApiResponse<T>
  } catch {
    throw new ProductApiError(
      response.status,
      'The server returned an invalid response.',
    )
  }

  if (!response.ok || !result || result.success !== true) {
    throw new ProductApiError(
      response.status,
      result?.message ?? `Request failed with status ${response.status}.`,
      result?.errors,
    )
  }

  return result
}

function requireData<T>(response: ApiResponse<T>): T {
  if (response.data === undefined || response.data === null) {
    throw new ProductApiError(
      500,
      'The server response is missing required data.',
    )
  }

  return response.data
}

function requireArray<T>(
  response: ApiResponse<T[]>,
  invalidResponseMessage: string,
): T[] {
  const data = requireData(response)

  if (!Array.isArray(data)) {
    throw new ProductApiError(500, invalidResponseMessage)
  }

  return data
}

// -----------------------------------------------------------------------------
// Read operations
// -----------------------------------------------------------------------------

/** GET /api/admin/products — requires an authorized staff session. */
export async function getStaffProducts(
  signal?: AbortSignal,
): Promise<StaffProduct[]> {
  const response = await productRequest<StaffProduct[]>(
    '/admin/products',
    { signal },
  )

  return requireArray(response, 'Invalid product listing response.')
}

/**
 * GET /api/categories — load all categories independently of products.
 * This includes empty categories that would be missing from the product list.
 */
export async function getProductCategories(
  signal?: AbortSignal,
): Promise<ProductCategory[]> {
  const response = await productRequest<ProductCategory[]>(
    '/categories',
    { signal },
  )

  const categories = requireArray(
    response,
    'Invalid product categories response.',
  )

  return [...categories].sort((a, b) => a.name.localeCompare(b.name))
}

/** GET /api/admin/products/:productId */
export async function getStaffProduct(
  productId: number,
  signal?: AbortSignal,
): Promise<StaffProduct> {
  const response = await productRequest<StaffProduct>(
    `/admin/products/${productId}`,
    { signal },
  )

  return requireData(response)
}

/** GET /api/admin/products/:productId/events */
export async function getProductAuditEvents(
  productId: number,
  signal?: AbortSignal,
): Promise<ProductHistoryResponse> {
  const response = (await productRequest<ProductAuditEvent[]>(
    `/admin/products/${productId}/events`,
    { signal },
  )) as ProductHistoryApiResponse

  const events = requireArray(
    response,
    'Invalid product audit history response.',
  )

  if (!response.product) {
    throw new ProductApiError(
      500,
      'Product audit information is incomplete.',
    )
  }

  return {
    product: response.product,
    count: events.length,
    data: events,
  }
}

// -----------------------------------------------------------------------------
// Write operations — product metadata only (never stockQuantity)
// -----------------------------------------------------------------------------

/** POST /api/admin/products */
export async function createStaffProduct(
  input: CreateProductInput,
): Promise<StaffProduct> {
  // Explicitly construct the allowed payload. New products start at zero stock
  // in the backend; no inventory fields are accepted from this service.
  const body = {
    name: input.name,
    description: input.description ?? null,
    priceUgx: input.priceUgx,
    unit: input.unit,
    imageUrl: input.imageUrl ?? null,
    badge: input.badge ?? null,
    categoryId: input.categoryId,
    isActive: input.isActive ?? false,
  }

  const response = await productRequest<StaffProduct>('/admin/products', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return requireData(response)
}

/** PATCH /api/admin/products/:productId */
export async function updateStaffProduct(
  productId: number,
  input: UpdateProductInput,
): Promise<StaffProduct> {
  const body: Record<string, unknown> = {
    expectedUpdatedAt: input.expectedUpdatedAt,
  }

  // Only send explicitly supplied editable fields. In particular,
  // stockQuantity must never be sent through this endpoint.
  const editableFields = [
    'name',
    'description',
    'priceUgx',
    'unit',
    'imageUrl',
    'badge',
    'categoryId',
    'isActive',
  ] as const

  for (const field of editableFields) {
    if (input[field] !== undefined) {
      body[field] = input[field]
    }
  }

  const response = await productRequest<StaffProduct>(
    `/admin/products/${productId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  )

  return requireData(response)
}
