
/**
 * LOYCE DAIRIES PLATFORM
 * CUSTOMER PRODUCT TYPES
 *
 * MILESTONE 4.9.3
 * STOCK AVAILABILITY INTEGRATION
 */

export type Product = {
  // ========================================
  // PRODUCT IDENTITY
  // ========================================

  id: number
  name: string
  category: string

  // ========================================
  // PRICING AND UNIT
  // ========================================

  price: number
  unit: string

  // ========================================
  // PRODUCT PRESENTATION
  // ========================================

  image: string
  badge?: string
  description?: string
  highlights?: string[]

  // ========================================
  // INVENTORY AVAILABILITY
  // ========================================

  /**
   * Public stock availability from the backend.
   *
   * true  = at least one sellable unit available
   * false = no sellable units available
   *
   * Undefined indicates that availability has
   * not been supplied by the product source.
   *
   * Customer cart operations must treat
   * undefined as unavailable.
   *
   * This field is optional temporarily to
   * preserve compatibility with older static
   * product definitions.
   */
  inStock?: boolean
}
