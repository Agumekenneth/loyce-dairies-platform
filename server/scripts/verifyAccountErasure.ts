import 'dotenv/config'
import { randomUUID } from 'node:crypto'

// ------------------------------------------
// LOYCE DAIRIES
// LOCAL-ONLY ACCOUNT ERASURE VERIFICATION
//
// Creates and removes only disposable test
// customers/orders in the local development
// database. Never run against production.
// ------------------------------------------

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing.')
}

const url = new URL(databaseUrl)
const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])

if (
  process.env.NODE_ENV === 'production' ||
  url.protocol !== 'postgresql:' && url.protocol !== 'postgres:' ||
  !allowedHosts.has(url.hostname) ||
  url.pathname !== '/loyce_dairies'
) {
  throw new Error(
    'Safety check failed: this test only runs against the local loyce_dairies database.',
  )
}

const { prisma } = await import('../src/lib/prisma.js')
const { eraseRequestedCustomerAccount } =
  await import('../src/lib/accountErasure.js')

const testId = randomUUID()
const createdCustomerIds: string[] = []
const createdOrderIds: string[] = []
const ledgerIds: string[] = []

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function createDisposableCustomer(suffix: string): Promise<string> {
  const customer = await prisma.customer.create({
    data: {
      fullName: 'Disposable erasure verification',
      email: `erase-test-${suffix}-${testId}@example.invalid`,
      phone: '+256000000000',
      passwordHash: null,
      role: 'CUSTOMER',
      isActive: true,
    },
    select: { id: true },
  })

  createdCustomerIds.push(customer.id)
  return customer.id
}

async function createDisposableOrder(
  customerId: string,
  suffix: string,
  status: 'PENDING' | 'COMPLETED',
): Promise<string> {
  const order = await prisma.order.create({
    data: {
      orderNumber: `ERASURE-TEST-${suffix}-${testId}`,
      customerId,
      fulfillmentMethod: 'DELIVERY',
      status,
      paymentMethod: 'CASH_ON_DELIVERY',
      paymentStatus: status === 'COMPLETED' ? 'PAID' : 'PENDING',
      recipientName: 'Disposable recipient',
      contactPhone: '+256000000000',
      deliveryAddress: 'Disposable test address',
      deliveryInstructions: 'Erase me',
      deliveryZoneName: 'Disposable test zone',
      subtotalUgx: 1000,
      deliveryFeeUgx: 0,
      totalUgx: 1000,
    },
    select: { id: true },
  })

  createdOrderIds.push(order.id)
  return order.id
}

let checksPassed = 0

try {
  // Case 1: No request must never erase an account.
  const unrequestedId = await createDisposableCustomer('unrequested')
  const noRequest = await eraseRequestedCustomerAccount(unrequestedId)

  assert(noRequest.outcome === 'NOT_REQUESTED', 'Unrequested erasure was not blocked.')
  assert(
    await prisma.customer.count({ where: { id: unrequestedId } }) === 1,
    'Unrequested customer unexpectedly disappeared.',
  )
  checksPassed++
  console.log('PASS 1/4: account without a request remains intact.')

  // Case 2: Erase a customer with no orders and revoke sessions.
  const noOrdersId = await createDisposableCustomer('no-orders')
  const sessionTokenHash = `test-${randomUUID()}`

  await prisma.customerSession.create({
    data: {
      customerId: noOrdersId,
      tokenHash: sessionTokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  })
  await prisma.accountDeletionRequest.create({
    data: { customerId: noOrdersId },
  })

  const noOrdersResult = await eraseRequestedCustomerAccount(noOrdersId)

  assert(noOrdersResult.outcome === 'DELETED', 'No-order erasure was not completed.')
  assert(
    await prisma.customer.count({ where: { id: noOrdersId } }) === 0,
    'Original no-order account still exists.',
  )
  assert(
    await prisma.customerSession.count({ where: { tokenHash: sessionTokenHash } }) === 0,
    'Account session was not deleted.',
  )
  checksPassed++
  console.log('PASS 2/4: no-order account deleted; session removed.')

  // Case 3: Completed transaction retained but contact data erased.
  const completedId = await createDisposableCustomer('completed')
  const completedOrderId = await createDisposableOrder(
    completedId,
    'completed',
    'COMPLETED',
  )
  await prisma.accountDeletionRequest.create({
    data: { customerId: completedId },
  })

  const completedResult = await eraseRequestedCustomerAccount(completedId)
  assert(completedResult.outcome === 'DELETED', 'Completed-order erasure failed.')

  const retainedOrder = await prisma.order.findUnique({
    where: { id: completedOrderId },
    select: {
      customerId: true,
      recipientName: true,
      contactPhone: true,
      deliveryAddress: true,
      deliveryInstructions: true,
      totalUgx: true,
    },
  })

  assert(retainedOrder !== null, 'Completed transaction was not retained.')
  ledgerIds.push(retainedOrder.customerId)

  assert(retainedOrder.customerId !== completedId, 'Order still points to original customer.')
  assert(retainedOrder.recipientName === 'Deleted customer', 'Recipient name not erased.')
  assert(retainedOrder.contactPhone === '', 'Contact phone not erased.')
  assert(retainedOrder.deliveryAddress === null, 'Delivery address not erased.')
  assert(retainedOrder.deliveryInstructions === null, 'Delivery instructions not erased.')
  assert(retainedOrder.totalUgx === 1000, 'Original accounting amount was lost.')
  assert(
    await prisma.customer.count({ where: { id: completedId } }) === 0,
    'Original completed-order account was not deleted.',
  )

  const ledger = await prisma.customer.findUnique({
    where: { id: retainedOrder.customerId },
    select: { isActive: true, passwordHash: true },
  })
  assert(ledger?.isActive === false && ledger.passwordHash === null,
    'Ledger placeholder is not safely inactive.',
  )
  checksPassed++
  console.log('PASS 3/4: completed order retained without original customer contact data.')

  // Case 4: An unfinished order blocks erasure.
  const pendingId = await createDisposableCustomer('pending')
  const pendingOrderId = await createDisposableOrder(
    pendingId,
    'pending',
    'PENDING',
  )
  await prisma.accountDeletionRequest.create({
    data: { customerId: pendingId },
  })

  const pendingResult = await eraseRequestedCustomerAccount(pendingId)
  assert(
    pendingResult.outcome === 'PENDING_ORDERS' &&
    pendingResult.unresolvedOrders === 1,
    'Unfinished order failed to block account erasure.',
  )
  assert(
    await prisma.customer.count({ where: { id: pendingId } }) === 1,
    'Account with pending order was unexpectedly deleted.',
  )
  assert(
    await prisma.order.count({
      where: { id: pendingOrderId, customerId: pendingId },
    }) === 1,
    'Pending order was modified unexpectedly.',
  )
  checksPassed++
  console.log('PASS 4/4: pending order blocks account erasure.')

  console.log(`VERIFIED: ${checksPassed}/4 local account-erasure checks passed.`)
} finally {
  // Clean up only the records generated by
  // this script, regardless of test outcome.
  try {
    if (createdOrderIds.length > 0) {
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      })
    }

    const disposableIds = [...new Set([
      ...createdCustomerIds,
      ...ledgerIds,
    ])]

    if (disposableIds.length > 0) {
      await prisma.customer.deleteMany({
        where: { id: { in: disposableIds } },
      })
    }

    console.log('Disposable test records cleaned up.')
  } catch (error) {
    console.error(
      'Test cleanup failed. Inspect only records with ERASURE-TEST order numbers.',
      error,
    )
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}
