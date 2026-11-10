
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Minus,
  Plus,
  ShoppingBag,
  Truck,
} from 'lucide-react'

import ProductCard from '../components/products/ProductCard'
import { useCart } from '../context/CartContext'
import { formatPrice, products } from '../data/products'

export default function ProductDetailsPage() {
  const { id } = useParams()
  const { updateCart, openCart } = useCart()

  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  const product = products.find(
    (item) => String(item.id) === id,
  )

  // Reset selection when navigating between product details
  useEffect(() => {
    setQuantity(1)
    setAdded(false)
  }, [id])

  if (!product) {
    return (
      <main className="min-h-screen bg-cream px-5 py-20 text-center">
        <h1 className="font-display text-4xl text-brand">
          Product not found
        </h1>

        <p className="mt-4 text-brand/60">
          We couldn't find the dairy product you're looking for.
        </p>

        <Link
          to="/products"
          className="mt-8 inline-flex rounded-full bg-brand px-7 py-4 text-sm font-bold text-white"
        >
          Browse products
        </Link>
      </main>
    )
  }

  const relatedProducts = products
    .filter((item) => item.id !== product.id)
    .slice(0, 3)

  const decreaseQuantity = () => {
    setQuantity((current) => Math.max(1, current - 1))
    setAdded(false)
  }

  const increaseQuantity = () => {
    setQuantity((current) => Math.min(99, current + 1))
    setAdded(false)
  }

  const handleAddToCart = () => {
    updateCart(product.id, quantity)
    setAdded(true)
  }

  return (
    <main className="min-h-screen bg-cream">
      {/* Breadcrumb navigation */}
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
          <img
            src={product.image}
            alt={product.name}
            className="h-[380px] w-full object-cover sm:h-[550px]"
          />

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

          <p className="mt-8 max-w-lg text-base leading-8 text-brand/65">
            {product.description}
          </p>

          {/* Product highlights */}
          {product.highlights && (
            <div className="mt-8 space-y-3">
              {product.highlights.map((highlight) => (
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

          {/* Quantity selection */}
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

          {/* Price calculation */}
          <div className="mt-8 flex items-center justify-between border-t border-brand/10 pt-6">
            <span className="text-sm font-semibold text-brand/60">
              Total for {quantity}{' '}
              {quantity === 1 ? 'item' : 'items'}
            </span>

            <span className="text-xl font-extrabold text-brand">
              {formatPrice(product.price * quantity)}
            </span>
          </div>

          {/* Add to cart */}
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
            Product information, descriptions and prices are
            currently sample data for development.
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
