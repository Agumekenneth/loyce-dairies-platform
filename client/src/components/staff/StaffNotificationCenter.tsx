
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { Link } from 'react-router-dom'

import {
  AlertCircle,
  BellRing,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  RefreshCw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

import {
  getStaffNotifications,
  markStaffNotificationRead,
  type StaffNotification,
} from '../../services/staffNotificationsApi'

// ==========================================
// LOYCE DAIRIES PLATFORM
// MILESTONE 4.14
// STAFF NOTIFICATIONS AND DIRECT ORDER LINKS
// ==========================================

type StaffNotificationCenterProps = {
  mode?: 'inline' | 'floating'
}

const POLL_INTERVAL_MS = 10_000
const MAX_VISIBLE_NOTIFICATIONS = 25

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

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Unable to load staff notifications.'
}

// ==========================================
// AUDIBLE NEW-ORDER ALERT
// ==========================================

function playAlertTone(context: AudioContext): void {
  if (context.state !== 'running') {
    return
  }

  const now = context.currentTime

  for (let index = 0; index < 2; index++) {
    const start = now + index * 0.2
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value =
      index === 0 ? 880 : 660

    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(
      0.12,
      start + 0.02,
    )
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + 0.16,
    )

    oscillator.connect(gain)
    gain.connect(context.destination)

    oscillator.start(start)
    oscillator.stop(start + 0.17)
  }
}

// ==========================================
// NOTIFICATION CENTER
// ==========================================

export default function StaffNotificationCenter({
  mode = 'inline',
}: StaffNotificationCenterProps) {
  const isFloating = mode === 'floating'

  // Notification data

  const [notifications, setNotifications] =
    useState<StaffNotification[]>([])

  const [unreadCount, setUnreadCount] =
    useState(0)

  const [loading, setLoading] = useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const [latestArrival, setLatestArrival] =
    useState<string | null>(null)

  // Interface state

  const [expanded, setExpanded] = useState(true)
  const [panelOpen, setPanelOpen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)

  const [markingId, setMarkingId] =
    useState<string | null>(null)

  // Persistent references

  const audioRef = useRef<AudioContext | null>(null)

  const knownIdsRef = useRef<Set<string>>(
    new Set(),
  )

  const initializedRef = useRef(false)
  const requestVersionRef = useRef(0)

  const controllerRef =
    useRef<AbortController | null>(null)

  const soundEnabledRef = useRef(false)

  // ========================================
  // FETCH NOTIFICATIONS
  // ========================================

  const refreshNotifications = useCallback(
    async (signal: AbortSignal) => {
      const version = ++requestVersionRef.current

      try {
        const page = await getStaffNotifications({
          limit: MAX_VISIBLE_NOTIFICATIONS,
          signal,
        })

        if (
          signal.aborted ||
          version !== requestVersionRef.current
        ) {
          return
        }

        // Do not play sounds for historical
        // notifications on initial loading.

        if (initializedRef.current) {
          const newAlerts = page.notifications.filter(
            (notification) =>
              !knownIdsRef.current.has(
                notification.id,
              ),
          )

          if (newAlerts.length > 0) {
            const newest = newAlerts[0]

            setLatestArrival(
              `New order received: ${newest.order.orderNumber}`,
            )

            if (
              soundEnabledRef.current &&
              audioRef.current
            ) {
              playAlertTone(audioRef.current)
            }
          }
        }

        knownIdsRef.current = new Set(
          page.notifications.map(
            (notification) => notification.id,
          ),
        )

        initializedRef.current = true

        setNotifications(page.notifications)
        setUnreadCount(page.unreadCount)
        setError(null)
      } catch (caughtError: unknown) {
        if (signal.aborted) return

        if (version === requestVersionRef.current) {
          setError(getErrorMessage(caughtError))
        }
      } finally {
        if (
          !signal.aborted &&
          version === requestVersionRef.current
        ) {
          setLoading(false)
        }
      }
    },
    [],
  )

  // ========================================
  // PERSISTENT POLLING
  // ========================================

  useEffect(() => {
    const controller = new AbortController()

    controllerRef.current = controller

    void refreshNotifications(controller.signal)

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshNotifications(controller.signal)
      }
    }, POLL_INTERVAL_MS)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshNotifications(controller.signal)
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      controller.abort()
      window.clearInterval(interval)

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )

      controllerRef.current = null
    }
  }, [refreshNotifications])

  // ========================================
  // CLEAN UP AUDIO
  // ========================================

  useEffect(() => {
    return () => {
      const audio = audioRef.current
      audioRef.current = null

      if (audio && audio.state !== 'closed') {
        void audio.close()
      }
    }
  }, [])

  // ========================================
  // ENABLE OR DISABLE SOUND
  // ========================================

  const toggleSound = async () => {
    if (soundEnabledRef.current) {
      soundEnabledRef.current = false
      setSoundEnabled(false)
      return
    }

    try {
      let audio = audioRef.current

      if (!audio || audio.state === 'closed') {
        audio = new AudioContext()
        audioRef.current = audio
      }

      await audio.resume()

      if (audio.state !== 'running') {
        throw new Error(
          'Your browser has not enabled notification audio.',
        )
      }

      soundEnabledRef.current = true
      setSoundEnabled(true)
      setError(null)

      playAlertTone(audio)
    } catch (caughtError: unknown) {
      soundEnabledRef.current = false
      setSoundEnabled(false)
      setError(getErrorMessage(caughtError))
    }
  }

  // ========================================
  // MANUAL REFRESH
  // ========================================

  const handleRefresh = () => {
    const signal = controllerRef.current?.signal

    if (!signal || signal.aborted) {
      return
    }

    void refreshNotifications(signal)
  }

  // ========================================
  // MARK NOTIFICATION AS READ
  // ========================================

  const handleMarkRead = async (alertId: string) => {
    if (markingId !== null) return

    setMarkingId(alertId)
    setError(null)

    try {
      const result =
        await markStaffNotificationRead(alertId)

      // Prevent stale polling data from
      // overwriting the updated read status.

      requestVersionRef.current += 1

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === alertId
            ? {
                ...notification,
                isRead: true,
                readAt: result.readAt,
              }
            : notification,
        ),
      )

      setUnreadCount(result.unreadCount)
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError))
    } finally {
      setMarkingId(null)
    }
  }

  // ========================================
  // DISPLAY CONFIGURATION
  // ========================================

  const showPanel = !isFloating || panelOpen
  const showList = isFloating || expanded

  const badgeText =
    unreadCount > 99
      ? '99+'
      : String(unreadCount)

  // ========================================
  // COMPONENT RENDER
  // ========================================

  return (
    <div
      className={
        isFloating
          ? 'pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px]'
          : 'w-full'
      }
    >

      {/* FLOATING NOTIFICATION BELL */}

      {isFloating && (
        <button
          type="button"
          onClick={() => {
            setPanelOpen((current) => !current)
          }}
          aria-label={
            unreadCount > 0
              ? `Order notifications, ${unreadCount} unread`
              : 'Order notifications'
          }
          aria-expanded={panelOpen}
          aria-controls="loyce-staff-notifications"
          className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-xl transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <BellRing size={25} aria-hidden="true" />

          {unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-extrabold text-white"
              aria-hidden="true"
            >
              {badgeText}
            </span>
          )}
        </button>
      )}

      {/* FLOATING NEW-ORDER BANNER */}

      {isFloating && latestArrival && !panelOpen && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto w-full rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-lg"
        >
          <p className="text-sm font-bold text-amber-900">
            {latestArrival}
          </p>

          <button
            type="button"
            onClick={() => {
              setPanelOpen(true)
              setLatestArrival(null)
            }}
            className="mt-2 text-xs font-bold text-amber-800 underline"
          >
            View notification
          </button>
        </div>
      )}

      {/* NOTIFICATION PANEL */}

      {showPanel && (
        <section
          id="loyce-staff-notifications"
          aria-labelledby={
            isFloating
              ? 'floating-staff-notifications-title'
              : 'staff-notifications-title'
          }
          className={
            isFloating
              ? 'pointer-events-auto max-h-[70vh] w-full overflow-y-auto rounded-[1.5rem] border border-brand/10 bg-white p-5 shadow-2xl sm:p-6'
              : 'rounded-[2rem] border border-brand/10 bg-white p-6 sm:p-8'
          }
        >

          {/* PANEL HEADER */}

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">

              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sage text-brand">
                <BellRing
                  size={24}
                  aria-hidden="true"
                />

                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                    {badgeText}
                  </span>
                )}
              </div>

              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-brand-light">
                  Loyce Dairies · Staff
                </p>

                <h2
                  id={
                    isFloating
                      ? 'floating-staff-notifications-title'
                      : 'staff-notifications-title'
                  }
                  className="mt-1 font-display text-2xl text-brand"
                >
                  Order notifications
                </h2>

                <p className="mt-2 text-sm text-brand/60">
                  {unreadCount === 0
                    ? 'No unread notifications'
                    : `${unreadCount} unread ${
                        unreadCount === 1
                          ? 'notification'
                          : 'notifications'
                      }`}
                </p>
              </div>
            </div>

            {isFloating ? (
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-label="Close notifications"
                className="rounded-full p-2 text-brand hover:bg-sage"
              >
                <X size={20} aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setExpanded((value) => !value)
                }}
                aria-expanded={expanded}
                className="inline-flex items-center gap-2 rounded-full border border-brand/15 px-4 py-2 text-sm font-bold text-brand hover:bg-sage"
              >
                {expanded ? (
                  <ChevronUp size={16} aria-hidden="true" />
                ) : (
                  <ChevronDown size={16} aria-hidden="true" />
                )}

                {expanded ? 'Collapse' : 'View alerts'}
              </button>
            )}
          </div>

          {/* NEW-ORDER MESSAGE */}

          {latestArrival && (
            <div
              role="status"
              aria-live="polite"
              className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4"
            >
              <p className="font-bold text-amber-900">
                {latestArrival}
              </p>

              <p className="mt-1 text-xs text-amber-800">
                Review the new customer order.
              </p>
            </div>
          )}

          {/* NOTIFICATION CONTENT */}

          {showList && (
            <div className="mt-7">

              {/* CONTROLS */}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void toggleSound()
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-brand/15 px-4 py-2 text-xs font-bold text-brand hover:bg-sage"
                >
                  {soundEnabled ? (
                    <Volume2 size={16} aria-hidden="true" />
                  ) : (
                    <VolumeX size={16} aria-hidden="true" />
                  )}

                  {soundEnabled
                    ? 'Sound enabled'
                    : 'Enable alert sound'}
                </button>

                <button
                  type="button"
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-2 rounded-full border border-brand/15 px-4 py-2 text-xs font-bold text-brand hover:bg-sage"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  Refresh
                </button>

                <span className="text-xs text-brand/50">
                  Checks every 10 seconds
                </span>
              </div>

              {/* ERROR MESSAGE */}

              {error && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                  <AlertCircle
                    size={19}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                  <p>{error}</p>
                </div>
              )}

              {/* LOADING */}

              {loading && (
                <div
                  role="status"
                  className="mt-8 flex items-center gap-2 text-sm text-brand/60"
                >
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Loading notifications...
                </div>
              )}

              {/* EMPTY STATE */}

              {!loading &&
                notifications.length === 0 &&
                !error && (
                  <div className="mt-7 rounded-2xl bg-cream p-8 text-center">
                    <BellRing
                      size={30}
                      className="mx-auto text-brand/40"
                      aria-hidden="true"
                    />

                    <p className="mt-4 font-semibold text-brand">
                      No order notifications yet
                    </p>

                    <p className="mt-2 text-sm text-brand/60">
                      New customer orders will appear here.
                    </p>
                  </div>
                )}

              {/* NOTIFICATION HISTORY */}

              <div className="mt-6 space-y-3">
                {notifications.map((notification) => (
                  <article
                    key={notification.id}
                    className={`rounded-2xl border p-5 ${
                      notification.isRead
                        ? 'border-brand/10 bg-white'
                        : 'border-brand/20 bg-sage/50'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-brand">
                          {notification.title}
                        </p>

                        <p className="mt-2 break-all text-sm text-brand/75">
                          {notification.order.orderNumber}
                        </p>

                        <p className="mt-1 text-xs text-brand/55">
                          {formatDate(notification.createdAt)}
                        </p>
                      </div>

                      {!notification.isRead && (
                        <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
                          Unread
                        </span>
                      )}
                    </div>

                    <p className="mt-4 text-sm text-brand/70">
                      {notification.order.recipientName}
                      {' · '}
                      UGX{' '}
                      {notification.order.totalUgx.toLocaleString(
                        'en-UG',
                      )}
                    </p>

                    <p className="mt-2 text-xs text-brand/55">
                      Status:{' '}
                      {notification.order.status.replaceAll(
                        '_',
                        ' ',
                      )}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-3">

                      {/* ==================================
                          MILESTONE 4.14
                          DIRECT ORDER NAVIGATION
                      ================================== */}

                      <Link
                        to={`/staff/orders?orderId=${encodeURIComponent(
                          notification.orderId,
                        )}`}
                        onClick={() => {
                          if (isFloating) {
                            setPanelOpen(false)
                          }
                        }}
                        className="inline-flex items-center rounded-full bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand-light"
                      >
                        Review orders
                      </Link>

                      {/* MARK AS READ */}

                      {!notification.isRead && (
                        <button
                          type="button"
                          disabled={markingId !== null}
                          onClick={() => {
                            void handleMarkRead(notification.id)
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-brand/20 px-4 py-2 text-xs font-bold text-brand hover:bg-sage disabled:opacity-50"
                        >
                          <CheckCheck
                            size={15}
                            aria-hidden="true"
                          />

                          {markingId === notification.id
                            ? 'Saving...'
                            : 'Mark as read'}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              {notifications.length >=
                MAX_VISIBLE_NOTIFICATIONS && (
                  <p className="mt-5 text-xs text-brand/50">
                    Showing the most recent 25 notifications.
                  </p>
                )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
