
import { prisma } from '../lib/prisma.js'

async function main() {
  console.log('Checking Loyce Dairies database...')

  await prisma.$connect()

  const categoryCount = await prisma.category.count()
  const productCount = await prisma.product.count()

  console.log('Database connection: SUCCESS')
  console.log(`Categories: ${categoryCount}`)
  console.log(`Products: ${productCount}`)
}

main()
  .catch((error: unknown) => {
    console.error('Database connection failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
