
import { useState } from 'react'
import {
  Link,
  NavLink,
  useNavigate,
} from 'react-router-dom'

import {
  ChevronDown,
  LogOut,
  MapPin,
  Menu,
  Milk,
  ShoppingBag,
  UserRound,
  X,
} from 'lucide-react'

import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'

// ==========================================
// NAVBAR PROPS
// ==========================================

type NavbarProps = {
  onShopClick: () => void
}

// ==========================================
// MAIN NAVBAR COMPONENT
// ==========================================

export default function Navbar({
  onShopClick,
}: NavbarProps) {
  const navigate = useNavigate()

  // Navigation state
  const [menuOpen, setMenuOpen] = useState(false)

  const [logoutError, setLogoutError] = useState<
    string | null
  >(null)

  // Shopping cart
  const {
    cartCount,
    openCart,
  } = useCart()

  // Customer authentication
  const {
    customer,
    status,
    isAuthenticated,
    isLoading,
    isSubmitting,
    logout,
  } = useAuth()

  const isGuest = status === 'guest'
  const isAuthError = status === 'error'

  // ==========================================
  // NAVIGATION HANDLERS
  // ==========================================

  const closeMenu = () => {
    setMenuOpen(false)
    setLogoutError(null)
  }

  const handleShopClick = () => {
    closeMenu()
    onShopClick()
  }

  const handleCartClick = () => {
    closeMenu()
    openCart()
  }

  // ==========================================
  // CUSTOMER LOGOUT
  // ==========================================

  const handleLogout = async () => {
    if (isSubmitting) return

    setLogoutError(null)

    try {
      await logout()

      setMenuOpen(false)

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
    <>
      {/* ======================================
          ANNOUNCEMENT BAR
      ====================================== */}

      <div className="bg-brand px-4 py-2.5 text-center text-xs font-medium text-white sm:text-sm">
        Fresh dairy delivered with care in Mbarara
      </div>

      {/* ======================================
          MAIN HEADER
      ====================================== */}

      <header className="sticky top-0 z-30 border-b border-brand/10 bg-cream/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">

          {/* ==================================
              LOYCE DAIRIES BRAND
          ================================== */}

          <Link
            to="/"
            onClick={closeMenu}
            aria-label="Loyce Dairies home"
            className="flex shrink-0 items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white">
              <Milk
                size={24}
                strokeWidth={1.7}
                aria-hidden="true"
              />
            </div>

            <div>
              <span className="block text-lg font-extrabold tracking-tight text-brand">
                loyce
                <span className="text-brand-light">
                  .
                </span>
              </span>

              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-brand/60">
                Dairies
              </span>
            </div>
          </Link>

          {/* ==================================
              DESKTOP NAVIGATION
          ================================== */}

          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-7 text-sm font-semibold text-brand/80 md:flex"
          >
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive
                  ? 'text-brand-light'
                  : 'transition-colors hover:text-brand-light'
              }
            >
              Home
            </NavLink>

            <button
              type="button"
              onClick={handleShopClick}
              className="transition-colors hover:text-brand-light"
            >
              Shop products
            </button>

            <Link
              to="/#why-us"
              className="transition-colors hover:text-brand-light"
            >
              Why Loyce?
            </Link>
          </nav>

          {/* ==================================
              HEADER ACTIONS
          ================================== */}

          <div className="flex items-center gap-2 sm:gap-3">

            {/* Location */}
            <span className="hidden items-center gap-1 text-xs font-semibold text-brand/70 xl:flex">
              <MapPin
                size={15}
                aria-hidden="true"
              />

              Mbarara, Uganda

              <ChevronDown
                size={13}
                aria-hidden="true"
              />
            </span>

            {/* ==================================
                GUEST ACCOUNT NAVIGATION
            ================================== */}

            {isGuest && (
              <>
                {/* Desktop sign in */}
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="hidden items-center gap-2 text-sm font-bold text-brand transition-colors hover:text-brand-light lg:inline-flex"
                >
                  <UserRound
                    size={18}
                    aria-hidden="true"
                  />

                  Sign in
                </Link>

                {/* Desktop registration */}
                <Link
                  to="/register"
                  onClick={closeMenu}
                  className="hidden rounded-full bg-brand px-5 py-3 text-xs font-bold text-white transition-colors hover:bg-brand-light lg:inline-flex"
                >
                  Create account
                </Link>

                {/* Tablet sign in */}
                <Link
                  to="/login"
                  onClick={closeMenu}
                  aria-label="Sign in"
                  className="hidden h-11 w-11 items-center justify-center rounded-full border border-brand/15 text-brand transition-colors hover:bg-sage md:flex lg:hidden"
                >
                  <UserRound
                    size={19}
                    aria-hidden="true"
                  />
                </Link>
              </>
            )}

            {/* ==================================
                AUTHENTICATED CUSTOMER
            ================================== */}

            {!isLoading && isAuthenticated && (
              <>
                {/* My Account link */}
                <NavLink
                  to="/account"
                  onClick={closeMenu}
                  aria-label="My account"
                  className={({ isActive }) =>
                    `hidden items-center gap-2 rounded-full border px-3 py-2.5 text-sm font-bold transition-colors md:inline-flex ${
                      isActive
                        ? 'border-brand-light bg-sage text-brand'
                        : 'border-brand/15 text-brand hover:bg-sage'
                    }`
                  }
                >
                  <UserRound
                    size={19}
                    aria-hidden="true"
                  />

                  <span className="hidden max-w-28 truncate lg:inline">
                    {customer?.fullName || 'My account'}
                  </span>
                </NavLink>

                {/* Desktop sign out */}
                <button
                  type="button"
                  onClick={() => {
                    void handleLogout()
                  }}
                  disabled={isSubmitting}
                  aria-label="Sign out"
                  title="Sign out"
                  className="hidden h-11 w-11 items-center justify-center rounded-full border border-brand/15 text-brand transition-colors hover:bg-sage disabled:cursor-not-allowed disabled:opacity-40 lg:flex"
                >
                  <LogOut
                    size={18}
                    aria-hidden="true"
                  />
                </button>
              </>
            )}

            {/* ==================================
                SHOPPING CART
            ================================== */}

            <button
              type="button"
              onClick={handleCartClick}
              aria-label={`Open shopping cart with ${cartCount} items`}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand/15 text-brand transition-colors hover:bg-sage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <ShoppingBag
                size={20}
                aria-hidden="true"
              />

              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-brand">
                  {cartCount}
                </span>
              )}
            </button>

            {/* ==================================
                MOBILE MENU TOGGLE
            ================================== */}

            <button
              type="button"
              onClick={() => {
                setMenuOpen((current) => !current)
              }}
              aria-label={
                menuOpen
                  ? 'Close navigation menu'
                  : 'Open navigation menu'
              }
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand/15 text-brand transition-colors hover:bg-sage md:hidden"
            >
              {menuOpen ? (
                <X
                  size={21}
                  aria-hidden="true"
                />
              ) : (
                <Menu
                  size={21}
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
        </div>

        {/* ======================================
            MOBILE NAVIGATION
        ====================================== */}

        {menuOpen && (
          <nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="space-y-4 border-t border-brand/10 px-6 py-5 text-sm font-semibold text-brand md:hidden"
          >
            {/* Home */}
            <Link
              to="/"
              onClick={closeMenu}
              className="block transition-colors hover:text-brand-light"
            >
              Home
            </Link>

            {/* Products */}
            <button
              type="button"
              onClick={handleShopClick}
              className="block transition-colors hover:text-brand-light"
            >
              Shop products
            </button>

            {/* Why Loyce */}
            <Link
              to="/#why-us"
              onClick={closeMenu}
              className="block transition-colors hover:text-brand-light"
            >
              Why Loyce?
            </Link>

            {/* ==================================
                MOBILE ACCOUNT SECTION
            ================================== */}

            <div className="border-t border-brand/10 pt-5">

              {/* Guest links */}
              {isGuest && (
                <div className="space-y-4">
                  <Link
                    to="/login"
                    onClick={closeMenu}
                    className="flex items-center gap-2 text-brand"
                  >
                    <UserRound
                      size={17}
                      aria-hidden="true"
                    />

                    Sign in
                  </Link>

                  <Link
                    to="/register"
                    onClick={closeMenu}
                    className="block font-bold text-brand-light"
                  >
                    Create account
                  </Link>
                </div>
              )}

              {/* Authenticated customer links */}
              {!isLoading && isAuthenticated && (
                <div className="space-y-5">

                  {/* Customer identity */}
                  <div className="rounded-2xl bg-sage p-4">
                    <p className="text-xs font-medium text-brand/60">
                      Signed in as
                    </p>

                    <p className="mt-1 break-words text-sm font-extrabold text-brand">
                      {customer?.fullName}
                    </p>

                    <p className="mt-1 break-all text-xs text-brand/60">
                      {customer?.email}
                    </p>
                  </div>

                  {/* My Account */}
                  <NavLink
                    to="/account"
                    onClick={closeMenu}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
                        isActive
                          ? 'bg-sage text-brand-light'
                          : 'text-brand hover:bg-sage'
                      }`
                    }
                  >
                    <UserRound
                      size={19}
                      aria-hidden="true"
                    />

                    My account
                  </NavLink>

                  {/* Sign out */}
                  <button
                    type="button"
                    onClick={() => {
                      void handleLogout()
                    }}
                    disabled={isSubmitting}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <LogOut
                      size={18}
                      aria-hidden="true"
                    />

                    {isSubmitting
                      ? 'Signing out...'
                      : 'Sign out'}
                  </button>
                </div>
              )}

              {/* Session verification status */}
              {isLoading && (
                <p
                  role="status"
                  className="text-xs text-brand/60"
                >
                  Checking your account...
                </p>
              )}

              {isAuthError && (
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="text-sm font-semibold text-brand-light"
                >
                  Sign in to your account
                </Link>
              )}
            </div>
          </nav>
        )}

        {/* ======================================
            LOGOUT ERROR FEEDBACK
        ====================================== */}

        {logoutError && (
          <div
            role="alert"
            className="border-t border-red-100 bg-red-50 px-5 py-3 text-center text-xs text-red-700"
          >
            {logoutError}
          </div>
        )}
      </header>
    </>
  )
}
