
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  ChevronDown,
  MapPin,
  Menu,
  Milk,
  ShoppingBag,
  X,
} from 'lucide-react'

import { useCart } from '../../context/CartContext'

type NavbarProps = {
  onShopClick: () => void
}

export default function Navbar({ onShopClick }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { cartCount, openCart } = useCart()

  const handleShopClick = () => {
    setMenuOpen(false)
    onShopClick()
  }

  const closeMenu = () => {
    setMenuOpen(false)
  }

  return (
    <>
      {/* Announcement bar */}
      <div className="bg-brand px-4 py-2.5 text-center text-xs font-medium text-white sm:text-sm">
        Fresh dairy delivered with care in Mbarara
      </div>

      {/* Main navigation */}
      <header className="sticky top-0 z-30 border-b border-brand/10 bg-cream/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          {/* Brand */}
          <Link
            to="/"
            onClick={closeMenu}
            className="flex items-center gap-3"
          >
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
          </Link>

          {/* Desktop navigation */}
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-9 text-sm font-semibold text-brand/80 md:flex"
          >
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive
                  ? 'text-brand-light'
                  : 'hover:text-brand-light'
              }
            >
              Home
            </NavLink>

            <button
              type="button"
              onClick={handleShopClick}
              className="hover:text-brand-light"
            >
              Shop products
            </button>

            <Link
              to="/#why-us"
              className="hover:text-brand-light"
            >
              Why Loyce?
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1 text-xs font-semibold text-brand/70 lg:flex">
              <MapPin size={15} aria-hidden="true" />
              Mbarara, Uganda
              <ChevronDown size={13} aria-hidden="true" />
            </span>

            {/* Shopping cart */}
            <button
              type="button"
              onClick={openCart}
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

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label={
                menuOpen
                  ? 'Close navigation menu'
                  : 'Open navigation menu'
              }
              aria-expanded={menuOpen}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-brand/15 md:hidden"
            >
              {menuOpen ? (
                <X size={21} aria-hidden="true" />
              ) : (
                <Menu size={21} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        {menuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="space-y-4 border-t border-brand/10 px-6 py-5 text-sm font-semibold md:hidden"
          >
            <Link
              to="/"
              onClick={closeMenu}
              className="block"
            >
              Home
            </Link>

            <button
              type="button"
              onClick={handleShopClick}
              className="block"
            >
              Shop products
            </button>

            <Link
              to="/#why-us"
              onClick={closeMenu}
              className="block"
            >
              Why Loyce?
            </Link>
          </nav>
        )}
      </header>
    </>
  )
}
