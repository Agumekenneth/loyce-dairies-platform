
import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  Link,
  useNavigate,
} from 'react-router-dom'

import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Minus,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react'

import { useCart } from '../../context/CartContext'
import { useCatalog } from '../../context/CatalogContext'
import { formatPrice } from '../../data/products'

// ==========================================
// LOYCE DAIRIES PLATFORM
// SHOPPING CART DRAWER
//
// MILESTONE 4.9.3F
// STOCK-AWARE CUSTOMER BASKET
// ==========================================

const MAX_CART_QUANTITY = 99

// ==========================================
// CART DRAWER COMPONENT
// ==========================================

export default function CartDrawer() {
  const navigate = useNavigate()

  // ========================================
  // CART CONTEXT
  // ========================================

  const {
    cartProducts,
    cartCount,
    cartTotal,
    cartOpen,
    closeCart,
    updateCart,
    clearCart,
  } = useCart()

  // ========================================
  // CATALOGUE CONTEXT
  // ========================================

  const {
    status,
    reloadCatalog,
  } = useCatalog()

  const isLoading = status === 'loading'
  const hasError = status === 'error'
  const isReady = status === 'ready'

  // ========================================
  // LOCAL STATE AND REFS
  // ========================================

  const [confirmClear, setConfirmClear] =
    useState(false)

  const closeButtonRef =
    useRef<HTMLButtonElement>(null)

  const confirmButtonRef =
    useRef<HTMLButtonElement>(null)

  const panelRef =
    useRef<HTMLElement>(null)

  const previousFocusRef =
    useRef<HTMLElement | null>(null)

  const confirmClearRef = useRef(false)

  // ========================================
  // CHECKOUT ELIGIBILITY
  // ========================================

  /**
   * CartContext only exposes products
   * that remain in the active public
   * catalogue and have confirmed stock.
   *
   * The checkout button also validates
   * the current basket state.
   */

  const hasValidItems =
    cartProducts.length > 0 &&
    cartProducts.every(
      ({ product, quantity }) =>
        product.inStock === true &&
        quantity > 0,
    )

  const canCheckout =
    isReady &&
    cartCount > 0 &&
    hasValidItems &&
    !confirmClear

  // ========================================
  // REFRESH CATALOGUE WHEN DRAWER OPENS
  // ========================================

  /**
   * Prices, product activation and stock
   * availability may have changed since
   * the customer last visited the shop.
   *
   * Refresh the public catalogue when
   * the basket opens.
   *
   * CartContext reconciles saved basket
   * items after a successful refresh.
   *
   * Temporary API failures do not remove
   * the saved basket.
   */

  useEffect(() => {
    if (!cartOpen) return

    reloadCatalog()
  }, [
    cartOpen,
    reloadCatalog,
  ])

  // ========================================
  // SYNCHRONIZE CONFIRMATION REF
  // ========================================

  useEffect(() => {
    confirmClearRef.current = confirmClear
  }, [confirmClear])

  // ========================================
  // ACCESSIBILITY AND SCROLL MANAGEMENT
  // ========================================

  useEffect(() => {
    if (!cartOpen) return

    // Remember the element that opened
    // the shopping cart.

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    // Disable background scrolling.

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow = 'hidden'

    // Move keyboard focus into the drawer.

    closeButtonRef.current?.focus()

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      // ====================================
      // ESCAPE KEY
      // ====================================

      if (event.key === 'Escape') {
        event.preventDefault()

        if (confirmClearRef.current) {
          setConfirmClear(false)
        } else {
          closeCart()
        }

        return
      }

      // ====================================
      // KEYBOARD FOCUS TRAP
      // ====================================

      if (event.key !== 'Tab') return

      const panel = panelRef.current

      if (!panel) return

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          [
            'button:not([disabled])',
            'a[href]',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
          ].join(', '),
        ),
      ).filter(
        (element) =>
          element.getClientRects().length > 0,
      )

      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      // If focus has moved outside the
      // drawer, return it to the panel.

      if (
        !panel.contains(
          document.activeElement,
        )
      ) {
        event.preventDefault()

        if (event.shiftKey) {
          last.focus()
        } else {
          first.focus()
        }

        return
      }

      // Wrap backward navigation.

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault()
        last.focus()
      }

      // Wrap forward navigation.

      if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener(
      'keydown',
      handleKeyDown,
    )

    // ====================================
    // CLEANUP
    // ====================================

    return () => {
      document.body.style.overflow =
        previousOverflow

      document.removeEventListener(
        'keydown',
        handleKeyDown,
      )

      previousFocusRef.current?.focus()
    }
  }, [
    cartOpen,
    closeCart,
  ])

  // ========================================
  // RESET CLEAR CONFIRMATION
  // ========================================

  useEffect(() => {
    if (!cartOpen) {
      setConfirmClear(false)
    }
  }, [cartOpen])

  // ========================================
  // FOCUS CONFIRMATION BUTTON
  // ========================================

  useEffect(() => {
    if (
      cartOpen &&
      confirmClear
    ) {
      confirmButtonRef.current?.focus()
    }
  }, [
    cartOpen,
    confirmClear,
  ])

  // ========================================
  // NAVIGATION HANDLERS
  // ========================================

  function handleExploreProducts() {
    closeCart()
    navigate('/products')
  }

  function handleClearCart() {
    clearCart()
    setConfirmClear(false)
  }

  function handleCheckout() {
    if (!canCheckout) {
      return
    }

    closeCart()

    // ProtectedRoute handles authentication.
    // The backend validates stock and prices
    // again when the order is submitted.

    navigate('/checkout')
  }

  // ========================================
  // DO NOT RENDER CLOSED DRAWER
  // ========================================

  if (!cartOpen) {
    return null
  }

  // ========================================
  // DRAWER RENDER
  // ========================================

  return (
    <div className="fixed inset-0 z-50">

      {/* ====================================
          BACKGROUND OVERLAY
      ==================================== */}

      <button
        type="button"
        aria-label="Close shopping cart"
        onClick={closeCart}
        tabIndex={-1}
        className="absolute inset-0 bg-black/45"
      />

      {/* ====================================
          DRAWER PANEL
      ==================================== */}

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        aria-describedby="cart-description"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream p-5 shadow-2xl sm:p-6"
      >

        {/* ==================================
            DRAWER HEADER
        ================================== */}

        <div className="flex items-start justify-between gap-4 border-b border-brand/10 pb-5">

          <div>
            <h2
              id="cart-title"
              className="font-display text-3xl text-brand"
            >
              Your basket
            </h2>

            <p
              id="cart-description"
              className="mt-2 text-xs leading-5 text-brand/60"
            >
              Fresh dairy from Loyce Dairies.
            </p>

            <p
              aria-live="polite"
              className="mt-2 text-xs font-bold text-brand-light"
            >
              {cartCount}{' '}
              {cartCount === 1
                ? 'item'
                : 'items'}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage text-brand transition-colors hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <X
              size={20}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* ==================================
            REFRESH AVAILABILITY
        ================================== */}

        <div className="flex items-center justify-between gap-3 border-b border-brand/10 py-4">

          <div className="flex items-center gap-2 text-xs text-brand/60">
            {isLoading ? (
              <LoaderCircle
                size={15}
                className="animate-spin text-brand-light"
                aria-hidden="true"
              />
            ) : isReady ? (
              <CheckCircle2
                size={15}
                className="text-brand-light"
                aria-hidden="true"
              />
            ) : (
              <AlertCircle
                size={15}
                className="text-amber-700"
                aria-hidden="true"
              />
            )}

            <span>
              {isLoading
                ? 'Checking availability...'
                : isReady
                  ? 'Catalogue information loaded'
                  : 'Catalogue unavailable'}
            </span>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={reloadCatalog}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-brand-light transition-colors hover:bg-sage disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
            />

            Refresh
          </button>
        </div>

        {/* ==================================
            CART CONTENT
        ================================== */}

        <div className="min-h-0 flex-1 overflow-y-auto py-6">

          {/* ================================
              CATALOGUE LOADING
          ================================ */}

          {isLoading ? (
            <div
              role="status"
              className="flex h-full flex-col items-center justify-center px-4 text-center"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sage">
                <LoaderCircle
                  size={36}
                  className="animate-spin text-brand-light"
                  aria-hidden="true"
                />
              </div>

              <h3 className="mt-6 font-display text-2xl text-brand">
                Checking your basket
              </h3>

              <p className="mt-3 max-w-xs text-sm leading-6 text-brand/60">
                Retrieving the latest dairy product
                prices and stock availability.
              </p>
            </div>
          ) : hasError ? (

            /* ================================
                CATALOGUE ERROR
            ================================ */

            <div
              role="alert"
              className="flex h-full flex-col items-center justify-center px-4 text-center"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
                <AlertCircle
                  size={36}
                  className="text-amber-700"
                  aria-hidden="true"
                />
              </div>

              <h3 className="mt-6 font-display text-2xl text-brand">
                Basket temporarily unavailable
              </h3>

              <p className="mt-3 max-w-xs text-sm leading-6 text-brand/60">
                We couldn't retrieve the latest
                catalogue information. Your saved
                basket quantities are preserved.
              </p>

              <button
                type="button"
                onClick={reloadCatalog}
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-light"
              >
                <RefreshCw
                  size={17}
                  aria-hidden="true"
                />

                Try again
              </button>
            </div>
          ) : cartProducts.length === 0 ? (

            /* ================================
                EMPTY CART
            ================================ */

            <div className="flex h-full flex-col items-center justify-center px-4 text-center">

              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sage">
                <ShoppingBag
                  size={36}
                  className="text-brand/50"
                  aria-hidden="true"
                />
              </div>

              <h3 className="mt-6 font-display text-2xl text-brand">
                Your basket is empty
              </h3>

              <p className="mt-3 max-w-xs text-sm leading-6 text-brand/60">
                Browse our dairy products to discover
                what's currently available.
              </p>

              <button
                type="button"
                onClick={handleExploreProducts}
                className="mt-7 rounded-full bg-brand px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-light"
              >
                Explore products
              </button>
            </div>
          ) : (

            /* ================================
                CART PRODUCTS
            ================================ */

            <div className="space-y-5">

              {cartProducts.map(({
                product,
                quantity,
                lineTotal,
              }) => {
                const hasImage =
                  product.image.trim().length > 0

                const canIncrease =
                  isReady &&
                  product.inStock === true &&
                  quantity < MAX_CART_QUANTITY

                return (
                  <article
                    key={product.id}
                    className="border-b border-brand/10 pb-5"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">

                      {/* Product image */}

                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-sage">

                        {hasImage ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-brand/40">
                            <Package
                              size={30}
                              aria-hidden="true"
                            />
                          </div>
                        )}
                      </div>

                      {/* Product details */}

                      <div className="min-w-0 flex-1">

                        <Link
                          to={`/products/${product.id}`}
                          onClick={closeCart}
                          className="text-sm font-bold leading-5 text-brand transition-colors hover:text-brand-light"
                        >
                          {product.name}
                        </Link>

                        <p className="mt-1 text-xs text-brand/60">
                          {product.unit}
                        </p>

                        <p className="mt-2 text-xs text-brand/60">
                          {formatPrice(product.price)}
                          {' / unit'}
                        </p>

                        <p className="mt-2 text-sm font-extrabold text-brand">
                          {formatPrice(lineTotal)}
                        </p>

                        <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-brand-light">
                          <span
                            className="h-2 w-2 rounded-full bg-green-600"
                            aria-hidden="true"
                          />

                          In stock
                        </p>
                      </div>
                    </div>

                    {/* Quantity controls */}

                    <div className="mt-4 flex items-center justify-between gap-3">

                      <span className="text-xs font-semibold text-brand/60">
                        Quantity
                      </span>

                      <div
                        role="group"
                        aria-label={`Quantity for ${product.name}`}
                        className="flex shrink-0 items-center rounded-full border border-brand/15 bg-white"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            updateCart(product.id, -1)
                          }
                          aria-label={`Remove one ${product.name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-l-full text-brand transition-colors hover:bg-sage focus-visible:outline-2 focus-visible:outline-brand"
                        >
                          <Minus
                            size={15}
                            aria-hidden="true"
                          />
                        </button>

                        <span
                          aria-live="polite"
                          className="min-w-6 text-center text-sm font-bold tabular-nums text-brand"
                        >
                          {quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            updateCart(product.id, 1)
                          }
                          disabled={!canIncrease}
                          aria-label={`Add one ${product.name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-r-full text-brand transition-colors hover:bg-sage focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Plus
                            size={15}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}

              {/* Availability guidance */}

              <div className="rounded-2xl border border-brand/10 bg-sage/40 p-4">

                <p className="flex items-center gap-2 text-xs font-bold text-brand">
                  <CheckCircle2
                    size={16}
                    className="text-brand-light"
                    aria-hidden="true"
                  />

                  Basket availability checked
                </p>

                <p className="mt-2 text-xs leading-6 text-brand/60">
                  Only products currently reported
                  as in stock are displayed. If
                  availability changes, your basket
                  is updated after a successful
                  catalogue refresh.
                </p>

                <p className="mt-2 text-xs leading-6 text-brand/60">
                  Exact quantities and final prices
                  are validated by the server when
                  you place an order.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ==================================
            CART FOOTER
        ================================== */}

        <div className="border-t border-brand/10 pt-5">

          {/* ================================
              CLEAR BASKET
          ================================ */}

          {isReady &&
            cartProducts.length > 0 && (
              <>
                {!confirmClear ? (
                  <div className="mb-5 flex justify-end">

                    <button
                      type="button"
                      onClick={() =>
                        setConfirmClear(true)
                      }
                      className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2
                        size={15}
                        aria-hidden="true"
                      />

                      Clear basket
                    </button>
                  </div>
                ) : (

                  /* Clear confirmation */

                  <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4">

                    <p className="text-sm font-bold text-red-800">
                      Clear your basket?
                    </p>

                    <p className="mt-2 text-xs leading-5 text-red-700">
                      This will remove all products
                      from your basket.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">

                      <button
                        ref={confirmButtonRef}
                        type="button"
                        onClick={handleClearCart}
                        className="rounded-full bg-red-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-red-700"
                      >
                        Yes, clear basket
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setConfirmClear(false)
                        }
                        className="rounded-full border border-red-200 bg-white px-5 py-2.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

          {/* ================================
              CART SUBTOTAL
          ================================ */}

          <div className="mb-5 flex items-center justify-between gap-4">

            <span className="text-lg font-bold text-brand">
              Subtotal
            </span>

            <span className="text-lg font-extrabold tabular-nums text-brand">
              {isReady
                ? formatPrice(cartTotal)
                : '—'}
            </span>
          </div>

          <p className="mb-4 text-xs leading-5 text-brand/60">
            Delivery charges, where applicable,
            will be calculated during checkout.
          </p>

          {/* ================================
              CONTINUE TO CHECKOUT
          ================================ */}

          <button
            type="button"
            disabled={!canCheckout}
            onClick={handleCheckout}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ShoppingBag
              size={18}
              aria-hidden="true"
            />

            Continue to checkout
          </button>

          <p className="mt-4 text-center text-[11px] text-brand/45">
            Fresh dairy, made simple.
          </p>
        </div>
      </aside>
    </div>
  )
}
