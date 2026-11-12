
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'

import {
  Link,
  useSearchParams,
} from 'react-router-dom'

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from 'lucide-react'

import { formatPrice } from '../data/products'

import {
  changeStaffOrderStatus,
  getStaffOrderDetails,
  getStaffOrders,
  ORDER_STATUSES,
  StaffApiError,
  type OrderFilter,
  type OrderStatus,
  type StaffOrderDetail,
  type StaffOrderSummary,
} from '../services/adminOrdersApi'

// ==========================================
// LOYCE DAIRIES PLATFORM
// STAFF ORDER MANAGEMENT
//
// MILESTONE 4.14
// DIRECT ORDER NOTIFICATION NAVIGATION
// ==========================================

const statusLabels: Record<OrderStatus, string> = {
  PENDING: 'Pending confirmation',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for pickup',
  OUT_FOR_DELIVERY: 'Out for delivery',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const transitions: Record<
  OrderStatus,
  readonly OrderStatus[]
> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: [
    'READY_FOR_PICKUP',
    'OUT_FOR_DELIVERY',
    'CANCELLED',
  ],
  READY_FOR_PICKUP: ['COMPLETED'],
  OUT_FOR_DELIVERY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

// ==========================================
// DISPLAY HELPERS
// ==========================================

function formatDate(value: string): string {
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

function paymentLabel(method: string): string {
  const labels: Record<string, string> = {
    CASH_ON_PICKUP: 'Cash on pickup',
    CASH_ON_DELIVERY: 'Cash on delivery',
    MTN_MOMO: 'MTN Mobile Money',
    AIRTEL_MONEY: 'Airtel Money',
    CARD: 'Card',
  }

  return labels[method] ?? method.replaceAll('_', ' ')
}

function statusStyle(status: OrderStatus): string {
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

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.'
}

function availableTransitions(
  order: StaffOrderDetail,
): OrderStatus[] {
  return transitions[order.status].filter((status) => {
    if (status === 'READY_FOR_PICKUP') {
      return order.fulfillmentMethod === 'PICKUP'
    }

    if (status === 'OUT_FOR_DELIVERY') {
      return order.fulfillmentMethod === 'DELIVERY'
    }

    return true
  })
}

// ==========================================
// STAFF ORDER MANAGEMENT PAGE
// ==========================================

export default function StaffOrdersPage() {
  // ========================================
  // MILESTONE 4.14
  // URL-BASED ORDER SELECTION
  // ========================================

  const [searchParams, setSearchParams] =
    useSearchParams()

  // This value comes from:
  //
  // /staff/orders?orderId=...
  //
  // It takes precedence over manual selection.
  // The backend independently verifies that
  // the requested order exists and that the
  // current account has staff permissions.

  const linkedOrderId =
    searchParams.get('orderId')

  const [
    manuallySelectedId,
    setManuallySelectedId,
  ] = useState<string | null>(null)

  const selectedId =
    linkedOrderId ?? manuallySelectedId

  // ========================================
  // ORDER LIST STATE
  // ========================================

  const [orders, setOrders] = useState<
    StaffOrderSummary[]
  >([])

  const [filter, setFilter] =
    useState<OrderFilter>('ALL')

  const [cursor, setCursor] =
    useState<string | null>(null)

  const [nextCursor, setNextCursor] =
    useState<string | null>(null)

  const [reloadVersion, setReloadVersion] =
    useState(0)

  const [listLoading, setListLoading] =
    useState(true)

  const [listError, setListError] =
    useState<string | null>(null)

  const [accessError, setAccessError] =
    useState<number | null>(null)

  // ========================================
  // SELECTED ORDER DETAILS
  // ========================================

  const [selectedOrder, setSelectedOrder] =
    useState<StaffOrderDetail | null>(null)

  const [detailsLoading, setDetailsLoading] =
    useState(false)

  const [detailsError, setDetailsError] =
    useState<string | null>(null)

  const [detailsVersion, setDetailsVersion] =
    useState(0)

  // ========================================
  // STATUS UPDATE STATE
  // ========================================

  const [targetStatus, setTargetStatus] =
    useState<OrderStatus | ''>('')

  const [note, setNote] = useState('')

  const [updating, setUpdating] =
    useState(false)

  const updatingRef = useRef(false)

  const [updateError, setUpdateError] =
    useState<string | null>(null)

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null)

  // ========================================
  // FETCH STAFF ORDER LIST
  // ========================================

  useEffect(() => {
    const controller = new AbortController()

    const loadOrders = async () => {
      setListLoading(true)
      setListError(null)

      if (cursor === null) {
        setOrders([])
        setNextCursor(null)
      }

      try {
        const page = await getStaffOrders({
          status:
            filter === 'ALL'
              ? undefined
              : filter,

          cursor: cursor ?? undefined,
          limit: 20,
          signal: controller.signal,
        })

        if (controller.signal.aborted) {
          return
        }

        setAccessError(null)

        setOrders((previous) => {
          if (cursor === null) {
            return page.orders
          }

          const known = new Set(
            previous.map((order) => order.id),
          )

          return [
            ...previous,
            ...page.orders.filter(
              (order) => !known.has(order.id),
            ),
          ]
        })

        setNextCursor(page.nextCursor)

        // Preserve automatic selection for
        // ordinary order-management visits.
        //
        // When an orderId exists in the URL,
        // it takes precedence and the linked
        // order is loaded independently.

        if (
          cursor === null &&
          page.orders.length > 0
        ) {
          setManuallySelectedId(
            (current) =>
              current ?? page.orders[0].id,
          )
        }
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          return
        }

        if (
          error instanceof StaffApiError &&
          (error.status === 401 ||
            error.status === 403)
        ) {
          setAccessError(error.status)
          setOrders([])
          setManuallySelectedId(null)
          setSelectedOrder(null)
        } else {
          setListError(errorMessage(error))
        }
      } finally {
        if (!controller.signal.aborted) {
          setListLoading(false)
        }
      }
    }

    void loadOrders()

    return () => {
      controller.abort()
    }
  }, [filter, cursor, reloadVersion])

  // ========================================
  // FETCH EXACT SELECTED ORDER
  // ========================================

  useEffect(() => {
    if (!selectedId) {
      setSelectedOrder(null)
      setDetailsError(null)
      setDetailsLoading(false)
      return
    }

    const controller = new AbortController()

    const loadDetails = async () => {
      setDetailsLoading(true)
      setDetailsError(null)
      setSelectedOrder(null)

      try {
        // This endpoint retrieves the order
        // directly by its database ID.
        //
        // It does not depend on the current
        // order-list page or status filter.

        const order = await getStaffOrderDetails(
          selectedId,
          controller.signal,
        )

        if (controller.signal.aborted) {
          return
        }

        setSelectedOrder(order)
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          return
        }

        if (
          error instanceof StaffApiError &&
          (error.status === 401 ||
            error.status === 403)
        ) {
          setAccessError(error.status)
        } else {
          setDetailsError(errorMessage(error))
        }
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
  }, [selectedId, detailsVersion])

  // ========================================
  // REFRESH ORDER INFORMATION
  // ========================================

  const handleRefresh = () => {
    if (updatingRef.current) {
      return
    }

    setCursor(null)
    setReloadVersion((value) => value + 1)

    if (selectedId) {
      setDetailsVersion((value) => value + 1)
    }

    setUpdateError(null)
    setSuccessMessage(null)
  }

  // ========================================
  // FILTER CUSTOMER ORDERS
  // ========================================

  const handleFilter = (value: OrderFilter) => {
    if (updatingRef.current) {
      return
    }

    // Filtering returns staff to the
    // regular order-list selection mode.
    // Remove an earlier notification link.

    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(
          previous,
        )

        next.delete('orderId')

        return next
      },
      { replace: true },
    )

    setFilter(value)
    setCursor(null)

    setManuallySelectedId(null)
    setSelectedOrder(null)

    setTargetStatus('')
    setNote('')
    setUpdateError(null)
    setSuccessMessage(null)

    setReloadVersion((value) => value + 1)
  }

  // ========================================
  // SELECT CUSTOMER ORDER
  // ========================================

  const handleSelectOrder = (orderId: string) => {
    if (updatingRef.current) {
      return
    }

    if (selectedId === orderId) {
      return
    }

    // Keep the URL synchronized with the
    // order selected by staff.
    //
    // This also makes the selection
    // directly linkable and refresh-safe.

    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(
          previous,
        )

        next.set('orderId', orderId)

        return next
      },
      { replace: true },
    )

    setManuallySelectedId(orderId)
    setSelectedOrder(null)

    setTargetStatus('')
    setNote('')
    setUpdateError(null)
    setSuccessMessage(null)
  }

  // ========================================
  // CHANGE ORDER STATUS
  // ========================================

  const handleUpdateStatus = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (
      !selectedOrder ||
      !targetStatus ||
      updatingRef.current
    ) {
      return
    }

    setUpdateError(null)
    setSuccessMessage(null)

    const allowed = availableTransitions(
      selectedOrder,
    )

    if (!allowed.includes(targetStatus)) {
      setUpdateError(
        'This status transition is not permitted.',
      )
      return
    }

    const cleanNote = note.trim()

    if (
      targetStatus === 'CANCELLED' &&
      cleanNote.length < 3
    ) {
      setUpdateError(
        'Please provide a cancellation reason of at least 3 characters.',
      )
      return
    }

    if (
      cleanNote.length > 0 &&
      cleanNote.length < 3
    ) {
      setUpdateError(
        'A staff note must contain at least 3 characters.',
      )
      return
    }

    updatingRef.current = true
    setUpdating(true)

    try {
      const updated =
        await changeStaffOrderStatus(
          selectedOrder.id,
          targetStatus,
          cleanNote || undefined,
        )

      setSelectedOrder(updated)

      setOrders((current) =>
        current.map((order) =>
          order.id === updated.id
            ? {
                ...order,
                status: updated.status,
                updatedAt: updated.updatedAt,
              }
            : order,
        ),
      )

      setTargetStatus('')
      setNote('')

      setSuccessMessage(
        `Order updated to ${
          statusLabels[updated.status]
        }.`,
      )

      setCursor(null)
      setReloadVersion((value) => value + 1)
    } catch (error: unknown) {
      setUpdateError(errorMessage(error))
    } finally {
      updatingRef.current = false
      setUpdating(false)
    }
  }

  // ========================================
  // DERIVED VIEW STATE
  // ========================================

  const nextStatuses = selectedOrder
    ? availableTransitions(selectedOrder)
    : []

  const visibleSelectedOrder =
    selectedOrder?.id === selectedId
      ? selectedOrder
      : null

  const isLinkedOrder =
    linkedOrderId !== null &&
    selectedId === linkedOrderId

  // ========================================
  // STAFF ACCESS RESTRICTION
  // ========================================

  if (
    accessError === 401 ||
    accessError === 403
  ) {
    return (
      <main className="min-h-[70vh] bg-cream px-5 py-20">
        <section className="mx-auto max-w-lg rounded-[2rem] border border-brand/10 bg-white p-9 text-center shadow-sm">

          <LockKeyhole
            size={42}
            className="mx-auto text-brand-light"
            aria-hidden="true"
          />

          <h1 className="mt-6 font-display text-3xl text-brand">
            {accessError === 401
              ? 'Staff sign-in required'
              : 'Staff access only'}
          </h1>

          <p className="mt-4 text-sm leading-7 text-brand/65">
            {accessError === 401
              ? 'Please sign in using your authorized Loyce Dairies staff account.'
              : 'Your current account does not have permission to manage customer orders.'}
          </p>

          <Link
            to={
              accessError === 401
                ? '/login'
                : '/account'
            }
            className="mt-7 inline-flex rounded-full bg-brand px-7 py-3.5 text-sm font-bold text-white hover:bg-brand-light"
          >
            {accessError === 401
              ? 'Go to sign in'
              : 'Back to my account'}
          </Link>

        </section>
      </main>
    )
  }

  // ========================================
  // STAFF ORDER DASHBOARD
  // ========================================

  return (
    <main className="min-h-screen bg-cream">

      {/* ====================================
          HEADER AND STAFF NAVIGATION
      ==================================== */}

      <section className="border-b border-brand/10 bg-sage/60">

        <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-12">

          <nav
            aria-label="Staff workspace navigation"
            className="mb-9 flex flex-wrap items-center gap-3"
          >
            <Link
              to="/account"
              className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-white px-5 py-3 text-sm font-semibold text-brand transition-colors hover:bg-sage"
            >
              <ArrowLeft
                size={17}
                aria-hidden="true"
              />
              Back to account
            </Link>

            <Link
              to="/staff/delivery-zones"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-light"
            >
              <Truck
                size={17}
                aria-hidden="true"
              />
              Manage delivery zones
            </Link>
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-5">

            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-light">
                LOYCE DAIRIES · STAFF
              </p>

              <h1 className="mt-4 font-display text-4xl text-brand sm:text-5xl">
                Order management
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-brand/65">
                Review customer purchases, manage
                fulfillment progress, and inspect
                recorded status changes.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-bold text-brand">
              <ShieldCheck
                size={18}
                className="text-brand-light"
                aria-hidden="true"
              />
              Staff workspace
            </div>

          </div>
        </div>
      </section>

      {/* ====================================
          MAIN DASHBOARD CONTENT
      ==================================== */}

      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">

        {/* ==================================
            FILTERS AND REFRESH
        ================================== */}

        <div className="flex flex-wrap items-end justify-between gap-4">

          <div>
            <label
              htmlFor="staff-order-filter"
              className="mb-2 block text-sm font-bold text-brand"
            >
              Filter by order status
            </label>

            <select
              id="staff-order-filter"
              value={filter}
              disabled={updating}
              onChange={(event) =>
                handleFilter(
                  event.target.value as OrderFilter,
                )
              }
              className="min-w-56 rounded-xl border border-brand/15 bg-white px-4 py-3 text-sm text-brand outline-none focus:border-brand-light"
            >
              <option value="ALL">
                All order statuses
              </option>

              {ORDER_STATUSES.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={listLoading || updating}
            className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-white px-5 py-3 text-sm font-bold text-brand hover:bg-sage disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={
                listLoading
                  ? 'animate-spin'
                  : ''
              }
              aria-hidden="true"
            />
            Refresh
          </button>

        </div>

        {/* ==================================
            ORDER LIST AND DETAILS
        ================================== */}

        <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">

          {/* ================================
              CUSTOMER ORDER LIST
          ================================ */}

          <section
            aria-labelledby="staff-orders-title"
            className="min-w-0 rounded-[2rem] border border-brand/10 bg-white p-5 sm:p-7"
          >

            <div className="flex items-center justify-between gap-3">

              <div className="flex items-center gap-3">
                <ClipboardList
                  size={23}
                  className="text-brand-light"
                  aria-hidden="true"
                />

                <h2
                  id="staff-orders-title"
                  className="font-display text-2xl text-brand"
                >
                  Customer orders
                </h2>
              </div>

              <span className="text-xs font-semibold text-brand/50">
                {orders.length} loaded
              </span>

            </div>

            {/* LOADING STATE */}

            {listLoading &&
              orders.length === 0 && (
                <div
                  role="status"
                  className="flex items-center gap-3 py-12 text-sm text-brand/60"
                >
                  <LoaderCircle
                    size={21}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Loading customer orders...
                </div>
              )}

            {/* ERROR STATE */}

            {listError && (
              <div
                role="alert"
                className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"
              >
                <AlertCircle
                  size={22}
                  className="text-amber-700"
                  aria-hidden="true"
                />

                <p className="mt-3 text-sm text-amber-900">
                  {listError}
                </p>

                <button
                  type="button"
                  onClick={handleRefresh}
                  className="mt-4 text-sm font-bold text-brand underline"
                >
                  Retry
                </button>
              </div>
            )}

            {/* EMPTY STATE */}

            {!listLoading &&
              !listError &&
              orders.length === 0 && (
                <div className="py-14 text-center">
                  <ShoppingBag
                    size={38}
                    className="mx-auto text-brand/35"
                    aria-hidden="true"
                  />

                  <h3 className="mt-5 font-display text-2xl text-brand">
                    No matching orders
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-brand/60">
                    No orders match the selected filter.
                  </p>
                </div>
              )}

            {/* ORDER CARDS */}

            <div className="mt-6 space-y-3">

              {orders.map((order) => {
                const selected =
                  selectedId === order.id

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() =>
                      handleSelectOrder(order.id)
                    }
                    disabled={updating}
                    aria-pressed={selected}
                    className={`w-full rounded-2xl border p-5 text-left transition-colors disabled:opacity-60 ${
                      selected
                        ? 'border-brand bg-sage'
                        : 'border-brand/10 bg-cream hover:border-brand/30'
                    }`}
                  >

                    <div className="flex items-start justify-between gap-3">

                      <div className="min-w-0">
                        <p className="break-all text-xs font-extrabold text-brand">
                          {order.orderNumber}
                        </p>

                        <p className="mt-2 text-sm font-semibold text-brand/75">
                          {order.customer.fullName}
                        </p>

                        <p className="mt-1 break-all text-xs text-brand/50">
                          {order.customer.email}
                        </p>
                      </div>

                      <ChevronRight
                        size={19}
                        className="shrink-0 text-brand-light"
                        aria-hidden="true"
                      />

                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">

                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusStyle(order.status)}`}
                      >
                        {statusLabels[order.status]}
                      </span>

                      <span className="text-xs text-brand/55">
                        {order._count.items}{' '}
                        {order._count.items === 1
                          ? 'item'
                          : 'items'}
                      </span>

                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-brand/10 pt-4">

                      <div>
                        <p className="text-xs text-brand/50">
                          {formatDate(order.createdAt)}
                        </p>

                        <p className="mt-2 text-sm font-extrabold text-brand">
                          {formatPrice(order.totalUgx)}
                        </p>
                      </div>

                      {order.fulfillmentMethod ===
                      'PICKUP' ? (
                        <PackageCheck
                          size={21}
                          className="text-brand-light"
                          aria-hidden="true"
                        />
                      ) : (
                        <Truck
                          size={21}
                          className="text-brand-light"
                          aria-hidden="true"
                        />
                      )}

                    </div>
                  </button>
                )
              })}

            </div>

            {/* PAGINATION */}

            {nextCursor && (
              <button
                type="button"
                disabled={listLoading}
                onClick={() =>
                  setCursor(nextCursor)
                }
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-brand/15 px-5 py-3 text-sm font-bold text-brand hover:bg-sage disabled:opacity-50"
              >
                {listLoading && (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                )}

                Load more orders
              </button>
            )}

          </section>

          {/* ================================
              ORDER DETAILS PANEL
          ================================ */}

          <section
            aria-labelledby="staff-details-title"
            className="min-w-0 rounded-[2rem] border border-brand/10 bg-white p-5 sm:p-7"
          >

            <h2
              id="staff-details-title"
              className="font-display text-2xl text-brand"
            >
              Order details
            </h2>

            {/* LINKED ORDER NOTICE */}

            {isLinkedOrder && (
              <p className="mt-3 text-xs leading-6 text-brand-light">
                Viewing the order selected through
                a direct link or staff notification.
              </p>
            )}

            {/* NO ORDER SELECTED */}

            {!selectedId && (
              <div className="py-14 text-center">
                <PackageCheck
                  size={40}
                  className="mx-auto text-brand/30"
                  aria-hidden="true"
                />

                <p className="mt-5 text-sm leading-7 text-brand/60">
                  Select an order to review its
                  details, manage its status,
                  and view its history.
                </p>
              </div>
            )}

            {/* DETAILS LOADING */}

            {selectedId &&
              detailsLoading && (
                <div
                  role="status"
                  className="flex items-center gap-3 py-12 text-sm text-brand/60"
                >
                  <LoaderCircle
                    size={21}
                    className="animate-spin"
                    aria-hidden="true"
                  />

                  Loading order details...
                </div>
              )}

            {/* DETAILS ERROR */}

            {selectedId &&
              detailsError && (
                <div
                  role="alert"
                  className="mt-6 rounded-xl bg-amber-50 p-5 text-sm text-amber-900"
                >
                  {detailsError}

                  <button
                    type="button"
                    onClick={() =>
                      setDetailsVersion(
                        (value) => value + 1,
                      )
                    }
                    className="mt-3 block font-bold underline"
                  >
                    Try again
                  </button>
                </div>
              )}

            {/* ==============================
                SELECTED ORDER CONTENT
            ============================== */}

            {visibleSelectedOrder &&
              !detailsLoading &&
              !detailsError && (
                <div className="mt-6 space-y-7">

                  {/* ORDER STATUS SUMMARY */}

                  <div className="rounded-2xl bg-cream p-5">

                    <p className="text-xs font-semibold text-brand/50">
                      Order number
                    </p>

                    <p className="mt-2 break-all text-sm font-extrabold text-brand">
                      {visibleSelectedOrder.orderNumber}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-3">

                      <span
                        className={`rounded-full px-3 py-2 text-xs font-bold ${statusStyle(visibleSelectedOrder.status)}`}
                      >
                        {statusLabels[
                          visibleSelectedOrder.status
                        ]}
                      </span>

                      <span className="text-xs text-brand/60">
                        Payment:{' '}
                        {visibleSelectedOrder.paymentStatus}
                      </span>

                    </div>
                  </div>

                  {/* CUSTOMER DETAILS */}

                  <div>
                    <h3 className="text-sm font-extrabold text-brand">
                      Customer and fulfillment
                    </h3>

                    <div className="mt-4 space-y-2 text-sm text-brand/70">

                      <p>
                        <strong>Customer:</strong>{' '}
                        {visibleSelectedOrder.customer.fullName}
                      </p>

                      <p className="break-all">
                        <strong>Email:</strong>{' '}
                        {visibleSelectedOrder.customer.email}
                      </p>

                      <p>
                        <strong>Recipient:</strong>{' '}
                        {visibleSelectedOrder.recipientName}
                      </p>

                      <p>
                        <strong>Phone:</strong>{' '}
                        {visibleSelectedOrder.contactPhone}
                      </p>

                      <p>
                        <strong>Fulfillment:</strong>{' '}
                        {visibleSelectedOrder.fulfillmentMethod ===
                        'PICKUP'
                          ? 'Pickup'
                          : 'Delivery'}
                      </p>

                      <p>
                        <strong>Payment method:</strong>{' '}
                        {paymentLabel(
                          visibleSelectedOrder.paymentMethod,
                        )}
                      </p>

                      {visibleSelectedOrder.deliveryZoneName && (
                        <p>
                          <strong>Delivery zone:</strong>{' '}
                          {visibleSelectedOrder.deliveryZoneName}
                        </p>
                      )}

                      {visibleSelectedOrder.deliveryAddress && (
                        <p className="flex items-start gap-2 break-words">
                          <MapPin
                            size={16}
                            className="mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          {visibleSelectedOrder.deliveryAddress}
                        </p>
                      )}

                      {visibleSelectedOrder.deliveryInstructions && (
                        <p className="break-words">
                          <strong>Instructions:</strong>{' '}
                          {visibleSelectedOrder.deliveryInstructions}
                        </p>
                      )}

                    </div>
                  </div>

                  {/* PRODUCTS PURCHASED */}

                  <div>
                    <h3 className="text-sm font-extrabold text-brand">
                      Products purchased
                    </h3>

                    <div className="mt-4 divide-y divide-brand/10">

                      {visibleSelectedOrder.items.map(
                        (item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-4 py-4 text-sm"
                          >
                            <div>
                              <p className="font-bold text-brand">
                                {item.productName}
                              </p>

                              <p className="mt-1 text-xs text-brand/55">
                                {item.productUnit} ×{' '}
                                {item.quantity}
                              </p>

                              <p className="mt-1 text-xs text-brand/55">
                                {formatPrice(
                                  item.unitPriceUgx,
                                )}{' '}
                                per unit
                              </p>
                            </div>

                            <strong className="shrink-0 text-brand">
                              {formatPrice(
                                item.lineTotalUgx,
                              )}
                            </strong>
                          </div>
                        ),
                      )}

                    </div>

                    {/* ORDER TOTALS */}

                    <div className="space-y-3 rounded-2xl bg-cream p-5 text-sm">

                      <div className="flex justify-between gap-4">
                        <span>Subtotal</span>
                        <span>
                          {formatPrice(
                            visibleSelectedOrder.subtotalUgx,
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span>Delivery fee</span>
                        <span>
                          {formatPrice(
                            visibleSelectedOrder.deliveryFeeUgx,
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4 border-t border-brand/10 pt-3 font-extrabold text-brand">
                        <span>Order total</span>
                        <span>
                          {formatPrice(
                            visibleSelectedOrder.totalUgx,
                          )}
                        </span>
                      </div>

                    </div>
                  </div>

                  {/* ============================
                      ORDER STATUS MANAGEMENT
                  ============================ */}

                  <div className="border-t border-brand/10 pt-6">

                    <div className="flex items-center gap-2">
                      <ShieldCheck
                        size={22}
                        className="text-brand-light"
                        aria-hidden="true"
                      />

                      <h3 className="font-display text-xl text-brand">
                        Update order status
                      </h3>
                    </div>

                    {/* STATUS UPDATE SUCCESS */}

                    {successMessage && (
                      <div
                        role="status"
                        className="mt-5 flex items-start gap-3 rounded-xl bg-sage p-4 text-sm text-brand"
                      >
                        <CheckCircle2
                          size={19}
                          className="shrink-0 text-brand-light"
                          aria-hidden="true"
                        />
                        {successMessage}
                      </div>
                    )}

                    {/* STATUS UPDATE ERROR */}

                    {updateError && (
                      <div
                        role="alert"
                        className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
                      >
                        {updateError}
                      </div>
                    )}

                    {nextStatuses.length === 0 ? (
                      <p className="mt-5 rounded-xl bg-cream p-4 text-sm text-brand/65">
                        This order has reached a final
                        status. No further status changes
                        are available.
                      </p>
                    ) : (
                      <form
                        onSubmit={handleUpdateStatus}
                        className="mt-5 space-y-4"
                      >

                        <div>
                          <label
                            htmlFor="staff-next-status"
                            className="mb-2 block text-sm font-bold text-brand"
                          >
                            New order status
                          </label>

                          <select
                            id="staff-next-status"
                            value={targetStatus}
                            required
                            disabled={updating}
                            onChange={(event) => {
                              setTargetStatus(
                                event.target.value as
                                  OrderStatus | '',
                              )

                              setUpdateError(null)
                            }}
                            className="w-full rounded-xl border border-brand/15 bg-cream px-4 py-3.5 text-sm text-brand"
                          >
                            <option value="">
                              Select next status
                            </option>

                            {nextStatuses.map((status) => (
                              <option
                                key={status}
                                value={status}
                              >
                                {statusLabels[status]}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor="staff-status-note"
                            className="mb-2 block text-sm font-bold text-brand"
                          >
                            Staff note{' '}
                            {targetStatus === 'CANCELLED'
                              ? '(required)'
                              : '(optional)'}
                          </label>

                          <textarea
                            id="staff-status-note"
                            value={note}
                            rows={3}
                            maxLength={300}
                            disabled={updating}
                            required={
                              targetStatus === 'CANCELLED'
                            }
                            minLength={
                              targetStatus === 'CANCELLED'
                                ? 3
                                : undefined
                            }
                            onChange={(event) =>
                              setNote(event.target.value)
                            }
                            placeholder="Reason or operational update"
                            className="w-full resize-y rounded-xl border border-brand/15 bg-cream px-4 py-3.5 text-sm text-brand"
                          />
                        </div>

                        <p className="text-xs leading-6 text-brand/55">
                          Every successful status change
                          is recorded in the order audit
                          history.
                        </p>

                        <button
                          type="submit"
                          disabled={
                            updating || !targetStatus
                          }
                          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-4 text-sm font-bold text-white hover:bg-brand-light disabled:opacity-50"
                        >
                          {updating ? (
                            <>
                              <LoaderCircle
                                size={18}
                                className="animate-spin"
                              />
                              Saving status...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={18} />
                              Save status change
                            </>
                          )}
                        </button>

                      </form>
                    )}

                  </div>

                  {/* ============================
                      ORDER AUDIT HISTORY
                  ============================ */}

                  <div className="border-t border-brand/10 pt-6">

                    <div className="flex items-center gap-2">
                      <Clock3
                        size={21}
                        className="text-brand-light"
                        aria-hidden="true"
                      />

                      <h3 className="font-display text-xl text-brand">
                        Status history
                      </h3>
                    </div>

                    {visibleSelectedOrder.statusEvents.length ===
                    0 ? (
                      <p className="mt-4 text-sm leading-7 text-brand/60">
                        No staff status changes have
                        been recorded for this order yet.
                      </p>
                    ) : (
                      <ol className="mt-5 space-y-4">

                        {visibleSelectedOrder.statusEvents.map(
                          (event) => (
                            <li
                              key={event.id}
                              className="rounded-2xl border border-brand/10 bg-cream p-4"
                            >

                              <p className="text-sm font-extrabold text-brand">
                                {statusLabels[
                                  event.fromStatus
                                ]}
                                {' → '}
                                {statusLabels[
                                  event.toStatus
                                ]}
                              </p>

                              <p className="mt-2 text-xs text-brand/60">
                                By{' '}
                                {event.changedBy.fullName}
                                {' · '}
                                {formatDate(
                                  event.createdAt,
                                )}
                              </p>

                              {event.note && (
                                <p className="mt-3 text-sm leading-6 text-brand/70">
                                  {event.note}
                                </p>
                              )}

                            </li>
                          ),
                        )}

                      </ol>
                    )}

                    <p className="mt-5 text-xs leading-6 text-brand/50">
                      Status history reflects recorded
                      changes. Payment confirmation is
                      managed separately.
                    </p>

                  </div>

                </div>
              )}

          </section>

        </div>

        <p className="mt-8 text-xs leading-6 text-brand/50">
          This dashboard displays database-recorded
          orders and status events. It does not provide
          live delivery tracking or process payments.
        </p>

      </section>
    </main>
  )
}
