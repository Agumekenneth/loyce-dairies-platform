
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  AlertCircle,
  LoaderCircle,
  Minus,
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
// SHOPPING CART DRAWER
// ==========================================

export default function CartDrawer() {
  const navigate = useNavigate()

  // ==========================================
  // CART CONTEXT
  // ==========================================

  const {
    cartProducts,
    cartCount,
    cartTotal,
    cartOpen,
    closeCart,
    updateCart,
    clearCart,
  } = useCart()

  // ==========================================
  // CATALOGUE CONTEXT
  // ==========================================

  const { status, reloadCatalog } = useCatalog()

  const isLoading = status === 'loading'
  const hasError = status === 'error'
  const isReady = status === 'ready'

  // ==========================================
  // REFS AND LOCAL STATE
  // ==========================================

  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  const previousFocusRef = useRef<HTMLElement | null>(
    null,
  )

  const confirmClearRef = useRef(false)

  const confirmButtonRef =
    useRef<HTMLButtonElement>(null)

  const [confirmClear, setConfirmClear] =
    useState(false)

  // ==========================================
  // SYNCHRONIZE CONFIRMATION STATE
  // ==========================================

  useEffect(() => {
    confirmClearRef.current = confirmClear
  }, [confirmClear])

  // ==========================================
  // ACCESSIBILITY AND SCROLL MANAGEMENT
  // ==========================================

  useEffect(() => {
    if (!cartOpen) return

    // Remember the previously focused element.
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    // Prevent background scrolling.
    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow = 'hidden'

    // Focus the cart close button.
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      // ======================================
      // ESCAPE KEY
      // ======================================

      if (event.key === 'Escape') {
        event.preventDefault()

        if (confirmClearRef.current) {
          // Cancel clear confirmation first.
          setConfirmClear(false)
        } else {
          // Otherwise close the drawer.
          closeCart()
        }

        return
      }

      // ======================================
      // TAB KEY — FOCUS TRAP
      // ======================================

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

      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      // Keep focus inside the cart drawer.
      if (!panel.contains(document.activeElement)) {
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
      else if (
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

    // ======================================
    // CLEANUP
    // ======================================

    return () => {
      document.body.style.overflow =
        previousOverflow

      document.removeEventListener(
        'keydown',
        handleKeyDown,
      )

      // Restore focus when the drawer closes.
      previousFocusRef.current?.focus()
    }
  }, [cartOpen, closeCart])

  // ==========================================
  // RESET CONFIRMATION WHEN CART CLOSES
  // ==========================================

  useEffect(() => {
    if (!cartOpen) {
      setConfirmClear(false)
    }
  }, [cartOpen])

  // ==========================================
  // FOCUS CLEAR CONFIRMATION BUTTON
  // ==========================================

  useEffect(() => {
    if (cartOpen && confirmClear) {
      confirmButtonRef.current?.focus()
    }
  }, [cartOpen, confirmClear])

  // ==========================================
  // NAVIGATION HANDLERS
  // ==========================================

  const handleExploreProducts = () => {
    closeCart()

    navigate('/products')
  }

  // ==========================================
  // CLEAR SHOPPING CART
  // ==========================================

  const handleClearCart = () => {
    clearCart()

    setConfirmClear(false)
  }

  // ==========================================
  // CONTINUE TO CHECKOUT
  // ==========================================

  const handleCheckout = () => {
    // Do not proceed if the catalogue is unavailable
    // or the shopping cart contains no products.
    if (
      !isReady ||
      cartCount === 0 ||
      cartProducts.length === 0
    ) {
      return
    }

    // Close the drawer before navigating.
    closeCart()

    // The /checkout route is protected by
    // ProtectedRoute in App.tsx.
    //
    // Authenticated customers proceed to checkout.
    // Guests are redirected to /login.
    //
    // Cart contents remain intact.
    navigate('/checkout')
  }

  // ==========================================
  // DO NOT RENDER WHEN CLOSED
  // ==========================================

  if (!cartOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* ======================================
          BACKGROUND OVERLAY
      ====================================== */}

      <button
        type="button"
        aria-label="Close shopping cart"
        onClick={closeCart}
        tabIndex={-1}
        className="absolute inset-0 bg-black/45"
      />

      {/* ======================================
          CART DRAWER PANEL
      ====================================== */}

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream p-5 shadow-2xl sm:p-6"
      >
        {/* ==================================
            DRAWER HEADER
        ================================== */}

        <div className="flex items-center justify-between border-b border-brand/10 pb-5">
          <div>
            <h2
              id="cart-title"
              className="font-display text-3xl text-brand"
            >
              Your basket
            </h2>

            <p
              aria-live="polite"
              className="mt-1 text-xs text-brand/60"
            >
              {cartCount}{' '}
              {cartCount === 1 ? 'item' : 'items'}
            </p>
          </div>

          {/* Close drawer */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-sage text-brand transition-colors hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* ==================================
            CART CONTENT
        ================================== */}

        <div className="min-h-0 flex-1 overflow-y-auto py-6">
          {/* ==================================
              LOADING STATE
          ================================== */}

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
                Loading your basket
              </h3>

              <p className="mt-3 max-w-xs text-sm leading-6 text-brand/60">
                Retrieving the latest product information.
              </p>
            </div>
          ) : hasError ? (
            /* ==================================
                CATALOGUE ERROR STATE
            ================================== */

            <div
              role="alert"
              className="flex h-full flex-col items-center justify-center px-4 text-center"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
                <AlertCircle
                  size={36}
                  className="text-amber-600"
                  aria-hidden="true"
                />
              </div>

              <h3 className="mt-6 font-display text-2xl text-brand">
                Basket temporarily unavailable
              </h3>

              <p className="mt-3 max-w-xs text-sm leading-6 text-brand/60">
                We couldn't connect to our product
                catalogue. Your saved basket quantities
                are preserved.
              </p>

              <button
                type="button"
                onClick={() => {
                  void reloadCatalog()
                }}
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-light"
              >
                <RefreshCw
                  size={17}
                  aria-hidden="true"
                />

                Try again
              </button>
            </div>
          ) : cartCount === 0 ? (
            /* ==================================
                EMPTY SHOPPING CART
            ================================== */

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
                Your next dairy favourite is just a
                few clicks away.
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
            /* ==================================
                SHOPPING CART PRODUCTS
            ================================== */

            <div className="space-y-5">
              {cartProducts.map(
                ({
                  product,
                  quantity,
                  lineTotal,
                }) => (
                  <article
                    key={product.id}
                    className="flex items-center gap-3 border-b border-brand/10 pb-5 sm:gap-4"
                  >
                    {/* Product image */}
                    <img
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      className="h-20 w-20 shrink-0 rounded-xl bg-sage object-cover"
                    />

                    {/* Product details */}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold leading-5 text-brand">
                        {product.name}
                      </h3>

                      <p className="mt-1 text-xs text-brand/60">
                        {product.unit}
                      </p>

                      <p className="mt-2 text-sm font-extrabold text-brand">
                        {formatPrice(lineTotal)}
                      </p>
                    </div>

                    {/* ==================================
                        QUANTITY CONTROLS
                    ================================== */}

                    <div
                      role="group"
                      aria-label={`Quantity for ${product.name}`}
                      className="flex shrink-0 items-center rounded-full border border-brand/15 bg-white"
                    >
                      {/* Decrease quantity */}
                      <button
                        type="button"
                        onClick={() =>
                          updateCart(
                            product.id,
                            -1,
                          )
                        }
                        aria-label={`Remove one ${product.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-l-full text-brand transition-colors hover:bg-sage focus-visible:outline-2 focus-visible:outline-brand"
                      >
                        <Minus
                          size={15}
                          aria-hidden="true"
                        />
                      </button>

                      {/* Current quantity */}
                      <span className="min-w-5 text-center text-sm font-bold tabular-nums text-brand">
                        {quantity}
                      </span>

                      {/* Increase quantity */}
                      <button
                        type="button"
                        onClick={() =>
                          updateCart(
                            product.id,
                            1,
                          )
                        }
                        disabled={quantity >= 99}
                        aria-label={`Add one ${product.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-r-full text-brand transition-colors hover:bg-sage focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Plus
                          size={15}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </div>

        {/* ==================================
            CART FOOTER
        ================================== */}

        <div className="border-t border-brand/10 pt-5">
          {/* ==================================
              CLEAR BASKET
          ================================== */}

          {cartCount > 0 && (
            <>
              {!confirmClear ? (
                <div className="mb-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmClear(true)
                    }}
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
                /* ==================================
                    CLEAR CART CONFIRMATION
                ================================== */

                <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-bold text-red-800">
                    Clear your basket?
                  </p>

                  <p className="mt-2 text-xs leading-5 text-red-700">
                    This will remove all products from
                    your basket.
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
                      onClick={() => {
                        setConfirmClear(false)
                      }}
                      className="rounded-full border border-red-200 bg-white px-5 py-2.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ==================================
              CART SUBTOTAL
          ================================== */}

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
            will be calculated at checkout.
          </p>

          {/* ==================================
              CONTINUE TO CHECKOUT
          ================================== */}

          <button
            type="button"
            disabled={
              !isReady ||
              cartCount === 0 ||
              cartProducts.length === 0
            }
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
