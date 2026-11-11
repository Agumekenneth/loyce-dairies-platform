
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'

import { Link } from 'react-router-dom'

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  ShoppingBag,
  Truck,
  UserRound,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useCatalog } from '../context/CatalogContext'
import { formatPrice } from '../data/products'

import {
  fetchDeliveryZones,
  submitCheckout,
  type CheckoutPayload,
  type CreatedOrder,
  type DeliveryZone,
  type FulfillmentMethod,
} from '../services/checkoutApi'

// ==========================================
// LOYCE DAIRIES PLATFORM
// CUSTOMER CHECKOUT PAGE
//
// MILESTONE 4.9.4A
// STOCK-AWARE CHECKOUT VALIDATION
// ==========================================

const MAX_CART_QUANTITY = 99

// ==========================================
// DISPLAY HELPERS
// ==========================================

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Unable to complete checkout. Please try again.'
}

function isStockRelatedError(message: string): boolean {
  return (
    /insufficient stock/i.test(message) ||
    /selected products? (are|is) unavailable/i.test(message)
  )
}

// ==========================================
// CHECKOUT PAGE
// ==========================================

export default function CheckoutPage() {
  // ========================================
  // AUTHENTICATED CUSTOMER
  // ========================================

  const { customer } = useAuth()

  // ========================================
  // LIVE PRODUCT CATALOGUE
  // ========================================

  const {
    status: catalogStatus,
    reloadCatalog,
  } = useCatalog()

  // ========================================
  // SHOPPING BASKET
  // ========================================

  const {
    cartProducts,
    cartTotal,
    clearCart,
  } = useCart()

  // ========================================
  // CUSTOMER INFORMATION
  // ========================================

  const [recipientName, setRecipientName] =
    useState(customer?.fullName ?? '')

  const [contactPhone, setContactPhone] =
    useState(customer?.phone ?? '')

  // ========================================
  // FULFILLMENT METHOD
  // ========================================

  const [fulfillmentMethod, setFulfillmentMethod] =
    useState<FulfillmentMethod>('PICKUP')

  // ========================================
  // DELIVERY ZONES
  // ========================================

  const [deliveryZones, setDeliveryZones] =
    useState<DeliveryZone[]>([])

  const [zonesLoading, setZonesLoading] =
    useState(true)

  const [zonesError, setZonesError] =
    useState<string | null>(null)

  const [deliveryZoneId, setDeliveryZoneId] =
    useState('')

  const [deliveryAddress, setDeliveryAddress] =
    useState('')

  const [
    deliveryInstructions,
    setDeliveryInstructions,
  ] = useState('')

  // ========================================
  // CHECKOUT STATE
  // ========================================

  const [isSubmitting, setIsSubmitting] =
    useState(false)

  const submittingRef = useRef(false)

  const [checkoutError, setCheckoutError] =
    useState<string | null>(null)

  const [createdOrder, setCreatedOrder] =
    useState<CreatedOrder | null>(null)

  // ========================================
  // REFRESH CATALOGUE ON PAGE ENTRY
  // ========================================

  /**
   * Refresh product information when
   * the checkout page is opened.
   *
   * This helps identify changes to:
   * - Product availability
   * - Product activation
   * - Current selling prices
   *
   * CartContext reconciles unavailable
   * products after successful loading.
   *
   * A temporary API failure does not
   * erase the saved basket.
   */

  useEffect(() => {
    reloadCatalog()
  }, [reloadCatalog])

  // ========================================
  // LOAD DELIVERY ZONES
  // ========================================

  useEffect(() => {
    let active = true

    async function loadZones() {
      setZonesLoading(true)
      setZonesError(null)

      try {
        const zones = await fetchDeliveryZones()

        if (!active) return

        setDeliveryZones(zones)
      } catch (error: unknown) {
        if (!active) return

        setZonesError(
          getErrorMessage(error),
        )
      } finally {
        if (active) {
          setZonesLoading(false)
        }
      }
    }

    void loadZones()

    return () => {
      active = false
    }
  }, [])

  // ========================================
  // CATALOGUE STATUS
  // ========================================

  const isCatalogReady =
    catalogStatus === 'ready'

  // ========================================
  // VALIDATE BASKET AVAILABILITY
  // ========================================

  /**
   * Checkout is available only when
   * every basket item is present in
   * the current public catalogue and
   * explicitly marked as in stock.
   *
   * The frontend does not know exact
   * stock quantities.
   *
   * The backend performs final
   * quantity validation atomically.
   */

  const hasValidCartItems =
    cartProducts.length > 0 &&
    cartProducts.every(
      ({ product, quantity }) =>
        product.inStock === true &&
        Number.isSafeInteger(quantity) &&
        quantity >= 1 &&
        quantity <= MAX_CART_QUANTITY,
    )

  // ========================================
  // SELECTED DELIVERY ZONE
  // ========================================

  const selectedZone = deliveryZones.find(
    (zone) =>
      String(zone.id) === deliveryZoneId,
  )

  // ========================================
  // ESTIMATED DELIVERY FEE
  // ========================================

  const estimatedDeliveryFee =
    fulfillmentMethod === 'DELIVERY'
      ? selectedZone?.feeUgx ?? null
      : 0

  // ========================================
  // ESTIMATED ORDER TOTAL
  // ========================================

  const estimatedTotal =
    estimatedDeliveryFee === null
      ? null
      : cartTotal + estimatedDeliveryFee

  // ========================================
  // PAYMENT METHOD
  // ========================================

  const paymentMethod =
    fulfillmentMethod === 'PICKUP'
      ? 'CASH_ON_PICKUP'
      : 'CASH_ON_DELIVERY'

  // ========================================
  // DELIVERY VALIDATION
  // ========================================

  const deliveryIsValid =
    fulfillmentMethod === 'PICKUP' ||
    (
      selectedZone !== undefined &&
      !zonesLoading &&
      !zonesError
    )

  // ========================================
  // CHECKOUT ELIGIBILITY
  // ========================================

  const canSubmit =
    isCatalogReady &&
    hasValidCartItems &&
    deliveryIsValid &&
    !isSubmitting &&
    !createdOrder

  // ========================================
  // SUBMIT CHECKOUT
  // ========================================

  async function handleCheckout(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    // Prevent duplicate concurrent requests.
    if (
      submittingRef.current ||
      createdOrder
    ) {
      return
    }

    setCheckoutError(null)

    // ======================================
    // VERIFY CATALOGUE STATUS
    // ======================================

    if (!isCatalogReady) {
      setCheckoutError(
        'Product availability is being checked. Please try again after the catalogue loads.',
      )
      return
    }

    // ======================================
    // VERIFY CART AVAILABILITY
    // ======================================

    if (!hasValidCartItems) {
      setCheckoutError(
        'Your basket contains unavailable or invalid items. Please review your basket.',
      )
      return
    }

    // ======================================
    // VERIFY CUSTOMER CONTACT
    // ======================================

    const name = recipientName.trim()
    const phone = contactPhone.trim()

    if (
      name.length < 2 ||
      name.length > 100
    ) {
      setCheckoutError(
        'Enter a valid recipient name.',
      )
      return
    }

    if (
      phone.length < 7 ||
      phone.length > 20
    ) {
      setCheckoutError(
        'Enter a valid contact phone number.',
      )
      return
    }

    // ======================================
    // VERIFY DELIVERY SELECTION
    // ======================================

    if (
      fulfillmentMethod === 'DELIVERY' &&
      !selectedZone
    ) {
      setCheckoutError(
        'Please select an available delivery zone.',
      )
      return
    }

    // ======================================
    // PREPARE ORDER ITEMS
    // ======================================

    /**
     * Send only product IDs and quantities.
     *
     * Never send product prices or
     * calculated totals as authoritative
     * checkout values.
     */

    const items = cartProducts.map(
      ({ product, quantity }) => ({
        productId: product.id,
        quantity,
      }),
    )

    const common = {
      recipientName: name,
      contactPhone: phone,
      items,
    }

    // ======================================
    // BUILD TYPE-SAFE CHECKOUT PAYLOAD
    // ======================================

    let payload: CheckoutPayload

    if (fulfillmentMethod === 'PICKUP') {
      payload = {
        ...common,
        fulfillmentMethod: 'PICKUP',
        paymentMethod: 'CASH_ON_PICKUP',
      }
    } else {
      if (!selectedZone) {
        return
      }

      payload = {
        ...common,
        fulfillmentMethod: 'DELIVERY',
        paymentMethod: 'CASH_ON_DELIVERY',
        deliveryZoneId: selectedZone.id,
        deliveryAddress:
          deliveryAddress.trim(),

        ...(deliveryInstructions.trim()
          ? {
              deliveryInstructions:
                deliveryInstructions.trim(),
            }
          : {}),
      }
    }

    // ======================================
    // BEGIN ORDER SUBMISSION
    // ======================================

    submittingRef.current = true
    setIsSubmitting(true)

    try {
      const order =
        await submitCheckout(payload)

      // Save the server-confirmed order
      // before clearing the basket.

      setCreatedOrder(order)

      // Clear only after confirmed success.
      clearCart()

      // Refresh public inventory and
      // product availability after checkout.

      reloadCatalog()
    } catch (error: unknown) {
      const message = getErrorMessage(error)

      setCheckoutError(message)

      /**
       * Refresh the catalogue after an
       * explicit stock-related rejection.
       *
       * Do not automatically retry checkout.
       *
       * On ambiguous network failures,
       * preserve the original instruction
       * to check order history first.
       */

      if (isStockRelatedError(message)) {
        reloadCatalog()
      }
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  // ========================================
  // SERVER-CONFIRMED ORDER RECEIPT
  // ========================================

  if (createdOrder) {
    return (
      <main className="min-h-screen bg-cream px-5 py-16">

        <section
          role="status"
          className="mx-auto max-w-2xl rounded-[2rem] border border-brand/10 bg-white p-7 text-center shadow-sm sm:p-12"
        >

          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sage">
            <CheckCircle2
              size={44}
              className="text-brand-light"
              aria-hidden="true"
            />
          </div>

          <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-brand-light">
            ORDER RECEIVED
          </p>

          <h1 className="mt-4 font-display text-4xl text-brand">
            Thank you for your order!
          </h1>

          <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-brand/65">
            Your order has been recorded
            successfully and is awaiting
            confirmation by Loyce Dairies.
          </p>

          {/* Order receipt */}

          <div className="mt-9 rounded-2xl bg-cream p-6 text-left">

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-brand/60">
                Order number
              </span>

              <strong className="break-all text-sm text-brand">
                {createdOrder.orderNumber}
              </strong>
            </div>

            {/* Purchased items */}

            <div className="mt-5 border-t border-brand/10 pt-5">

              {createdOrder.items.map((item) => (
                <div
                  key={item.id}
                  className="mb-3 flex items-start justify-between gap-4 text-sm"
                >
                  <span className="text-brand/70">
                    {item.productName}
                    {' × '}
                    {item.quantity}
                  </span>

                  <strong className="text-brand">
                    {formatPrice(
                      item.lineTotalUgx,
                    )}
                  </strong>
                </div>
              ))}
            </div>

            {/* Confirmed amounts */}

            <div className="mt-5 space-y-3 border-t border-brand/10 pt-5 text-sm">

              <div className="flex justify-between gap-4">
                <span className="text-brand/60">
                  Subtotal
                </span>

                <span className="text-brand">
                  {formatPrice(
                    createdOrder.subtotalUgx,
                  )}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-brand/60">
                  Delivery
                </span>

                <span className="text-brand">
                  {formatPrice(
                    createdOrder.deliveryFeeUgx,
                  )}
                </span>
              </div>

              <div className="flex justify-between gap-4 border-t border-brand/10 pt-4">
                <strong className="text-brand">
                  Total
                </strong>

                <strong className="text-xl text-brand">
                  {formatPrice(
                    createdOrder.totalUgx,
                  )}
                </strong>
              </div>
            </div>
          </div>

          {/* Order status */}

          <div className="mt-6 rounded-2xl bg-sage p-5 text-left text-sm leading-7 text-brand">

            <p>
              <strong>Fulfillment:</strong>{' '}
              {createdOrder.fulfillmentMethod === 'PICKUP'
                ? 'Pickup'
                : 'Delivery'}
            </p>

            <p>
              <strong>Payment:</strong>{' '}
              {createdOrder.paymentMethod ===
              'CASH_ON_PICKUP'
                ? 'Cash on pickup'
                : 'Cash on delivery'}
            </p>

            <p>
              <strong>Order status:</strong>{' '}
              {createdOrder.status}
            </p>

            <p>
              <strong>Payment status:</strong>{' '}
              {createdOrder.paymentStatus}
            </p>
          </div>

          <p className="mt-6 text-xs leading-6 text-brand/55">
            No electronic payment has been
            processed. Pickup or delivery
            arrangements are subject to
            order confirmation.
          </p>

          {/* Receipt navigation */}

          <div className="mt-9 flex flex-wrap justify-center gap-3">

            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-7 py-4 text-sm font-bold text-white hover:bg-brand-light"
            >
              Continue shopping
              <ArrowRight size={17} />
            </Link>

            <Link
              to="/account"
              className="rounded-full border border-brand/15 px-7 py-4 text-sm font-bold text-brand hover:bg-sage"
            >
              My account
            </Link>
          </div>
        </section>
      </main>
    )
  }

  // ========================================
  // CATALOGUE LOADING OR ERROR
  // ========================================

  if (!isCatalogReady) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center bg-cream px-5 text-center">

        {catalogStatus === 'loading' ? (
          <>
            <LoaderCircle
              size={34}
              className="animate-spin text-brand-light"
            />

            <h1 className="mt-5 font-display text-2xl text-brand">
              Preparing your checkout
            </h1>

            <p className="mt-3 text-sm text-brand/65">
              Checking current product
              information and availability.
            </p>
          </>
        ) : (
          <>
            <AlertCircle
              size={38}
              className="text-amber-700"
            />

            <h1 className="mt-5 font-display text-2xl text-brand">
              Checkout temporarily unavailable
            </h1>

            <p className="mt-3 max-w-sm text-sm leading-6 text-brand/65">
              We couldn't load the latest
              product catalogue. Your basket
              has been preserved.
            </p>

            <button
              type="button"
              onClick={reloadCatalog}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white"
            >
              <RefreshCw size={17} />
              Try again
            </button>
          </>
        )}
      </main>
    )
  }

  // ========================================
  // EMPTY OR UNAVAILABLE BASKET
  // ========================================

  if (!hasValidCartItems) {
    return (
      <main className="min-h-[70vh] bg-cream px-5 py-20 text-center">

        <ShoppingBag
          size={46}
          className="mx-auto text-brand/35"
        />

        <h1 className="mt-6 font-display text-4xl text-brand">
          Your basket is empty
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-brand/65">
          Add an available dairy product
          before checking out. Products
          without available stock cannot
          be ordered.
        </p>

        <Link
          to="/products"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-4 text-sm font-bold text-white hover:bg-brand-light"
        >
          Browse products
          <ArrowRight size={18} />
        </Link>
      </main>
    )
  }

  // ========================================
  // MAIN CHECKOUT PAGE
  // ========================================

  return (
    <main className="min-h-screen bg-cream">

      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">

        {/* Back navigation */}

        <Link
          to="/products"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand/65 hover:text-brand"
        >
          <ArrowLeft size={17} />
          Continue shopping
        </Link>

        {/* Page heading */}

        <div className="mt-8">

          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-light">
            LOYCE DAIRIES CHECKOUT
          </p>

          <h1 className="mt-4 font-display text-4xl text-brand sm:text-5xl">
            Almost there.
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-7 text-brand/65">
            Review your dairy favourites and
            choose how you'd like to receive
            your order.
          </p>
        </div>

        {/* ==================================
            CHECKOUT FORM
        ================================== */}

        <form
          onSubmit={(event) => {
            void handleCheckout(event)
          }}
          className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]"
        >

          <div className="space-y-7">

            {/* ==============================
                CUSTOMER CONTACT DETAILS
            ============================== */}

            <section className="rounded-[2rem] border border-brand/10 bg-white p-6 sm:p-9">

              <div className="flex items-center gap-3">
                <UserRound
                  size={25}
                  className="text-brand-light"
                />

                <h2 className="font-display text-2xl text-brand">
                  Contact details
                </h2>
              </div>

              <div className="mt-7 grid gap-5 sm:grid-cols-2">

                <div>
                  <label
                    htmlFor="checkout-name"
                    className="mb-2 block text-sm font-bold text-brand"
                  >
                    Recipient name
                  </label>

                  <input
                    id="checkout-name"
                    type="text"
                    value={recipientName}
                    onChange={(event) =>
                      setRecipientName(
                        event.target.value,
                      )
                    }
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                    disabled={isSubmitting}
                    placeholder="Full name"
                    className="w-full rounded-xl border border-brand/15 bg-cream px-4 py-4 text-sm text-brand outline-none focus:border-brand-light disabled:opacity-60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="checkout-phone"
                    className="mb-2 flex items-center gap-2 text-sm font-bold text-brand"
                  >
                    <Phone size={15} />
                    Contact phone
                  </label>

                  <input
                    id="checkout-phone"
                    type="tel"
                    value={contactPhone}
                    onChange={(event) =>
                      setContactPhone(
                        event.target.value,
                      )
                    }
                    autoComplete="tel"
                    required
                    minLength={7}
                    maxLength={20}
                    disabled={isSubmitting}
                    placeholder="+256 700 000 000"
                    className="w-full rounded-xl border border-brand/15 bg-cream px-4 py-4 text-sm text-brand outline-none focus:border-brand-light disabled:opacity-60"
                  />
                </div>
              </div>

              <p className="mt-4 text-xs text-brand/50">
                Signed in as {customer?.email}
              </p>
            </section>

            {/* ==============================
                FULFILLMENT METHOD
            ============================== */}

            <section className="rounded-[2rem] border border-brand/10 bg-white p-6 sm:p-9">

              <h2 className="font-display text-2xl text-brand">
                How would you like your order?
              </h2>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">

                {/* Pickup */}

                <label
                  className={`cursor-pointer rounded-2xl border p-5 transition-colors ${
                    fulfillmentMethod === 'PICKUP'
                      ? 'border-brand bg-sage'
                      : 'border-brand/15 bg-cream'
                  }`}
                >
                  <div className="flex items-center justify-between">

                    <PackageCheck
                      size={26}
                      className="text-brand-light"
                    />

                    <input
                      type="radio"
                      name="fulfillmentMethod"
                      value="PICKUP"
                      checked={
                        fulfillmentMethod === 'PICKUP'
                      }
                      disabled={isSubmitting}
                      onChange={() =>
                        setFulfillmentMethod('PICKUP')
                      }
                      className="accent-brand"
                    />
                  </div>

                  <p className="mt-4 font-bold text-brand">
                    Pickup
                  </p>

                  <p className="mt-2 text-xs leading-6 text-brand/60">
                    Collect your order after
                    pickup arrangements are
                    confirmed.
                  </p>
                </label>

                {/* Delivery */}

                <label
                  className={`cursor-pointer rounded-2xl border p-5 transition-colors ${
                    fulfillmentMethod === 'DELIVERY'
                      ? 'border-brand bg-sage'
                      : 'border-brand/15 bg-cream'
                  }`}
                >
                  <div className="flex items-center justify-between">

                    <Truck
                      size={26}
                      className="text-brand-light"
                    />

                    <input
                      type="radio"
                      name="fulfillmentMethod"
                      value="DELIVERY"
                      checked={
                        fulfillmentMethod === 'DELIVERY'
                      }
                      disabled={isSubmitting}
                      onChange={() =>
                        setFulfillmentMethod('DELIVERY')
                      }
                      className="accent-brand"
                    />
                  </div>

                  <p className="mt-4 font-bold text-brand">
                    Delivery
                  </p>

                  <p className="mt-2 text-xs leading-6 text-brand/60">
                    Available within configured
                    delivery zones.
                  </p>
                </label>
              </div>

              {/* ============================
                  DELIVERY DETAILS
              ============================ */}

              {fulfillmentMethod === 'DELIVERY' && (
                <div className="mt-7 space-y-5 border-t border-brand/10 pt-7">

                  {zonesLoading && (
                    <p
                      role="status"
                      className="flex items-center gap-2 text-sm text-brand/60"
                    >
                      <LoaderCircle
                        size={17}
                        className="animate-spin"
                      />

                      Loading delivery zones...
                    </p>
                  )}

                  {zonesError && (
                    <div
                      role="alert"
                      className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800"
                    >
                      {zonesError}
                      {' '}You can still choose pickup.
                    </div>
                  )}

                  {!zonesLoading &&
                    !zonesError &&
                    deliveryZones.length === 0 && (
                      <div className="rounded-xl bg-sage p-4 text-sm leading-7 text-brand">
                        Delivery is not currently
                        available. Please choose pickup.
                      </div>
                    )}

                  {/* Delivery zone */}

                  <div>
                    <label
                      htmlFor="checkout-zone"
                      className="mb-2 block text-sm font-bold text-brand"
                    >
                      Delivery zone
                    </label>

                    <select
                      id="checkout-zone"
                      value={deliveryZoneId}
                      onChange={(event) =>
                        setDeliveryZoneId(
                          event.target.value,
                        )
                      }
                      disabled={
                        isSubmitting ||
                        zonesLoading ||
                        Boolean(zonesError) ||
                        deliveryZones.length === 0
                      }
                      required
                      className="w-full rounded-xl border border-brand/15 bg-cream px-4 py-4 text-sm text-brand outline-none focus:border-brand-light disabled:opacity-60"
                    >
                      <option value="">
                        Select a delivery zone
                      </option>

                      {deliveryZones.map((zone) => (
                        <option
                          key={zone.id}
                          value={zone.id}
                        >
                          {zone.name}
                          {' — '}
                          {formatPrice(zone.feeUgx)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Delivery address */}

                  <div>
                    <label
                      htmlFor="checkout-address"
                      className="mb-2 flex items-center gap-2 text-sm font-bold text-brand"
                    >
                      <MapPin size={16} />
                      Delivery address
                    </label>

                    <textarea
                      id="checkout-address"
                      value={deliveryAddress}
                      onChange={(event) =>
                        setDeliveryAddress(
                          event.target.value,
                        )
                      }
                      rows={3}
                      required
                      minLength={8}
                      maxLength={250}
                      disabled={isSubmitting}
                      placeholder="Enter your delivery address and nearby landmark"
                      className="w-full resize-y rounded-xl border border-brand/15 bg-cream px-4 py-4 text-sm text-brand outline-none focus:border-brand-light disabled:opacity-60"
                    />
                  </div>

                  {/* Delivery instructions */}

                  <div>
                    <label
                      htmlFor="checkout-instructions"
                      className="mb-2 block text-sm font-bold text-brand"
                    >
                      Delivery instructions (optional)
                    </label>

                    <textarea
                      id="checkout-instructions"
                      value={deliveryInstructions}
                      onChange={(event) =>
                        setDeliveryInstructions(
                          event.target.value,
                        )
                      }
                      rows={2}
                      maxLength={500}
                      disabled={isSubmitting}
                      placeholder="Additional delivery details"
                      className="w-full resize-y rounded-xl border border-brand/15 bg-cream px-4 py-4 text-sm text-brand outline-none focus:border-brand-light disabled:opacity-60"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* ==============================
                PAYMENT METHOD
            ============================== */}

            <section className="rounded-[2rem] border border-brand/10 bg-white p-6 sm:p-9">

              <h2 className="font-display text-2xl text-brand">
                Payment method
              </h2>

              <div className="mt-6 rounded-2xl bg-sage p-5">

                <p className="text-sm font-bold text-brand">
                  {paymentMethod === 'CASH_ON_PICKUP'
                    ? 'Cash on pickup'
                    : 'Cash on delivery'}
                </p>

                <p className="mt-2 text-xs leading-6 text-brand/65">
                  No online payment is collected
                  during this checkout.
                </p>
              </div>

              <p className="mt-4 text-xs leading-6 text-brand/50">
                Mobile Money and card payments
                will be introduced after secure
                payment integration and testing.
              </p>
            </section>
          </div>

          {/* ==============================
              ORDER SUMMARY
          ============================== */}

          <aside className="rounded-[2rem] border border-brand/10 bg-white p-6 lg:sticky lg:top-28">

            <div className="flex items-center gap-3">

              <ShoppingBag
                size={24}
                className="text-brand-light"
              />

              <h2 className="font-display text-2xl text-brand">
                Your order
              </h2>
            </div>

            {/* Order items */}

            <div className="mt-7 space-y-5">

              {cartProducts.map(({
                product,
                quantity,
                lineTotal,
              }) => (
                <div
                  key={product.id}
                  className="flex items-start justify-between gap-4"
                >
                  <div>
                    <p className="text-sm font-bold text-brand">
                      {product.name}
                    </p>

                    <p className="mt-1 text-xs text-brand/55">
                      {product.unit}
                      {' × '}
                      {quantity}
                    </p>
                  </div>

                  <strong className="shrink-0 text-sm text-brand">
                    {formatPrice(lineTotal)}
                  </strong>
                </div>
              ))}
            </div>

            {/* Estimated amounts */}

            <div className="mt-7 space-y-4 border-t border-brand/10 pt-6 text-sm">

              <div className="flex justify-between gap-4">

                <span className="text-brand/60">
                  Subtotal
                </span>

                <span className="font-bold text-brand">
                  {formatPrice(cartTotal)}
                </span>
              </div>

              <div className="flex justify-between gap-4">

                <span className="text-brand/60">
                  Delivery fee
                </span>

                <span className="font-bold text-brand">
                  {estimatedDeliveryFee === null
                    ? 'Select zone'
                    : formatPrice(
                        estimatedDeliveryFee,
                      )}
                </span>
              </div>

              <div className="flex justify-between gap-4 border-t border-brand/10 pt-5">

                <strong className="text-brand">
                  Estimated total
                </strong>

                <strong className="text-lg text-brand">
                  {estimatedTotal === null
                    ? '—'
                    : formatPrice(
                        estimatedTotal,
                      )}
                </strong>
              </div>
            </div>

            {/* Server validation notice */}

            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-sage/50 p-4">

              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0 text-brand-light"
              />

              <p className="text-xs leading-6 text-brand/65">
                Product availability has been
                checked against the public
                catalogue. The server verifies
                final inventory quantities,
                prices and delivery charges
                before accepting your order.
              </p>
            </div>

            {/* Checkout error */}

            {checkoutError && (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle
                    size={18}
                    className="mt-0.5 shrink-0"
                  />

                  <p>{checkoutError}</p>
                </div>
              </div>
            )}

            {/* Submit order */}

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-7 flex w-full items-center justify-center gap-3 rounded-full bg-brand px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />

                  Placing order...
                </>
              ) : (
                <>
                  Place order
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <p className="mt-5 text-center text-xs leading-6 text-brand/50">
              Orders are subject to confirmation
              and final product availability.
            </p>
          </aside>
        </form>
      </div>
    </main>
  )
}
