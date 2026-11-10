
import type { Product } from '../types/product'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5000/api'
).replace(/\/+$/, '')

// Product structure returned by PostgreSQL/Prisma
type ApiProduct = {
  id: number
  name: string
  description: string | null
  priceUgx: number
  unit: string
  imageUrl: string | null
  badge: string | null
  isActive: boolean
  category: {
    id: number
    name: string
    slug: string
  }
}

type ApiCategory = {
  id: number
  name: string
  slug: string
}

type ApiResponse<T> = {
  success: boolean
  data?: T
  message?: string
  count?: number
}

// Shared API request helper
async function apiRequest<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(
      `API request failed with status ${response.status}`,
    )
  }

  const result = (await response.json()) as ApiResponse<T>

  if (!result.success || result.data === undefined) {
    throw new Error(
      result.message ?? 'Unable to retrieve data from the API',
    )
  }

  return result.data
}

// Convert backend product fields into frontend Product fields
function mapApiProduct(product: ApiProduct): Product {
  return {
    id: product.id,
    name: product.name,
    category: product.category.name,
    price: product.priceUgx,
    unit: product.unit,
    image: product.imageUrl ?? '',
    badge: product.badge ?? undefined,
    description: product.description ?? undefined,
  }
}

// GET /api/products
export async function fetchProducts(): Promise<Product[]> {
  const products = await apiRequest<ApiProduct[]>('/products')

  return products.map(mapApiProduct)
}

// GET /api/categories
export async function fetchCategories(): Promise<string[]> {
  const categories = await apiRequest<ApiCategory[]>('/categories')

  return [
    'All products',
    ...categories.map((category) => category.name),
  ]
}

// GET /api/products/:id
export async function fetchProductById(
  productId: number,
): Promise<Product> {
  const product = await apiRequest<ApiProduct>(
    `/products/${productId}`,
  )

  return mapApiProduct(product)
}
