
import { useState } from 'react'
import {
  ArrowRight,
  Leaf,
  Milk,
  Search,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import ProductCard from '../components/products/ProductCard'
import { products, categories } from '../data/products'

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState('All products')
  const [search, setSearch] = useState('')

  const searchTerm = search.trim().toLowerCase()

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      activeCategory === 'All products' ||
      product.category === activeCategory

    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm) ||
      product.category.toLowerCase().includes(searchTerm)

    return matchesCategory && matchesSearch
  })

  return (
    <main id="home">
      {/* Hero section */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-14 pt-12 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="max-w-xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-sage px-4 py-2 text-xs font-bold tracking-wide text-brand">
            <Leaf size={15} aria-hidden="true" />
            FRESH GOODNESS FROM MBARARA
          </div>

          <h1 className="font-display text-[clamp(3.5rem,6vw,6rem)] leading-[1.04] tracking-tight text-brand">
            A little fresh.
            <br />
            A lot of{' '}
            <span className="italic text-brand-light">
              good.
            </span>
          </h1>

          <p className="mt-7 max-w-md text-base leading-8 text-brand/65 sm:text-lg">
            From creamy milk to delicious yoghurt, discover everyday dairy
            favourites delivered straight to your doorstep.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              to="/products"
              className="inline-flex items-center gap-3 rounded-full bg-brand px-7 py-4 text-sm font-bold text-white shadow-lg shadow-brand/15 hover:-translate-y-1 hover:bg-brand-light"
            >
              Shop fresh dairy
              <ArrowRight size={18} aria-hidden="true" />
            </Link>

            <a
              href="#why-us"
              className="rounded-full border border-brand/20 px-7 py-4 text-sm font-bold text-brand hover:bg-sage"
            >
              Why choose us?
            </a>
          </div>

          {/* Hero highlights */}
          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 border-t border-brand/10 pt-6">
            <span className="flex items-center gap-2 text-xs font-semibold text-brand/75">
              <Leaf size={17} className="text-brand-light" />
              Quality dairy
            </span>

            <span className="flex items-center gap-2 text-xs font-semibold text-brand/75">
              <Truck size={17} className="text-brand-light" />
              Local delivery
            </span>

            <span className="flex items-center gap-2 text-xs font-semibold text-brand/75">
              <ShieldCheck
                size={17}
                className="text-brand-light"
              />
              Easy ordering
            </span>
          </div>
        </div>

        {/* Hero image */}
        <div className="relative">
          <div className="absolute -left-5 -top-5 h-28 w-28 rounded-full bg-gold/30 blur-3xl" />

          <div className="relative overflow-hidden rounded-[2.5rem] bg-sage">
            <img
              src="https://images.unsplash.com/photo-1550583724-b2692b85b150?w=1400&auto=format&fit=crop&q=90"
              alt="Fresh dairy products"
              className="h-[400px] w-full object-cover sm:h-[550px]"
            />

            <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-white/95 px-5 py-4 shadow-xl backdrop-blur sm:right-auto">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-light">
                Everyday goodness
              </span>

              <p className="mt-1 font-display text-2xl text-brand">
                Freshness you can taste.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Homepage product catalogue */}
      <section
        id="products"
        className="scroll-mt-24 bg-white py-20"
      >
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-light">
                THE GOOD STUFF
              </p>

              <h2 className="font-display text-4xl text-brand sm:text-5xl">
                Our dairy favourites
              </h2>

              <p className="mt-4 text-sm text-brand/60">
                Explore our selection of fresh dairy essentials.
              </p>
            </div>

            {/* Search products */}
            <label className="flex items-center gap-2 rounded-full border border-brand/15 px-4 py-3 focus-within:border-brand-light">
              <Search
                size={18}
                className="text-brand/50"
                aria-hidden="true"
              />

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products"
                aria-label="Search products"
                className="w-36 bg-transparent text-sm text-brand outline-none placeholder:text-brand/40 sm:w-48"
              />
            </label>
          </div>

          {/* Product categories */}
          <div
            aria-label="Product categories"
            className="mt-9 flex gap-3 overflow-x-auto pb-3"
          >
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                aria-pressed={activeCategory === category}
                className={`shrink-0 rounded-full px-5 py-3 text-xs font-bold ${
                  activeCategory === category
                    ? 'bg-brand text-white'
                    : 'bg-cream text-brand/70 hover:bg-sage'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Reusable product cards */}
          <div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>

          {/* Empty results */}
          {filteredProducts.length === 0 && (
            <div className="py-16 text-center">
              <Search
                size={36}
                className="mx-auto mb-4 text-brand/30"
                aria-hidden="true"
              />

              <h3 className="font-display text-2xl text-brand">
                No products found
              </h3>

              <p className="mt-2 text-sm text-brand/60">
                Try a different search or product category.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setActiveCategory('All products')
                }}
                className="mt-5 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white"
              >
                View all products
              </button>
            </div>
          )}

          <p className="mt-8 text-xs text-brand/50">
            Sample products and prices for interface development.
            Final availability and pricing will come from our backend.
          </p>

          <div className="mt-10 text-center">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded-full border border-brand/20 px-7 py-4 text-sm font-bold text-brand hover:bg-sage"
            >
              View full catalogue
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Why choose Loyce */}
      <section
        id="why-us"
        className="scroll-mt-24 bg-sage py-20"
      >
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-xl">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-light">
              THE LOYCE WAY
            </p>

            <h2 className="font-display text-4xl text-brand sm:text-5xl">
              Good dairy. Simple shopping.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: <Milk size={27} />,
                title: 'Dairy favourites',
                description:
                  'Find milk, yoghurt, butter and ghee in one convenient place.',
              },
              {
                icon: <Truck size={27} />,
                title: 'Made for local delivery',
                description:
                  'Order for delivery within our supported Mbarara service areas.',
              },
              {
                icon: <ShieldCheck size={27} />,
                title: 'A simpler way to shop',
                description:
                  'Browse, choose your favourites and manage your cart with ease.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-[1.75rem] bg-white p-8"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-sage text-brand">
                  {feature.icon}
                </div>

                <h3 className="text-lg font-extrabold text-brand">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-brand/60">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
