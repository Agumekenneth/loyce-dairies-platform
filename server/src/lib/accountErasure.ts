import { randomUUID } from 'node:crypto'

import { prisma } from './prisma.js'

// ==========================================
// LOYCE DAIRIES
// CUSTOMER ACCOUNT ERASURE
//
// Deliberately not called by the request API
// until the fulfilment workflow is reviewed
// and database-tested.
//
// The original customer account is deleted;
// completed/cancelled transactions are moved
// to an inaccessible, randomly named ledger
// placeholder after erasing contact details.
// ==========================================

export type AccountErasureResult =
  | { outcome: 'NOT_REQUESTED' }
  | { outcome: 'PENDING_ORDERS'; unresolvedOrders: number }
  | { outcome: 'DELETED'; anonymizedOrders: number }

// A completed order or a cancellation with
// settled/reversed payments may be retained
// as an anonymized accounting transaction.
//
// Do not process active fulfilment or a paid
// cancellation that has not been refunded.
function isUnresolvedOrder(
  status: string,
  paymentStatus: string,
): boolean {
  if (status !== 'COMPLETED' && status !== 'CANCELLED') {
    return true
  }

  if (status === 'CANCELLED' && paymentStatus === 'PAID') {
    return true
  }

  return false
}

/**
 * Transactional, verified-request-only erasure.
 *
 * This function must only be invoked by a
 * trusted backend workflow. It does not
 * authenticate a caller or send notifications.
 *
 * On success, the original Customer, sessions,
 * action tokens, and deletion-request row are
 * removed through foreign-key cascades.
 *
 * This does not remove information from backups
 * or third-party systems. Their retention and
 * erasure must be addressed operationally.
 */
export async function eraseRequestedCustomerAccount(
  customerId: string,
): Promise<AccountErasureResult> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.accountDeletionRequest.findUnique({
      where: { customerId },
      select: {
        id: true,
        status: true,
        requestedAt: true,
      },
    })

    if (!request || request.status !== 'PENDING') {
      return { outcome: 'NOT_REQUESTED' } as const
    }

    // Lock the account BEFORE examining its orders. Checkout
    // acquires a shared lock on this same row before creating
    // an order, so neither operation can bypass the other's
    // final database checks. The serializable transaction
    // aborts on conflicting concurrent writes.
    const lockedCustomer = await tx.$queryRaw<
      Array<{ id: string }>
    >`
      SELECT "id"
      FROM "Customer"
      WHERE "id" = ${customerId}
      FOR UPDATE
    `

    if (lockedCustomer.length !== 1) {
      return { outcome: 'NOT_REQUESTED' } as const
    }

    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        role: true,
      },
    })

    // Never erase staff records through the
    // customer account-deletion workflow.
    if (!customer || customer.role !== 'CUSTOMER') {
      return { outcome: 'NOT_REQUESTED' } as const
    }

    const orders = await tx.order.findMany({
      where: { customerId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
      },
    })

    const unresolvedOrders = orders.filter(
      (order) => isUnresolvedOrder(
        order.status,
        order.paymentStatus,
      ),
    ).length

    if (unresolvedOrders > 0) {
      return {
        outcome: 'PENDING_ORDERS',
        unresolvedOrders,
      } as const
    }

    // Prevent this customer from being treated
    // as active while we remove the account.
    await tx.customer.update({
      where: { id: customerId },
      data: { isActive: false },
    })

    if (orders.length > 0) {
      // A non-login ledger row preserves the
      // order foreign keys without retaining
      // the deleted customer's identity.
      //
      // The randomized address is not a user's
      // email and cannot be used to sign in.
      const ledger = await tx.customer.create({
        data: {
          fullName: 'Deleted customer',
          email: `erased-${randomUUID()}@deleted.invalid`,
          phone: null,
          passwordHash: null,
          emailVerifiedAt: null,
          isActive: false,
          role: 'CUSTOMER',
        },
        select: { id: true },
      })

      const orderIds = orders.map((order) => order.id)

      // Free-text audit notes may contain
      // customer-identifying information.
      // Preserve status/stock quantities,
      // but remove these notes.
      await tx.orderStatusEvent.updateMany({
        where: { orderId: { in: orderIds } },
        data: { note: null },
      })

      await tx.inventoryEvent.updateMany({
        where: { orderId: { in: orderIds } },
        data: { note: null },
      })

      // Preserve transaction amounts and
      // inventory history while erasing
      // recipient and delivery data.
      await tx.order.updateMany({
        where: { customerId },
        data: {
          customerId: ledger.id,
          recipientName: 'Deleted customer',
          contactPhone: '',
          deliveryAddress: null,
          deliveryInstructions: null,
          deliveryZoneId: null,
          deliveryZoneName: null,
          // Purge hosted payment links and provider identifiers from
          // de-identified ledger rows. Retained transaction amounts,
          // method and status remain available for accounting.
          paymentProviderCheckoutUrl: null,
          paymentProviderTrackingId: null,
          paymentProviderReference: null,
        },
      })
    }

    // The original customer record must be
    // truly deleted, not merely deactivated.
    //
    // PostgreSQL refuses this if unrelated
    // RESTRICT relations still reference the
    // account, and the transaction rolls back.
    await tx.customer.delete({
      where: { id: customerId },
    })

    // This independent audit entry is committed
    // atomically with the deletion. It contains
    // no customer identity or contact information.
    // Its request ID may still be correlated with
    // external operational logs, so access to
    // those logs must remain restricted.
    await tx.accountErasureAudit.create({
      data: {
        requestId: request.id,
        requestedAt: request.requestedAt,
        anonymizedOrders: orders.length,
      },
    })

    return {
      outcome: 'DELETED',
      anonymizedOrders: orders.length,
    } as const
  }, {
    isolationLevel: 'Serializable',
    timeout: 20_000,
  })
}
