
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

const router = Router()

// GET /api/categories
// Retrieve all product categories
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

// GET /api/products
// Retrieve all active products
router.get('/products', async (_req, res) => {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
    },
    include: {
      category: true,
    },
    orderBy: {
      id: 'asc',
    },
  })

  res.status(200).json({
    success: true,
    count: products.length,
    data: products,
  })
})

// GET /api/products/:id
// Retrieve one active product
router.get('/products/:id', async (req, res) => {
  const id = Number(req.params.id)

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    res.status(400).json({
      success: false,
      message: 'Invalid product ID',
    })
    return
  }

  const product = await prisma.product.findFirst({
    where: {
      id,
      isActive: true,
    },
    include: {
      category: true,
    },
  })

  if (!product) {
    res.status(404).json({
      success: false,
      message: 'Product not found',
    })
    return
  }

  res.status(200).json({
    success: true,
    data: product,
  })
})

export default router
