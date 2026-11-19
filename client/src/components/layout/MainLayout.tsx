
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  Outlet,
  useNavigate,
} from 'react-router-dom'

import { Capacitor } from '@capacitor/core'

import {
  BellRing,
  CheckCircle2,
  LoaderCircle,
  Smartphone,
} from 'lucide-react'

import Navbar from './Navbar'
import Footer from './Footer'
import CartDrawer from './CartDrawer'
import ScrollManager from './ScrollManager'

import StaffNotificationCenter from '../staff/StaffNotificationCenter'

import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'

import {
  registerStaffPushDevice,
} from '../../services/staffPushRegistration'

// ==========================================
// LOYCE DAIRIES PLATFORM
// MAIN APPLICATION LAYOUT
//
// Automatic Firebase registration refresh
// for previously opted-in staff devices.
// ==========================================

type RegistrationStatus =
  | 'idle'
  | 'registering'
  | 'success'
  | 'error'

// ==========================================
// DEVICE NOTIFICATION PREFERENCE
// ==========================================

// Store only a consent preference.
// Never store Firebase registration tokens
// in localStorage.

const PUSH_CONSENT_PREFIX =
  'loyce.staffPush.enabled.'

function hasPushConsent(
  staffId: string,
): boolean {
  try {
    return (
      window.localStorage.getItem(
        PUSH_CONSENT_PREFIX + staffId,
      ) === '1'
    )
  } catch {
    return false
  }
}

function savePushConsent(
  staffId: string,
): void {
  try {
    window.localStorage.setItem(
      PUSH_CONSENT_PREFIX + staffId,
      '1',
    )
  } catch {
    // Storage may be unavailable.
    // Manual registration still works.
  }
}

// ==========================================
// ANDROID STAFF PUSH REGISTRATION
// ==========================================

function StaffPushRegistrationControl({
  staffId,
}: {
  staffId: string
}) {
  const [status, setStatus] =
    useState<RegistrationStatus>('idle')

  const [message, setMessage] =
    useState<string | null>(null)

  const [automatic, setAutomatic] =
    useState(false)

  // Prevent duplicate Firebase requests
  // while registration is in progress.

  const inFlightRef = useRef(false)

  // Avoid updating the interface after
  // a staff member signs out.

  const mountedRef = useRef(true)

  // ========================================
  // REGISTER OR REFRESH STAFF DEVICE
  // ========================================

  const performRegistration = useCallback(
    async (
      isAutomatic: boolean,
    ): Promise<void> => {
      if (inFlightRef.current) {
        return
      }

      inFlightRef.current = true

      if (mountedRef.current) {
        setStatus('registering')
        setAutomatic(isAutomatic)
        setMessage(null)
      }

      try {
        // This service performs:
        //
        // 1. Android platform verification
        // 2. Notification permission check
        // 3. Native notification channel setup
        // 4. Firebase token retrieval
        // 5. Authenticated backend registration
        //
        // The backend refreshes lastSeenAt
        // and verifies the staff account.

        await registerStaffPushDevice()

        // Save consent only after successful
        // backend registration.
        //
        // This preference is associated with
        // the current staff account.

        savePushConsent(staffId)

        if (mountedRef.current) {
          setStatus('success')

          setMessage(
            isAutomatic
              ? 'Push alerts refreshed automatically for this staff account.'
              : 'Push alerts enabled. New customer orders can now notify this Android device.',
          )
        }
      } catch (error: unknown) {
        if (mountedRef.current) {
          setStatus('error')

          const explanation =
            error instanceof Error
              ? error.message
              : 'Unable to register this Android device.'

          setMessage(
            isAutomatic
              ? `Automatic refresh failed: ${explanation}`
              : explanation,
          )
        }
      } finally {
        inFlightRef.current = false
      }
    },
    [staffId],
  )

  // ========================================
  // AUTOMATIC REFRESH ON STAFF SIGN-IN
  // ========================================

  useEffect(() => {
    mountedRef.current = true

    // Automatic registration is permitted
    // only when this same staff account
    // previously enabled push alerts.
    //
    // First-time activation remains an
    // explicit user action.

    if (hasPushConsent(staffId)) {
      void performRegistration(true)
    }

    return () => {
      mountedRef.current = false
    }
  }, [staffId, performRegistration])

  // ========================================
  // REGISTRATION INTERFACE
  // ========================================

  return (
    <section
      aria-label="Android push notification setup"
      className="border-b border-brand/10 bg-sage px-5 py-5"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white p-3 text-brand">
            {status === 'success' ? (
              <CheckCircle2 size={22} />
            ) : (
              <Smartphone size={22} />
            )}
          </div>

          <div>
            <h2 className="font-bold text-brand">
              Android push notifications
            </h2>

            <p className="mt-1 text-sm text-brand/70">
              Receive audible new-order alerts,
              including when the application
              is in the background.
            </p>

            {message && (
              <p
                role={
                  status === 'error'
                    ? 'alert'
                    : 'status'
                }
                className={
                  status === 'error'
                    ? 'mt-2 text-sm font-semibold text-red-700'
                    : 'mt-2 text-sm font-semibold text-brand'
                }
              >
                {message}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void performRegistration(false)
          }}
          disabled={status === 'registering'}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
        >
          {status === 'registering' ? (
            <LoaderCircle
              size={17}
              className="animate-spin"
            />
          ) : status === 'success' ? (
            <CheckCircle2 size={17} />
          ) : (
            <BellRing size={17} />
          )}

          {status === 'registering'
            ? automatic
              ? 'Refreshing push alerts...'
              : 'Registering device...'
            : status === 'success'
              ? 'Refresh registration'
              : 'Register for push alerts'}
        </button>
      </div>
    </section>
  )
}

// ==========================================
// MAIN APPLICATION LAYOUT
// ==========================================

export default function MainLayout() {
  const navigate = useNavigate()

  const { closeCart } = useCart()

  const {
    customer,
    isAuthenticated,
  } = useAuth()

  const isStaff =
    isAuthenticated &&
    customer !== null &&
    customer.role === 'STAFF' &&
    customer.emailVerifiedAt !== null

  const isNativeAndroid =
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android'

  const goToProducts = () => {
    closeCart()
    navigate('/products')
  }

  return (
    <div className="min-h-screen bg-cream text-brand">

      <ScrollManager />

      <Navbar
        onShopClick={goToProducts}
      />

      {/* STAFF ANDROID FIREBASE REGISTRATION */}

      {isStaff && isNativeAndroid && customer && (
        <StaffPushRegistrationControl
          key={customer.id}
          staffId={customer.id}
        />
      )}

      {/* ACTIVE APPLICATION PAGE */}

      <Outlet />

      <Footer />

      <CartDrawer />

      {/* EXISTING WORKING STAFF ALERTS */}

      {isStaff && (
        <StaffNotificationCenter
          mode="floating"
        />
      )}

    </div>
  )
}
