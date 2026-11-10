
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'

import {
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

export default function CheckoutPage() {
  const { customer } = useAuth()

  const { status: catalogStatus, reloadCatalog } =
    useCatalog()

  const {
    cartProducts,
    cartTotal,
    clearCart,
  } = useCart()

  // ==========================================
  // CUSTOMER INFORMATION
  // ==========================================

  const [recipientName, setRecipientName] = useState(
    customer?.fullName ?? '',
  )

  const [contactPhone, setContactPhone] = useState(
    customer?.phone ?? '',
  )

  // ==========================================
  // DELIVERY AND PAYMENT
  // ==========================================

  const [fulfillmentMethod, setFulfillmentMethod] =
    useState<FulfillmentMethod>('PICKUP')

  const [deliveryZones, setDeliveryZones] = useState<
    DeliveryZone[]
  >([])

  const [zonesLoading, setZonesLoading] = useState(true)
  const [zonesError, setZonesError] = useState<string | null>(
    null,
  )

  const [deliveryZoneId, setDeliveryZoneId] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryInstructions, setDeliveryInstructions] =
    useState('')

  // ==========================================
  // CHECKOUT STATE
  // ==========================================

  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const [checkoutError, setCheckoutError] = useState<
    string | null
  >(null)

  const [createdOrder, setCreatedOrder] = useState<
    CreatedOrder | null
  >(null)

  // ==========================================
  // LOAD DELIVERY ZONES
  // ==========================================

  useEffect(() => {
    let active = true

    const loadZones = async () => {
      try {
        const zones = await fetchDeliveryZones()

        if (!active) return

        setDeliveryZones(zones)
        setZonesError(null)
      } catch (error: unknown) {
        if (!active) return

        setZonesError(
          error instanceof Error
            ? error.message
            : 'Unable to load delivery zones.',
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

  // ==========================================
  // CALCULATE DISPLAY ESTIMATES
  // ==========================================

  const selectedZone = deliveryZones.find(
    (zone) => String(zone.id) === deliveryZoneId,
  )

  const estimatedDeliveryFee =
    fulfillmentMethod === 'DELIVERY'
      ? selectedZone?.feeUgx ?? null
      : 0

  const estimatedTotal =
    estimatedDeliveryFee === null
      ? null
      : cartTotal + estimatedDeliveryFee

  const paymentMethod =
    fulfillmentMethod === 'PICKUP'
      ? 'CASH_ON_PICKUP'
      : 'CASH_ON_DELIVERY'

  // ==========================================
  // SUBMIT CHECKOUT
  // ==========================================

  const handleCheckout = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (submittingRef.current || createdOrder) return

    setCheckoutError(null)

    if (cartProducts.length === 0) {
      setCheckoutError('Your cart is empty.')
      return
    }

    if (
      fulfillmentMethod === 'DELIVERY' &&
      !selectedZone
    ) {
      setCheckoutError(
        'Please select an available delivery zone.',
      )
      return
    }

    const items = cartProducts.map(
      ({ product, quantity }) => ({
        productId: product.id,
        quantity,
      }),
    )

    const common = {
      recipientName: recipientName.trim(),
      contactPhone: contactPhone.trim(),
      items,
    }

    let payload: CheckoutPayload

    if (fulfillmentMethod === 'PICKUP') {
      payload = {
        ...common,
        fulfillmentMethod: 'PICKUP',
        paymentMethod: 'CASH_ON_PICKUP',
      }
    } else {
      if (!selectedZone) return

      payload = {
        ...common,
        fulfillmentMethod: 'DELIVERY',
        paymentMethod: 'CASH_ON_DELIVERY',
        deliveryZoneId: selectedZone.id,
        deliveryAddress: deliveryAddress.trim(),
        ...(deliveryInstructions.trim()
          ? {
              deliveryInstructions:
                deliveryInstructions.trim(),
            }
          : {}),
      }
    }

    submittingRef.current = true
    setIsSubmitting(true)

    try {
      const order = await submitCheckout(payload)

      // Preserve the server-confirmed order receipt.
      setCreatedOrder(order)

      // Clear the cart only after the server
      // confirms that the order was created.
      clearCart()
    } catch (error: unknown) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : 'Unable to complete checkout.',
      )
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  // ==========================================
  // SERVER-CONFIRMED ORDER RECEIPT
  // ==========================================

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
            Your order has been recorded successfully.
            It is awaiting confirmation by Loyce Dairies.
          </p>

          <div className="mt-9 rounded-2xl bg-cream p-6 text-left">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-brand/60">
                Order number
              </span>

              <strong className="break-all text-sm text-brand">
                {createdOrder.orderNumber}
              </strong>
            </div>

            <div className="mt-5 border-t border-brand/10 pt-5">
              {createdOrder.items.map((item) => (
                <div
                  key={item.id}
                  className="mb-3 flex items-start justify-between gap-4 text-sm"
                >
                  <span className="text-brand/70">
                    {item.productName} × {item.quantity}
                  </span>

                  <strong className="text-brand">
                    {formatPrice(item.lineTotalUgx)}
                  </strong>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3 border-t border-brand/10 pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-brand/60">
                  Subtotal
                </span>
                <span className="text-brand">
                  {formatPrice(createdOrder.subtotalUgx)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-brand/60">
                  Delivery
                </span>
                <span className="text-brand">
                  {createdOrder.deliveryFeeUgx === 0
                    ? 'UGX 0'
                    : formatPrice(
                        createdOrder.deliveryFeeUgx,
                      )}
                </span>
              </div>

              <div className="flex justify-between border-t border-brand/10 pt-4">
                <strong className="text-brand">
                  Total
                </strong>

                <strong className="text-xl text-brand">
                  {formatPrice(createdOrder.totalUgx)}
                </strong>
              </div>
            </div>
          </div>

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
            No electronic payment has been processed.
            Pickup or delivery arrangements are subject
            to order confirmation.
          </p>

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

  // ==========================================
  // CATALOGUE LOADING / ERROR
  // ==========================================

  if (catalogStatus !== 'ready') {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center bg-cream px-5 text-center">
        {catalogStatus === 'loading' ? (
          <>
            <LoaderCircle
              size={34}
              className="animate-spin text-brand-light"
            />

            <p className="mt-5 text-sm text-brand/65">
              Preparing your checkout...
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-brand/70">
              Unable to load your shopping cart.
            </p>

            <button
              type="button"
              onClick={() => void reloadCatalog()}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white"
            >
              <RefreshCw size={17} />
              Try again
            </button>
          </>
        )}
      </main>
    )
  }

  // ==========================================
  // EMPTY CART
  // ==========================================

  if (cartProducts.length === 0) {
    return (
      <main className="min-h-[70vh] bg-cream px-5 py-20 text-center">
        <ShoppingBag
          size={46}
          className="mx-auto text-brand/35"
        />

        <h1 className="mt-6 font-display text-4xl text-brand">
          Your cart is empty
        </h1>

        <p className="mt-4 text-sm text-brand/65">
          Add some dairy favourites before checking out.
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

  // ==========================================
  // MAIN CHECKOUT PAGE
  // ==========================================

  return (
    <main className="min-h-screen bg-cream">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <Link
          to="/products"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand/65 hover:text-brand"
        >
          <ArrowLeft size={17} />
          Continue shopping
        </Link>

        <div className="mt-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-light">
            LOYCE DAIRIES CHECKOUT
          </p>

          <h1 className="mt-4 font-display text-4xl text-brand sm:text-5xl">
            Almost there.
          </h1>

          <p className="mt-4 text-sm leading-7 text-brand/65">
            Review your dairy favourites and choose
            how you'd like to receive your order.
          </p>
        </div>

        <form
          onSubmit={handleCheckout}
          className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]"
        >
          <div className="space-y-7">
            {/* ==================================
                CUSTOMER CONTACT DETAILS
            ================================== */}

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
                      setRecipientName(event.target.value)
                    }
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="Full name"
                    className="w-full rounded-xl border border-brand/15 bg-cream px-4 py-4 text-sm text-brand outline-none focus:border-brand-light"
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
                      setContactPhone(event.target.value)
                    }
                    autoComplete="tel"
                    required
                    minLength={7}
                    maxLength={20}
                    placeholder="+256 700 000 000"
                    className="w-full rounded-xl border border-brand/15 bg-cream px-4 py-4 text-sm text-brand outline-none focus:border-brand-light"
                  />
                </div>
              </div>

              <p className="mt-4 text-xs text-brand/50">
                Signed in as {customer?.email}
              </p>
            </section>

            {/* ==================================
                FULFILLMENT METHOD
            ================================== */}

            <section className="rounded-[2rem] border border-brand/10 bg-white p-6 sm:p-9">
              <h2 className="font-display text-2xl text-brand">
                How would you like your order?
              </h2>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
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
                      checked={fulfillmentMethod === 'PICKUP'}
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
                    Collect your order after the business
                    confirms pickup arrangements.
                  </p>
                </label>

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
                    Available only for configured
                    delivery zones.
                  </p>
                </label>
              </div>

              {/* Delivery-specific inputs */}
              {fulfillmentMethod === 'DELIVERY' && (
                <div className="mt-7 space-y-5 border-t border-brand/10 pt-7">
                  {zonesLoading && (
                    <p
                      role="status"
                      className="text-sm text-brand/60"
                    >
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
                        Delivery is not available yet.
                        No active zones and fees have
                        been configured. Please select
                        pickup for now.
                      </div>
                    )}

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
                          {zone.name} —{' '}
                          {formatPrice(zone.feeUgx)}
                        </option>
                      ))}
                    </select>
                  </div>

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
                      placeholder="Enter your delivery address and nearby landmark"
                      className="w-full resize-y rounded-xl border border-brand/15 bg-cream px-4 py-4 text-sm text-brand outline-none focus:border-brand-light"
                    />
                  </div>

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
                      placeholder="Additional delivery details"
                      className="w-full resize-y rounded-xl border border-brand/15 bg-cream px-4 py-4 text-sm text-brand outline-none focus:border-brand-light"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* ==================================
                PAYMENT METHOD
            ================================== */}

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
                  No online payment will be collected
                  during this checkout.
                </p>
              </div>

              <p className="mt-4 text-xs leading-6 text-brand/50">
                Mobile Money and card payments will
                be enabled after secure payment
                integration and verification.
              </p>
            </section>
          </div>

          {/* ==================================
              ORDER SUMMARY
          ================================== */}

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

            <div className="mt-7 space-y-5">
              {cartProducts.map(
                ({ product, quantity, lineTotal }) => (
                  <div
                    key={product.id}
                    className="flex items-start justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-brand">
                        {product.name}
                      </p>

                      <p className="mt-1 text-xs text-brand/55">
                        {product.unit} × {quantity}
                      </p>
                    </div>

                    <strong className="shrink-0 text-sm text-brand">
                      {formatPrice(lineTotal)}
                    </strong>
                  </div>
                ),
              )}
            </div>

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
                    : formatPrice(estimatedTotal)}
                </strong>
              </div>
            </div>

            <p className="mt-4 text-xs leading-6 text-brand/55">
              Final prices and fees are calculated
              by the server when you submit.
            </p>

            {checkoutError && (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
              >
                {checkoutError}
              </div>
            )}

            <button
              type="submit"
              disabled={
                isSubmitting ||
                (fulfillmentMethod === 'DELIVERY' &&
                  !selectedZone)
              }
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
              and availability.
            </p>
          </aside>
        </form>
      </div>
    </main>
  )
}
