
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  LoaderCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'

import ProductCard from '../components/products/ProductCard'
import { useCatalog } from '../context/CatalogContext'

type SortOption =
  | 'default'
  | 'price-low'
  | 'price-high'
  | 'name'

export default function ProductsPage() {
  const {
    products,
    categories,
    status,
    error,
    reloadCatalog,
  } = useCatalog()

  const [activeCategory, setActiveCategory] = useState(
    'All products',
  )

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('default')

  const isLoading = status === 'loading'
  const hasError = status === 'error'
  const isReady = status === 'ready'

  // Filter and sort products received from PostgreSQL.
  const filteredProducts = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()

    const results = products.filter((product) => {
      const matchesCategory =
        activeCategory === 'All products' ||
        product.category === activeCategory

      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm) ||
        product.category.toLowerCase().includes(searchTerm)

      return matchesCategory && matchesSearch
    })

    switch (sortBy) {
      case 'price-low':
        return [...results].sort(
          (a, b) => a.price - b.price,
        )

      case 'price-high':
        return [...results].sort(
          (a, b) => b.price - a.price,
        )

      case 'name':
        return [...results].sort((a, b) =>
          a.name.localeCompare(b.name),
        )

      default:
        return results
    }
  }, [products, activeCategory, search, sortBy])

  const resetFilters = () => {
    setActiveCategory('All products')
    setSearch('')
    setSortBy('default')
  }

  const hasActiveFilters =
    activeCategory !== 'All products' ||
    search.trim() !== '' ||
    sortBy !== 'default'

  return (
    <main className="min-h-screen bg-cream">
      {/* Page introduction */}
      <section className="border-b border-brand/10 bg-sage/50">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-light hover:text-brand"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            Back to home
          </Link>

          <div className="mt-10 max-w-2xl">
            <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-light">
              FRESH FROM LOYCE
            </p>

            <h1 className="font-display text-5xl leading-tight text-brand sm:text-6xl">
              Find your dairy{' '}
              <span className="italic text-brand-light">
                favourites.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-brand/65">
              Explore our collection of milk, yoghurt,
              butter and traditional ghee. Find what you
              love and add it to your basket.
            </p>
          </div>
        </div>
      </section>

      {/* Catalogue */}
      <section className="bg-white py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          {/* Search and sorting */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex w-full items-center gap-3 rounded-full border border-brand/15 bg-cream px-5 py-3.5 focus-within:border-brand-light sm:max-w-md">
              <Search
                size={19}
                className="shrink-0 text-brand/50"
                aria-hidden="true"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                disabled={!isReady}
                placeholder="Search dairy products..."
                aria-label="Search dairy products"
                className="min-w-0 flex-1 bg-transparent text-sm text-brand outline-none placeholder:text-brand/40 disabled:opacity-50"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="text-brand/50 hover:text-brand"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              )}
            </label>

            <label className="flex items-center gap-3 text-sm font-semibold text-brand/70">
              <SlidersHorizontal
                size={18}
                aria-hidden="true"
              />

              <span>Sort by</span>

              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as SortOption)
                }
                disabled={!isReady}
                aria-label="Sort products"
                className="rounded-full border border-brand/15 bg-cream px-4 py-3 text-sm font-semibold text-brand outline-none focus:border-brand-light disabled:opacity-50"
              >
                <option value="default">Featured</option>
                <option value="price-low">
                  Price: Low to high
                </option>
                <option value="price-high">
                  Price: High to low
                </option>
                <option value="name">
                  Name: A to Z
                </option>
              </select>
            </label>
          </div>

          {/* Categories loaded from the API */}
          <div
            aria-label="Filter products by category"
            className="mt-9 flex gap-3 overflow-x-auto pb-3"
          >
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                disabled={!isReady}
                aria-pressed={activeCategory === category}
                className={`shrink-0 rounded-full px-5 py-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  activeCategory === category
                    ? 'bg-brand text-white'
                    : 'bg-cream text-brand/70 hover:bg-sage'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Results header */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl text-brand">
                Our products
              </h2>

              {isReady && (
                <p
                  aria-live="polite"
                  className="mt-2 text-sm text-brand/60"
                >
                  Showing {filteredProducts.length}{' '}
                  {filteredProducts.length === 1
                    ? 'product'
                    : 'products'}
                </p>
              )}
            </div>

            {hasActiveFilters && isReady && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 text-sm font-bold text-brand-light hover:text-brand"
              >
                <X size={16} aria-hidden="true" />
                Clear filters
              </button>
            )}
          </div>

          {/* Loading state */}
          {isLoading && (
            <div
              role="status"
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <LoaderCircle
                size={42}
                className="animate-spin text-brand-light"
                aria-hidden="true"
              />

              <h3 className="mt-6 font-display text-2xl text-brand">
                Loading fresh dairy
              </h3>

              <p className="mt-3 text-sm text-brand/60">
                Fetching our latest product catalogue.
              </p>
            </div>
          )}

          {/* Error state */}
          {hasError && (
            <div
              role="alert"
              className="mt-10 rounded-[2rem] bg-cream px-6 py-20 text-center"
            >
              <AlertCircle
                size={42}
                className="mx-auto text-amber-600"
                aria-hidden="true"
              />

              <h3 className="mt-6 font-display text-3xl text-brand">
                We couldn't load the products
              </h3>

              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-brand/60">
                Please check your connection and try
                again. Your saved basket will be preserved.
              </p>

              {error && (
                <p className="mx-auto mt-3 max-w-lg text-xs text-brand/50">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={reloadCatalog}
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-sm font-bold text-white hover:bg-brand-light"
              >
                <RefreshCw
                  size={17}
                  aria-hidden="true"
                />
                Try again
              </button>
            </div>
          )}

          {/* Successfully loaded catalogue */}
          {isReady && (
            <>
              {filteredProducts.length > 0 ? (
                <div className="mt-9 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-10 rounded-[2rem] bg-cream px-6 py-20 text-center">
                  <Search
                    size={42}
                    className="mx-auto text-brand/30"
                    aria-hidden="true"
                  />

                  <h3 className="mt-6 font-display text-3xl text-brand">
                    No products found
                  </h3>

                  <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-brand/60">
                    Try another search term or product
                    category.
                  </p>

                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-7 rounded-full bg-brand px-7 py-3.5 text-sm font-bold text-white hover:bg-brand-light"
                  >
                    View all products
                  </button>
                </div>
              )}

              <p className="mt-12 border-t border-brand/10 pt-6 text-xs text-brand/50">
                Product prices and information are currently
                development samples stored in the database.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
