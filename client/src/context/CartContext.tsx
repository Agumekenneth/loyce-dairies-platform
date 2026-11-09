import {
  createContext,
  useCallback,
  useContext,
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

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItems>({})
  const [cartOpen, setCartOpen] = useState(false)

  const updateCart = useCallback((productId: number, change: number) => {
    setCart((current) => {
      const quantity = Math.max(
        0,
        (current[productId] ?? 0) + change,
      )

      const updated = { ...current }

      if (quantity === 0) {
        delete updated[productId]
      } else {
        updated[productId] = quantity
      }

      return updated
    })
  }, [])

  const clearCart = useCallback(() => {
    setCart({})
  }, [])

  const openCart = useCallback(() => {
    setCartOpen(true)
  }, [])

  const closeCart = useCallback(() => {
    setCartOpen(false)
  }, [])

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
  }, [cart])

  const cartCount = useMemo(() => {
    return cartProducts.reduce(
      (total, item) => total + item.quantity,
      0,
    )
  }, [cartProducts])

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
    throw new Error('useCart must be used within a CartProvider')
  }

  return context
}
