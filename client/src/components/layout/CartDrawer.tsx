
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Minus,
  Plus,
  ShoppingBag,
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
  } = useCart()

  const navigate = useNavigate()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Manage keyboard access and background scrolling
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
        closeCart()
      }

      if (event.key === 'Tab') {
        const panel = closeButtonRef.current?.closest('aside')

        if (!panel) return

        const focusable = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled])',
          ),
        )

        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey && document.activeElement === first) {
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
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [cartOpen, closeCart])

  const handleExploreProducts = () => {
    closeCart()
    navigate('/products')
  }

  if (!cartOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Background overlay */}
      <button
        type="button"
        aria-label="Close shopping cart"
        onClick={closeCart}
        className="absolute inset-0 bg-black/45"
      />

      {/* Shopping cart panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream p-6 shadow-2xl"
      >
        {/* Cart header */}
        <div className="flex items-center justify-between border-b border-brand/10 pb-5">
          <div>
            <h2 className="font-display text-3xl text-brand">
              Your basket
            </h2>

            <p className="mt-1 text-xs text-brand/60">
              {cartCount} {cartCount === 1 ? 'item' : 'items'}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="rounded-full bg-sage p-3 hover:bg-brand/10"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Cart products */}
        <div className="flex-1 overflow-y-auto py-6">
          {cartCount === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ShoppingBag
                size={45}
                className="text-brand/30"
                aria-hidden="true"
              />

              <h3 className="mt-5 font-display text-2xl text-brand">
                Your basket is empty
              </h3>

              <p className="mt-2 text-sm text-brand/60">
                Add something fresh to get started.
              </p>

              <button
                type="button"
                onClick={handleExploreProducts}
                className="mt-6 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-light"
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
                    className="flex items-center gap-4 border-b border-brand/10 pb-5"
                  >
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-20 w-20 shrink-0 rounded-xl object-cover"
                    />

                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-brand">
                        {product.name}
                      </h3>

                      <p className="mt-1 text-xs text-brand/60">
                        {product.unit}
                      </p>

                      <p className="mt-2 text-sm font-bold text-brand">
                        {formatPrice(lineTotal)}
                      </p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex shrink-0 items-center rounded-full border border-brand/15">
                      <button
                        type="button"
                        onClick={() => updateCart(product.id, -1)}
                        aria-label={`Remove one ${product.name}`}
                        className="p-2 hover:text-brand-light"
                      >
                        <Minus size={15} aria-hidden="true" />
                      </button>

                      <span className="min-w-5 text-center text-sm font-bold">
                        {quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => updateCart(product.id, 1)}
                        aria-label={`Add one ${product.name}`}
                        className="p-2 hover:text-brand-light"
                      >
                        <Plus size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </div>

        {/* Cart summary */}
        <div className="border-t border-brand/10 pt-5">
          <div className="mb-5 flex justify-between text-lg font-bold text-brand">
            <span>Subtotal</span>
            <span>{formatPrice(cartTotal)}</span>
          </div>

          <p className="mb-4 text-xs text-brand/60">
            Delivery charges will be calculated at checkout.
          </p>

          <button
            type="button"
            disabled={cartCount === 0}
            onClick={() => {
              closeCart()
              window.alert(
                'Checkout will be available in a later milestone.',
              )
            }}
            className="w-full rounded-full bg-brand py-4 text-sm font-bold text-white hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to checkout
          </button>
        </div>
      </aside>
    </div>
  )
}
