
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

// ==========================================
// LOYCE DAIRIES PLATFORM
// SHOPPING CART CONTEXT
//
// MILESTONE 4.9.3C
// INVENTORY AVAILABILITY PROTECTION
// ==========================================

// ==========================================
// CART TYPES
// ==========================================

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

  updateCart: (
    productId: number,
    change: number,
  ) => void

  clearCart: () => void
}

// ==========================================
// CART CONFIGURATION
// ==========================================

// Preserve the existing storage key so
// customers do not lose saved basket data.
const STORAGE_KEY = 'loyce-dairies-cart-v1'

// Existing per-product quantity limit.
const MAX_CART_QUANTITY = 99

// ==========================================
// CART CONTEXT
// ==========================================

const CartContext = createContext<
  CartContextValue | undefined
>(undefined)

// ==========================================
// RESTORE SAVED CART
// ==========================================

function loadSavedCart(): CartItems {
  try {
    const saved = localStorage.getItem(
      STORAGE_KEY,
    )

    if (!saved) {
      return {}
    }

    const parsed: unknown = JSON.parse(saved)

    // Reject malformed stored data.
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {}
    }

    const savedItems = parsed as Record<
      string,
      unknown
    >

    const validCart: CartItems = {}

    for (
      const [key, value]
      of Object.entries(savedItems)
    ) {
      const productId = Number(key)

      const validProductId =
        Number.isSafeInteger(productId) &&
        productId > 0 &&
        String(productId) === key

      const validQuantity =
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value > 0

      if (
        !validProductId ||
        !validQuantity
      ) {
        continue
      }

      validCart[productId] = Math.min(
        value as number,
        MAX_CART_QUANTITY,
      )
    }

    return validCart
  } catch {
    // Browser storage may be unavailable
    // or contain malformed JSON.
    //
    // Continue with an empty basket
    // without crashing the application.
    return {}
  }
}

// ==========================================
// CART PROVIDER
// ==========================================

export function CartProvider({
  children,
}: {
  children: ReactNode
}) {
  // ========================================
  // LOAD CURRENT CATALOGUE
  // ========================================

  const {
    products,
    status,
  } = useCatalog()

  // ========================================
  // CART STATE
  // ========================================

  const [cart, setCart] =
    useState<CartItems>(loadSavedCart)

  const [cartOpen, setCartOpen] =
    useState(false)

  // ========================================
  // IDENTIFY PURCHASABLE PRODUCTS
  // ========================================

  /**
   * Only products explicitly confirmed
   * as in stock by the backend can be
   * added to the basket.
   *
   * Missing stock availability is treated
   * as unavailable.
   *
   * Inactive products are already excluded
   * by the public catalogue API.
   */

  const purchasableIds = useMemo(() => {
    return new Set(
      products
        .filter(
          (product) =>
            product.inStock === true,
        )
        .map(
          (product) => product.id,
        ),
    )
  }, [products])

  // ========================================
  // PERSIST BASKET
  // ========================================

  useEffect(() => {
    try {
      if (
        Object.keys(cart).length === 0
      ) {
        localStorage.removeItem(
          STORAGE_KEY,
        )
      } else {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(cart),
        )
      }
    } catch {
      // Preserve the current in-memory
      // basket if localStorage is unavailable.
    }
  }, [cart])

  // ========================================
  // RECONCILE CART WITH CATALOGUE
  // ========================================

  /**
   * After the public catalogue loads:
   *
   * 1. Remove inactive products.
   * 2. Remove products no longer listed.
   * 3. Remove out-of-stock products.
   * 4. Preserve valid basket quantities.
   *
   * Do not clear saved items while the
   * catalogue is loading or has failed.
   */

  useEffect(() => {
    if (status !== 'ready') {
      return
    }

    setCart((current) => {
      const updated: CartItems = {}

      let changed = false

      for (
        const [key, quantity]
        of Object.entries(current)
      ) {
        const productId = Number(key)

        if (
          !purchasableIds.has(productId)
        ) {
          changed = true
          continue
        }

        const safeQuantity = Math.min(
          quantity,
          MAX_CART_QUANTITY,
        )

        updated[productId] = safeQuantity

        if (
          safeQuantity !== quantity
        ) {
          changed = true
        }
      }

      // Avoid unnecessary state updates
      // when the basket is already valid.
      return changed ? updated : current
    })
  }, [
    status,
    purchasableIds,
  ])

  // ========================================
  // UPDATE CART QUANTITIES
  // ========================================

  const updateCart = useCallback(
    (
      productId: number,
      change: number,
    ) => {
      // Reject invalid product IDs.
      if (
        !Number.isSafeInteger(productId) ||
        productId <= 0
      ) {
        return
      }

      // Reject invalid quantity changes.
      if (
        !Number.isSafeInteger(change) ||
        change === 0
      ) {
        return
      }

      // ====================================
      // STOCK AVAILABILITY CHECK
      // ====================================

      /**
       * Positive quantity changes require:
       *
       * - A successfully loaded catalogue.
       * - A valid active product.
       * - Explicit in-stock confirmation.
       *
       * This protects the basket even if
       * a product card has an outdated UI.
       */

      if (change > 0) {
        if (
          status !== 'ready' ||
          !purchasableIds.has(productId)
        ) {
          return
        }
      }

      // Negative changes remain permitted
      // so users can remove existing items.

      setCart((current) => {
        const existingQuantity =
          current[productId] ?? 0

        // Nothing to remove if the item
        // is not currently in the basket.
        if (
          change < 0 &&
          existingQuantity === 0
        ) {
          return current
        }

        const nextQuantity = Math.max(
          0,
          Math.min(
            MAX_CART_QUANTITY,
            existingQuantity + change,
          ),
        )

        // Avoid state changes when the
        // resulting quantity is unchanged.
        if (
          nextQuantity === existingQuantity
        ) {
          return current
        }

        const updated = {
          ...current,
        }

        if (nextQuantity === 0) {
          delete updated[productId]
        } else {
          updated[productId] =
            nextQuantity
        }

        return updated
      })
    },
    [
      status,
      purchasableIds,
    ],
  )

  // ========================================
  // CLEAR CART
  // ========================================

  const clearCart = useCallback(() => {
    setCart({})
  }, [])

  // ========================================
  // OPEN CART DRAWER
  // ========================================

  const openCart = useCallback(() => {
    setCartOpen(true)
  }, [])

  // ========================================
  // CLOSE CART DRAWER
  // ========================================

  const closeCart = useCallback(() => {
    setCartOpen(false)
  }, [])

  // ========================================
  // BUILD CART PRODUCT DETAILS
  // ========================================

  /**
   * Build display information using
   * current API product records.
   *
   * Products without verified stock
   * availability are excluded.
   *
   * The reconciliation effect removes
   * their saved quantities.
   */

  const cartProducts = useMemo<
    CartProduct[]
  >(() => {
    return products
      .filter(
        (product) =>
          product.inStock === true &&
          (cart[product.id] ?? 0) > 0,
      )
      .map((product) => {
        const quantity =
          cart[product.id] ?? 0

        return {
          product,
          quantity,
          lineTotal:
            product.price * quantity,
        }
      })
  }, [
    cart,
    products,
  ])

  // ========================================
  // CALCULATE CART ITEM COUNT
  // ========================================

  const cartCount = useMemo(() => {
    /**
     * While the catalogue is unavailable,
     * retain the saved item count.
     *
     * This prevents temporary API
     * failures from making a saved basket
     * appear permanently empty.
     */

    if (status !== 'ready') {
      return Object.values(cart).reduce(
        (total, quantity) =>
          total + quantity,
        0,
      )
    }

    return cartProducts.reduce(
      (total, item) =>
        total + item.quantity,
      0,
    )
  }, [
    cart,
    cartProducts,
    status,
  ])

  // ========================================
  // CALCULATE CART TOTAL
  // ========================================

  /**
   * Current prices come from the
   * PostgreSQL-backed public catalogue.
   *
   * These are display totals only.
   * The backend must calculate and
   * validate authoritative checkout
   * totals independently.
   */

  const cartTotal = useMemo(() => {
    return cartProducts.reduce(
      (total, item) =>
        total + item.lineTotal,
      0,
    )
  }, [cartProducts])

  // ========================================
  // EXPOSE CART CONTEXT
  // ========================================

  const value = useMemo<
    CartContextValue
  >(() => ({
    cart,
    cartProducts,
    cartCount,
    cartTotal,
    cartOpen,

    openCart,
    closeCart,

    updateCart,
    clearCart,
  }), [
    cart,
    cartProducts,
    cartCount,
    cartTotal,
    cartOpen,

    openCart,
    closeCart,

    updateCart,
    clearCart,
  ])

  // ========================================
  // CART PROVIDER RENDER
  // ========================================

  return (
    <CartContext.Provider
      value={value}
    >
      {children}
    </CartContext.Provider>
  )
}

// ==========================================
// CART CONTEXT HOOK
// ==========================================

export function useCart():
  CartContextValue {
  const context = useContext(
    CartContext,
  )

  if (context === undefined) {
    throw new Error(
      'useCart must be used within a CartProvider',
    )
  }

  return context
}
