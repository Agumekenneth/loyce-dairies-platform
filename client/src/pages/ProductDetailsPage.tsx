
import { Link, useParams } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { products, formatPrice } from '../data/products'

export default function ProductDetailsPage() {
  const { id } = useParams()
  const { updateCart } = useCart()

  const product = products.find(
    (item) => String(item.id) === id,
  )

  if (!product) {
    return (
      <main className="min-h-screen bg-cream px-5 py-20 text-center">
        <h1 className="font-display text-4xl text-brand">
          Product not found
        </h1>

        <Link
          to="/products"
          className="mt-6 inline-block font-semibold text-brand-light"
        >
          Browse products
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-cream px-5 py-16 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
        <div className="overflow-hidden rounded-[2rem] bg-sage">
          <img
            src={product.image}
            alt={product.name}
            className="h-[450px] w-full object-cover"
          />
        </div>

        <div className="flex flex-col justify-center">
          <Link
            to="/products"
            className="text-sm font-semibold text-brand-light"
          >
            ← Back to products
          </Link>

          <p className="mt-8 text-sm font-bold text-brand-light">
            {product.category}
          </p>

          <h1 className="mt-3 font-display text-5xl text-brand">
            {product.name}
          </h1>

          <p className="mt-5 text-lg text-brand/60">
            {product.unit}
          </p>

          <p className="mt-6 text-3xl font-extrabold text-brand">
            {formatPrice(product.price)}
          </p>

          <button
            type="button"
            onClick={() => updateCart(product.id, 1)}
            className="mt-10 w-full rounded-full bg-brand px-8 py-4 font-bold text-white hover:bg-brand-light sm:w-fit"
          >
            Add to basket
          </button>

          <p className="mt-5 text-xs text-brand/50">
            Sample product information and pricing.
          </p>
        </div>
      </div>
    </main>
  )
}
