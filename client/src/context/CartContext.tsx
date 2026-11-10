
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { useCatalog } from './CatalogContext'
import type { Product } from '../types/product'

type CartItems = Record<number, number>

type CartProduct = {
  product: Product
  quantity: number
  lineTotal: number
}

type CartContextValue = {
  cart: CartItems
  cartProducts: CartProduct[]
  cartCount: number
  cartTotal: number
  cartOpen: boolean
  openCart: () => void
  closeCart: () => void
  updateCart: (productId: number, change: number) => void
  clearCart: () => void
}

const STORAGE_KEY = 'loyce-dairies-cart-v1'

const CartContext = createContext<
  CartContextValue | undefined
>(undefined)

// Restore previously saved quantities.
// Product validation happens after the API loads.
function loadSavedCart(): CartItems {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (!saved) return {}

    const parsed: unknown = JSON.parse(saved)

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {}
    }

    const savedItems = parsed as Record<string, unknown>
    const validCart: CartItems = {}

    for (const [key, value] of Object.entries(savedItems)) {
      const productId = Number(key)

      if (
        Number.isSafeInteger(productId) &&
        productId > 0 &&
        String(productId) === key &&
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value > 0
      ) {
        validCart[productId] = Math.min(value, 99)
      }
    }

    return validCart
  } catch {
    // Storage may be unavailable or contain invalid JSON.
    return {}
  }
}

export function CartProvider({
  children,
}: {
  children: ReactNode
}) {
  // Products now come from PostgreSQL through CatalogContext.
  const { products, status } = useCatalog()

  const [cart, setCart] = useState<CartItems>(loadSavedCart)
  const [cartOpen, setCartOpen] = useState(false)

  // Save the basket when quantities change.
  useEffect(() => {
    try {
      if (Object.keys(cart).length === 0) {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(cart),
        )
      }
    } catch {
      // Keep the in-memory cart functional.
    }
  }, [cart])

  // Remove unavailable product IDs ONLY after the catalogue
  // has loaded successfully.
  //
  // Never erase saved items merely because the API is loading
  // or temporarily unavailable.
  useEffect(() => {
    if (status !== 'ready') return

    const availableIds = new Set(
      products.map((product) => product.id),
    )

    setCart((current) => {
      const updated: CartItems = {}
      let changed = false

      for (const [key, quantity] of Object.entries(current)) {
        const productId = Number(key)

        if (availableIds.has(productId)) {
          updated[productId] = quantity
        } else {
          changed = true
        }
      }

      return changed ? updated : current
    })
  }, [products, status])

  const updateCart = useCallback(
    (productId: number, change: number) => {
      // Don't allow adding products until their identity
      // has been verified against the API catalogue.
      if (
        status !== 'ready' ||
        !products.some((product) => product.id === productId) ||
        !Number.isSafeInteger(change)
      ) {
        return
      }

      setCart((current) => {
        const existingQuantity = current[productId] ?? 0

        const quantity = Math.max(
          0,
          Math.min(99, existingQuantity + change),
        )

        if (quantity === existingQuantity) {
          return current
        }

        const updated = { ...current }

        if (quantity === 0) {
          delete updated[productId]
        } else {
          updated[productId] = quantity
        }

        return updated
      })
    },
    [products, status],
  )

  const clearCart = useCallback(() => {
    setCart({})
  }, [])

  const openCart = useCallback(() => {
    setCartOpen(true)
  }, [])

  const closeCart = useCallback(() => {
    setCartOpen(false)
  }, [])

  // Build basket details from the CURRENT API products.
  const cartProducts = useMemo<CartProduct[]>(() => {
    return products
      .filter((product) => (cart[product.id] ?? 0) > 0)
      .map((product) => {
        const quantity = cart[product.id] ?? 0

        return {
          product,
          quantity,
          lineTotal: product.price * quantity,
        }
      })
  }, [cart, products])

  // Preserve the saved item count while products are loading.
  const cartCount = useMemo(() => {
    if (status !== 'ready') {
      return Object.values(cart).reduce(
        (total, quantity) => total + quantity,
        0,
      )
    }

    return cartProducts.reduce(
      (total, item) => total + item.quantity,
      0,
    )
  }, [cart, cartProducts, status])

  const cartTotal = useMemo(() => {
    return cartProducts.reduce(
      (total, item) => total + item.lineTotal,
      0,
    )
  }, [cartProducts])

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      cartProducts,
      cartCount,
      cartTotal,
      cartOpen,
      openCart,
      closeCart,
      updateCart,
      clearCart,
    }),
    [
      cart,
      cartProducts,
      cartCount,
      cartTotal,
      cartOpen,
      openCart,
      closeCart,
      updateCart,
      clearCart,
    ],
  )

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext)

  if (context === undefined) {
    throw new Error(
      'useCart must be used within a CartProvider',
    )
  }

  return context
}
