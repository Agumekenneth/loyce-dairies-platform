
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react'

import { useCart } from '../../context/CartContext'
import { formatPrice } from '../../data/products'

export default function CartDrawer() {
  const {
    cartProducts,
    cartCount,
    cartTotal,
    cartOpen,
    closeCart,
    updateCart,
    clearCart,
  } = useCart()

  const navigate = useNavigate()

  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const [confirmClear, setConfirmClear] = useState(false)

  // Manage focus, keyboard navigation and background scrolling
  useEffect(() => {
    if (!cartOpen) return

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (confirmClear) {
          setConfirmClear(false)
        } else {
          closeCart()
        }
        return
      }

      if (event.key !== 'Tab') return

      const panel = panelRef.current

      if (!panel) return

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])',
        ),
      ).filter(
        (element) =>
          element.getClientRects().length > 0,
      )

      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [cartOpen, closeCart, confirmClear])

  // Reset confirmation when the drawer closes
  useEffect(() => {
    if (!cartOpen) {
      setConfirmClear(false)
    }
  }, [cartOpen])

  const handleExploreProducts = () => {
    closeCart()
    navigate('/products')
  }

  const handleClearCart = () => {
    clearCart()
    setConfirmClear(false)
  }

  const handleCheckout = () => {
    closeCart()

    window.alert(
      'Checkout will be available in a later milestone.',
    )
  }

  if (!cartOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Background overlay */}
      <button
        type="button"
        aria-label="Close shopping cart"
        onClick={closeCart}
        tabIndex={-1}
        className="absolute inset-0 bg-black/45"
      />

      {/* Shopping cart panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream p-5 shadow-2xl sm:p-6"
      >
        {/* Cart header */}
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

        {/* Cart products */}
        <div className="min-h-0 flex-1 overflow-y-auto py-6">
          {cartCount === 0 ? (
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
                Your next dairy favourite is just a few
                clicks away.
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
            <div className="space-y-5">
              {cartProducts.map(
                ({ product, quantity, lineTotal }) => (
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

                    {/* Quantity controls */}
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

                      <span className="min-w-5 text-center text-sm font-bold tabular-nums text-brand">
                        {quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          updateCart(product.id, 1)
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

        {/* Cart footer */}
        <div className="border-t border-brand/10 pt-5">
          {cartCount > 0 && (
            <>
              {/* Clear basket */}
              {!confirmClear ? (
                <div className="mb-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
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
                <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-bold text-red-800">
                    Clear your basket?
                  </p>

                  <p className="mt-2 text-xs leading-5 text-red-700">
                    This will remove all products from your
                    basket.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleClearCart}
                      className="rounded-full bg-red-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-red-700"
                    >
                      Yes, clear basket
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="rounded-full border border-red-200 bg-white px-5 py-2.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Subtotal */}
          <div className="mb-5 flex items-center justify-between gap-4">
            <span className="text-lg font-bold text-brand">
              Subtotal
            </span>

            <span className="text-lg font-extrabold tabular-nums text-brand">
              {formatPrice(cartTotal)}
            </span>
          </div>

          <p className="mb-4 text-xs leading-5 text-brand/60">
            Delivery charges will be calculated at checkout.
          </p>

          {/* Checkout */}
          <button
            type="button"
            disabled={cartCount === 0}
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
