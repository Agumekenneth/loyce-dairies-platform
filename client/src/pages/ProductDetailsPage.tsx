
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  AlertCircle,
  ArrowLeft,
  Check,
  LoaderCircle,
  Minus,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  Truck,
} from 'lucide-react'

import ProductCard from '../components/products/ProductCard'
import { useCatalog } from '../context/CatalogContext'
import { useCart } from '../context/CartContext'

import {
  formatPrice,
  products as sampleProducts,
} from '../data/products'

// ==========================================
// LOYCE DAIRIES PLATFORM
// PRODUCT DETAILS PAGE
//
// MILESTONE 4.9.3E
// PRODUCT AVAILABILITY & CART PROTECTION
// ==========================================

const MAX_CART_QUANTITY = 99

// ==========================================
// PRODUCT DETAILS COMPONENT
// ==========================================

export default function ProductDetailsPage() {
  // ========================================
  // ROUTE PARAMETERS
  // ========================================

  const { id } = useParams()

  // ========================================
  // LIVE PRODUCT CATALOGUE
  // ========================================

  const {
    products,
    status,
    getProductById,
    reloadCatalog,
  } = useCatalog()

  // ========================================
  // SHOPPING CART
  // ========================================

  const {
    cart,
    updateCart,
    openCart,
  } = useCart()

  // ========================================
  // LOCAL COMPONENT STATE
  // ========================================

  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  // ========================================
  // VALIDATE PRODUCT IDENTIFIER
  // ========================================

  const productId = Number(id)

  const validId =
    Number.isSafeInteger(productId) &&
    productId > 0 &&
    String(productId) === id

  // ========================================
  // RETRIEVE CURRENT PRODUCT
  // ========================================

  const product = validId
    ? getProductById(productId)
    : undefined

  // ========================================
  // CATALOGUE STATUS
  // ========================================

  const isLoading = status === 'loading'
  const hasError = status === 'error'
  const isReady = status === 'ready'

  // ========================================
  // STOCK AVAILABILITY
  // ========================================

  /**
   * Only products explicitly confirmed
   * as in stock by the backend may be
   * added to the shopping basket.
   *
   * Undefined, missing or false stock
   * availability is treated as unavailable.
   *
   * The frontend receives a boolean
   * availability indicator rather than
   * exact inventory quantities.
   */

  const isInStock =
    isReady &&
    product?.inStock === true

  // ========================================
  // EXISTING BASKET QUANTITY
  // ========================================

  const existingCartQuantity = product
    ? (cart[product.id] ?? 0)
    : 0

  /**
   * Preserve the existing maximum of
   * 99 units per product in the basket.
   *
   * This is a basket limit, not an
   * indication of actual stock quantity.
   */

  const remainingCartCapacity = Math.max(
    0,
    MAX_CART_QUANTITY - existingCartQuantity,
  )

  // ========================================
  // PURCHASING ELIGIBILITY
  // ========================================

  const canAddToCart =
    isInStock &&
    quantity > 0 &&
    quantity <= remainingCartCapacity

  // ========================================
  // RESET PRODUCT SELECTION
  // ========================================

  useEffect(() => {
    setQuantity(1)
    setAdded(false)
  }, [id, product?.inStock])

  // ========================================
  // RELATED PRODUCTS
  // ========================================

  /**
   * Related products are selected from
   * the current backend catalogue.
   *
   * Inactive products are already
   * excluded by the public API.
   *
   * Out-of-stock products may still
   * appear, but their ProductCard
   * purchase controls are disabled.
   */

  const relatedProducts = products
    .filter(
      (item) => item.id !== product?.id,
    )
    .slice(0, 3)

  // ========================================
  // LEGACY PRODUCT HIGHLIGHTS
  // ========================================

  /**
   * The original development products
   * include local presentation highlights.
   *
   * Preserve those highlights until they
   * are supported by PostgreSQL.
   *
   * Product identity must match before
   * applying these temporary highlights.
   */

  const matchingSample = product
    ? sampleProducts.find(
        (item) =>
          item.id === product.id &&
          item.name === product.name &&
          item.category === product.category,
      )
    : undefined

  const highlights =
    product?.highlights ??
    matchingSample?.highlights ??
    []

  // ========================================
  // DECREASE SELECTED QUANTITY
  // ========================================

  function decreaseQuantity() {
    if (!isInStock) {
      return
    }

    setQuantity((current) =>
      Math.max(1, current - 1),
    )

    setAdded(false)
  }

  // ========================================
  // INCREASE SELECTED QUANTITY
  // ========================================

  function increaseQuantity() {
    if (!isInStock) {
      return
    }

    setQuantity((current) =>
      Math.min(
        MAX_CART_QUANTITY,
        current + 1,
      ),
    )

    setAdded(false)
  }

  // ========================================
  // ADD PRODUCT TO SHOPPING BASKET
  // ========================================

  function handleAddToCart() {
    /**
     * Independently check product identity,
     * current catalogue status, stock
     * availability and basket capacity.
     *
     * CartContext also performs its own
     * stock availability validation.
     */

    if (
      !product ||
      !isReady ||
      !canAddToCart
    ) {
      return
    }

    updateCart(
      product.id,
      quantity,
    )

    setAdded(true)
  }

  // ========================================
  // LOADING STATE
  // ========================================

  if (isLoading) {
    return (
      <main
        role="status"
        className="flex min-h-[60vh] flex-col items-center justify-center bg-cream px-5 text-center"
      >
        <LoaderCircle
          size={42}
          className="animate-spin text-brand-light"
          aria-hidden="true"
        />

        <h1 className="mt-6 font-display text-3xl text-brand">
          Loading product details
        </h1>

        <p className="mt-3 text-sm text-brand/60">
          Retrieving the latest product information
          and stock availability.
        </p>
      </main>
    )
  }

  // ========================================
  // CATALOGUE ERROR STATE
  // ========================================

  if (hasError) {
    return (
      <main
        role="alert"
        className="flex min-h-[60vh] flex-col items-center justify-center bg-cream px-5 text-center"
      >
        <AlertCircle
          size={42}
          className="text-amber-600"
          aria-hidden="true"
        />

        <h1 className="mt-6 font-display text-3xl text-brand">
          Product temporarily unavailable
        </h1>

        <p className="mt-3 max-w-md text-sm leading-7 text-brand/60">
          We couldn't connect to the product
          catalogue. Please check your connection
          and try again.
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

        <Link
          to="/products"
          className="mt-5 text-sm font-bold text-brand-light hover:text-brand"
        >
          Back to products
        </Link>
      </main>
    )
  }

  // ========================================
  // PRODUCT NOT FOUND
  // ========================================

  /**
   * Inactive products are excluded from
   * the public catalogue.
   *
   * This also handles invalid product
   * identifiers and deleted products.
   */

  if (!product) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center bg-cream px-5 text-center">
        <Package
          size={48}
          className="text-brand/35"
          aria-hidden="true"
        />

        <h1 className="mt-6 font-display text-4xl text-brand">
          Product not found
        </h1>

        <p className="mt-4 max-w-md text-sm leading-7 text-brand/60">
          This dairy product isn't currently
          available in our catalogue.
        </p>

        <Link
          to="/products"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-light"
        >
          <ArrowLeft
            size={17}
            aria-hidden="true"
          />

          Browse products
        </Link>
      </main>
    )
  }

  // ========================================
  // PRODUCT IMAGE AVAILABILITY
  // ========================================

  const hasImage =
    typeof product.image === 'string' &&
    product.image.trim().length > 0

  // ========================================
  // PRODUCT DETAILS PAGE
  // ========================================

  return (
    <main className="min-h-screen bg-cream">

      {/* ====================================
          BREADCRUMB NAVIGATION
      ==================================== */}

      <div className="mx-auto max-w-7xl px-5 pt-8 lg:px-8">
        <Link
          to="/products"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-light hover:text-brand"
        >
          <ArrowLeft
            size={17}
            aria-hidden="true"
          />

          Back to products
        </Link>
      </div>

      {/* ====================================
          PRODUCT INFORMATION SECTION
      ==================================== */}

      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-10 lg:grid-cols-2 lg:items-start lg:gap-16 lg:px-8">

        {/* ==================================
            PRODUCT IMAGE
        ================================== */}

        <div className="relative overflow-hidden rounded-[2rem] bg-sage">

          {hasImage ? (
            <img
              src={product.image}
              alt={product.name}
              className={`h-[380px] w-full object-cover sm:h-[550px] ${
                isInStock
                  ? ''
                  : 'opacity-75'
              }`}
            />
          ) : (
            <div className="flex h-[380px] flex-col items-center justify-center gap-4 text-brand/40 sm:h-[550px]">
              <Package
                size={60}
                strokeWidth={1.5}
                aria-hidden="true"
              />

              <p className="text-sm font-semibold">
                Product image coming soon
              </p>
            </div>
          )}

          {/* Product badge */}

          {product.badge && (
            <span className="absolute left-6 top-6 rounded-full bg-white px-4 py-2 text-xs font-bold text-brand shadow-sm">
              {product.badge}
            </span>
          )}

          {/* Stock availability badge */}

          {!isInStock && (
            <span className="absolute bottom-6 left-6 rounded-full bg-amber-50 px-4 py-2 text-xs font-extrabold text-amber-800 shadow-sm">
              Out of stock
            </span>
          )}
        </div>

        {/* ==================================
            PRODUCT DETAILS
        ================================== */}

        <div className="py-3">

          {/* Product category */}

          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-light">
            {product.category}
          </p>

          {/* Product name */}

          <h1 className="mt-5 font-display text-5xl leading-tight text-brand sm:text-6xl">
            {product.name}
          </h1>

          {/* Selling unit */}

          <p className="mt-5 text-base text-brand/60">
            {product.unit}
          </p>

          {/* Unit price */}

          <p className="mt-7 text-3xl font-extrabold text-brand">
            {formatPrice(product.price)}
          </p>

          {/* ==================================
              STOCK AVAILABILITY MESSAGE
          ================================== */}

          <div
            role="status"
            className={`mt-6 flex items-start gap-3 rounded-2xl border p-5 ${
              isInStock
                ? 'border-green-200 bg-green-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            {isInStock ? (
              <Check
                size={20}
                className="mt-0.5 shrink-0 text-green-700"
                aria-hidden="true"
              />
            ) : (
              <AlertCircle
                size={20}
                className="mt-0.5 shrink-0 text-amber-700"
                aria-hidden="true"
              />
            )}

            <div>
              <p
                className={`text-sm font-bold ${
                  isInStock
                    ? 'text-green-800'
                    : 'text-amber-900'
                }`}
              >
                {isInStock
                  ? 'Available to order'
                  : 'Currently out of stock'}
              </p>

              <p
                className={`mt-2 text-xs leading-6 ${
                  isInStock
                    ? 'text-green-800/80'
                    : 'text-amber-900/80'
                }`}
              >
                {isInStock
                  ? 'This product is currently available. Final stock availability will be confirmed during checkout.'
                  : 'This product is temporarily unavailable for ordering. Please check again later.'}
              </p>
            </div>
          </div>

          {/* ==================================
              PRODUCT DESCRIPTION
          ================================== */}

          {product.description && (
            <p className="mt-8 max-w-lg text-base leading-8 text-brand/65">
              {product.description}
            </p>
          )}

          {/* ==================================
              PRODUCT HIGHLIGHTS
          ================================== */}

          {highlights.length > 0 && (
            <div className="mt-8 space-y-3">
              {highlights.map((highlight) => (
                <div
                  key={highlight}
                  className="flex items-center gap-3 text-sm text-brand/75"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage text-brand-light">
                    <Check
                      size={15}
                      aria-hidden="true"
                    />
                  </span>

                  <span>
                    {highlight}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ==================================
              QUANTITY SELECTOR
          ================================== */}

          <div className="mt-10">

            <p className="mb-4 text-sm font-bold text-brand">
              Quantity
            </p>

            <div className="inline-flex items-center rounded-full border border-brand/20 bg-white">

              {/* Decrease quantity */}

              <button
                type="button"
                onClick={decreaseQuantity}
                disabled={
                  !isInStock ||
                  quantity <= 1
                }
                aria-label="Decrease quantity"
                className="flex h-12 w-12 items-center justify-center text-brand transition-colors hover:text-brand-light disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Minus
                  size={18}
                  aria-hidden="true"
                />
              </button>

              {/* Current quantity */}

              <span
                aria-live="polite"
                className="min-w-12 text-center text-base font-bold text-brand"
              >
                {quantity}
              </span>

              {/* Increase quantity */}

              <button
                type="button"
                onClick={increaseQuantity}
                disabled={
                  !isInStock ||
                  quantity >= MAX_CART_QUANTITY
                }
                aria-label="Increase quantity"
                className="flex h-12 w-12 items-center justify-center text-brand transition-colors hover:text-brand-light disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Plus
                  size={18}
                  aria-hidden="true"
                />
              </button>
            </div>

            {/* Quantity guidance */}

            {isInStock && (
              <p className="mt-3 text-xs leading-6 text-brand/50">
                You can select up to{' '}
                {MAX_CART_QUANTITY} units per product
                in your basket. Actual stock
                availability is checked separately
                during checkout.
              </p>
            )}

            {!isInStock && (
              <p className="mt-3 text-xs text-amber-800">
                Quantity selection is disabled
                while this product is out of stock.
              </p>
            )}
          </div>

          {/* ==================================
              SELECTED QUANTITY TOTAL
          ================================== */}

          <div className="mt-8 flex items-center justify-between gap-4 border-t border-brand/10 pt-6">

            <span className="text-sm font-semibold text-brand/60">
              Total for {quantity}{' '}
              {quantity === 1
                ? 'item'
                : 'items'}
            </span>

            <span className="text-xl font-extrabold text-brand">
              {formatPrice(
                product.price * quantity,
              )}
            </span>
          </div>

          {/* ==================================
              BASKET CAPACITY WARNING
          ================================== */}

          {isInStock &&
            remainingCartCapacity < quantity && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"
              >
                <p className="text-sm font-bold text-amber-900">
                  Basket quantity limit
                </p>

                <p className="mt-2 text-xs leading-6 text-amber-800">
                  You already have{' '}
                  {existingCartQuantity}{' '}
                  {existingCartQuantity === 1
                    ? 'unit'
                    : 'units'}{' '}
                  of this product in your basket.
                  You can add at most{' '}
                  {remainingCartCapacity} more
                  before reaching the 99-unit
                  basket limit.
                </p>
              </div>
            )}

          {/* ==================================
              ADD TO BASKET BUTTON
          ================================== */}

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!canAddToCart}
            aria-label={
              !isInStock
                ? `${product.name} is out of stock`
                : !canAddToCart
                  ? 'Basket quantity limit reached'
                  : `Add ${quantity} of ${product.name} to basket`
            }
            className={`mt-6 flex w-full items-center justify-center gap-3 rounded-full px-8 py-4 text-sm font-bold transition-colors ${
              canAddToCart
                ? 'bg-brand text-white hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
                : 'cursor-not-allowed bg-brand/15 text-brand/45'
            }`}
          >
            <ShoppingBag
              size={19}
              aria-hidden="true"
            />

            {!isInStock
              ? 'Currently out of stock'
              : !canAddToCart
                ? 'Basket limit reached'
                : `Add ${quantity} to basket`}
          </button>

          {/* ==================================
              SUCCESS CONFIRMATION
          ================================== */}

          {added && isInStock && (
            <div
              role="status"
              className="mt-5 rounded-2xl bg-sage px-5 py-4"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-brand">
                <Check
                  size={18}
                  aria-hidden="true"
                />

                Added to your basket
              </div>

              <button
                type="button"
                onClick={openCart}
                className="mt-3 text-sm font-bold text-brand-light underline underline-offset-4"
              >
                View your basket
              </button>
            </div>
          )}

          {/* ==================================
              DELIVERY INFORMATION
          ================================== */}

          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-brand/10 bg-white p-5">

            <Truck
              size={22}
              className="shrink-0 text-brand-light"
              aria-hidden="true"
            />

            <div>
              <h3 className="text-sm font-bold text-brand">
                Local delivery in Mbarara
              </h3>

              <p className="mt-2 text-xs leading-6 text-brand/60">
                Delivery availability and charges
                depend on the selected delivery
                zone and will be confirmed
                during checkout.
              </p>
            </div>
          </div>

          {/* ==================================
              DEVELOPMENT DATA NOTICE
          ================================== */}

          <p className="mt-6 text-xs leading-6 text-brand/45">
            Product information and prices are
            currently development samples stored
            in the database.
          </p>
        </div>
      </section>

      {/* ====================================
          RELATED PRODUCTS
      ==================================== */}

      {relatedProducts.length > 0 && (
        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">

            <div className="flex flex-wrap items-end justify-between gap-5">

              <div>
                <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-light">
                  MORE TO EXPLORE
                </p>

                <h2 className="font-display text-4xl text-brand">
                  You might also like
                </h2>
              </div>

              <Link
                to="/products"
                className="text-sm font-bold text-brand-light hover:text-brand"
              >
                View all products
              </Link>
            </div>

            <div className="mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {relatedProducts.map((item) => (
                <ProductCard
                  key={item.id}
                  product={item}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
