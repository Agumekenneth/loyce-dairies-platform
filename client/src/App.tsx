
import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  Leaf,
  MapPin,
  Menu,
  Milk,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
  X,
} from 'lucide-react'

import { products, categories, formatPrice } from './data/products'
import type { Product } from './types/product'

function App() {
  const [activeCategory, setActiveCategory] = useState('All products')
  const [cart, setCart] = useState<Record<number, number>>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')

  const closeCartRef = useRef<HTMLButtonElement>(null)
  const cartTriggerRef = useRef<HTMLButtonElement>(null)

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      activeCategory === 'All products' ||
      product.category === activeCategory

    const searchTerm = search.trim().toLowerCase()

    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm) ||
      product.category.toLowerCase().includes(searchTerm)

    return matchesCategory && matchesSearch
  })

  const cartCount = Object.values(cart).reduce(
    (total, quantity) => total + quantity,
    0,
  )

  const cartTotal = products.reduce(
    (total, product) =>
      total + product.price * (cart[product.id] ?? 0),
    0,
  )

  const cartProducts: Product[] = products.filter(
    (product) => (cart[product.id] ?? 0) > 0,
  )

  const updateCart = (id: number, change: number) => {
    setCart((current) => {
      const nextQuantity = Math.max(0, (current[id] ?? 0) + change)
      const updated = { ...current }

      if (nextQuantity === 0) {
        delete updated[id]
      } else {
        updated[id] = nextQuantity
      }

      return updated
    })
  }

  const closeCart = () => {
    setCartOpen(false)
  }

  const goToProducts = () => {
    document.getElementById('products')?.scrollIntoView({
      behavior: 'smooth',
    })

    setMenuOpen(false)
    setCartOpen(false)
  }

  useEffect(() => {
    if (!cartOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    closeCartRef.current?.focus()

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCartOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
      cartTriggerRef.current?.focus()
    }
  }, [cartOpen])

  return (
    <div className="min-h-screen bg-cream text-brand">
      {/* Announcement bar */}
      <div className="bg-brand px-4 py-2.5 text-center text-xs font-medium text-white sm:text-sm">
        <span className="inline-flex items-center justify-center gap-2">
          <Truck size={15} aria-hidden="true" />
          Fresh dairy delivered with care in Mbarara
        </span>
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-30 border-b border-brand/10 bg-cream/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <a href="#home" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white">
              <Milk size={24} strokeWidth={1.7} aria-hidden="true" />
            </div>

            <div>
              <span className="block text-lg font-extrabold tracking-tight text-brand">
                loyce<span className="text-brand-light">.</span>
              </span>

              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-brand/60">
                Dairies
              </span>
            </div>
          </a>

          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-9 text-sm font-semibold text-brand/80 md:flex"
          >
            <a href="#home" className="hover:text-brand-light">
              Home
            </a>

            <button
              type="button"
              onClick={goToProducts}
              className="hover:text-brand-light"
            >
              Shop products
            </button>

            <a href="#why-us" className="hover:text-brand-light">
              Why Loyce?
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1 text-xs font-semibold text-brand/70 lg:flex">
              <MapPin size={15} aria-hidden="true" />
              Mbarara, Uganda
              <ChevronDown size={13} aria-hidden="true" />
            </span>

            <button
              ref={cartTriggerRef}
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={`Open shopping cart with ${cartCount} items`}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-brand/15 hover:bg-sage"
            >
              <ShoppingBag size={20} aria-hidden="true" />

              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-brand">
                  {cartCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-brand/15 md:hidden"
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="space-y-4 border-t border-brand/10 px-6 py-5 text-sm font-semibold md:hidden"
          >
            <a
              href="#home"
              onClick={() => setMenuOpen(false)}
              className="block"
            >
              Home
            </a>

            <button
              type="button"
              onClick={goToProducts}
              className="block"
            >
              Shop products
            </button>

            <a
              href="#why-us"
              onClick={() => setMenuOpen(false)}
              className="block"
            >
              Why Loyce?
            </a>
          </nav>
        )}
      </header>

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
              <span className="italic text-brand-light">good.</span>
            </h1>

            <p className="mt-7 max-w-md text-base leading-8 text-brand/65 sm:text-lg">
              From creamy milk to delicious yoghurt, discover everyday dairy
              favourites delivered straight to your doorstep.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={goToProducts}
                className="inline-flex items-center gap-3 rounded-full bg-brand px-7 py-4 text-sm font-bold text-white shadow-lg shadow-brand/15 hover:-translate-y-1 hover:bg-brand-light"
              >
                Shop fresh dairy
                <ArrowRight size={18} aria-hidden="true" />
              </button>

              <a
                href="#why-us"
                className="rounded-full border border-brand/20 px-7 py-4 text-sm font-bold text-brand hover:bg-sage"
              >
                Why choose us?
              </a>
            </div>

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
                <ShieldCheck size={17} className="text-brand-light" />
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

        {/* Products section */}
        <section id="products" className="scroll-mt-24 bg-white py-20">
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

              <label className="flex items-center gap-2 rounded-full border border-brand/15 px-4 py-3 focus-within:border-brand-light">
                <Search size={18} className="text-brand/50" />

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

            {/* Category filters */}
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

            {/* Product grid */}
            <div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {filteredProducts.map((product) => (
                <article key={product.id} className="group">
                  <div className="relative overflow-hidden rounded-[1.75rem] bg-cream">
                    <img
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      className="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {product.badge && (
                      <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-2 text-[10px] font-bold text-brand">
                        {product.badge}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => updateCart(product.id, 1)}
                      aria-label={`Add ${product.name} to cart`}
                      className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-lg hover:scale-110"
                    >
                      <Plus size={21} />
                    </button>
                  </div>

                  <div className="px-1 pt-5">
                    <p className="text-xs font-semibold text-brand-light">
                      {product.category} · {product.unit}
                    </p>

                    <h3 className="mt-2 text-base font-bold text-brand">
                      {product.name}
                    </h3>

                    <p className="mt-2 text-sm font-extrabold text-brand">
                      {formatPrice(product.price)}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="py-16 text-center">
                <Search
                  size={36}
                  className="mx-auto mb-4 text-brand/30"
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
          </div>
        </section>

        {/* Why choose Loyce */}
        <section id="why-us" className="scroll-mt-24 bg-sage py-20">
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

      {/* Footer */}
      <footer className="bg-brand px-5 py-12 text-white lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-2xl font-extrabold">loyce.</p>

            <p className="mt-2 text-sm text-white/60">
              Fresh dairy for everyday living.
            </p>
          </div>

          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} Loyce Dairies · Mbarara, Uganda
          </p>
        </div>
      </footer>

      {/* Shopping cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close shopping cart"
            onClick={closeCart}
            className="absolute inset-0 bg-black/45"
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream p-6 shadow-2xl"
          >
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
                ref={closeCartRef}
                type="button"
                onClick={closeCart}
                aria-label="Close cart"
                className="rounded-full bg-sage p-3"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto py-6">
              {cartCount === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <ShoppingBag
                    size={45}
                    className="text-brand/30"
                  />

                  <p className="mt-5 font-display text-2xl text-brand">
                    Your basket is empty
                  </p>

                  <p className="mt-2 text-sm text-brand/60">
                    Add something fresh to get started.
                  </p>

                  <button
                    type="button"
                    onClick={goToProducts}
                    className="mt-6 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white"
                  >
                    Explore products
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {cartProducts.map((product: Product) => {
                    const quantity = cart[product.id] ?? 0

                    return (
                      <article key={product.id} className="flex items-center gap-4 border-b border-brand/10 pb-5">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-20 w-20 shrink-0 rounded-xl object-cover"
                        />

                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-brand">{product.name}</h3>
                          <p className="mt-1 text-xs text-brand/60">{product.unit}</p>
                          <p className="mt-2 text-sm font-bold text-brand">
                            {formatPrice(product.price * quantity)}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center rounded-full border border-brand/15">
                          <button
                            type="button"
                            onClick={() => updateCart(product.id, -1)}
                            aria-label={`Remove one ${product.name}`}
                            className="p-2"
                          >
                            <Minus size={15} />
                          </button>
                          <span className="min-w-5 text-center text-sm font-bold">{quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCart(product.id, 1)}
                            aria-label={`Add one ${product.name}`}
                            className="p-2"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>

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
      )}
    </div>
  )
}

export default App
