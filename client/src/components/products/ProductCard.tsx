
import { Link } from 'react-router-dom'
import {
  Package,
  Plus,
} from 'lucide-react'

import { useCart } from '../../context/CartContext'
import { formatPrice } from '../../data/products'
import type { Product } from '../../types/product'

// ==========================================
// LOYCE DAIRIES PLATFORM
// CUSTOMER PRODUCT CARD
//
// MILESTONE 4.9.3D
// STOCK AVAILABILITY INTEGRATION
// ==========================================

// ==========================================
// COMPONENT PROPS
// ==========================================

type ProductCardProps = {
  product: Product
}

// ==========================================
// PRODUCT CARD COMPONENT
// ==========================================

export default function ProductCard({
  product,
}: ProductCardProps) {
  // ========================================
  // SHOPPING CART
  // ========================================

  const { updateCart } = useCart()

  // ========================================
  // STOCK AVAILABILITY
  // ========================================

  /**
   * Availability is supplied by the
   * PostgreSQL-backed public catalogue.
   *
   * Only an explicit true indicates
   * that stock is available.
   *
   * Missing availability information
   * is treated as out of stock.
   */

  const isInStock = product.inStock === true

  // ========================================
  // PRODUCT IMAGE
  // ========================================

  /**
   * A product may not yet have an image.
   *
   * Display a neutral placeholder instead
   * of rendering an empty image URL.
   */

  const hasImage =
    typeof product.image === 'string' &&
    product.image.trim().length > 0

  // ========================================
  // ADD PRODUCT TO CART
  // ========================================

  function handleAddToCart() {
    // Prevent unavailable products from
    // triggering a cart quantity update.
    if (!isInStock) {
      return
    }

    // CartContext independently validates
    // the product and its availability.
    updateCart(product.id, 1)
  }

  // ========================================
  // PRODUCT DETAILS URL
  // ========================================

  const productUrl = `/products/${product.id}`

  // ========================================
  // COMPONENT RENDER
  // ========================================

  return (
    <article className="group flex h-full flex-col">

      {/* ====================================
          PRODUCT IMAGE CONTAINER
      ==================================== */}

      <div className="relative overflow-hidden rounded-[1.75rem] bg-cream">

        {/* ==================================
            PRODUCT DETAILS LINK
        ================================== */}

        <Link
          to={productUrl}
          aria-label={`View details for ${product.name}`}
          className="block"
        >

          {/* ================================
              PRODUCT IMAGE OR PLACEHOLDER
          ================================ */}

          {hasImage ? (
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              className={`h-64 w-full object-cover transition-transform duration-500 ${
                isInStock
                  ? 'group-hover:scale-105'
                  : 'opacity-65'
              }`}
            />
          ) : (
            <div
              className="flex h-64 w-full flex-col items-center justify-center gap-3 bg-sage/40 text-brand/40"
              role="img"
              aria-label={`Image unavailable for ${product.name}`}
            >
              <Package
                size={52}
                strokeWidth={1.5}
                aria-hidden="true"
              />

              <span className="text-xs font-semibold">
                Product image coming soon
              </span>
            </div>
          )}

        </Link>

        {/* ==================================
            PRODUCT BADGE
        ================================== */}

        {product.badge && (
          <span
            className="pointer-events-none absolute left-4 top-4 rounded-full bg-white px-3 py-2 text-[10px] font-bold text-brand shadow-sm"
          >
            {product.badge}
          </span>
        )}

        {/* ==================================
            STOCK AVAILABILITY BADGE
        ================================== */}

        {!isInStock && (
          <span
            className="pointer-events-none absolute right-4 top-4 rounded-full bg-amber-50 px-3 py-2 text-[10px] font-extrabold text-amber-800 shadow-sm"
          >
            Out of stock
          </span>
        )}

        {/* ==================================
            ADD TO CART BUTTON
        ================================== */}

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!isInStock}
          aria-label={
            isInStock
              ? `Add ${product.name} to cart`
              : `${product.name} is out of stock`
          }
          title={
            isInStock
              ? `Add ${product.name} to basket`
              : 'Currently out of stock'
          }
          className={`absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-all duration-200 ${
            isInStock
              ? 'bg-brand text-white hover:scale-110 hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
              : 'cursor-not-allowed bg-white/90 text-brand/35 shadow-sm'
          }`}
        >
          <Plus
            size={21}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* ====================================
          PRODUCT INFORMATION
      ==================================== */}

      <div className="flex flex-1 flex-col px-1 pt-5">

        {/* ==================================
            PRODUCT CATEGORY AND UNIT
        ================================== */}

        <p className="text-xs font-semibold text-brand-light">
          {product.category}
          {' · '}
          {product.unit}
        </p>

        {/* ==================================
            PRODUCT NAME
        ================================== */}

        <h3 className="mt-2 text-base font-bold text-brand">
          <Link
            to={productUrl}
            className="transition-colors hover:text-brand-light focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-brand"
          >
            {product.name}
          </Link>
        </h3>

        {/* ==================================
            PRODUCT PRICE
        ================================== */}

        <p className="mt-2 text-sm font-extrabold text-brand">
          {formatPrice(product.price)}
        </p>

        {/* ==================================
            STOCK STATUS MESSAGE
        ================================== */}

        <div className="mt-auto pt-4">

          {isInStock ? (
            <p
              className="flex items-center gap-2 text-xs font-semibold text-brand-light"
              aria-label="Product is in stock"
            >
              <span
                className="h-2 w-2 rounded-full bg-green-600"
                aria-hidden="true"
              />

              Available to order
            </p>
          ) : (
            <p
              className="flex items-center gap-2 text-xs font-semibold text-amber-700"
              aria-label="Product is out of stock"
            >
              <span
                className="h-2 w-2 rounded-full bg-amber-600"
                aria-hidden="true"
              />

              Currently unavailable
            </p>
          )}

        </div>
      </div>
    </article>
  )
}
