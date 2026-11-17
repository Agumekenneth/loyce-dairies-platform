import 'dotenv/config'

import { prisma } from '../src/lib/prisma.js'

// ==========================================
// LOYCE DAIRIES
// ACCOUNT DELETION REQUEST REVIEW
//
// Read-only operational overview.
// Does not fulfil requests, update records,
// display contact details, or send email.
//
// Only run against databases you are
// authorized to administer.
// ==========================================

const MAX_RESULTS = 50

type OrderState = {
  status: string
  paymentStatus: string
}

function isUnresolvedOrder(order: OrderState): boolean {
  if (
    order.status !== 'COMPLETED' &&
    order.status !== 'CANCELLED'
  ) {
    return true
  }

  if (
    order.status === 'CANCELLED' &&
    order.paymentStatus === 'PAID'
  ) {
    return true
  }

  return false
}

async function main(): Promise<void> {
  if (process.argv.length > 2) {
    throw new Error(
      'This read-only script does not accept arguments. ' +
      'It cannot execute account deletion.',
    )
  }

  const count = await prisma.accountDeletionRequest.count({
    where: { status: 'PENDING' },
  })

  const requests = await prisma.accountDeletionRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: [
      { requestedAt: 'asc' },
      { id: 'asc' },
    ],
    take: MAX_RESULTS,
    select: {
      id: true,
      customerId: true,
      requestedAt: true,
      customer: {
        select: {
          role: true,
          isActive: true,
          orders: {
            select: {
              status: true,
              paymentStatus: true,
            },
          },
        },
      },
    },
  })

  console.log('LOYCE DAIRIES — ACCOUNT DELETION REQUEST REVIEW')
  console.log('----------------------------------------------')
  console.log(`Pending requests: ${count}`)

  if (requests.length === 0) {
    console.log('No pending customer deletion requests.')
    return
  }

  for (const request of requests) {
    const unresolved = request.customer.orders.filter(
      isUnresolvedOrder,
    ).length

    const eligibility =
      request.customer.role !== 'CUSTOMER'
        ? 'STAFF_ACCOUNT_REVIEW'
        : !request.customer.isActive
          ? 'INACTIVE_ACCOUNT_REVIEW'
          : unresolved > 0
            ? 'UNRESOLVED_ORDERS'
            : 'MANUAL_ERASURE_REVIEW'

    console.log('')
    console.log(`Request: ${request.id}`)
    console.log(`Customer ID: ${request.customerId}`)
    console.log(`Requested: ${request.requestedAt.toISOString()}`)
    console.log(`Order count: ${request.customer.orders.length}`)
    console.log(`Unresolved orders: ${unresolved}`)
    console.log(`Review status: ${eligibility}`)
  }

  if (count > requests.length) {
    console.log('')
    console.log(
      `Showing the oldest ${requests.length} of ${count} requests.`,
    )
  }

  console.log('')
  console.log(
    'This report makes no database changes. ' +
    'Manual review and separate fulfilment are still required.',
  )
}

try {
  await main()
} catch (error) {
  console.error(
    'Unable to review account-deletion requests:',
    error instanceof Error ? error.message : 'Unknown error',
  )
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
