
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

// ==========================================
// LOYCE DAIRIES PLATFORM
// MILESTONE 4.7.1
// PRODUCT CATALOGUE AND STOCK AVAILABILITY
// ==========================================

const router = Router()

// ==========================================
// PRODUCT RESPONSE FIELDS
// ==========================================

// Preserve the existing product information
// required by the React storefront.
//
// Include stockQuantity internally so that
// the API can calculate stock availability.
//
// Do not expose exact quantities publicly.

const productSelect = {
  id: true,
  name: true,
  description: true,
  priceUgx: true,
  unit: true,
  imageUrl: true,
  badge: true,
  isActive: true,

  categoryId: true,

  createdAt: true,
  updatedAt: true,

  category: true,

  // Internal stock balance
  stockQuantity: true,
} as const

// ==========================================
// PUBLIC PRODUCT TRANSFORMATION
// ==========================================

// Converts the database product into the
// public catalogue response.
//
// Customers receive:
// - Existing product information
// - Category information
// - Boolean stock availability
//
// Customers do not receive:
// - Exact inventory quantities
// - Inventory adjustment history
// - Staff information

function toPublicProduct<
  T extends { stockQuantity: number }
>(product: T) {
  const {
    stockQuantity,
    ...publicProduct
  } = product

  return {
    ...publicProduct,

    // A positive quantity means that
    // at least one sellable unit is available.
    inStock: stockQuantity > 0,
  }
}

// ==========================================
// GET /api/categories
//
// RETRIEVE ALL PRODUCT CATEGORIES
// ==========================================

router.get('/categories', async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: {
      name: 'asc',
    },
  })

  res.status(200).json({
    success: true,
    count: categories.length,
    data: categories,
  })
})

// ==========================================
// GET /api/products
//
// RETRIEVE ACTIVE PRODUCTS WITH STOCK STATUS
// ==========================================

router.get('/products', async (_req, res) => {
  // Product availability can change after
  // stock adjustments and customer checkout.
  //
  // Prevent stale cached stock indicators.

  res.set('Cache-Control', 'no-store')

  // Retrieve active products.
  //
  // An active product is still included
  // when stockQuantity is zero, allowing
  // the frontend to display "Out of stock".

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
    },

    select: productSelect,

    orderBy: {
      id: 'asc',
    },
  })

  // Convert products to public responses.
  //
  // Exact inventory balances are removed.

  const publicProducts = products.map(
    toPublicProduct,
  )

  res.status(200).json({
    success: true,
    count: publicProducts.length,
    data: publicProducts,
  })
})

// ==========================================
// GET /api/products/:id
//
// RETRIEVE ONE ACTIVE PRODUCT
// ==========================================

router.get('/products/:id', async (req, res) => {
  // ========================================
  // VALIDATE PRODUCT ID
  // ========================================

  const rawId = req.params.id

  if (
    typeof rawId !== 'string' ||
    !/^[1-9]\d*$/.test(rawId)
  ) {
    res.status(400).json({
      success: false,
      message: 'Invalid product ID.',
    })

    return
  }

  const productId = Number(rawId)

  if (
    !Number.isSafeInteger(productId) ||
    productId > 2_147_483_647
  ) {
    res.status(400).json({
      success: false,
      message: 'Invalid product ID.',
    })

    return
  }

  // ========================================
  // RETRIEVE PRODUCT
  // ========================================

  res.set('Cache-Control', 'no-store')

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      isActive: true,
    },

    select: productSelect,
  })

  // ========================================
  // PRODUCT NOT FOUND
  // ========================================

  if (!product) {
    res.status(404).json({
      success: false,
      message: 'Product not found.',
    })

    return
  }

  // ========================================
  // SUCCESS RESPONSE
  // ========================================

  res.status(200).json({
    success: true,

    data: toPublicProduct(product),
  })
})

// ==========================================
// EXPORT PUBLIC CATALOGUE ROUTER
// ==========================================

export default router
