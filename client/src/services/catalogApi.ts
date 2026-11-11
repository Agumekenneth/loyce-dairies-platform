
import type { Product } from '../types/product'

// ==========================================
// LOYCE DAIRIES PLATFORM
// CUSTOMER PRODUCT CATALOGUE API
//
// MILESTONE 4.9.3B
// LIVE PRODUCT & STOCK AVAILABILITY
// ==========================================

// ==========================================
// API CONFIGURATION
// ==========================================

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5000/api'
).replace(/\/+$/, '')

// ==========================================
// BACKEND PRODUCT TYPES
// ==========================================

type ApiProduct = {
  id: number
  name: string
  description: string | null
  priceUgx: number
  unit: string
  imageUrl: string | null
  badge: string | null

  // Product catalogue availability
  isActive: boolean

  // Public stock availability
  // Exact inventory quantities are not exposed.
  inStock: boolean

  categoryId: number

  category: {
    id: number
    name: string
    slug: string
  }
}

// ==========================================
// BACKEND CATEGORY TYPES
// ==========================================

type ApiCategory = {
  id: number
  name: string
  slug: string
}

// ==========================================
// API RESPONSE TYPES
// ==========================================

type ApiResponse<T> = {
  success: boolean
  data?: T
  message?: string
  count?: number
}

// ==========================================
// CUSTOM CATALOGUE API ERROR
// ==========================================

export class CatalogApiError extends Error {
  public readonly statusCode: number

  constructor(
    statusCode: number,
    message: string,
  ) {
    super(message)

    this.name = 'CatalogApiError'
    this.statusCode = statusCode
  }
}

// ==========================================
// SHARED GET REQUEST FUNCTION
// ==========================================

async function apiRequest<T>(
  endpoint: string,
): Promise<T> {
  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        method: 'GET',

        headers: {
          Accept: 'application/json',
        },

        // Product prices, catalogue status and
        // stock availability may change.
        //
        // Avoid using stale cached responses.
        cache: 'no-store',
      },
    )
  } catch {
    throw new CatalogApiError(
      0,
      'Unable to connect to the Loyce Dairies server.',
    )
  }

  // ========================================
  // PARSE SERVER RESPONSE
  // ========================================

  let result: ApiResponse<T>

  try {
    result = (
      await response.json()
    ) as ApiResponse<T>
  } catch {
    throw new CatalogApiError(
      response.status,
      'The server returned an invalid response.',
    )
  }

  // ========================================
  // HANDLE HTTP AND API ERRORS
  // ========================================

  if (
    !response.ok ||
    !result ||
    result.success !== true
  ) {
    throw new CatalogApiError(
      response.status,
      result?.message ??
        `Catalogue request failed with status ${response.status}.`,
    )
  }

  // ========================================
  // VALIDATE RESPONSE DATA
  // ========================================

  if (
    result.data === undefined ||
    result.data === null
  ) {
    throw new CatalogApiError(
      response.status,
      'The server response is missing required catalogue data.',
    )
  }

  return result.data
}

// ==========================================
// PRODUCT DATA TRANSFORMATION
//
// BACKEND PRODUCT → FRONTEND PRODUCT
// ==========================================

function mapApiProduct(
  product: ApiProduct,
): Product {
  return {
    // ======================================
    // PRODUCT IDENTITY
    // ======================================

    id: product.id,

    name: product.name,

    category: product.category.name.trim(),

    // ======================================
    // PRICING
    // ======================================

    price: product.priceUgx,

    unit: product.unit,

    // ======================================
    // PRODUCT PRESENTATION
    // ======================================

    image: product.imageUrl ?? '',

    badge: product.badge ?? undefined,

    description:
      product.description ?? undefined,

    // ======================================
    // INVENTORY AVAILABILITY
    // ======================================

    /**
     * Only an explicit boolean true means
     * that stock is available.
     *
     * false, undefined or malformed values
     * are treated as unavailable.
     *
     * This does not represent an exact
     * available quantity.
     */
    inStock: product.inStock === true,
  }
}

// ==========================================
// GET ALL CUSTOMER PRODUCTS
//
// GET /api/products
// ==========================================

export async function fetchProducts():
  Promise<Product[]> {
  const products =
    await apiRequest<ApiProduct[]>(
      '/products',
    )

  // ========================================
  // VALIDATE PRODUCT COLLECTION
  // ========================================

  if (!Array.isArray(products)) {
    throw new CatalogApiError(
      500,
      'Invalid product catalogue response.',
    )
  }

  // ========================================
  // CUSTOMER CATALOGUE VISIBILITY
  // ========================================

  /**
   * The backend already filters products
   * using isActive: true.
   *
   * This additional frontend filter
   * prevents an inactive product from
   * being displayed if an unexpected
   * API response includes it.
   *
   * Both in-stock and out-of-stock
   * active products remain visible.
   */

  const activeProducts = products.filter(
    (product) => product.isActive === true,
  )

  // ========================================
  // MAP DATABASE PRODUCTS
  // ========================================

  return activeProducts.map(mapApiProduct)
}

// ==========================================
// GET ALL PRODUCT CATEGORIES
//
// GET /api/categories
// ==========================================

export async function fetchCategories():
  Promise<string[]> {
  const categories =
    await apiRequest<ApiCategory[]>(
      '/categories',
    )

  // ========================================
  // VALIDATE CATEGORY COLLECTION
  // ========================================

  if (!Array.isArray(categories)) {
    throw new CatalogApiError(
      500,
      'Invalid product categories response.',
    )
  }

  // ========================================
  // NORMALIZE CATEGORY NAMES
  // ========================================

  /**
   * Remove unwanted surrounding spaces,
   * ignore empty names and avoid duplicate
   * category labels.
   *
   * Example:
   * "Cheese " becomes "Cheese".
   */

  const categoryNames = categories
    .map((category) => category.name.trim())
    .filter((name) => name.length > 0)

  const uniqueCategories = [
    ...new Set(categoryNames),
  ]

  // ========================================
  // RETURN STOREFRONT FILTER OPTIONS
  // ========================================

  return [
    'All products',
    ...uniqueCategories.sort(
      (a, b) => a.localeCompare(b),
    ),
  ]
}

// ==========================================
// GET A SINGLE CUSTOMER PRODUCT
//
// GET /api/products/:id
// ==========================================

export async function fetchProductById(
  productId: number,
): Promise<Product> {
  // ========================================
  // VALIDATE PRODUCT ID
  // ========================================

  if (
    !Number.isSafeInteger(productId) ||
    productId <= 0
  ) {
    throw new CatalogApiError(
      400,
      'Invalid product ID.',
    )
  }

  // ========================================
  // REQUEST PRODUCT DETAILS
  // ========================================

  const product =
    await apiRequest<ApiProduct>(
      `/products/${productId}`,
    )

  // ========================================
  // VERIFY PRODUCT VISIBILITY
  // ========================================

  /**
   * The backend returns 404 for
   * inactive products.
   *
   * This check provides an additional
   * safeguard in the frontend service.
   */

  if (product.isActive !== true) {
    throw new CatalogApiError(
      404,
      'This product is not currently available.',
    )
  }

  // ========================================
  // RETURN FRONTEND PRODUCT
  // ========================================

  return mapApiProduct(product)
}
