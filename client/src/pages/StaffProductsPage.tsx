/**
 * Loyce Dairies — Staff Product Management
 * Milestone 4.8.8C: independent product-category loading.
 *
 * Product metadata and audit history are managed here.
 * Inventory adjustments must use the dedicated inventory workflow.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
  PackagePlus,
  Pencil,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Truck,
} from 'lucide-react'

import { formatPrice } from '../data/products'
import {
  createStaffProduct,
  getProductAuditEvents,
  getProductCategories,
  getStaffProducts,
  ProductApiError,
  updateStaffProduct,
  type ProductAuditEvent,
  type ProductAuditSnapshot,
  type ProductCategory,
  type ProductEditableFields,
  type StaffProduct,
} from '../services/adminProductsApi'

type ProductFilter = 'all' | 'active' | 'inactive'
type PageMode = 'edit' | 'create'

type ProductForm = {
  name: string
  description: string
  priceUgx: string
  unit: string
  imageUrl: string
  badge: string
  categoryId: string
  isActive: boolean
}

const EDITABLE_FIELDS = [
  'name',
  'description',
  'priceUgx',
  'unit',
  'imageUrl',
  'badge',
  'categoryId',
  'isActive',
] as const

const AUDIT_FIELDS = [
  { key: 'name', label: 'Product name' },
  { key: 'description', label: 'Description' },
  { key: 'priceUgx', label: 'Price' },
  { key: 'unit', label: 'Selling unit' },
  { key: 'imageUrl', label: 'Image URL' },
  { key: 'badge', label: 'Badge' },
  { key: 'categoryId', label: 'Category ID' },
  { key: 'isActive', label: 'Catalogue status' },
] as const

function emptyProductForm(): ProductForm {
  return {
    name: '',
    description: '',
    priceUgx: '',
    unit: '',
    imageUrl: '',
    badge: '',
    categoryId: '',
    isActive: false,
  }
}

function productToForm(product: StaffProduct): ProductForm {
  return {
    name: product.name,
    description: product.description ?? '',
    priceUgx: String(product.priceUgx),
    unit: product.unit,
    imageUrl: product.imageUrl ?? '',
    badge: product.badge ?? '',
    categoryId: String(product.categoryId),
    isActive: product.isActive,
  }
}

function productToEditable(product: StaffProduct): ProductEditableFields {
  return {
    name: product.name,
    description: product.description,
    priceUgx: product.priceUgx,
    unit: product.unit,
    imageUrl: product.imageUrl,
    badge: product.badge,
    categoryId: product.categoryId,
    isActive: product.isActive,
  }
}

function validateForm(
  form: ProductForm,
  categories: ProductCategory[],
): ProductEditableFields {
  const name = form.name.trim()
  const description = form.description.trim()
  const unit = form.unit.trim()
  const badge = form.badge.trim()
  const imageUrl = form.imageUrl.trim()
  const categoryId = Number(form.categoryId)

  if (name.length < 2 || name.length > 120) {
    throw new Error('Product name must contain 2–120 characters.')
  }
  if (description.length > 2000) {
    throw new Error('Description cannot exceed 2000 characters.')
  }
  if (unit.length < 1 || unit.length > 60) {
    throw new Error('Selling unit must contain 1–60 characters.')
  }
  if (badge.length > 80) {
    throw new Error('Product badge cannot exceed 80 characters.')
  }
  if (imageUrl.length > 2048) {
    throw new Error('Image URL cannot exceed 2048 characters.')
  }
  if (!/^[1-9]\d*$/.test(form.priceUgx.trim())) {
    throw new Error('Enter a positive whole-number price in UGX.')
  }

  const priceUgx = Number(form.priceUgx)
  if (!Number.isSafeInteger(priceUgx) || priceUgx > 2_147_483_647) {
    throw new Error('The price exceeds the supported range.')
  }
  if (
    !Number.isInteger(categoryId) ||
    !categories.some((category) => category.id === categoryId)
  ) {
    throw new Error('Select a valid category from the category list.')
  }

  return {
    name,
    description: description || null,
    priceUgx,
    unit,
    imageUrl: imageUrl || null,
    badge: badge || null,
    categoryId,
    isActive: form.isActive,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function auditActionLabel(action: ProductAuditEvent['action']): string {
  switch (action) {
    case 'CREATED': return 'Product created'
    case 'UPDATED': return 'Product updated'
    case 'ACTIVATED': return 'Product activated'
    case 'DEACTIVATED': return 'Product deactivated'
  }
}

function formatAuditValue(
  key: keyof ProductAuditSnapshot,
  value: string | number | boolean | null,
): string {
  if (value === null || value === '') return 'Not set'
  if (key === 'priceUgx') return formatPrice(Number(value))
  if (key === 'isActive') return value ? 'Active' : 'Inactive'
  return String(value)
}

function getAuditChanges(event: ProductAuditEvent) {
  if (!event.previousValues) return []
  const previous = event.previousValues
  const next = event.newValues

  return AUDIT_FIELDS
    .filter(({ key }) => previous[key] !== next[key])
    .map(({ key, label }) => ({
      label,
      before: formatAuditValue(key, previous[key]),
      after: formatAuditValue(key, next[key]),
    }))
}

export default function StaffProductsPage() {
  const [products, setProducts] = useState<StaffProduct[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [accessError, setAccessError] = useState<401 | 403 | null>(null)
  const [productsVersion, setProductsVersion] = useState(0)
  const [categoriesVersion, setCategoriesVersion] = useState(0)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ProductFilter>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [mode, setMode] = useState<PageMode>('edit')
  const [form, setForm] = useState<ProductForm>(emptyProductForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [history, setHistory] = useState<ProductAuditEvent[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyVersion, setHistoryVersion] = useState(0)

  // Load products independently. Failure to load categories never hides products.
  useEffect(() => {
    const controller = new AbortController()
    setProductsLoading(true)
    setProductsError(null)

    void getStaffProducts(controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return
        setProducts(items)
        setAccessError(null)
        setSelectedId((current) =>
          current !== null && items.some((item) => item.id === current)
            ? current
            : items[0]?.id ?? null,
        )
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (
          error instanceof ProductApiError &&
          (error.statusCode === 401 || error.statusCode === 403)
        ) {
          setAccessError(error.statusCode)
        } else {
          setProductsError(errorMessage(error))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setProductsLoading(false)
      })

    return () => controller.abort()
  }, [productsVersion])

  // Independent category source: GET /api/categories. Includes empty categories.
  useEffect(() => {
    const controller = new AbortController()
    setCategoriesLoading(true)
    setCategoriesError(null)

    void getProductCategories(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setCategories(items)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setCategoriesError(errorMessage(error))
          setCategories([])
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCategoriesLoading(false)
      })

    return () => controller.abort()
  }, [categoriesVersion])

  const selectedProduct = products.find((item) => item.id === selectedId) ?? null

  useEffect(() => {
    if (mode === 'edit' && selectedProduct) {
      setForm(productToForm(selectedProduct))
    }
  }, [mode, selectedProduct])

  useEffect(() => {
    if (mode !== 'edit' || selectedId === null) {
      setHistory([])
      setHistoryError(null)
      setHistoryLoading(false)
      return
    }

    const controller = new AbortController()
    setHistoryLoading(true)
    setHistoryError(null)
    setHistory([])

    void getProductAuditEvents(selectedId, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setHistory(response.data)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setHistoryError(errorMessage(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false)
      })

    return () => controller.abort()
  }, [mode, selectedId, historyVersion])

  const stats = {
    total: products.length,
    active: products.filter((item) => item.isActive).length,
    inactive: products.filter((item) => !item.isActive).length,
    inStock: products.filter((item) => item.isActive && item.stockQuantity > 0).length,
  }

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((item) => {
      if (filter === 'active' && !item.isActive) return false
      if (filter === 'inactive' && item.isActive) return false
      return (
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.category.name.toLowerCase().includes(term) ||
        item.unit.toLowerCase().includes(term)
      )
    })
  }, [products, search, filter])

  function updateForm<K extends keyof ProductForm>(field: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
    setFormError(null)
    setSuccessMessage(null)
  }

  function selectProduct(product: StaffProduct) {
    if (saving) return
    setSelectedId(product.id)
    setMode('edit')
    setForm(productToForm(product))
    setFormError(null)
    setSuccessMessage(null)
  }

  function startCreate() {
    if (saving) return
    setMode('create')
    // Deliberately require staff to choose a category. Never default to Butter.
    setForm(emptyProductForm())
    setFormError(null)
    setSuccessMessage(null)
  }

  function cancelChanges() {
    if (saving) return
    setMode('edit')
    setForm(selectedProduct ? productToForm(selectedProduct) : emptyProductForm())
    setFormError(null)
    setSuccessMessage(null)
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setFormError(null)
    setSuccessMessage(null)

    if (categoriesLoading || categoriesError) {
      setFormError('Categories are unavailable. Refresh the category list before saving.')
      return
    }

    let values: ProductEditableFields
    try {
      values = validateForm(form, categories)
    } catch (error) {
      setFormError(errorMessage(error))
      return
    }

    if (mode === 'edit' && !selectedProduct) {
      setFormError('Select a product before saving changes.')
      return
    }

    setSaving(true)
    try {
      const isNew = mode === 'create'
      let saved: StaffProduct

      if (isNew) {
        saved = await createStaffProduct(values)
      } else {
        const current = selectedProduct!
        const previous = productToEditable(current)

        const changed = EDITABLE_FIELDS.some((key) => values[key] !== previous[key])
        if (!changed) {
          setFormError('No changes detected. Edit a field before saving.')
          return
        }

        saved = await updateStaffProduct(current.id, {
          ...values,
          expectedUpdatedAt: current.updatedAt,
        })
      }

      setProducts((items) => {
        const exists = items.some((item) => item.id === saved.id)
        const next = exists
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [...items, saved]
        return next.sort((a, b) => a.id - b.id)
      })

      setSelectedId(saved.id)
      setMode('edit')
      setForm(productToForm(saved))
      setSuccessMessage(
        isNew
          ? 'Product created. Its initial inventory is zero and its creation is audited.'
          : 'Product updated successfully. The change was recorded in its audit history.',
      )
      setHistoryVersion((version) => version + 1)
    } catch (error) {
      if (error instanceof ProductApiError && error.statusCode === 409) {
        setFormError(
          'This product changed since you opened it. Refresh the product list and review the latest values before saving.',
        )
      } else {
        setFormError(errorMessage(error))
      }
    } finally {
      setSaving(false)
    }
  }

  if (accessError !== null) {
    return (
      <main className="min-h-[70vh] bg-cream px-5 py-20">
        <section className="mx-auto max-w-lg rounded-[2rem] border border-brand/10 bg-white p-9 text-center">
          <LockKeyhole size={42} className="mx-auto text-brand-light" aria-hidden="true" />
          <h1 className="mt-6 font-display text-3xl text-brand">
            {accessError === 401 ? 'Staff sign-in required' : 'Staff access only'}
          </h1>
          <p className="mt-4 text-sm leading-7 text-brand/65">
            {accessError === 401
              ? 'Sign in with a verified Loyce Dairies staff account to manage products.'
              : 'Your account does not have permission to manage the product catalogue.'}
          </p>
          <Link
            to={accessError === 401 ? '/login' : '/account'}
            className="mt-7 inline-flex rounded-full bg-brand px-7 py-3.5 text-sm font-bold text-white"
          >
            {accessError === 401 ? 'Go to sign in' : 'Back to account'}
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-cream">
      <section className="bg-sage/60">
        <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
          <nav aria-label="Staff navigation" className="flex flex-wrap items-center gap-3">
            <Link to="/account" className="inline-flex items-center gap-2 text-sm font-bold text-brand-light hover:text-brand">
              <ArrowLeft size={16} /> Back to account
            </Link>
            <Link to="/staff/orders" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-brand">
              <ClipboardList size={16} /> Manage orders
            </Link>
            <Link to="/staff/delivery-zones" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-brand">
              <Truck size={16} /> Delivery zones
            </Link>
            <Link to="/staff/inventory" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-brand">
              <Package size={16} /> Inventory
            </Link>
          </nav>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-light">
                LOYCE DAIRIES · STAFF
              </p>
              <h1 className="mt-5 font-display text-4xl text-brand sm:text-5xl">
                Product management
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-brand/65">
                Manage the dairy catalogue, prices, product categories, listing status, and audit history.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-bold text-brand">
              <ShieldCheck size={18} className="text-brand-light" /> Staff workspace
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-9 px-5 py-10 lg:px-8">
        {productsError && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            <AlertCircle size={20} className="shrink-0" />
            <div>
              <p className="font-bold">Unable to load products</p>
              <p className="mt-2">{productsError}</p>
              <button type="button" onClick={() => setProductsVersion((v) => v + 1)} className="mt-3 font-bold underline">
                Retry product loading
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total products', value: stats.total, help: 'Products in the catalogue' },
            { label: 'Active products', value: stats.active, help: 'Enabled for public listings' },
            { label: 'Inactive products', value: stats.inactive, help: 'Hidden from public listings' },
            { label: 'Active products in stock', value: stats.inStock, help: 'Active items with recorded stock' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-brand/10 bg-white p-6">
              <p className="text-xs font-extrabold uppercase tracking-wide text-brand/55">{stat.label}</p>
              <p className="mt-4 font-display text-4xl text-brand">{stat.value}</p>
              <p className="mt-2 text-xs leading-5 text-brand/55">{stat.help}</p>
            </div>
          ))}
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="min-w-0 rounded-[2rem] border border-brand/10 bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl text-brand">Dairy products</h2>
                <p className="mt-2 text-sm text-brand/60">Select a product to manage.</p>
              </div>
              <button
                type="button"
                onClick={() => setProductsVersion((v) => v + 1)}
                disabled={saving || productsLoading}
                className="inline-flex items-center gap-2 rounded-full border border-brand/10 px-4 py-3 text-xs font-bold text-brand disabled:opacity-50"
              >
                <RefreshCw size={16} /> Refresh
              </button>
            </div>

            <button
              type="button"
              onClick={startCreate}
              disabled={saving || productsLoading}
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3.5 text-sm font-bold text-white hover:bg-brand-light disabled:opacity-50"
            >
              <PackagePlus size={19} /> Add new dairy product
            </button>

            <div className="mt-7">
              <label htmlFor="staff-product-search" className="mb-2 block text-sm font-bold text-brand">
                Search products
              </label>
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand/40" />
                <input
                  id="staff-product-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, category or unit"
                  className="w-full rounded-xl border border-brand/10 bg-cream py-3 pl-11 pr-4 text-sm text-brand outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="staff-product-filter" className="mb-2 block text-sm font-bold text-brand">
                Catalogue status
              </label>
              <select
                id="staff-product-filter"
                value={filter}
                onChange={(event) => setFilter(event.target.value as ProductFilter)}
                className="w-full rounded-xl border border-brand/10 bg-cream px-4 py-3 text-sm text-brand"
              >
                <option value="all">All products</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>

            <div className="mt-7 space-y-3">
              {productsLoading ? (
                <div className="flex items-center justify-center gap-3 py-12 text-sm text-brand/60">
                  <LoaderCircle size={22} className="animate-spin" /> Loading products...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="rounded-2xl bg-cream p-7 text-center text-sm text-brand/60">
                  No products match the selected filters.
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const selected = mode === 'edit' && selectedId === product.id
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={saving}
                      onClick={() => selectProduct(product)}
                      aria-pressed={selected}
                      className={`w-full rounded-2xl border p-5 text-left transition-colors disabled:opacity-60 ${
                        selected ? 'border-brand-light bg-sage/50' : 'border-brand/10 bg-cream/60 hover:border-brand/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-bold text-brand">{product.name}</p>
                          <p className="mt-1 text-xs text-brand/55">
                            {product.category.name.trim()} · {product.unit}
                          </p>
                          <p className="mt-3 text-sm font-extrabold text-brand">
                            {formatPrice(product.priceUgx)}
                          </p>
                        </div>
                        <Pencil size={17} className="shrink-0 text-brand-light" />
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                          product.isActive ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-xs text-brand/60">
                          Stock: {product.stockQuantity} units
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
            <p className="mt-5 text-xs text-brand/50">
              Showing {filteredProducts.length} of {products.length} products.
            </p>
          </section>

          <div className="min-w-0 space-y-8">
            <section className="rounded-[2rem] border border-brand/10 bg-white p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sage text-brand">
                  {mode === 'create' ? <PackagePlus size={25} /> : <Pencil size={25} />}
                </span>
                <div>
                  <h2 className="font-display text-3xl text-brand">
                    {mode === 'create' ? 'Add product' : 'Edit product'}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-brand/60">
                    {mode === 'create'
                      ? 'Register a new dairy product in the catalogue.'
                      : 'Update product information and catalogue availability.'}
                  </p>
                </div>
              </div>

              {successMessage && (
                <div role="status" className="mt-7 flex items-start gap-3 rounded-2xl bg-green-50 p-4 text-sm text-green-800">
                  <CheckCircle2 size={19} className="shrink-0" /> {successMessage}
                </div>
              )}
              {formError && (
                <div role="alert" className="mt-7 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
                  <AlertCircle size={19} className="shrink-0" /> {formError}
                </div>
              )}

              {mode === 'edit' && !selectedProduct ? (
                <div className="mt-8 rounded-2xl bg-cream p-7 text-sm text-brand/60">
                  Select a product to begin editing.
                </div>
              ) : (
                <form onSubmit={(event) => { void handleSave(event) }} className="mt-8 space-y-6">
                  <div>
                    <label htmlFor="product-name" className="mb-2 block text-sm font-bold text-brand">Product name</label>
                    <input id="product-name" type="text" required maxLength={120} value={form.name} disabled={saving}
                      onChange={(e) => updateForm('name', e.target.value)} placeholder="e.g. Fresh Whole Milk"
                      className="w-full rounded-xl border border-brand/10 px-4 py-3 text-sm text-brand outline-none focus:border-brand" />
                  </div>
                  <div>
                    <label htmlFor="product-description" className="mb-2 block text-sm font-bold text-brand">Description</label>
                    <textarea id="product-description" rows={4} maxLength={2000} value={form.description} disabled={saving}
                      onChange={(e) => updateForm('description', e.target.value)} placeholder="Describe the dairy product..."
                      className="w-full resize-y rounded-xl border border-brand/10 px-4 py-3 text-sm text-brand outline-none focus:border-brand" />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="product-price" className="mb-2 block text-sm font-bold text-brand">Price (UGX)</label>
                      <input id="product-price" type="number" min={1} step={1} required value={form.priceUgx} disabled={saving}
                        onChange={(e) => updateForm('priceUgx', e.target.value)} placeholder="3500"
                        className="w-full rounded-xl border border-brand/10 px-4 py-3 text-sm text-brand outline-none focus:border-brand" />
                    </div>
                    <div>
                      <label htmlFor="product-unit" className="mb-2 block text-sm font-bold text-brand">Selling unit</label>
                      <input id="product-unit" type="text" required maxLength={60} value={form.unit} disabled={saving}
                        onChange={(e) => updateForm('unit', e.target.value)} placeholder="1 litre, 500 ml..."
                        className="w-full rounded-xl border border-brand/10 px-4 py-3 text-sm text-brand outline-none focus:border-brand" />
                    </div>
                  </div>

                  {/* Categories are loaded from /api/categories, not inferred from products. */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label htmlFor="product-category" className="block text-sm font-bold text-brand">
                        Product category
                      </label>
                      <button type="button" disabled={categoriesLoading || saving}
                        onClick={() => setCategoriesVersion((v) => v + 1)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-brand-light disabled:opacity-50">
                        <RefreshCw size={14} /> Refresh categories
                      </button>
                    </div>
                    <select
                      id="product-category" required value={form.categoryId}
                      disabled={saving || categoriesLoading || !!categoriesError || categories.length === 0}
                      onChange={(e) => updateForm('categoryId', e.target.value)}
                      className="mt-2 w-full rounded-xl border border-brand/10 px-4 py-3 text-sm text-brand outline-none focus:border-brand disabled:opacity-60"
                    >
                      <option value="">
                        {categoriesLoading ? 'Loading categories...' : 'Select a category'}
                      </option>
                      {categories.map((category) => (
                        <option key={category.id} value={String(category.id)}>
                          {category.name.trim()}
                        </option>
                      ))}
                    </select>
                    {categoriesError ? (
                      <p role="alert" className="mt-2 text-xs leading-5 text-red-700">
                        Categories could not be loaded: {categoriesError}. You can still view products and audit history. Retry to enable saving.
                      </p>
                    ) : (
                      <p className="mt-2 text-xs leading-5 text-brand/50">
                        {categoriesLoading
                          ? 'Retrieving available categories...'
                          : `${categories.length} categories loaded from the category service, including categories without products.`}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="product-image" className="mb-2 block text-sm font-bold text-brand">Product image URL</label>
                    <input id="product-image" type="text" maxLength={2048} value={form.imageUrl} disabled={saving}
                      onChange={(e) => updateForm('imageUrl', e.target.value)} placeholder="https://... or /images/product.jpg"
                      className="w-full rounded-xl border border-brand/10 px-4 py-3 text-sm text-brand outline-none focus:border-brand" />
                  </div>
                  <div>
                    <label htmlFor="product-badge" className="mb-2 block text-sm font-bold text-brand">Product badge (optional)</label>
                    <input id="product-badge" type="text" maxLength={80} value={form.badge} disabled={saving}
                      onChange={(e) => updateForm('badge', e.target.value)} placeholder="Popular, New, Farm favourite..."
                      className="w-full rounded-xl border border-brand/10 px-4 py-3 text-sm text-brand outline-none focus:border-brand" />
                  </div>
                  <div className="rounded-2xl border border-brand/10 bg-cream p-5">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={form.isActive} disabled={saving}
                        onChange={(e) => updateForm('isActive', e.target.checked)} className="mt-1 h-4 w-4 accent-brand" />
                      <span>
                        <span className="block text-sm font-bold text-brand">Active in public catalogue</span>
                        <span className="mt-2 block text-xs leading-5 text-brand/60">
                          Active products may appear in the storefront. Checkout also requires sufficient inventory.
                        </span>
                      </span>
                    </label>
                  </div>

                  {mode === 'edit' && selectedProduct && (
                    <div className="rounded-2xl bg-sage/50 p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-brand-light">Current recorded stock</p>
                      <p className="mt-2 font-display text-3xl text-brand">{selectedProduct.stockQuantity}</p>
                      <p className="mt-2 text-xs leading-5 text-brand/60">
                        Stock cannot be edited here. Use Inventory Management for adjustments.
                      </p>
                      <Link to="/staff/inventory" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-brand hover:text-brand-light">
                        <Package size={16} /> Open inventory management
                      </Link>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button type="submit"
                      disabled={saving || productsLoading || categoriesLoading || !!categoriesError || categories.length === 0}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-bold text-white hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50">
                      {saving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
                      {saving ? 'Saving...' : mode === 'create' ? 'Create product' : 'Save product changes'}
                    </button>
                    <button type="button" onClick={cancelChanges} disabled={saving}
                      className="rounded-full border border-brand/15 px-6 py-3.5 text-sm font-bold text-brand hover:bg-sage disabled:opacity-50">
                      Cancel
                    </button>
                  </div>
                  <p className="text-xs leading-6 text-brand/50">
                    Successful product changes are recorded with the previous and new values and the responsible staff account.
                  </p>
                </form>
              )}
            </section>

            {mode === 'edit' && selectedProduct && (
              <section className="rounded-[2rem] border border-brand/10 bg-white p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-3 font-display text-2xl text-brand">
                      <History size={23} className="text-brand-light" /> Product history
                    </h2>
                    <p className="mt-3 text-xs leading-6 text-brand/60">
                      Recorded changes to {selectedProduct.name}.
                    </p>
                  </div>
                  <button type="button" disabled={historyLoading}
                    onClick={() => setHistoryVersion((v) => v + 1)}
                    aria-label="Refresh product history"
                    className="rounded-full border border-brand/10 p-3 text-brand disabled:opacity-50">
                    <RefreshCw size={17} />
                  </button>
                </div>
                {historyLoading ? (
                  <p className="mt-8 flex items-center gap-3 text-sm text-brand/60">
                    <LoaderCircle size={20} className="animate-spin" /> Loading product history...
                  </p>
                ) : historyError ? (
                  <div role="alert" className="mt-7 rounded-2xl bg-red-50 p-5 text-sm text-red-800">
                    {historyError}
                  </div>
                ) : history.length === 0 ? (
                  <div className="mt-7 rounded-2xl bg-cream p-6 text-sm leading-7 text-brand/60">
                    No product-management events have been recorded yet.
                  </div>
                ) : (
                  <div className="mt-7 space-y-4">
                    {history.map((event) => {
                      const changes = getAuditChanges(event)
                      return (
                        <article key={event.id} className="rounded-2xl border border-brand/10 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <span className="rounded-full bg-sage px-3 py-1 text-xs font-bold text-brand">
                                {auditActionLabel(event.action)}
                              </span>
                              <p className="mt-3 flex items-center gap-2 text-xs text-brand/55">
                                <Clock3 size={14} /> {formatDate(event.createdAt)}
                              </p>
                            </div>
                            <ShieldCheck size={20} className="shrink-0 text-brand-light" />
                          </div>
                          {event.action === 'CREATED' && (
                            <p className="mt-5 rounded-xl bg-cream p-4 text-sm text-brand/70">
                              Product registered in the catalogue.
                            </p>
                          )}
                          {changes.length > 0 && (
                            <div className="mt-5 space-y-3">
                              {changes.map((change) => (
                                <div key={change.label} className="rounded-xl bg-cream p-4">
                                  <p className="text-xs font-extrabold text-brand">{change.label}</p>
                                  <p className="mt-3 break-words text-xs text-brand/55">Before</p>
                                  <p className="mt-1 break-words text-sm text-brand">{change.before}</p>
                                  <p className="mt-3 break-words text-xs text-brand/55">After</p>
                                  <p className="mt-1 break-words text-sm font-bold text-brand">{change.after}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="mt-5 border-t border-brand/10 pt-4 text-xs text-brand/55">
                            Performed by: <span className="font-bold text-brand">{event.changedBy.fullName}</span>
                          </p>
                        </article>
                      )
                    })}
                  </div>
                )}
                <p className="mt-5 text-xs leading-6 text-brand/50">
                  Showing up to 100 recent recorded product-management events.
                </p>
              </section>
            )}
          </div>
        </div>

        <section className="rounded-[2rem] border border-brand/10 bg-sage/50 p-7 sm:p-9">
          <div className="flex items-start gap-4">
            <ShieldCheck size={27} className="shrink-0 text-brand-light" />
            <div>
              <h2 className="font-display text-2xl text-brand">Product management accountability</h2>
              <p className="mt-4 text-sm leading-7 text-brand/65">
                Product creation, metadata changes, activation and deactivation are recorded in the product audit history.
                Inventory quantities are managed separately through the Inventory Management system.
              </p>
              <p className="mt-3 text-sm leading-7 text-brand/65">
                New products start with zero stock. Activating a product does not replenish its inventory.
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}
