import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { products } from '../data/products'
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

const CartContext = createContext<CartContextValue | undefined>(
  undefined,
)

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

    for (const product of products) {
      const quantity = savedItems[String(product.id)]

      if (
        typeof quantity === 'number' &&
        Number.isSafeInteger(quantity) &&
        quantity > 0
      ) {
        validCart[product.id] = Math.min(quantity, 99)
      }
    }

    return validCart
  } catch {
    return {}
  }
}

export function CartProvider({
  children,
}: {
  children: ReactNode
}) {
  const [cart, setCart] = useState<CartItems>(loadSavedCart)
  const [cartOpen, setCartOpen] = useState(false)

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
      // Cart continues working in memory if storage is unavailable.
    }
  }, [cart])

  const updateCart = useCallback(
    (productId: number, change: number) => {
      if (
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

        const updated = { ...current }

        if (quantity === 0) {
          delete updated[productId]
        } else {
          updated[productId] = quantity
        }

        return updated
      })
    },
    [],
  )

  const clearCart = useCallback(() => setCart({}), [])
  const openCart = useCallback(() => setCartOpen(true), [])
  const closeCart = useCallback(() => setCartOpen(false), [])

  const cartProducts = useMemo<CartProduct[]>(
    () =>
      products
        .filter((product) => (cart[product.id] ?? 0) > 0)
        .map((product) => {
          const quantity = cart[product.id] ?? 0

          return {
            product,
            quantity,
            lineTotal: product.price * quantity,
          }
        }),
    [cart],
  )

  const cartCount = useMemo(
    () =>
      cartProducts.reduce(
        (total, item) => total + item.quantity,
        0,
      ),
    [cartProducts],
  )

  const cartTotal = useMemo(
    () =>
      cartProducts.reduce(
        (total, item) => total + item.lineTotal,
        0,
      ),
    [cartProducts],
  )

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

  if (!context) {
    throw new Error(
      'useCart must be used within a CartProvider',
    )
  }

  return context
}
