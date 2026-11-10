
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'

type SeedProduct = {
  name: string
  category: string
  description: string
  priceUgx: number
  unit: string
  imageUrl: string
  badge?: string
}

// Development-only sample categories
const categories = [
  { name: 'Fresh Milk', slug: 'fresh-milk' },
  { name: 'Yoghurt', slug: 'yoghurt' },
  { name: 'Butter', slug: 'butter' },
  { name: 'Ghee', slug: 'ghee' },
]

// Development-only sample products
const products: SeedProduct[] = [
  {
    name: 'Fresh Whole Milk',
    category: 'Fresh Milk',
    description:
      'Enjoy the creamy taste of whole milk as part of your everyday routine. A versatile dairy favourite for tea, breakfast, cooking and more.',
    priceUgx: 3500,
    unit: '1 litre',
    imageUrl:
      'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&auto=format&fit=crop&q=85',
    badge: 'Popular',
  },
  {
    name: 'Creamy Natural Yoghurt',
    category: 'Yoghurt',
    description:
      'A creamy natural yoghurt option for breakfast, snacks or enjoying on its own.',
    priceUgx: 5000,
    unit: '500 ml',
    imageUrl:
      'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&auto=format&fit=crop&q=85',
  },
  {
    name: 'Farmhouse Butter',
    category: 'Butter',
    description:
      'A rich butter option for spreading, baking and preparing your favourite meals.',
    priceUgx: 12000,
    unit: '250 g',
    imageUrl:
      'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=800&auto=format&fit=crop&q=85',
    badge: 'Farm favourite',
  },
  {
    name: 'Traditional Pure Ghee',
    category: 'Ghee',
    description:
      'Traditional ghee for adding rich dairy flavour to your favourite dishes.',
    priceUgx: 18000,
    unit: '500 ml',
    imageUrl:
      'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=800&auto=format&fit=crop&q=85',
  },
]

async function main() {
  // Prevent accidental seeding of a remote database
  const databaseUrl = process.env.DATABASE_URL

  if (
    process.env.NODE_ENV !== 'development' ||
    !databaseUrl ||
    !['localhost', '127.0.0.1'].includes(
      new URL(databaseUrl).hostname,
    )
  ) {
    throw new Error(
      'Sample seeding is permitted only for a local development database.',
    )
  }

  console.log('Seeding Loyce Dairies development database...')

  const categoryIds = new Map<string, number>()

  // Create or update categories
  for (const category of categories) {
    const savedCategory = await prisma.category.upsert({
      where: {
        slug: category.slug,
      },
      update: {
        name: category.name,
      },
      create: category,
    })

    categoryIds.set(category.name, savedCategory.id)
  }

  // Create or update products
  for (const product of products) {
    const categoryId = categoryIds.get(product.category)

    if (categoryId === undefined) {
      throw new Error(
        `Category not found: ${product.category}`,
      )
    }

    const data = {
      name: product.name,
      description: product.description,
      priceUgx: product.priceUgx,
      unit: product.unit,
      imageUrl: product.imageUrl,
      badge: product.badge ?? null,
      categoryId,
      isActive: true,
    }

    const existing = await prisma.product.findFirst({
      where: {
        name: product.name,
        categoryId,
      },
      select: {
        id: true,
      },
    })

    if (existing) {
      await prisma.product.update({
        where: {
          id: existing.id,
        },
        data,
      })
    } else {
      await prisma.product.create({
        data,
      })
    }
  }

  const categoryCount = await prisma.category.count()
  const productCount = await prisma.product.count()

  console.log('Database seeding completed successfully.')
  console.log(`Categories: ${categoryCount}`)
  console.log(`Products: ${productCount}`)
  console.log('All seeded prices are development samples.')
}

main()
  .catch((error: unknown) => {
    console.error('Database seeding failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
