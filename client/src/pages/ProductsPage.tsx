
import { Link } from 'react-router-dom'
import ProductCard from '../components/products/ProductCard'
import { products } from '../data/products'

export default function ProductsPage() {
  return (
    <main className="min-h-screen bg-cream px-5 py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link
          to="/"
          className="text-sm font-semibold text-brand-light"
        >
          ← Back to home
        </Link>

        <h1 className="mt-8 font-display text-5xl text-brand">
          Shop fresh dairy
        </h1>

        <p className="mt-4 text-brand/60">
          Explore our selection of dairy favourites.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
