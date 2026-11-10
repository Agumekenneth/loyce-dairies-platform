
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  LoaderCircle,
  Minus,
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

export default function ProductDetailsPage() {
  const { id } = useParams()

  const {
    products,
    status,
    getProductById,
    reloadCatalog,
  } = useCatalog()

  const { updateCart, openCart } = useCart()

  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  const productId = Number(id)

  const validId =
    Number.isSafeInteger(productId) &&
    productId > 0 &&
    String(productId) === id

  const product = validId
    ? getProductById(productId)
    : undefined

  const isLoading = status === 'loading'
  const hasError = status === 'error'

  // Reset selections when switching products.
  useEffect(() => {
    setQuantity(1)
    setAdded(false)
  }, [id])

  // Show related products from the API catalogue.
  const relatedProducts = products
    .filter((item) => item.id !== product?.id)
    .slice(0, 3)

  // Temporarily preserve highlights for the original
  // development products until highlights are stored
  // in PostgreSQL.
  const matchingSample = product
    ? sampleProducts.find(
        (item) =>
          item.id === product.id &&
          item.name === product.name &&
          item.category === product.category,
      )
    : undefined

  const highlights =
    product?.highlights ?? matchingSample?.highlights ?? []

  const decreaseQuantity = () => {
    setQuantity((current) => Math.max(1, current - 1))
    setAdded(false)
  }

  const increaseQuantity = () => {
    setQuantity((current) => Math.min(99, current + 1))
    setAdded(false)
  }

  const handleAddToCart = () => {
    if (!product || status !== 'ready') return

    updateCart(product.id, quantity)
    setAdded(true)
  }

  // Loading state
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
          Retrieving the latest information.
        </p>
      </main>
    )
  }

  // API error state
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
          We couldn't connect to the product catalogue.
          Please try again.
        </p>

        <button
          type="button"
          onClick={reloadCatalog}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-sm font-bold text-white hover:bg-brand-light"
        >
          <RefreshCw size={17} aria-hidden="true" />
          Try again
        </button>
      </main>
    )
  }

  // Unknown or unavailable product
  if (!product) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center bg-cream px-5 text-center">
        <h1 className="font-display text-4xl text-brand">
          Product not found
        </h1>

        <p className="mt-4 text-sm text-brand/60">
          This dairy product isn't currently available.
        </p>

        <Link
          to="/products"
          className="mt-8 rounded-full bg-brand px-7 py-4 text-sm font-bold text-white hover:bg-brand-light"
        >
          Browse products
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-cream">
      {/* Breadcrumb */}
      <div className="mx-auto max-w-7xl px-5 pt-8 lg:px-8">
        <Link
          to="/products"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-light hover:text-brand"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Back to products
        </Link>
      </div>

      {/* Product details */}
      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-10 lg:grid-cols-2 lg:items-start lg:gap-16 lg:px-8">
        {/* Product image */}
        <div className="relative overflow-hidden rounded-[2rem] bg-sage">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="h-[380px] w-full object-cover sm:h-[550px]"
            />
          ) : (
            <div className="flex h-[380px] items-center justify-center text-brand/40 sm:h-[550px]">
              <ShoppingBag size={60} aria-hidden="true" />
            </div>
          )}

          {product.badge && (
            <span className="absolute left-6 top-6 rounded-full bg-white px-4 py-2 text-xs font-bold text-brand shadow-sm">
              {product.badge}
            </span>
          )}
        </div>

        {/* Product information */}
        <div className="py-3">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-light">
            {product.category}
          </p>

          <h1 className="mt-5 font-display text-5xl leading-tight text-brand sm:text-6xl">
            {product.name}
          </h1>

          <p className="mt-5 text-base text-brand/60">
            {product.unit}
          </p>

          <p className="mt-7 text-3xl font-extrabold text-brand">
            {formatPrice(product.price)}
          </p>

          {product.description && (
            <p className="mt-8 max-w-lg text-base leading-8 text-brand/65">
              {product.description}
            </p>
          )}

          {/* Product highlights */}
          {highlights.length > 0 && (
            <div className="mt-8 space-y-3">
              {highlights.map((highlight) => (
                <div
                  key={highlight}
                  className="flex items-center gap-3 text-sm text-brand/75"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage text-brand-light">
                    <Check size={15} aria-hidden="true" />
                  </span>

                  {highlight}
                </div>
              ))}
            </div>
          )}

          {/* Quantity selector */}
          <div className="mt-10">
            <p className="mb-4 text-sm font-bold text-brand">
              Quantity
            </p>

            <div className="inline-flex items-center rounded-full border border-brand/20 bg-white">
              <button
                type="button"
                onClick={decreaseQuantity}
                disabled={quantity === 1}
                aria-label="Decrease quantity"
                className="flex h-12 w-12 items-center justify-center disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Minus size={18} aria-hidden="true" />
              </button>

              <span
                aria-live="polite"
                className="min-w-12 text-center text-base font-bold text-brand"
              >
                {quantity}
              </span>

              <button
                type="button"
                onClick={increaseQuantity}
                disabled={quantity === 99}
                aria-label="Increase quantity"
                className="flex h-12 w-12 items-center justify-center disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Total */}
          <div className="mt-8 flex items-center justify-between border-t border-brand/10 pt-6">
            <span className="text-sm font-semibold text-brand/60">
              Total for {quantity}{' '}
              {quantity === 1 ? 'item' : 'items'}
            </span>

            <span className="text-xl font-extrabold text-brand">
              {formatPrice(product.price * quantity)}
            </span>
          </div>

          {/* Add to basket */}
          <button
            type="button"
            onClick={handleAddToCart}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-brand px-8 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-light"
          >
            <ShoppingBag size={19} aria-hidden="true" />
            Add {quantity} to basket
          </button>

          {/* Confirmation */}
          {added && (
            <div
              role="status"
              className="mt-5 rounded-2xl bg-sage px-5 py-4"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-brand">
                <Check size={18} aria-hidden="true" />
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

          {/* Delivery information */}
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
                Delivery availability and charges will be
                confirmed during checkout.
              </p>
            </div>
          </div>

          <p className="mt-6 text-xs text-brand/45">
            Product information and prices are currently
            development samples stored in the database.
          </p>
        </div>
      </section>

      {/* Related products */}
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
