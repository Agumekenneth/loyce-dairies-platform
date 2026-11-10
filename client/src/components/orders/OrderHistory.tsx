
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock3,
  LoaderCircle,
  MapPin,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Truck,
} from 'lucide-react'

import { formatPrice } from '../../data/products'

import {
  fetchCustomerOrder,
  fetchCustomerOrders,
  type CustomerOrder,
  type OrderStatus,
  type PaymentStatus,
} from '../../services/orderHistoryApi'

// ==========================================
// DISPLAY HELPERS
// ==========================================

const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING: 'Pending confirmation',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for pickup',
  OUT_FOR_DELIVERY: 'Out for delivery',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: 'Payment pending',
  PAID: 'Paid',
  FAILED: 'Payment failed',
  REFUNDED: 'Refunded',
}

function formatOrderDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable'
  }

  return new Intl.DateTimeFormat('en-UG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Kampala',
  }).format(date)
}

function formatPaymentMethod(method: string): string {
  const labels: Record<string, string> = {
    CASH_ON_PICKUP: 'Cash on pickup',
    CASH_ON_DELIVERY: 'Cash on delivery',
    MTN_MOMO: 'MTN Mobile Money',
    AIRTEL_MONEY: 'Airtel Money',
    CARD: 'Card',
  }

  return labels[method] ?? method.replaceAll('_', ' ')
}

function getStatusClasses(status: OrderStatus): string {
  if (status === 'COMPLETED') {
    return 'bg-sage text-brand'
  }

  if (status === 'CANCELLED') {
    return 'bg-red-50 text-red-700'
  }

  if (
    status === 'READY_FOR_PICKUP' ||
    status === 'OUT_FOR_DELIVERY'
  ) {
    return 'bg-blue-50 text-blue-800'
  }

  return 'bg-amber-50 text-amber-800'
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Unable to load order information.'
}

// ==========================================
// CUSTOMER ORDER HISTORY
// ==========================================

export default function OrderHistory() {
  const [orders, setOrders] = useState<CustomerOrder[]>(
    [],
  )

  const [isLoading, setIsLoading] = useState(true)

  const [error, setError] = useState<string | null>(
    null,
  )

  const [refreshVersion, setRefreshVersion] = useState(0)

  // ==========================================
  // SELECTED ORDER DETAILS
  // ==========================================

  const [selectedOrderId, setSelectedOrderId] =
    useState<string | null>(null)

  const [selectedOrder, setSelectedOrder] =
    useState<CustomerOrder | null>(null)

  const [detailsLoading, setDetailsLoading] =
    useState(false)

  const [detailsError, setDetailsError] =
    useState<string | null>(null)

  const [detailsVersion, setDetailsVersion] =
    useState(0)

  // ==========================================
  // LOAD CUSTOMER ORDERS
  // ==========================================

  useEffect(() => {
    const controller = new AbortController()

    const loadOrders = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await fetchCustomerOrders(
          controller.signal,
        )

        if (controller.signal.aborted) return

        setOrders(data)
      } catch (caughtError: unknown) {
        if (controller.signal.aborted) return

        setError(getErrorMessage(caughtError))
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadOrders()

    return () => {
      controller.abort()
    }
  }, [refreshVersion])

  // ==========================================
  // LOAD INDIVIDUAL ORDER DETAILS
  // ==========================================

  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedOrder(null)
      setDetailsError(null)
      setDetailsLoading(false)
      return
    }

    const controller = new AbortController()

    const loadDetails = async () => {
      setSelectedOrder(null)
      setDetailsLoading(true)
      setDetailsError(null)

      try {
        const data = await fetchCustomerOrder(
          selectedOrderId,
          controller.signal,
        )

        if (controller.signal.aborted) return

        setSelectedOrder(data)
      } catch (caughtError: unknown) {
        if (controller.signal.aborted) return

        setDetailsError(
          getErrorMessage(caughtError),
        )
      } finally {
        if (!controller.signal.aborted) {
          setDetailsLoading(false)
        }
      }
    }

    void loadDetails()

    return () => {
      controller.abort()
    }
  }, [selectedOrderId, detailsVersion])

  const handleRefresh = () => {
    setSelectedOrderId(null)
    setRefreshVersion((current) => current + 1)
  }

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId((current) =>
      current === orderId ? null : orderId,
    )
  }

  // ==========================================
  // MAIN COMPONENT
  // ==========================================

  return (
    <section
      aria-labelledby="customer-orders-title"
      className="rounded-[2rem] border border-brand/10 bg-white p-6 sm:p-9"
    >
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sage text-brand">
            <ShoppingBag
              size={26}
              aria-hidden="true"
            />
          </div>

          <div>
            <h2
              id="customer-orders-title"
              className="font-display text-3xl text-brand"
            >
              My orders
            </h2>

            <p className="mt-2 text-sm text-brand/60">
              Your recorded orders and current statuses.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-full border border-brand/15 px-4 py-2.5 text-xs font-bold text-brand transition-colors hover:bg-sage disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={isLoading ? 'animate-spin' : ''}
            aria-hidden="true"
          />

          Refresh
        </button>
      </div>

      {/* ======================================
          LOADING
      ====================================== */}

      {isLoading && (
        <div
          role="status"
          className="flex flex-col items-center py-14 text-center"
        >
          <LoaderCircle
            size={34}
            className="animate-spin text-brand-light"
            aria-hidden="true"
          />

          <p className="mt-5 text-sm text-brand/60">
            Loading your orders...
          </p>
        </div>
      )}

      {/* ======================================
          ERROR
      ====================================== */}

      {!isLoading && error && (
        <div
          role="alert"
          className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center"
        >
          <AlertCircle
            size={30}
            className="mx-auto text-amber-700"
            aria-hidden="true"
          />

          <h3 className="mt-4 text-base font-bold text-brand">
            Unable to load your orders
          </h3>

          <p className="mt-2 text-sm leading-6 text-brand/65">
            {error}
          </p>

          <button
            type="button"
            onClick={handleRefresh}
            className="mt-5 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-light"
          >
            Try again
          </button>

          <Link
            to="/login"
            className="mt-4 block text-sm font-semibold text-brand-light"
          >
            Return to sign in
          </Link>
        </div>
      )}

      {/* ======================================
          EMPTY ORDER HISTORY
      ====================================== */}

      {!isLoading && !error && orders.length === 0 && (
        <div className="mt-9 rounded-2xl bg-cream px-6 py-12 text-center">
          <ShoppingBag
            size={39}
            className="mx-auto text-brand/35"
            aria-hidden="true"
          />

          <h3 className="mt-5 font-display text-2xl text-brand">
            No orders yet
          </h3>

          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-brand/60">
            When you place an order, its details and
            latest recorded status will appear here.
          </p>

          <Link
            to="/products"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-light"
          >
            Explore products
          </Link>
        </div>
      )}

      {/* ======================================
          ORDER LIST
      ====================================== */}

      {!isLoading && !error && orders.length > 0 && (
        <div className="mt-8 space-y-5">
          <p className="text-xs text-brand/55">
            Showing {orders.length} most recent{' '}
            {orders.length === 1 ? 'order' : 'orders'}.
          </p>

          {orders.map((order) => {
            const expanded =
              selectedOrderId === order.id

            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-2xl border border-brand/10 bg-cream"
              >
                <div className="p-5 sm:p-6">
                  {/* Order identification */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-brand/50">
                        Order number
                      </p>

                      <h3 className="mt-2 break-all text-sm font-extrabold text-brand">
                        {order.orderNumber}
                      </h3>

                      <p className="mt-2 flex items-center gap-2 text-xs text-brand/55">
                        <Clock3
                          size={14}
                          aria-hidden="true"
                        />

                        {formatOrderDate(order.createdAt)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-2 text-xs font-bold ${getStatusClasses(order.status)}`}
                    >
                      {orderStatusLabels[order.status] ??
                        order.status}
                    </span>
                  </div>

                  {/* Order summary */}
                  <div className="mt-5 grid gap-4 border-t border-brand/10 pt-5 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-brand/50">
                        Total
                      </p>

                      <p className="mt-1 text-base font-extrabold text-brand">
                        {formatPrice(order.totalUgx)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-brand/50">
                        Fulfillment
                      </p>

                      <p className="mt-1 flex items-center gap-2 text-sm font-bold text-brand">
                        {order.fulfillmentMethod ===
                        'PICKUP' ? (
                          <PackageCheck
                            size={16}
                            aria-hidden="true"
                          />
                        ) : (
                          <Truck
                            size={16}
                            aria-hidden="true"
                          />
                        )}

                        {order.fulfillmentMethod ===
                        'PICKUP'
                          ? 'Pickup'
                          : 'Delivery'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-brand/50">
                        Payment
                      </p>

                      <p className="mt-1 text-sm font-bold text-brand">
                        {paymentStatusLabels[
                          order.paymentStatus
                        ] ?? order.paymentStatus}
                      </p>
                    </div>
                  </div>

                  {/* Expand order details */}
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectOrder(order.id)
                    }
                    aria-expanded={expanded}
                    aria-controls={`order-details-${order.id}`}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-bold text-brand transition-colors hover:bg-sage"
                  >
                    {expanded
                      ? 'Hide order details'
                      : 'View order details'}

                    {expanded ? (
                      <ChevronUp
                        size={16}
                        aria-hidden="true"
                      />
                    ) : (
                      <ChevronDown
                        size={16}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </div>

                {/* ==================================
                    EXPANDED ORDER DETAILS
                ================================== */}

                {expanded && (
                  <div
                    id={`order-details-${order.id}`}
                    className="border-t border-brand/10 bg-white p-5 sm:p-6"
                  >
                    {detailsLoading && (
                      <div
                        role="status"
                        className="flex items-center gap-3 py-6 text-sm text-brand/60"
                      >
                        <LoaderCircle
                          size={19}
                          className="animate-spin"
                        />
                        Loading order details...
                      </div>
                    )}

                    {detailsError && (
                      <div
                        role="alert"
                        className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800"
                      >
                        <p>{detailsError}</p>

                        <button
                          type="button"
                          onClick={() =>
                            setDetailsVersion(
                              (current) => current + 1,
                            )
                          }
                          className="mt-3 font-bold underline"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {selectedOrder &&
                      selectedOrder.id === order.id &&
                      !detailsLoading &&
                      !detailsError && (
                        <div className="space-y-7">
                          {/* Items */}
                          <div>
                            <h4 className="font-display text-xl text-brand">
                              Products ordered
                            </h4>

                            <div className="mt-4 divide-y divide-brand/10">
                              {selectedOrder.items.map(
                                (item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-start justify-between gap-4 py-4"
                                  >
                                    <div>
                                      <p className="text-sm font-bold text-brand">
                                        {item.productName}
                                      </p>

                                      <p className="mt-1 text-xs text-brand/55">
                                        {item.productUnit} ×{' '}
                                        {item.quantity}
                                      </p>

                                      <p className="mt-1 text-xs text-brand/55">
                                        Unit price:{' '}
                                        {formatPrice(
                                          item.unitPriceUgx,
                                        )}
                                      </p>
                                    </div>

                                    <p className="shrink-0 text-sm font-bold text-brand">
                                      {formatPrice(
                                        item.lineTotalUgx,
                                      )}
                                    </p>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>

                          {/* Totals */}
                          <div className="space-y-3 rounded-2xl bg-cream p-5 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-brand/60">
                                Subtotal
                              </span>

                              <span className="font-bold text-brand">
                                {formatPrice(
                                  selectedOrder.subtotalUgx,
                                )}
                              </span>
                            </div>

                            <div className="flex justify-between gap-4">
                              <span className="text-brand/60">
                                Delivery fee
                              </span>

                              <span className="font-bold text-brand">
                                {formatPrice(
                                  selectedOrder.deliveryFeeUgx,
                                )}
                              </span>
                            </div>

                            <div className="flex justify-between gap-4 border-t border-brand/10 pt-3">
                              <strong className="text-brand">
                                Total
                              </strong>

                              <strong className="text-lg text-brand">
                                {formatPrice(
                                  selectedOrder.totalUgx,
                                )}
                              </strong>
                            </div>
                          </div>

                          {/* Contact and fulfillment */}
                          <div>
                            <h4 className="font-display text-xl text-brand">
                              Fulfillment details
                            </h4>

                            <dl className="mt-4 space-y-3 text-sm">
                              <div>
                                <dt className="text-brand/55">
                                  Recipient
                                </dt>
                                <dd className="mt-1 font-semibold text-brand">
                                  {selectedOrder.recipientName}
                                </dd>
                              </div>

                              <div>
                                <dt className="text-brand/55">
                                  Contact phone
                                </dt>
                                <dd className="mt-1 font-semibold text-brand">
                                  {selectedOrder.contactPhone}
                                </dd>
                              </div>

                              <div>
                                <dt className="text-brand/55">
                                  Payment method
                                </dt>
                                <dd className="mt-1 font-semibold text-brand">
                                  {formatPaymentMethod(
                                    selectedOrder.paymentMethod,
                                  )}
                                </dd>
                              </div>

                              {selectedOrder.fulfillmentMethod ===
                                'DELIVERY' && (
                                <>
                                  {selectedOrder.deliveryZoneName && (
                                    <div>
                                      <dt className="text-brand/55">
                                        Delivery zone
                                      </dt>
                                      <dd className="mt-1 font-semibold text-brand">
                                        {selectedOrder.deliveryZoneName}
                                      </dd>
                                    </div>
                                  )}

                                  {selectedOrder.deliveryAddress && (
                                    <div>
                                      <dt className="flex items-center gap-2 text-brand/55">
                                        <MapPin size={15} />
                                        Delivery address
                                      </dt>
                                      <dd className="mt-1 break-words font-semibold text-brand">
                                        {selectedOrder.deliveryAddress}
                                      </dd>
                                    </div>
                                  )}

                                  {selectedOrder.deliveryInstructions && (
                                    <div>
                                      <dt className="text-brand/55">
                                        Instructions
                                      </dt>
                                      <dd className="mt-1 break-words text-brand">
                                        {selectedOrder.deliveryInstructions}
                                      </dd>
                                    </div>
                                  )}
                                </>
                              )}
                            </dl>
                          </div>

                          {/* Recorded status */}
                          <div className="rounded-2xl bg-sage p-5">
                            <h4 className="text-sm font-bold text-brand">
                              Current order status
                            </h4>

                            <p className="mt-2 text-base font-extrabold text-brand">
                              {orderStatusLabels[
                                selectedOrder.status
                              ] ?? selectedOrder.status}
                            </p>

                            <p className="mt-3 text-xs leading-6 text-brand/60">
                              This is the latest status
                              recorded by Loyce Dairies.
                              Live delivery tracking is
                              not available yet.
                            </p>
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </article>
            )
          })}

          <p className="pt-2 text-xs leading-6 text-brand/50">
            Order history currently displays up to
            50 recent orders. Select Refresh to check
            for updated statuses.
          </p>
        </div>
      )}
    </section>
  )
}
