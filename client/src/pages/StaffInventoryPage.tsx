
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'

import { Link } from 'react-router-dom'

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock3,
  History,
  LoaderCircle,
  LockKeyhole,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
} from 'lucide-react'

import { formatPrice } from '../data/products'

import {
  getStaffInventory,
  getInventoryEvents,
  updateStaffInventory,
  InventoryApiError,
  type InventoryProduct,
  type InventoryAuditEvent,
  type InventoryAction,
} from '../services/adminInventoryApi'

// ==========================================
// LOYCE DAIRIES PLATFORM
// MILESTONE 4.7.3
// STAFF INVENTORY MANAGEMENT DASHBOARD
// ==========================================

// ==========================================
// DISPLAY HELPERS
// ==========================================

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable'
  }

  return new Intl.DateTimeFormat('en-UG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Kampala',
  }).format(date)
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

// ==========================================
// INVENTORY ACTION LABELS
// ==========================================

const actionLabels: Record<
  InventoryAction,
  string
> = {
  STAFF_SET: 'Staff adjustment',
  ORDER_PLACED: 'Checkout deduction',
  ORDER_CANCELLED: 'Cancellation restoration',
}

function actionStyle(
  action: InventoryAction,
): string {
  switch (action) {
    case 'STAFF_SET':
      return 'bg-blue-50 text-blue-800'

    case 'ORDER_PLACED':
      return 'bg-amber-50 text-amber-800'

    case 'ORDER_CANCELLED':
      return 'bg-emerald-50 text-emerald-800'
  }
}

function quantityChangeLabel(
  quantity: number,
): string {
  if (quantity > 0) {
    return `+${quantity}`
  }

  return String(quantity)
}

// ==========================================
// INVENTORY FILTERS
// ==========================================

type InventoryFilter =
  | 'ALL'
  | 'IN_STOCK'
  | 'OUT_OF_STOCK'

// ==========================================
// INVENTORY STAT CARD
// ==========================================

type StatCardProps = {
  title: string
  value: number
  description: string
}

function StatCard({
  title,
  value,
  description,
}: StatCardProps) {
  return (
    <div className="rounded-[1.5rem] border border-brand/10 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand/60">
        {title}
      </p>

      <p className="mt-3 font-display text-4xl text-brand">
        {value.toLocaleString('en-UG')}
      </p>

      <p className="mt-2 text-xs leading-5 text-brand/60">
        {description}
      </p>
    </div>
  )
}

// ==========================================
// STAFF INVENTORY DASHBOARD
// ==========================================

export default function StaffInventoryPage() {
  // ========================================
  // INVENTORY PRODUCT LIST
  // ========================================

  const [products, setProducts] = useState<
    InventoryProduct[]
  >([])

  const [listLoading, setListLoading] =
    useState(true)

  const [listError, setListError] =
    useState<string | null>(null)

  const [accessError, setAccessError] =
    useState<number | null>(null)

  const [reloadVersion, setReloadVersion] =
    useState(0)

  // ========================================
  // SEARCH AND FILTER
  // ========================================

  const [search, setSearch] = useState('')

  const [filter, setFilter] =
    useState<InventoryFilter>('ALL')

  // ========================================
  // SELECTED PRODUCT
  // ========================================

  const [selectedProductId, setSelectedProductId] =
    useState<number | null>(null)

  const selectedProduct =
    products.find(
      (product) =>
        product.id === selectedProductId,
    ) ?? null

  // ========================================
  // STOCK ADJUSTMENT FORM
  // ========================================

  const [newQuantity, setNewQuantity] =
    useState('')

  const [adjustmentNote, setAdjustmentNote] =
    useState('')

  const [updating, setUpdating] =
    useState(false)

  const updatingRef = useRef(false)

  const [updateError, setUpdateError] =
    useState<string | null>(null)

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null)

  // ========================================
  // INVENTORY AUDIT HISTORY
  // ========================================

  const [events, setEvents] = useState<
    InventoryAuditEvent[]
  >([])

  const [eventsLoading, setEventsLoading] =
    useState(false)

  const [eventsError, setEventsError] =
    useState<string | null>(null)

  const [eventsVersion, setEventsVersion] =
    useState(0)

  // ========================================
  // LOAD STAFF INVENTORY
  // ========================================

  useEffect(() => {
    const controller = new AbortController()

    const loadInventory = async () => {
      setListLoading(true)
      setListError(null)
      setAccessError(null)

      try {
        const inventory =
          await getStaffInventory(
            controller.signal,
          )

        if (controller.signal.aborted) {
          return
        }

        setProducts(inventory)

        // Preserve the selected product
        // when refreshing inventory.
        //
        // Select the first available product
        // only if the current selection
        // is missing.

        setSelectedProductId((currentId) => {
          if (
            currentId !== null &&
            inventory.some(
              (product) =>
                product.id === currentId,
            )
          ) {
            return currentId
          }

          return inventory[0]?.id ?? null
        })
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          return
        }

        if (
          error instanceof InventoryApiError &&
          (
            error.status === 401 ||
            error.status === 403
          )
        ) {
          setAccessError(error.status)
          setProducts([])
          setSelectedProductId(null)
        } else {
          setListError(errorMessage(error))
        }
      } finally {
        if (!controller.signal.aborted) {
          setListLoading(false)
        }
      }
    }

    void loadInventory()

    return () => {
      controller.abort()
    }
  }, [reloadVersion])

  // ========================================
  // LOAD SELECTED PRODUCT AUDIT HISTORY
  // ========================================

  useEffect(() => {
    if (selectedProductId === null) {
      setEvents([])
      setEventsError(null)
      return
    }

    const controller = new AbortController()

    const loadEvents = async () => {
      setEventsLoading(true)
      setEventsError(null)
      setEvents([])

      try {
        const history = await getInventoryEvents(
          selectedProductId,
          controller.signal,
        )

        if (controller.signal.aborted) {
          return
        }

        setEvents(history)
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          return
        }

        if (
          error instanceof InventoryApiError &&
          (
            error.status === 401 ||
            error.status === 403
          )
        ) {
          setAccessError(error.status)
        } else {
          setEventsError(errorMessage(error))
        }
      } finally {
        if (!controller.signal.aborted) {
          setEventsLoading(false)
        }
      }
    }

    void loadEvents()

    return () => {
      controller.abort()
    }
  }, [selectedProductId, eventsVersion])

  // ========================================
  // INVENTORY SUMMARY STATISTICS
  // ========================================

  const stats = useMemo(() => {
    const activeProducts = products.filter(
      (product) => product.isActive,
    )

    const inStockProducts =
      activeProducts.filter(
        (product) =>
          product.stockQuantity > 0,
      )

    const outOfStockProducts =
      activeProducts.filter(
        (product) =>
          product.stockQuantity === 0,
      )

    return {
      totalProducts: products.length,
      activeProducts: activeProducts.length,
      inStockProducts: inStockProducts.length,
      outOfStockProducts:
        outOfStockProducts.length,
    }
  }, [products])

  // ========================================
  // FILTERED PRODUCTS
  // ========================================

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name
          .toLowerCase()
          .includes(query) ||
        product.category.name
          .toLowerCase()
          .includes(query) ||
        product.unit
          .toLowerCase()
          .includes(query)

      const matchesFilter =
        filter === 'ALL' ||
        (
          filter === 'IN_STOCK' &&
          product.stockQuantity > 0
        ) ||
        (
          filter === 'OUT_OF_STOCK' &&
          product.stockQuantity === 0
        )

      return matchesSearch && matchesFilter
    })
  }, [products, search, filter])

  // ========================================
  // PRODUCT SELECTION
  // ========================================

  const selectProduct = (
    productId: number,
  ) => {
    if (updatingRef.current) {
      return
    }

    setSelectedProductId(productId)

    // Reset the form so an adjustment
    // intended for a previous product
    // cannot accidentally be submitted.

    setNewQuantity('')
    setAdjustmentNote('')
    setUpdateError(null)
    setSuccessMessage(null)
  }

  // ========================================
  // REFRESH INVENTORY
  // ========================================

  const handleRefresh = () => {
    if (updatingRef.current) {
      return
    }

    setNewQuantity('')
    setUpdateError(null)

    setReloadVersion((value) => value + 1)

    setEventsVersion((value) => value + 1)
  }

  // ========================================
  // SUBMIT STOCK ADJUSTMENT
  // ========================================

  const handleUpdateStock = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (
      !selectedProduct ||
      updatingRef.current
    ) {
      return
    }

    setUpdateError(null)
    setSuccessMessage(null)

    // ======================================
    // VALIDATE NEW QUANTITY
    // ======================================

    const trimmedQuantity =
      newQuantity.trim()

    // Only permit nonnegative whole
    // numbers, not decimals, negatives
    // or scientific notation.

    if (
      !/^(0|[1-9]\d*)$/.test(
        trimmedQuantity,
      )
    ) {
      setUpdateError(
        'Enter a valid whole-number stock quantity.',
      )
      return
    }

    const quantity =
      Number(trimmedQuantity)

    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 0 ||
      quantity > 2_147_483_647
    ) {
      setUpdateError(
        'Stock quantity must be between 0 and 2,147,483,647.',
      )
      return
    }

    if (
      quantity ===
      selectedProduct.stockQuantity
    ) {
      setUpdateError(
        'The new stock quantity must differ from the current balance.',
      )
      return
    }

    // ======================================
    // VALIDATE ADJUSTMENT REASON
    // ======================================

    const note =
      adjustmentNote.trim()

    if (
      note.length < 5 ||
      note.length > 300
    ) {
      setUpdateError(
        'Provide a reason containing 5–300 characters.',
      )
      return
    }

    // ======================================
    // SUBMIT ADJUSTMENT
    // ======================================

    updatingRef.current = true
    setUpdating(true)

    try {
      const updated =
        await updateStaffInventory(
          selectedProduct.id,
          {
            expectedStockQuantity:
              selectedProduct.stockQuantity,

            stockQuantity: quantity,
            note,
          },
        )

      // Use the authoritative balance
      // returned by the backend.

      setProducts((current) =>
        current.map((product) =>
          product.id === updated.id
            ? {
                ...product,
                stockQuantity:
                  updated.stockQuantity,

                updatedAt:
                  updated.updatedAt,
              }
            : product,
        ),
      )

      setNewQuantity('')
      setAdjustmentNote('')

      setSuccessMessage(
        `Stock updated successfully. ` +
        `The recorded balance is now ` +
        `${updated.stockQuantity} ` +
        `sellable unit(s).`,
      )

      // Refresh product inventory and
      // audit history from PostgreSQL.

      setReloadVersion(
        (value) => value + 1,
      )

      setEventsVersion(
        (value) => value + 1,
      )
    } catch (error: unknown) {
      if (
        error instanceof InventoryApiError &&
        (
          error.status === 401 ||
          error.status === 403
        )
      ) {
        setAccessError(error.status)
        return
      }

      if (
        error instanceof InventoryApiError &&
        error.status === 409
      ) {
        setUpdateError(
          'The inventory changed before your adjustment was saved. ' +
          'The latest balances are being retrieved. ' +
          'Review the new balance and enter your adjustment again.',
        )

        setNewQuantity('')

        setReloadVersion(
          (value) => value + 1,
        )

        setEventsVersion(
          (value) => value + 1,
        )
      } else {
        setUpdateError(
          errorMessage(error),
        )
      }
    } finally {
      updatingRef.current = false
      setUpdating(false)
    }
  }

  // ========================================
  // STAFF ACCESS DENIED
  // ========================================

  if (
    accessError === 401 ||
    accessError === 403
  ) {
    return (
      <main className="min-h-[70vh] bg-cream px-5 py-20">
        <section className="mx-auto max-w-lg rounded-[2rem] bg-white p-9 text-center shadow-sm">
          <LockKeyhole
            size={42}
            className="text-brand-light"
            aria-hidden="true"
          />

          <h1 className="mt-6 font-display text-3xl text-brand">
            {accessError === 401
              ? 'Staff sign-in required'
              : 'Staff access only'}
          </h1>

          <p className="mt-4 text-sm leading-7 text-brand/65">
            {accessError === 401
              ? 'Please sign in with your authorized Loyce Dairies staff account.'
              : 'Your current account does not have permission to manage inventory.'}
          </p>

          <Link
            to={
              accessError === 401
                ? '/login'
                : '/account'
            }
            className="mt-7 inline-flex rounded-full bg-brand px-7 py-3.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            {accessError === 401
              ? 'Go to sign in'
              : 'Back to account'}
          </Link>
        </section>
      </main>
    )
  }

  // ========================================
  // MAIN DASHBOARD
  // ========================================

  return (
    <main className="min-h-screen bg-cream">

      {/* ==================================
          DASHBOARD HEADER
      ================================== */}

      <section className="border-b border-brand/10 bg-sage/60">
        <div className="mx-auto max-w-7xl px-5 py-11 lg:px-8">

          {/* Staff workspace navigation */}

          <nav
            aria-label="Staff workspace navigation"
            className="flex flex-wrap items-center gap-3"
          >
            <Link
              to="/account"
              className="inline-flex items-center gap-2 rounded-full px-2 py-3 text-sm font-semibold text-brand/65 transition hover:text-brand"
            >
              <ArrowLeft
                size={17}
                aria-hidden="true"
              />

              Back to account
            </Link>

            <Link
              to="/staff/orders"
              className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-white px-5 py-3 text-sm font-bold text-brand transition hover:bg-sage"
            >
              <ClipboardList
                size={17}
                aria-hidden="true"
              />

              Manage orders
            </Link>

            <Link
              to="/staff/delivery-zones"
              className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-white px-5 py-3 text-sm font-bold text-brand transition hover:bg-sage"
            >
              <Truck
                size={17}
                aria-hidden="true"
              />

              Delivery zones
            </Link>
          </nav>

          {/* Title */}

          <div className="mt-8 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-light">
                LOYCE DAIRIES · STAFF
              </p>

              <h1 className="mt-4 font-display text-4xl text-brand sm:text-5xl">
                Inventory management
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-brand/65">
                Monitor dairy product availability,
                update verified stock balances,
                and review inventory movements
                recorded by the system.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-bold text-brand">
              <ShieldCheck
                size={18}
                className="text-brand-light"
                aria-hidden="true"
              />

              Staff workspace
            </div>
          </div>
        </div>
      </section>

      {/* ==================================
          DASHBOARD CONTENT
      ================================== */}

      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">

        {/* ==================================
            INVENTORY SUMMARY CARDS
        ================================== */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total products"
            value={stats.totalProducts}
            description="Products registered in the catalogue"
          />

          <StatCard
            title="Active products"
            value={stats.activeProducts}
            description="Currently active catalogue listings"
          />

          <StatCard
            title="In stock"
            value={stats.inStockProducts}
            description="Active products with available units"
          />

          <StatCard
            title="Out of stock"
            value={stats.outOfStockProducts}
            description="Active products with zero recorded units"
          />
        </div>

        {/* ==================================
            INVENTORY REFRESH
        ================================== */}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Package
              size={24}
              className="text-brand-light"
              aria-hidden="true"
            />

            <div>
              <h2 className="font-display text-2xl text-brand">
                Product inventory
              </h2>

              <p className="text-sm text-brand/60">
                Stock is tracked in sellable product units.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={listLoading || updating}
            className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-white px-5 py-3 text-sm font-bold text-brand transition hover:bg-sage disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={
                listLoading
                  ? 'animate-spin'
                  : ''
              }
              aria-hidden="true"
            />

            Refresh inventory
          </button>
        </div>

        {/* ==================================
            INVENTORY LIST ERROR
        ================================== */}

        {listError && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            <p>{listError}</p>
          </div>
        )}

        {/* ==================================
            FILTERS
        ================================== */}

        <div className="mt-7 grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">

          <div>
            <label
              htmlFor="inventory-search"
              className="mb-2 block text-sm font-bold text-brand"
            >
              Search products
            </label>

            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand/45"
                aria-hidden="true"
              />

              <input
                id="inventory-search"
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Product name, category or unit"
                className="w-full rounded-xl border border-brand/15 bg-white py-3 pl-12 pr-4 text-sm text-brand outline-none focus:border-brand-light"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="inventory-filter"
              className="mb-2 block text-sm font-bold text-brand"
            >
              Stock availability
            </label>

            <select
              id="inventory-filter"
              value={filter}
              onChange={(event) =>
                setFilter(
                  event.target.value as
                    InventoryFilter,
                )
              }
              className="w-full rounded-xl border border-brand/15 bg-white px-4 py-3 text-sm text-brand outline-none focus:border-brand-light"
            >
              <option value="ALL">
                All products
              </option>

              <option value="IN_STOCK">
                In stock
              </option>

              <option value="OUT_OF_STOCK">
                Out of stock
              </option>
            </select>
          </div>
        </div>

        {/* ==================================
            MAIN TWO-COLUMN WORKSPACE
        ================================== */}

        <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">

          {/* ================================
              PRODUCT INVENTORY LIST
          ================================ */}

          <section className="min-w-0 rounded-[2rem] border border-brand/10 bg-white p-5 sm:p-7">

            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-xl text-brand">
                Products
              </h3>

              <span className="text-xs font-semibold text-brand/60">
                {filteredProducts.length} shown
              </span>
            </div>

            {listLoading && products.length === 0 ? (
              <div
                role="status"
                className="flex items-center gap-3 py-12 text-sm text-brand/65"
              >
                <LoaderCircle
                  size={22}
                  className="animate-spin"
                  aria-hidden="true"
                />

                Loading inventory...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-12 text-center">
                <Package
                  size={36}
                  className="mx-auto text-brand/30"
                  aria-hidden="true"
                />

                <p className="mt-4 text-sm text-brand/65">
                  No products match your current filters.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">

                {filteredProducts.map((product) => {
                  const isSelected =
                    selectedProductId ===
                    product.id

                  const inStock =
                    product.stockQuantity > 0

                  return (
                    <button
                      key={product.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() =>
                        selectProduct(product.id)
                      }
                      disabled={updating}
                      className={`w-full rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-70 ${
                        isSelected
                          ? 'border-brand bg-sage/50'
                          : 'border-brand/10 bg-white hover:border-brand/30 hover:bg-cream/50'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">

                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-brand">
                            {product.name}
                          </p>

                          <p className="mt-1 text-xs text-brand/60">
                            {product.category.name}
                            {' · '}
                            {product.unit}
                          </p>

                          <p className="mt-2 text-xs font-semibold text-brand/75">
                            {formatPrice(
                              product.priceUgx,
                            )}
                          </p>

                          {!product.isActive && (
                            <p className="mt-2 text-xs font-semibold text-amber-700">
                              Inactive catalogue listing
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="font-display text-3xl text-brand">
                            {product.stockQuantity.toLocaleString(
                              'en-UG',
                            )}
                          </p>

                          <p className="text-xs text-brand/60">
                            units
                          </p>

                          <span
                            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                              inStock
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-red-50 text-red-800'
                            }`}
                          >
                            {inStock
                              ? 'In stock'
                              : 'Out of stock'}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* ================================
              SELECTED PRODUCT DETAILS
          ================================ */}

          <div className="min-w-0 space-y-7">

            {/* ==============================
                STOCK ADJUSTMENT CARD
            ============================== */}

            <section className="rounded-[2rem] border border-brand/10 bg-white p-5 sm:p-7">

              <div className="flex items-center gap-3">
                <PackageCheck
                  size={24}
                  className="text-brand-light"
                  aria-hidden="true"
                />

                <h3 className="font-display text-xl text-brand">
                  Adjust stock
                </h3>
              </div>

              {!selectedProduct ? (
                <p className="mt-6 text-sm leading-7 text-brand/65">
                  Select a product to view its
                  balance and manage its stock.
                </p>
              ) : (
                <>

                  <div className="mt-6 rounded-2xl bg-sage/50 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand/60">
                      Selected product
                    </p>

                    <p className="mt-2 font-bold text-brand">
                      {selectedProduct.name}
                    </p>

                    <p className="mt-1 text-sm text-brand/65">
                      {selectedProduct.unit}
                    </p>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-brand/60">
                          Current recorded balance
                        </p>

                        <p className="mt-1 font-display text-4xl text-brand">
                          {selectedProduct.stockQuantity.toLocaleString(
                            'en-UG',
                          )}
                        </p>
                      </div>

                      <span className="text-xs font-bold text-brand/65">
                        Sellable units
                      </span>
                    </div>
                  </div>

                  {/* ========================
                      ADJUSTMENT FORM
                  ======================== */}

                  <form
                    onSubmit={handleUpdateStock}
                    className="mt-6 space-y-5"
                  >

                    <div>
                      <label
                        htmlFor="inventory-new-quantity"
                        className="mb-2 block text-sm font-bold text-brand"
                      >
                        New total stock quantity
                      </label>

                      <input
                        id="inventory-new-quantity"
                        type="number"
                        min="0"
                        max="2147483647"
                        step="1"
                        required
                        value={newQuantity}
                        disabled={updating || listLoading}
                        onChange={(event) =>
                          setNewQuantity(
                            event.target.value,
                          )
                        }
                        placeholder="Enter new balance"
                        className="w-full rounded-xl border border-brand/15 bg-white px-4 py-3 text-sm text-brand outline-none focus:border-brand-light disabled:bg-gray-50"
                      />

                      <p className="mt-2 text-xs leading-5 text-brand/55">
                        Enter the final quantity,
                        not the amount to add.
                        For example, entering 12
                        sets the recorded balance
                        to 12 sellable units.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="inventory-note"
                        className="mb-2 block text-sm font-bold text-brand"
                      >
                        Adjustment reason
                      </label>

                      <textarea
                        id="inventory-note"
                        rows={4}
                        minLength={5}
                        maxLength={300}
                        required
                        value={adjustmentNote}
                        disabled={updating || listLoading}
                        onChange={(event) =>
                          setAdjustmentNote(
                            event.target.value,
                          )
                        }
                        placeholder="Explain the stock count or correction..."
                        className="w-full resize-y rounded-xl border border-brand/15 bg-white px-4 py-3 text-sm text-brand outline-none focus:border-brand-light disabled:bg-gray-50"
                      />

                      <p className="mt-2 text-xs text-brand/55">
                        5–300 characters. This reason
                        will be stored in the
                        inventory audit history.
                      </p>
                    </div>

                    {/* ======================
                        ERROR MESSAGE
                    ====================== */}

                    {updateError && (
                      <div
                        role="alert"
                        className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                      >
                        <AlertCircle
                          size={19}
                          className="mt-0.5 shrink-0"
                          aria-hidden="true"
                        />

                        <p>{updateError}</p>
                      </div>
                    )}

                    {/* ======================
                        SUCCESS MESSAGE
                    ====================== */}

                    {successMessage && (
                      <div
                        role="status"
                        className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
                      >
                        <CheckCircle2
                          size={19}
                          className="mt-0.5 shrink-0"
                          aria-hidden="true"
                        />

                        <p>{successMessage}</p>
                      </div>
                    )}

                    {/* ======================
                        SAVE BUTTON
                    ====================== */}

                    <button
                      type="submit"
                      disabled={updating || listLoading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {updating ? (
                        <>
                          <LoaderCircle
                            size={18}
                            className="animate-spin"
                            aria-hidden="true"
                          />

                          Saving adjustment...
                        </>
                      ) : (
                        <>
                          <PackageCheck
                            size={18}
                            aria-hidden="true"
                          />

                          Save stock adjustment
                        </>
                      )}
                    </button>
                  </form>

                  <p className="mt-5 text-xs leading-6 text-brand/55">
                    Each successful adjustment
                    records the previous balance,
                    new balance, quantity change,
                    staff account, reason and time.
                  </p>
                </>
              )}
            </section>

            {/* ==============================
                INVENTORY AUDIT HISTORY
            ============================== */}

            <section className="rounded-[2rem] border border-brand/10 bg-white p-5 sm:p-7">

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <History
                    size={23}
                    className="text-brand-light"
                    aria-hidden="true"
                  />

                  <h3 className="font-display text-xl text-brand">
                    Inventory history
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEventsVersion(
                      (value) => value + 1,
                    )
                  }
                  disabled={
                    selectedProductId === null ||
                    eventsLoading ||
                    updating
                  }
                  aria-label="Refresh inventory audit history"
                  className="rounded-full border border-brand/15 p-2.5 text-brand transition hover:bg-sage disabled:opacity-50"
                >
                  <RefreshCw
                    size={17}
                    className={
                      eventsLoading
                        ? 'animate-spin'
                        : ''
                    }
                    aria-hidden="true"
                  />
                </button>
              </div>

              <p className="mt-3 text-xs leading-6 text-brand/60">
                Recent stock movements for
                the selected product, including
                adjustments, customer checkouts
                and cancelled orders.
              </p>

              {selectedProductId === null ? (
                <p className="mt-8 text-sm text-brand/60">
                  Select a product to view
                  its inventory history.
                </p>
              ) : eventsLoading ? (
                <div
                  role="status"
                  className="mt-8 flex items-center gap-3 text-sm text-brand/65"
                >
                  <LoaderCircle
                    size={20}
                    className="animate-spin"
                    aria-hidden="true"
                  />

                  Loading inventory history...
                </div>
              ) : eventsError ? (
                <div
                  role="alert"
                  className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800"
                >
                  {eventsError}
                </div>
              ) : events.length === 0 ? (
                <div className="py-10 text-center">
                  <Clock3
                    size={34}
                    className="mx-auto text-brand/30"
                    aria-hidden="true"
                  />

                  <p className="mt-4 text-sm text-brand/60">
                    No inventory movements have
                    been recorded for this product.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">

                  {events.map((auditEvent) => (
                    <article
                      key={auditEvent.id}
                      className="rounded-2xl border border-brand/10 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">

                        <div>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${actionStyle(
                              auditEvent.action,
                            )}`}
                          >
                            {actionLabels[
                              auditEvent.action
                            ]}
                          </span>

                          <p className="mt-3 text-xs text-brand/55">
                            {formatDate(
                              auditEvent.createdAt,
                            )}
                          </p>
                        </div>

                        <div className="text-right">
                          <p
                            className={`font-display text-2xl ${
                              auditEvent.quantityChange > 0
                                ? 'text-emerald-700'
                                : auditEvent.quantityChange < 0
                                  ? 'text-amber-700'
                                  : 'text-brand'
                            }`}
                          >
                            {quantityChangeLabel(
                              auditEvent.quantityChange,
                            )}
                          </p>

                          <p className="text-xs text-brand/55">
                            units
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-cream p-3">
                        <div>
                          <p className="text-xs text-brand/55">
                            Before
                          </p>

                          <p className="mt-1 font-bold text-brand">
                            {auditEvent.quantityBefore}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-brand/55">
                            After
                          </p>

                          <p className="mt-1 font-bold text-brand">
                            {auditEvent.quantityAfter}
                          </p>
                        </div>
                      </div>

                      {auditEvent.note && (
                        <p className="mt-4 break-words text-sm leading-6 text-brand/70">
                          {auditEvent.note}
                        </p>
                      )}

                      <div className="mt-4 space-y-2 border-t border-brand/10 pt-3 text-xs text-brand/55">

                        <p>
                          Performed by:{' '}
                          <span className="font-semibold text-brand/75">
                            {auditEvent.changedBy
                              ? auditEvent.changedBy.fullName
                              : 'Automatic checkout'}
                          </span>
                        </p>

                        {auditEvent.orderId && (
                          <p className="break-all">
                            Order ID:{' '}
                            <span className="font-mono text-brand/75">
                              {auditEvent.orderId}
                            </span>
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <p className="mt-6 text-xs text-brand/50">
                Showing up to the latest 100
                recorded movements for this product.
              </p>
            </section>
          </div>
        </div>

        {/* ==================================
            INVENTORY INFORMATION FOOTER
        ================================== */}

        <section className="mt-10 rounded-[2rem] border border-brand/10 bg-sage/50 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <ShieldCheck
              size={26}
              className="mt-1 shrink-0 text-brand-light"
              aria-hidden="true"
            />

            <div>
              <h3 className="font-display text-xl text-brand">
                Inventory accountability
              </h3>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-brand/70">
                Stock balances are maintained by
                the backend. Customer checkout
                automatically deducts available
                units, eligible order cancellations
                restore previously deducted
                quantities, and staff adjustments
                create audit records.
              </p>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-brand/70">
                Only record verified physical
                inventory. A product showing zero
                stock cannot be purchased until
                inventory is replenished.
              </p>
            </div>
          </div>
        </section>

      </section>
    </main>
  )
}
