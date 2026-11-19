import 'dotenv/config'

import { prisma } from '../src/lib/prisma.js'
import { eraseRequestedCustomerAccount } from '../src/lib/accountErasure.js'

// ==========================================
// LOYCE DAIRIES
// MANUAL ACCOUNT-DELETION FULFILMENT
//
// Default: read-only review of a single request.
// Execution: requires the request ID, exact
// customer ID, explicit flag, and environment
// approval. Never runs automatically.
//
// Run with: npx tsx scripts/processAccountDeletionRequest.ts
//            --request-id <request-id>
//
// This script does not erase backups, external
// providers, or operational logs. Confirm
// retention obligations separately.
// ==========================================

type Options = {
  requestId: string
  execute: boolean
  confirmedCustomerId: string | null
}

type OrderState = {
  status: string
  paymentStatus: string
}

function fail(message: string): never {
  throw new Error(message)
}

function readOptions(): Options {
  const argv = process.argv.slice(2)
  let requestId: string | null = null
  let confirmedCustomerId: string | null = null
  let execute = false

  for (let index = 0; index < argv.length; index++) {
    const option = argv[index]

    if (option === '--execute') {
      if (execute) fail('Duplicate --execute flag.')
      execute = true
      continue
    }

    if (option === '--request-id' || option === '--confirm-customer-id') {
      const value = argv[++index]
      if (
        !value ||
        !/^[a-zA-Z0-9_-]{10,128}$/.test(value)
      ) {
        fail('Missing or invalid value for ' + option + '.')
      }

      if (option === '--request-id') {
        if (requestId !== null) fail('Duplicate --request-id.')
        requestId = value
      } else {
        if (confirmedCustomerId !== null) fail('Duplicate --confirm-customer-id.')
        confirmedCustomerId = value
      }
      continue
    }

    fail('Unexpected argument: ' + option)
  }

  if (!requestId) {
    fail('Required: --request-id <request-id>. Use the read-only review script to find it.')
  }

  if (execute && !confirmedCustomerId) {
    fail('Execution requires --confirm-customer-id <customer-id>.')
  }

  if (!execute && confirmedCustomerId) {
    fail('--confirm-customer-id is only valid with --execute.')
  }

  return { requestId, execute, confirmedCustomerId }
}

function isUnresolvedOrder(order: OrderState): boolean {
  return (
    (order.status !== 'COMPLETED' && order.status !== 'CANCELLED') ||
    (order.status === 'CANCELLED' && order.paymentStatus === 'PAID')
  )
}

function requireExecutionApproval(): void {
  if (process.env.ALLOW_ACCOUNT_ERASURE !== '1') {
    fail('Execution blocked: set ALLOW_ACCOUNT_ERASURE=1 explicitly.')
  }

  const rawUrl = process.env.DATABASE_URL
  if (!rawUrl) fail('DATABASE_URL is not configured.')

  let databaseUrl: URL
  try {
    databaseUrl = new URL(rawUrl)
  } catch {
    fail('DATABASE_URL has an invalid format.')
  }

  if (
    databaseUrl.protocol !== 'postgresql:' &&
    databaseUrl.protocol !== 'postgres:'
  ) {
    fail('Execution requires a PostgreSQL DATABASE_URL.')
  }

  const isLocal = ['localhost', '127.0.0.1', '[::1]']
    .includes(databaseUrl.hostname)

  // A production DATABASE_URL may be used from a laptop
  // even when NODE_ENV is not set to "production".
  // Check the actual database endpoint rather than
  // depending only on NODE_ENV.
  if (
    !isLocal &&
    process.env.ALLOW_REMOTE_ACCOUNT_ERASURE !== '1'
  ) {
    fail(
      'Remote database erasure blocked: ' +
      'ALLOW_REMOTE_ACCOUNT_ERASURE=1 is required.'
    )
  }
}

async function main(): Promise<void> {
  const options = readOptions()

  const request = await prisma.accountDeletionRequest.findUnique({
    where: { id: options.requestId },
    select: {
      id: true,
      status: true,
      requestedAt: true,
      customerId: true,
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

  if (!request) fail('Deletion request not found.')
  if (request.status !== 'PENDING') fail('Request is not pending.')
  if (request.customer.role !== 'CUSTOMER') {
    fail('Staff accounts cannot be erased through this workflow.')
  }

  const orderCount = request.customer.orders.length
  const unresolvedOrders = request.customer.orders.filter(
    isUnresolvedOrder,
  ).length

  console.log('LOYCE DAIRIES — ACCOUNT DELETION FULFILMENT')
  console.log('------------------------------------------')
  console.log('Request ID: ' + request.id)
  console.log('Customer ID: ' + request.customerId)
  console.log('Requested: ' + request.requestedAt.toISOString())
  console.log('Active customer: ' + request.customer.isActive)
  console.log('Orders: ' + orderCount)
  console.log('Unresolved orders: ' + unresolvedOrders)

  if (!options.execute) {
    console.log('')
    console.log('DRY RUN ONLY — no database changes were made.')
    console.log(
      unresolvedOrders > 0
        ? 'BLOCKED: unresolved orders require manual review.'
        : 'Eligible for manual review; not yet approved for deletion.',
    )
    return
  }

  if (options.confirmedCustomerId !== request.customerId) {
    fail('Customer ID confirmation does not match the request.')
  }

  if (unresolvedOrders > 0) {
    fail('Execution blocked: unresolved orders remain.')
  }

  requireExecutionApproval()

  // The service re-checks the pending request,
  // account role, and order state in a serializable
  // transaction immediately before deleting data.
  // Concurrent updates can cause a transaction
  // conflict; a failure must be investigated, never
  // treated as a successful erasure.
  const result = await eraseRequestedCustomerAccount(
    request.customerId,
  )

  if (result.outcome !== 'DELETED') {
    fail(
      result.outcome === 'PENDING_ORDERS'
        ? 'Deletion blocked: unresolved orders changed during processing.'
        : 'Deletion not completed: request is no longer pending.',
    )
  }

  console.log('')
  console.log('ACCOUNT ERASURE COMPLETED')
  console.log('Request ID: ' + request.id)
  console.log('Anonymized orders: ' + result.anonymizedOrders)
  console.log(
    'Follow up separately on backups, external services, ' +
    'retention obligations, and the secure operational audit.',
  )
}

try {
  await main()
} catch (error) {
  console.error(
    'Account deletion fulfilment failed:',
    error instanceof Error ? error.message : 'Unknown error',
  )
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
