import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Smartphone,
} from 'lucide-react'

import {
  getStaffPushQueueHealth,
  type StaffPushQueueHealth,
} from '../../services/staffPushQueueHealthApi'

// ==========================================
// LOYCE DAIRIES
// STAFF NOTIFICATION DELIVERY HEALTH PANEL
// ==========================================

const POLL_INTERVAL_MS = 30_000

// ==========================================
// DATE FORMATTING
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

// ==========================================
// DASHBOARD
// ==========================================

export default function StaffPushQueueHealthPanel() {
  const [health, setHealth] =
    useState<StaffPushQueueHealth | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const requestRef =
    useRef<AbortController | null>(null)

  // ========================================
  // RETRIEVE QUEUE HEALTH
  // ========================================

  const refresh = useCallback(async () => {
    // Cancel any previous overlapping request.

    requestRef.current?.abort()

    const controller = new AbortController()
    requestRef.current = controller

    setRefreshing(true)

    try {
      const data = await getStaffPushQueueHealth(
        controller.signal,
      )

      if (controller.signal.aborted) {
        return
      }

      setHealth(data)
      setError(null)
    } catch (caughtError: unknown) {
      if (controller.signal.aborted) {
        return
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to retrieve notification health.',
      )
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [])

  // ========================================
  // AUTOMATIC REFRESH
  // ========================================

  useEffect(() => {
    void refresh()

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }, POLL_INTERVAL_MS)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      window.clearInterval(interval)

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )

      requestRef.current?.abort()
    }
  }, [refresh])

  // ========================================
  // DELIVERY SUMMARY
  // ========================================

  const summary = health?.summary

  const inProgress =
    (summary?.PENDING ?? 0) +
    (summary?.PROCESSING ?? 0)

  const failedCount = summary?.FAILED ?? 0

  const activeDevices =
    summary?.activeDevices ?? 0

  const needsAttention = failedCount > 0

  // ========================================
  // DASHBOARD CONTENT
  // ========================================

  return (
    <section
      aria-labelledby="staff-push-health-title"
      className="rounded-[2rem] border border-brand/10 bg-white p-6 shadow-sm sm:p-8"
    >
      {/* HEADER */}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-sage p-3 text-brand">
            <BellRing
              size={23}
              aria-hidden="true"
            />
          </div>

          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-brand-light">
              Loyce Dairies · Staff operations
            </p>

            <h2
              id="staff-push-health-title"
              className="mt-1 font-display text-2xl text-brand"
            >
              Notification delivery health
            </h2>

            <p className="mt-2 text-sm text-brand/65">
              Monitor Firebase delivery attempts
              and registered Android devices.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void refresh()
          }}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-brand/20 px-4 py-2 text-sm font-bold text-brand hover:bg-sage disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={
              refreshing ? 'animate-spin' : ''
            }
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      {/* INITIAL LOADING */}

      {loading && !health && (
        <div
          role="status"
          className="mt-6 flex items-center gap-2 text-sm text-brand/70"
        >
          <LoaderCircle
            size={18}
            className="animate-spin"
            aria-hidden="true"
          />
          Loading delivery statistics...
        </div>
      )}

      {/* API ERROR */}

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={18}
              className="shrink-0"
              aria-hidden="true"
            />

            <p>
              {error}
              {health &&
                ' Previously loaded statistics are shown below.'}
            </p>
          </div>
        </div>
      )}

      {/* HEALTH CONTENT */}

      {summary && health && (
        <>
          {/* STATUS MESSAGE */}

          <div
            role="status"
            className={
              `mt-6 rounded-2xl border p-4 text-sm font-semibold ${
                needsAttention
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : activeDevices === 0
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : inProgress > 0
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : 'border-brand/10 bg-sage text-brand'
              }`
            }
          >
            {error
              ? 'Delivery health could not be refreshed.'
              : needsAttention
                ? `${failedCount} notification delivery job(s) failed permanently. Review the failures below.`
                : activeDevices === 0
                  ? 'No active Android staff devices are registered.'
                  : inProgress > 0
                    ? `${inProgress} notification job(s) are awaiting or undergoing delivery.`
                    : 'No recorded notification delivery failures.'}
          </div>

          {/* METRIC CARDS */}

          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: 'FCM accepted',
                value: summary.SENT,
                Icon: CheckCircle2,
              },
              {
                label: 'Failed',
                value: summary.FAILED,
                Icon: AlertTriangle,
              },
              {
                label: 'In progress',
                value: inProgress,
                Icon: Clock3,
              },
              {
                label: 'Active Android devices',
                value: summary.activeDevices,
                Icon: Smartphone,
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-brand/10 bg-cream p-4"
              >
                <metric.Icon
                  size={19}
                  className="text-brand/65"
                  aria-hidden="true"
                />

                <p className="mt-3 text-xs font-semibold text-brand/65">
                  {metric.label}
                </p>

                <p className="mt-1 text-2xl font-extrabold text-brand">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>

          {/* RECENT FAILURES */}

          {health.recentFailures.length > 0 && (
            <div className="mt-7">
              <h3 className="text-lg font-bold text-brand">
                Recent failed deliveries
              </h3>

              <div className="mt-3 space-y-3">
                {health.recentFailures.map(
                  (failure, index) => (
                    <div
                      key={`${failure.orderNumber}-${index}`}
                      className="rounded-2xl border border-red-200 bg-red-50 p-4"
                    >
                      <p className="font-bold text-red-900">
                        Order {failure.orderNumber}
                      </p>

                      <p className="mt-1 text-sm text-red-800">
                        Attempts: {failure.attempts}
                      </p>

                      <p className="mt-1 break-words text-sm text-red-800">
                        Error: {failure.lastErrorCode ?? 'Unknown'}
                      </p>

                      <p className="mt-2 text-xs text-red-700">
                        Last updated: {formatDate(
                          failure.updatedAt,
                        )}
                      </p>

                      <p className="mt-1 text-xs text-red-700">
                        Order status: {failure.orderStatus}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {/* FOOTER */}

          <div className="mt-6 border-t border-brand/10 pt-4">
            <p className="text-xs text-brand/55">
              Total recorded jobs: {summary.totalJobs}
              {' · '}
              Cancelled: {summary.CANCELLED}
              {' · '}
              Updated: {formatDate(health.evaluatedAt)}
            </p>

            <p className="mt-2 text-xs text-brand/55">
              Refreshes every 30 seconds while
              visible. FCM acceptance does not
              guarantee display on a device.
            </p>
          </div>
        </>
      )}
    </section>
  )
}
