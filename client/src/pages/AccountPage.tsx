
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock3,
  LogOut,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Truck,
  UserRound,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import OrderHistory from '../components/orders/OrderHistory'

// ==========================================
// LOYCE DAIRIES PLATFORM
// CUSTOMER ACCOUNT AND STAFF WORKSPACE
// MILESTONE 4.7.3
// ==========================================

export default function AccountPage() {
  const navigate = useNavigate()

  const {
    customer,
    logout,
    isSubmitting,
  } = useAuth()

  const [logoutError, setLogoutError] =
    useState<string | null>(null)

  // ProtectedRoute handles authentication.

  if (!customer) {
    return null
  }

  // ========================================
  // ACCOUNT INFORMATION
  // ========================================

  const firstName =
    customer.fullName.trim().split(/\s+/)[0] ||
    'Customer'

  const isEmailVerified =
    customer.emailVerifiedAt !== null

  // The staff workspace is shown only if
  // the session customer includes the
  // STAFF role.
  //
  // The backend independently verifies
  // staff authorization for every
  // administrative API request.

  const isStaff =
    'role' in customer &&
    customer.role === 'STAFF' &&
    isEmailVerified

  // ========================================
  // SIGN OUT
  // ========================================

  const handleLogout = async () => {
    if (isSubmitting) {
      return
    }

    setLogoutError(null)

    try {
      await logout()

      navigate('/', {
        replace: true,
      })
    } catch (error: unknown) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : 'Unable to sign out. Please try again.',
      )
    }
  }

  // ========================================
  // ACCOUNT PAGE
  // ========================================

  return (
    <main className="min-h-screen bg-cream">

      {/* ====================================
          ACCOUNT HEADER
      ==================================== */}

      <section className="bg-sage/60">
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">

          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-light">
            YOUR LOYCE ACCOUNT
          </p>

          <div className="mt-6 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">

            <div>
              <h1 className="font-display text-4xl leading-tight text-brand sm:text-5xl">
                Hello,{' '}
                <span className="italic text-brand-light">
                  {firstName}.
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-brand/65 sm:text-base">
                Welcome to your personal space at
                Loyce Dairies. Review your orders,
                manage your account, and continue
                exploring your dairy favourites.
              </p>
            </div>

            <Link
              to="/products"
              className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full bg-brand px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-light sm:self-auto"
            >
              Shop products

              <ArrowRight
                size={17}
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>
      </section>

      {/* ====================================
          ACCOUNT CONTENT
      ==================================== */}

      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">

          {/* ==================================
              MAIN ACCOUNT COLUMN
          ================================== */}

          <div className="min-w-0 space-y-8">

            {/* ==============================
                PERSONAL INFORMATION
            ============================== */}

            <section className="rounded-[2rem] border border-brand/10 bg-white p-6 sm:p-9">

              <div className="flex items-center gap-4">

                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sage text-brand">
                  <UserRound
                    size={26}
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <h2 className="font-display text-3xl text-brand">
                    Personal information
                  </h2>

                  <p className="mt-2 text-sm text-brand/60">
                    Your registered account details.
                  </p>
                </div>
              </div>

              <div className="mt-9 grid gap-6 sm:grid-cols-2">

                {/* Full name */}

                <div className="rounded-2xl bg-cream p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-brand/55">
                    <UserRound
                      size={16}
                      aria-hidden="true"
                    />

                    Full name
                  </div>

                  <p className="mt-3 break-words text-sm font-bold text-brand">
                    {customer.fullName}
                  </p>
                </div>

                {/* Email */}

                <div className="rounded-2xl bg-cream p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-brand/55">
                    <Mail
                      size={16}
                      aria-hidden="true"
                    />

                    Email address
                  </div>

                  <p className="mt-3 break-all text-sm font-bold text-brand">
                    {customer.email}
                  </p>
                </div>

                {/* Phone */}

                <div className="rounded-2xl bg-cream p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-brand/55">
                    <Phone
                      size={16}
                      aria-hidden="true"
                    />

                    Phone number
                  </div>

                  <p className="mt-3 text-sm font-bold text-brand">
                    {customer.phone || 'Not provided'}
                  </p>
                </div>

                {/* Email verification */}

                <div className="rounded-2xl bg-cream p-5">

                  <div className="flex items-center gap-2 text-xs font-semibold text-brand/55">
                    <ShieldCheck
                      size={16}
                      aria-hidden="true"
                    />

                    Email verification
                  </div>

                  <div className="mt-3 flex items-center gap-2">

                    {isEmailVerified ? (
                      <>
                        <CheckCircle2
                          size={18}
                          className="shrink-0 text-brand-light"
                          aria-hidden="true"
                        />

                        <span className="text-sm font-bold text-brand">
                          Verified
                        </span>
                      </>
                    ) : (
                      <>
                        <CircleAlert
                          size={18}
                          className="shrink-0 text-amber-600"
                          aria-hidden="true"
                        />

                        <span className="text-sm font-bold text-brand">
                          Not yet verified
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Verification prompt */}

              {!isEmailVerified && (
                <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5">

                  <p className="text-sm font-bold text-amber-900">
                    Email verification is pending
                  </p>

                  <p className="mt-2 text-xs leading-6 text-amber-800">
                    Verify your email address to
                    complete verification of your
                    Loyce Dairies account.
                  </p>

                  <Link
                    to="/verify-email"
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-xs font-bold text-white transition-colors hover:bg-brand-light"
                  >
                    Verify my email

                    <ArrowRight
                      size={16}
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              )}

              <p className="mt-7 text-xs leading-6 text-brand/50">
                Profile editing will be available
                after the account update API is
                implemented.
              </p>
            </section>

            {/* ==================================
                STAFF WORKSPACE
                MILESTONE 4.7.3
            ================================== */}

            {isStaff && (
              <section
                aria-labelledby="staff-workspace-title"
                className="rounded-[2rem] border border-brand/10 bg-white p-6 sm:p-9"
              >
                {/* Header */}

                <div className="flex items-start gap-4">

                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sage text-brand">
                    <ShieldCheck
                      size={27}
                      aria-hidden="true"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-brand-light">
                      LOYCE DAIRIES · STAFF
                    </p>

                    <h2
                      id="staff-workspace-title"
                      className="mt-2 font-display text-3xl text-brand"
                    >
                      Staff workspace
                    </h2>

                    <p className="mt-3 text-sm leading-7 text-brand/65">
                      Access authorized tools for
                      managing customer orders,
                      delivery zones, and dairy
                      product inventory.
                    </p>
                  </div>
                </div>

                {/* Staff navigation */}

                <nav
                  aria-label="Staff administration"
                  className="mt-8 grid gap-4"
                >

                  {/* Order management */}

                  <Link
                    to="/staff/orders"
                    className="group flex items-center gap-4 rounded-2xl border border-brand/10 bg-cream p-5 transition-colors hover:border-brand/30 hover:bg-sage/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-brand-light">
                      <ClipboardList
                        size={23}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-brand">
                        Order management
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-brand/60">
                        Review customer orders,
                        update fulfillment status,
                        and inspect order history.
                      </p>
                    </div>

                    <ArrowRight
                      size={19}
                      className="shrink-0 text-brand/50 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>

                  {/* Delivery zone management */}

                  <Link
                    to="/staff/delivery-zones"
                    className="group flex items-center gap-4 rounded-2xl border border-brand/10 bg-cream p-5 transition-colors hover:border-brand/30 hover:bg-sage/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-brand-light">
                      <Truck
                        size={23}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-brand">
                        Delivery-zone management
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-brand/60">
                        Manage delivery coverage,
                        configured fees, zone
                        availability, and audit history.
                      </p>
                    </div>

                    <ArrowRight
                      size={19}
                      className="shrink-0 text-brand/50 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>

                  {/* Inventory management */}

                  <Link
                    to="/staff/inventory"
                    className="group flex items-center gap-4 rounded-2xl border border-brand/10 bg-sage/50 p-5 transition-colors hover:border-brand/30 hover:bg-sage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-brand-light">
                      <Package
                        size={23}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-brand">
                        Inventory management
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-brand/60">
                        Monitor product stock,
                        record verified adjustments,
                        and review inventory movements.
                      </p>
                    </div>

                    <ArrowRight
                      size={19}
                      className="shrink-0 text-brand/50 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </nav>

                <p className="mt-6 text-xs leading-6 text-brand/50">
                  Staff operations require an
                  authenticated and verified
                  account. Permissions are checked
                  again by the backend.
                </p>
              </section>
            )}

            {/* ==================================
                REAL ORDER HISTORY
            ================================== */}

            <OrderHistory />

          </div>

          {/* ==================================
              ACCOUNT SIDEBAR
          ================================== */}

          <aside className="space-y-6">

            {/* ==============================
                ACCOUNT SESSION
            ============================== */}

            <section className="rounded-[2rem] bg-brand p-7 text-white">

              <ShieldCheck
                size={30}
                className="text-gold"
                aria-hidden="true"
              />

              <h2 className="mt-6 font-display text-3xl">
                Your account
              </h2>

              <p className="mt-3 text-sm leading-7 text-white/70">
                You're signed in to Loyce Dairies.
                Your account session is managed
                by our backend.
              </p>

              <div className="mt-6 flex items-center gap-2 text-xs text-white/70">
                <Clock3
                  size={16}
                  aria-hidden="true"
                />

                Session active
              </div>
            </section>

            {/* ==============================
                DELIVERY INFORMATION
            ============================== */}

            <section className="rounded-[2rem] border border-brand/10 bg-white p-7">

              <MapPin
                size={27}
                className="text-brand-light"
                aria-hidden="true"
              />

              <h2 className="mt-5 text-lg font-extrabold text-brand">
                Delivery information
              </h2>

              <p className="mt-3 text-sm leading-7 text-brand/60">
                Delivery is supported through
                configured zones. Saved addresses
                and delivery preferences will
                be available in a future milestone.
              </p>

              <p className="mt-4 text-xs leading-6 text-brand/50">
                Delivery availability and fees
                depend on the selected active zone.
              </p>
            </section>

            {/* ==============================
                ACCOUNT SECURITY
            ============================== */}

            <section className="rounded-[2rem] border border-brand/10 bg-white p-7">

              <h2 className="text-lg font-extrabold text-brand">
                Account security
              </h2>

              <p className="mt-3 text-sm leading-7 text-brand/60">
                Sign out when you've finished
                using your account, especially
                on a shared device.
              </p>

              <Link
                to="/forgot-password"
                className="mt-5 inline-block text-sm font-bold text-brand-light hover:text-brand"
              >
                Password recovery
              </Link>

              {logoutError && (
                <p
                  role="alert"
                  className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                  {logoutError}
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  void handleLogout()
                }}
                disabled={isSubmitting}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand/15 px-6 py-3.5 text-sm font-bold text-brand transition-colors hover:bg-sage disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut
                  size={18}
                  aria-hidden="true"
                />

                {isSubmitting
                  ? 'Signing out...'
                  : 'Sign out'}
              </button>
            </section>
          </aside>
        </div>
      </section>
    </main>
  )
}
