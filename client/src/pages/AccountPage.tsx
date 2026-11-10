
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  ShoppingBag,
  UserRound,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'

export default function AccountPage() {
  const navigate = useNavigate()

  const {
    customer,
    logout,
    isSubmitting,
  } = useAuth()

  const [logoutError, setLogoutError] = useState<
    string | null
  >(null)

  // ProtectedRoute ensures that only authenticated
  // customers can access this page.
  if (!customer) {
    return null
  }

  const firstName =
    customer.fullName.trim().split(/\s+/)[0] || 'Customer'

  const isEmailVerified =
    customer.emailVerifiedAt !== null

  const handleLogout = async () => {
    if (isSubmitting) return

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

  return (
    <main className="min-h-screen bg-cream">
      {/* ======================================
          ACCOUNT PAGE HEADER
      ====================================== */}
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
                Welcome to your personal space at Loyce
                Dairies. Manage your account and continue
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

      {/* ======================================
          ACCOUNT CONTENT
      ====================================== */}
      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Customer profile */}
          <div className="space-y-8">
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

                {/* Verification */}
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

              {!isEmailVerified && (
                <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                  <p className="text-sm font-bold text-amber-900">
                    Email verification is pending
                  </p>

                  <p className="mt-2 text-xs leading-6 text-amber-800">
                    Email verification will be enabled
                    in an upcoming security milestone.
                  </p>
                </div>
              )}

              <p className="mt-7 text-xs leading-6 text-brand/50">
                Profile editing will be available after
                the account update API is implemented.
              </p>
            </section>

            {/* Order history */}
            <section className="rounded-[2rem] border border-brand/10 bg-white p-6 sm:p-9">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sage text-brand">
                  <ShoppingBag
                    size={26}
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <h2 className="font-display text-3xl text-brand">
                    My orders
                  </h2>

                  <p className="mt-2 text-sm text-brand/60">
                    Your dairy shopping history.
                  </p>
                </div>
              </div>

              <div className="mt-9 rounded-2xl bg-cream px-6 py-12 text-center">
                <ShoppingBag
                  size={39}
                  className="mx-auto text-brand/35"
                  aria-hidden="true"
                />

                <h3 className="mt-5 font-display text-2xl text-brand">
                  Order history coming soon
                </h3>

                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-brand/60">
                  Once checkout and order management are
                  implemented, you'll be able to view your
                  purchases and order progress here.
                </p>

                <Link
                  to="/products"
                  className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-light"
                >
                  Explore products
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </section>
          </div>

          {/* Account sidebar */}
          <aside className="space-y-6">
            {/* Account status */}
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
                Your account session is managed securely
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

            {/* Delivery */}
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
                Delivery services are planned for
                supported areas within Mbarara District.
                Saved addresses will be available when
                the delivery system is implemented.
              </p>
            </section>

            {/* Logout */}
            <section className="rounded-[2rem] border border-brand/10 bg-white p-7">
              <h2 className="text-lg font-extrabold text-brand">
                Account security
              </h2>

              <p className="mt-3 text-sm leading-7 text-brand/60">
                Sign out when you've finished using
                your account, especially on a shared device.
              </p>

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
