
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { Link } from 'react-router-dom'

import {
  AlertCircle,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ClipboardList,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'

import { formatPrice } from '../../data/products'

import {
  getStaffOrderAttention,
  type OrderAttentionLevel,
  type StaffOrderAttentionData,
} from '../../services/staffOrderAttentionApi'

// ==========================================
// LOYCE DAIRIES PLATFORM
// MILESTONE 4.16
// STAFF UNATTENDED-ORDER DASHBOARD
//
// REFINEMENT:
// REACT EFFECT-SAFE INITIAL DATA LOADING
// ==========================================

const REFRESH_INTERVAL_MS = 30_000
const PAGE_SIZE = 25

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

function formatWaitingTime(minutes: number): string {
  if (minutes < 1) {
    return 'Under 1 minute'
  }

  if (minutes < 60) {
    return `${minutes} ${
      minutes === 1 ? 'minute' : 'minutes'
    }`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours < 24) {
    return remainingMinutes === 0
      ? `${hours}h`
      : `${hours}h ${remainingMinutes}m`
  }

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24

  return remainingHours === 0
    ? `${days}d`
    : `${days}d ${remainingHours}h`
}

function attentionLabel(
  level: OrderAttentionLevel,
): string {
  switch (level) {
    case 'NORMAL':
      return 'Awaiting confirmation'

    case 'REMINDER':
      return 'Reminder required'

    case 'ESCALATED':
      return 'Escalation required'

    case 'CRITICAL':
      return 'Critical — overdue'
  }
}

function attentionStyle(
  level: OrderAttentionLevel,
): string {
  switch (level) {
    case 'NORMAL':
      return 'bg-sage text-brand'

    case 'REMINDER':
      return 'bg-amber-100 text-amber-800'

    case 'ESCALATED':
      return 'bg-orange-100 text-orange-800'

    case 'CRITICAL':
      return 'bg-red-100 text-red-800'
  }
}

function attentionBorder(
  level: OrderAttentionLevel,
): string {
  switch (level) {
    case 'NORMAL':
      return 'border-brand/10'

    case 'REMINDER':
      return 'border-amber-300'

    case 'ESCALATED':
      return 'border-orange-300'

    case 'CRITICAL':
      return 'border-red-400'
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Unable to retrieve unattended orders.'
}

// ==========================================
// STAFF ORDER ATTENTION PANEL
// ==========================================

export default function StaffOrderAttentionPanel() {
  // ========================================
  // MONITORING STATE
  // ========================================

  const [data, setData] =
    useState<StaffOrderAttentionData | null>(
      null,
    )

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  // ========================================
  // REQUEST REFERENCES
  // ========================================

  const controllerRef =
    useRef<AbortController | null>(null)

  const requestVersionRef =
    useRef(0)

  // ========================================
  // FETCH ORDER ATTENTION DATA
  // ========================================

  const loadAttention = useCallback(
    async (signal: AbortSignal) => {
      if (signal.aborted) {
        return
      }

      const version =
        ++requestVersionRef.current

      try {
        const result =
          await getStaffOrderAttention({
            limit: PAGE_SIZE,
            signal,
          })

        if (
          signal.aborted ||
          version !==
            requestVersionRef.current
        ) {
          return
        }

        setData(result)
        setError(null)
      } catch (caughtError: unknown) {
        if (
          signal.aborted ||
          version !==
            requestVersionRef.current
        ) {
          return
        }

        setError(
          getErrorMessage(caughtError),
        )
      } finally {
        if (
          !signal.aborted &&
          version ===
            requestVersionRef.current
        ) {
          setLoading(false)
        }
      }
    },
    [],
  )

  // ========================================
  // AUTOMATIC ORDER MONITORING
  //
  // REACT EFFECT-SAFE INITIALIZATION
  // ========================================

  useEffect(() => {
    const controller = new AbortController()

    controllerRef.current = controller

    // Schedule initial data loading after
    // effect setup instead of invoking
    // the state-updating request directly
    // inside the effect body.
    //
    // Clear the timer and abort requests
    // when React cleans up this effect.

    const initialLoadTimer =
      window.setTimeout(() => {
        if (!controller.signal.aborted) {
          void loadAttention(
            controller.signal,
          )
        }
      }, 0)

    // Continue refreshing monitoring
    // information every 30 seconds while
    // the browser tab is visible.

    const interval = window.setInterval(
      () => {
        if (
          !controller.signal.aborted &&
          document.visibilityState ===
            'visible'
        ) {
          void loadAttention(
            controller.signal,
          )
        }
      },
      REFRESH_INTERVAL_MS,
    )

    // Refresh immediately whenever
    // staff return to a visible tab.

    const handleVisibilityChange = () => {
      if (
        !controller.signal.aborted &&
        document.visibilityState ===
          'visible'
      ) {
        void loadAttention(
          controller.signal,
        )
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    // Clean up all monitoring resources.

    return () => {
      window.clearTimeout(
        initialLoadTimer,
      )

      window.clearInterval(interval)

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )

      controller.abort()

      if (
        controllerRef.current ===
        controller
      ) {
        controllerRef.current = null
      }
    }
  }, [loadAttention])

  // ========================================
  // MANUAL REFRESH
  // ========================================

  const handleRefresh = async () => {
    const signal =
      controllerRef.current?.signal

    if (
      !signal ||
      signal.aborted ||
      refreshing
    ) {
      return
    }

    setRefreshing(true)

    try {
      await loadAttention(signal)
    } finally {
      if (!signal.aborted) {
        setRefreshing(false)
      }
    }
  }

  // ========================================
  // DERIVED MONITORING INFORMATION
  // ========================================

  const summary = data?.summary

  const totalPending =
    summary?.totalPending ?? 0

  const reminderCount =
    summary?.reminder ?? 0

  const escalatedCount =
    summary?.escalated ?? 0

  const criticalCount =
    summary?.critical ?? 0

  const requiringAttention =
    summary?.requiringAttention ?? 0

  const hasOutstandingOrders =
    totalPending > 0

  // ========================================
  // RENDER
  // ========================================

  return (
    <section
      aria-labelledby="staff-order-attention-title"
      className="rounded-[2rem] border border-brand/10 bg-white p-5 sm:p-7"
    >
      {/* ====================================
          SECTION HEADER
      ==================================== */}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sage text-brand">
            <ShieldAlert
              size={23}
              aria-hidden="true"
            />
          </div>

          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-brand-light">
              LOYCE DAIRIES · STAFF
            </p>

            <h2
              id="staff-order-attention-title"
              className="mt-2 font-display text-2xl text-brand sm:text-3xl"
            >
              Unattended orders
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-brand/60">
              Monitor orders awaiting staff
              confirmation and identify those
              requiring urgent attention.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={loading || refreshing}
          onClick={() => {
            void handleRefresh()
          }}
          className="inline-flex items-center gap-2 rounded-full border border-brand/15 px-4 py-2.5 text-xs font-bold text-brand transition-colors hover:bg-sage disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={
              refreshing ? 'animate-spin' : ''
            }
            aria-hidden="true"
          />

          {refreshing
            ? 'Refreshing...'
            : 'Refresh'}
        </button>
      </div>

      {/* ====================================
          LOADING STATE
      ==================================== */}

      {loading && !data && (
        <div
          role="status"
          className="mt-8 flex items-center gap-3 rounded-2xl bg-cream p-6 text-sm text-brand/65"
        >
          <LoaderCircle
            size={20}
            className="animate-spin"
            aria-hidden="true"
          />

          Loading order monitoring data...
        </div>
      )}

      {/* ====================================
          ERROR STATE
      ==================================== */}

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              size={21}
              className="shrink-0 text-red-700"
              aria-hidden="true"
            />

            <div>
              <p className="text-sm font-bold text-red-800">
                Order monitoring unavailable
              </p>

              <p className="mt-2 text-sm leading-6 text-red-700">
                {error}
              </p>

              {data && (
                <p className="mt-2 text-xs text-red-700">
                  Previously retrieved results
                  are displayed below and may
                  be out of date.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================
          MONITORING DASHBOARD
      ==================================== */}

      {data && (
        <>
          {/* SUMMARY CARDS */}

          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-brand/10 bg-cream p-4">
              <p className="text-xs font-bold text-brand/60">
                Pending orders
              </p>

              <p className="mt-3 font-display text-3xl text-brand">
                {totalPending}
              </p>

              <p className="mt-2 text-xs text-brand/50">
                Awaiting confirmation
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-800">
                Reminders
              </p>

              <p className="mt-3 font-display text-3xl text-amber-900">
                {reminderCount}
              </p>

              <p className="mt-2 text-xs text-amber-700">
                5–9 minutes
              </p>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-xs font-bold text-orange-800">
                Escalated
              </p>

              <p className="mt-3 font-display text-3xl text-orange-900">
                {escalatedCount}
              </p>

              <p className="mt-2 text-xs text-orange-700">
                10–14 minutes
              </p>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-bold text-red-800">
                Critical
              </p>

              <p className="mt-3 font-display text-3xl text-red-900">
                {criticalCount}
              </p>

              <p className="mt-2 text-xs text-red-700">
                15+ minutes
              </p>
            </div>
          </div>

          {/* SUMMARY MESSAGE */}

          <div
            className={`mt-6 flex items-start gap-3 rounded-2xl border p-5 ${
              requiringAttention > 0
                ? 'border-amber-200 bg-amber-50'
                : 'border-brand/10 bg-sage/40'
            }`}
          >
            {requiringAttention > 0 ? (
              <AlertTriangle
                size={22}
                className="shrink-0 text-amber-700"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                size={22}
                className="shrink-0 text-brand-light"
                aria-hidden="true"
              />
            )}

            <div>
              <p className="text-sm font-bold text-brand">
                {requiringAttention > 0
                  ? `${requiringAttention} ${
                      requiringAttention === 1
                        ? 'order requires'
                        : 'orders require'
                    } attention`
                  : hasOutstandingOrders
                    ? 'Pending orders are within the initial response window'
                    : 'No unattended orders'}
              </p>

              <p className="mt-2 text-sm leading-6 text-brand/65">
                {requiringAttention > 0
                  ? 'Review overdue customer orders and confirm or resolve them promptly.'
                  : hasOutstandingOrders
                    ? 'Monitor these orders and confirm them before their response deadlines.'
                    : 'There are currently no customer orders awaiting staff confirmation.'}
              </p>
            </div>
          </div>

          {/* LAST UPDATE */}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-brand/50">
            <span className="inline-flex items-center gap-2">
              <Clock3
                size={14}
                aria-hidden="true"
              />

              Last checked:{' '}
              {formatDate(data.evaluatedAt)}
            </span>

            <span>
              Refreshes every 30 seconds
              while the tab is visible
            </span>
          </div>

          {/* ==================================
              PENDING ORDER LIST
          ================================== */}

          {data.orders.length > 0 && (
            <div className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ClipboardList
                    size={21}
                    className="text-brand-light"
                    aria-hidden="true"
                  />

                  <h3 className="font-display text-xl text-brand">
                    Orders awaiting confirmation
                  </h3>
                </div>

                <Link
                  to="/staff/orders"
                  className="text-xs font-bold text-brand-light underline underline-offset-4"
                >
                  View order management
                </Link>
              </div>

              <p className="mt-3 text-xs text-brand/55">
                Oldest pending orders appear first.
              </p>

              <div className="mt-5 space-y-3">
                {data.orders.map((order) => (
                  <article
                    key={order.orderId}
                    className={`rounded-2xl border bg-cream/60 p-5 ${attentionBorder(
                      order.attentionLevel,
                    )}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-all text-sm font-extrabold text-brand">
                          {order.orderNumber}
                        </p>

                        <p className="mt-2 text-sm text-brand/75">
                          {order.customerName}
                        </p>

                        <p className="mt-1 text-xs text-brand/50">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${attentionStyle(
                          order.attentionLevel,
                        )}`}
                      >
                        {order.attentionLevel ===
                          'CRITICAL' && (
                          <BellRing
                            size={13}
                            aria-hidden="true"
                          />
                        )}

                        {attentionLabel(
                          order.attentionLevel,
                        )}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-brand/70">
                      <span>
                        Waiting:{' '}
                        <strong className="text-brand">
                          {formatWaitingTime(
                            order.waitingMinutes,
                          )}
                        </strong>
                      </span>

                      <span>
                        {formatPrice(order.totalUgx)}
                      </span>

                      <span>
                        {order.fulfillmentMethod ===
                        'DELIVERY'
                          ? 'Delivery'
                          : 'Pickup'}
                      </span>
                    </div>

                    {order.nextAttentionAt && (
                      <p className="mt-3 text-xs text-brand/55">
                        Next attention threshold:{' '}
                        {formatDate(
                          order.nextAttentionAt,
                        )}
                      </p>
                    )}

                    <div className="mt-5 border-t border-brand/10 pt-4">
                      <Link
                        to={`/staff/orders?orderId=${encodeURIComponent(
                          order.orderId,
                        )}`}
                        className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-brand-light"
                      >
                        Review order

                        <ChevronRight
                          size={15}
                          aria-hidden="true"
                        />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* PAGINATION NOTICE */}

          {data.hasMore && (
            <div className="mt-5 rounded-xl border border-brand/10 bg-cream p-4">
              <p className="text-xs leading-6 text-brand/70">
                Showing the oldest{' '}
                {data.orders.length} pending orders.
                Additional pending orders exist.
              </p>

              <Link
                to="/staff/orders"
                className="mt-2 inline-block text-xs font-bold text-brand underline underline-offset-4"
              >
                Open full order management
              </Link>
            </div>
          )}

          {/* SERVICE-LEVEL POLICY */}

          <p className="mt-7 text-xs leading-6 text-brand/50">
            Initial response targets: reminder at{' '}
            {data.thresholdsMinutes.reminder}{' '}
            minutes, escalation at{' '}
            {data.thresholdsMinutes.escalation}{' '}
            minutes, and critical attention at{' '}
            {data.thresholdsMinutes.critical}{' '}
            minutes. These indicators do not
            automatically change order statuses
            or notify supervisors.
          </p>
        </>
      )}
    </section>
  )
}
