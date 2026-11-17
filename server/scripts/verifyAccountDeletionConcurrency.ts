import 'dotenv/config'

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'

// ==========================================
// LOYCE DAIRIES
// LOCAL-ONLY ACCOUNT-DELETION CONCURRENCY
//
// Case 1: Real HTTP checkout is rejected when
// a deletion request commits while checkout
// waits on the customer-row lock.
// Case 2: A checkout-style transaction already
// holding that lock may finish its pending order,
// but concurrent account erasure must not remove
// either the account or order.
//
// Only disposable localhost database records.
// ==========================================

const rawDatabaseUrl = process.env.DATABASE_URL
if (!rawDatabaseUrl) throw new Error('DATABASE_URL is missing.')

const databaseUrl = new URL(rawDatabaseUrl)
if (
  process.env.NODE_ENV === 'production' ||
  !['postgresql:', 'postgres:'].includes(databaseUrl.protocol) ||
  !new Set(['127.0.0.1', 'localhost', '[::1]']).has(databaseUrl.hostname) ||
  databaseUrl.pathname !== '/loyce_dairies'
) {
  throw new Error(
    'Safety check failed: only local PostgreSQL database loyce_dairies is allowed.',
  )
}

// No application or database imports before the safety check.
const { prisma } = await import('../src/lib/prisma.js')
const { app } = await import('../src/app.js')
const { eraseRequestedCustomerAccount } =
  await import('../src/lib/accountErasure.js')

const runId = randomUUID()
const customerIds: string[] = []
const requestIds: string[] = []
const orderIds: string[] = []

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

function gate() {
  let release = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

async function makeCustomer(label: string): Promise<string> {
  const record = await prisma.customer.create({
    data: {
      fullName: 'Disposable concurrency test',
      email: 'race-test-' + label + '-' + runId + '@example.invalid',
      phone: null,
      passwordHash: null,
      role: 'CUSTOMER',
      isActive: true,
    },
    select: { id: true },
  })
  customerIds.push(record.id)
  return record.id
}

async function testRealHttpCheckout(): Promise<void> {
  const customerId = await makeCustomer('http')
  const token = randomBytes(32).toString('base64url')

  await prisma.customerSession.create({
    data: {
      customerId,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  })

  const locked = gate()
  const release = gate()

  // This is a separate transaction simulating an operator
  // committing an account-deletion request while a checkout
  // waits to obtain a shared lock on the customer.
  const writer = prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT "id" FROM "Customer" WHERE "id" = $1 FOR UPDATE',
      customerId,
    )
    assert(rows.length === 1, 'Could not lock disposable customer.')
    locked.release()
    await release.promise
    const request = await tx.accountDeletionRequest.create({
      data: { customerId },
      select: { id: true },
    })
    requestIds.push(request.id)
  }, { timeout: 20_000 })

  const server = app.listen(0, '127.0.0.1')
  try {
    await locked.promise
    const address = server.address() as AddressInfo | null
    assert(address !== null, 'Local test server failed to listen.')

    // Uses the real Express checkout endpoint. Product ID
    // is a placeholder: the deletion guard must run first.
    const request = fetch(
      'http://127.0.0.1:' + address.port + '/api/orders/checkout',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Loyce-Request': '1',
          Cookie: 'ld_session=' + token,
        },
        body: JSON.stringify({
          recipientName: 'Disposable customer',
          contactPhone: '+256700000000',
          fulfillmentMethod: 'PICKUP',
          paymentMethod: 'CASH_ON_PICKUP',
          items: [{ productId: 1, quantity: 1 }],
        }),
        signal: AbortSignal.timeout(15_000),
      },
    )

    await sleep(150)
    release.release()
    await writer

    const response = await request
    assert(
      response.status === 409,
      'Expected HTTP 409, got ' + response.status +
        ': ' + (await response.text()).slice(0, 300),
    )
    assert(
      await prisma.order.count({ where: { customerId } }) === 0,
      'Checkout created an order after deletion request committed.',
    )
    console.log('PASS 1/2: real checkout rejected pending deletion (HTTP 409).')
  } finally {
    release.release()
    await writer.catch(() => {})
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

async function testInflightCheckout(): Promise<void> {
  const customerId = await makeCustomer('inflight')
  const ready = gate()
  const release = gate()

  // This checkout-style transaction repeats the same
  // shared customer lock and request check used by the
  // checkout route. It pauses before saving an order.
  const checkout = prisma.$transaction(async (tx) => {
    const eligible = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT "id" FROM "Customer" WHERE "id" = $1 ' +
        'AND "isActive" = true AND "role" = $2 FOR SHARE',
      customerId,
      'CUSTOMER',
    )
    assert(eligible.length === 1, 'Customer not eligible for checkout.')
    const request = await tx.accountDeletionRequest.findUnique({
      where: { customerId },
      select: { status: true },
    })
    assert(request === null, 'Unexpected pre-existing deletion request.')
    ready.release()
    await release.promise

    const saved = await tx.order.create({
      data: {
        orderNumber: 'RACE-ERASURE-' + runId,
        customerId,
        fulfillmentMethod: 'PICKUP',
        status: 'PENDING',
        paymentMethod: 'CASH_ON_PICKUP',
        paymentStatus: 'PENDING',
        recipientName: 'Disposable customer',
        contactPhone: '+256700000000',
        subtotalUgx: 1000,
        deliveryFeeUgx: 0,
        totalUgx: 1000,
      },
      select: { id: true },
    })
    orderIds.push(saved.id)
  }, { timeout: 20_000 })

  try {
    await ready.promise
    const request = await prisma.accountDeletionRequest.create({
      data: { customerId },
      select: { id: true },
    })
    requestIds.push(request.id)

    const erasure = eraseRequestedCustomerAccount(customerId)
      .then((result) => ({ kind: 'result' as const, result }))
      .catch((error: unknown) => ({
        kind: 'conflict' as const,
        error: error instanceof Error ? error.message : String(error),
      }))

    await sleep(150)
    release.release()
    await checkout

    const outcome = await erasure
    assert(
      outcome.kind !== 'result' || outcome.result.outcome !== 'DELETED',
      'Erasure incorrectly succeeded with an in-flight pending order.',
    )
    assert(
      await prisma.customer.count({ where: { id: customerId } }) === 1,
      'Original customer was deleted despite a pending order.',
    )
    assert(
      await prisma.order.count({ where: { customerId } }) === 1,
      'In-flight pending order was lost.',
    )
    assert(
      await prisma.accountErasureAudit.count({
        where: { requestId: request.id },
      }) === 0,
      'Blocked erasure incorrectly created a completion audit.',
    )

    console.log(
      'PASS 2/2: in-flight order retained; account erasure did not complete.',
    )
  } finally {
    release.release()
    await checkout.catch(() => {})
  }
}

try {
  await testRealHttpCheckout()
  await testInflightCheckout()
  console.log('VERIFIED: 2/2 local concurrency checks passed.')
} catch (error) {
  console.error(
    'CONCURRENCY TEST FAILED:',
    error instanceof Error ? error.message : String(error),
  )
  process.exitCode = 1
} finally {
  try {
    if (orderIds.length > 0) {
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
    }
    if (requestIds.length > 0) {
      await prisma.accountErasureAudit.deleteMany({
        where: { requestId: { in: requestIds } },
      })
    }
    if (customerIds.length > 0) {
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } })
    }
    console.log('Disposable concurrency-test records cleaned up.')
  } catch (error) {
    console.error(
      'Cleanup failed. Inspect only race-test-* accounts and RACE-ERASURE-* orders.',
      error,
    )
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}
