import 'dotenv/config'

import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'

// ==========================================
// LOYCE DAIRIES
// LOCAL-ONLY MANUAL DELETION PROCESSOR TEST
//
// Tests the CLI with disposable accounts.
// Refuses remote databases and production.
// Never tests with real customer accounts.
//
// Run from server:
//   npx tsx scripts/verifyAccountDeletionProcessor.ts
// ==========================================

const rawDatabaseUrl = process.env.DATABASE_URL
if (!rawDatabaseUrl) {
  throw new Error('DATABASE_URL is missing.')
}

const databaseUrl = new URL(rawDatabaseUrl)
const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])

if (
  process.env.NODE_ENV === 'production' ||
  !['postgresql:', 'postgres:'].includes(databaseUrl.protocol) ||
  !allowedHosts.has(databaseUrl.hostname) ||
  databaseUrl.pathname !== '/loyce_dairies'
) {
  throw new Error(
    'Safety check failed: use only local PostgreSQL database loyce_dairies.',
  )
}

// Import only after the strict database safety check.
const { prisma } = await import('../src/lib/prisma.js')

const testId = randomUUID()
const createdCustomerIds: string[] = []
const createdOrderIds: string[] = []

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message)
}

type CliResult = {
  exitCode: number | null
  output: string
}

function runCli(
  args: string[],
  approval: 'OFF' | 'ON' = 'OFF',
): CliResult {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'

  const result = spawnSync(
    command,
    ['--no-install', 'tsx', 'scripts/processAccountDeletionRequest.ts', ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 30_000,
      shell: false,
      env: {
        ...process.env,
        ALLOW_ACCOUNT_ERASURE: approval === 'ON' ? '1' : '0',
        ALLOW_REMOTE_ACCOUNT_ERASURE: '0',
        NODE_ENV: 'test',
      },
    },
  )

  if (result.error) {
    throw result.error
  }

  return {
    exitCode: result.status,
    output: (result.stdout ?? '') + '\n' + (result.stderr ?? ''),
  }
}

async function createDisposableCustomer(label: string) {
  const customer = await prisma.customer.create({
    data: {
      fullName: 'Disposable manual erasure test',
      email: 'cli-erasure-' + label + '-' + testId + '@example.invalid',
      phone: null,
      passwordHash: null,
      role: 'CUSTOMER',
      isActive: true,
    },
    select: { id: true },
  })

  createdCustomerIds.push(customer.id)
  return customer.id
}

async function createRequest(customerId: string) {
  return prisma.accountDeletionRequest.create({
    data: { customerId },
    select: { id: true },
  })
}

let passed = 0

try {
  const disposableCustomerId = await createDisposableCustomer('eligible')
  const eligibleRequest = await createRequest(disposableCustomerId)
  const baseArgs = ['--request-id', eligibleRequest.id]

  const preview = runCli(baseArgs)
  assert(preview.exitCode === 0, 'Dry run did not complete successfully.')
  assert(preview.output.includes('DRY RUN ONLY'), 'Dry run confirmation missing.')
  assert(
    await prisma.customer.count({ where: { id: disposableCustomerId } }) === 1,
    'Dry run modified the customer.',
  )
  passed++
  console.log('PASS 1/5: default dry run leaves disposable account intact.')

  const missingConfirmation = runCli([...baseArgs, '--execute'])
  assert(
    missingConfirmation.exitCode !== 0 &&
      missingConfirmation.output.includes('--confirm-customer-id'),
    'Execution without customer confirmation was not blocked.',
  )
  passed++
  console.log('PASS 2/5: explicit customer confirmation is required.')

  const wrongConfirmation = runCli(
    [...baseArgs, '--execute', '--confirm-customer-id', 'definitely-wrong-customer'],
    'ON',
  )
  assert(
    wrongConfirmation.exitCode !== 0 &&
      wrongConfirmation.output.includes('does not match'),
    'Mismatched customer ID was not rejected.',
  )
  passed++
  console.log('PASS 3/5: mismatched customer confirmation is rejected.')

  const correctArgs = [
    ...baseArgs,
    '--execute',
    '--confirm-customer-id',
    disposableCustomerId,
  ]
  const withoutApproval = runCli(correctArgs)
  assert(
    withoutApproval.exitCode !== 0 &&
      withoutApproval.output.includes('ALLOW_ACCOUNT_ERASURE'),
    'Execution without environment approval was not blocked.',
  )
  assert(
    await prisma.customer.count({ where: { id: disposableCustomerId } }) === 1,
    'Account disappeared before execution approval.',
  )
  passed++
  console.log('PASS 4/5: explicit environment approval is required.')

  const execution = runCli(correctArgs, 'ON')
  assert(execution.exitCode === 0, 'Approved erasure command failed: ' + execution.output)
  assert(execution.output.includes('ACCOUNT ERASURE COMPLETED'), 'Success message missing.')
  assert(
    await prisma.customer.count({ where: { id: disposableCustomerId } }) === 0,
    'Approved erasure left the disposable customer behind.',
  )
  assert(
    await prisma.accountDeletionRequest.count({ where: { id: eligibleRequest.id } }) === 0,
    'Completed request still links to deleted customer.',
  )
  passed++
  console.log('PASS 5/5: approved deletion removes only the disposable account.')

  const pendingCustomerId = await createDisposableCustomer('pending')
  const pendingRequest = await createRequest(pendingCustomerId)
  const pendingOrder = await prisma.order.create({
    data: {
      orderNumber: 'CLI-ERASURE-TEST-' + testId,
      customerId: pendingCustomerId,
      fulfillmentMethod: 'PICKUP',
      status: 'PENDING',
      paymentMethod: 'CASH_ON_PICKUP',
      paymentStatus: 'PENDING',
      recipientName: 'Disposable customer',
      contactPhone: '',
      subtotalUgx: 1000,
      deliveryFeeUgx: 0,
      totalUgx: 1000,
    },
    select: { id: true },
  })
  createdOrderIds.push(pendingOrder.id)

  const pendingExecution = runCli(
    [
      '--request-id', pendingRequest.id,
      '--execute',
      '--confirm-customer-id', pendingCustomerId,
    ],
    'ON',
  )
  assert(
    pendingExecution.exitCode !== 0 &&
      pendingExecution.output.includes('unresolved orders'),
    'Pending-order protection failed.',
  )
  assert(
    await prisma.customer.count({ where: { id: pendingCustomerId } }) === 1 &&
      await prisma.order.count({ where: { id: pendingOrder.id } }) === 1,
    'Blocked deletion unexpectedly modified disposable records.',
  )
  console.log('EXTRA PASS: pending orders block the processor.')
  console.log('VERIFIED: 5/5 processor checks plus pending-order protection passed.')
} catch (error) {
  console.error(
    'PROCESSOR VERIFICATION FAILED:',
    error instanceof Error ? error.message : 'Unknown error',
  )
  process.exitCode = 1
} finally {
  try {
    if (createdOrderIds.length > 0) {
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      })
    }
    if (createdCustomerIds.length > 0) {
      await prisma.customer.deleteMany({
        where: { id: { in: createdCustomerIds } },
      })
    }
    console.log('Disposable test records cleaned up.')
  } catch (error) {
    console.error(
      'Cleanup failed. Inspect only disposable cli-erasure-* accounts and CLI-ERASURE-TEST-* orders.',
      error,
    )
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}
