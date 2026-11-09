
import { Plus } from 'lucide-react'

import { useCart } from '../../context/CartContext'
import { formatPrice } from '../../data/products'
import type { Product } from '../../types/product'

type ProductCardProps = {
  product: Product
}

export default function ProductCard({
  product,
}: ProductCardProps) {
  const { updateCart } = useCart()

  return (
    <article className="group">
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
          <Plus size={21} aria-hidden="true" />
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
  )
}
