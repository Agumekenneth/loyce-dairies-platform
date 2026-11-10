
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
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react'

import { formatPrice } from '../data/products'

import {
  createDeliveryZone,
  DeliveryZoneApiError,
  getStaffDeliveryZones,
  setDeliveryZoneActivation,
  updateDeliveryZone,
  type DeliveryZone,
  type ZoneInput,
} from '../services/adminDeliveryZonesApi'

// ==========================================
// FORM TYPES
// ==========================================

type ZoneForm = {
  name: string
  slug: string
  feeUgx: string
}

type ActivationRequest = {
  zoneId: number
  activate: boolean
}

const EMPTY_FORM: ZoneForm = {
  name: '',
  slug: '',
  feeUgx: '',
}

const MAX_FEE = 2_147_483_647

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Unable to complete the request.'
}

// ==========================================
// STAFF DELIVERY ZONE DASHBOARD
// ==========================================

export default function StaffDeliveryZonesPage() {
  const [zones, setZones] = useState<DeliveryZone[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(
    null,
  )

  const [accessStatus, setAccessStatus] = useState<
    number | null
  >(null)

  const [reloadVersion, setReloadVersion] = useState(0)

  // ==========================================
  // CREATE / EDIT FORM
  // ==========================================

  const [editingId, setEditingId] = useState<
    number | null
  >(null)

  const [form, setForm] = useState<ZoneForm>(EMPTY_FORM)

  const [formError, setFormError] = useState<
    string | null
  >(null)

  // ==========================================
  // ACTIVATION CONFIRMATION
  // ==========================================

  const [activationRequest, setActivationRequest] =
    useState<ActivationRequest | null>(null)

  const [approvalConfirmed, setApprovalConfirmed] =
    useState(false)

  const [actionError, setActionError] = useState<
    string | null
  >(null)

  // ==========================================
  // SHARED MUTATION STATE
  // ==========================================

  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const [notice, setNotice] = useState<string | null>(
    null,
  )

  // ==========================================
  // LOAD ZONES
  // ==========================================

  useEffect(() => {
    const controller = new AbortController()

    const loadZones = async () => {
      setLoading(true)
      setLoadError(null)

      try {
        const result = await getStaffDeliveryZones(
          controller.signal,
        )

        if (controller.signal.aborted) return

        setZones(result)
        setAccessStatus(null)
      } catch (error: unknown) {
        if (controller.signal.aborted) return

        if (
          error instanceof DeliveryZoneApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          setAccessStatus(error.status)
          setZones([])
        } else {
          setLoadError(getErrorMessage(error))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadZones()

    return () => controller.abort()
  }, [reloadVersion])

  // ==========================================
  // DASHBOARD CALCULATIONS
  // ==========================================

  const activeZones = zones.filter(
    (zone) => zone.isActive,
  ).length

  const inactiveZones = zones.length - activeZones

  const currentEditingZone = zones.find(
    (zone) => zone.id === editingId,
  )

  const confirmationZone = zones.find(
    (zone) => zone.id === activationRequest?.zoneId,
  )

  // ==========================================
  // REFRESH
  // ==========================================

  const refreshZones = () => {
    if (busyRef.current) return

    setNotice(null)
    setActionError(null)
    setReloadVersion((value) => value + 1)
  }

  // ==========================================
  // CREATE / EDIT HANDLERS
  // ==========================================

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  const beginEditing = (zone: DeliveryZone) => {
    if (busyRef.current) return

    // Frontend safeguard:
    // Require deactivation before editing a
    // publicly available delivery zone.
    if (zone.isActive) {
      setFormError(
        'Deactivate this delivery zone before editing ' +
          'its name or fee.',
      )
      return
    }

    setEditingId(zone.id)
    setForm({
      name: zone.name,
      slug: zone.slug,
      feeUgx: String(zone.feeUgx),
    })

    setFormError(null)
    setNotice(null)
  }

  const handleSave = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (busyRef.current) return

    setFormError(null)
    setNotice(null)

    const name = form.name.trim()
    const slug = form.slug.trim()

    if (name.length < 2 || name.length > 100) {
      setFormError(
        'Zone name must contain 2–100 characters.',
      )
      return
    }

    if (
      slug.length < 2 ||
      slug.length > 100 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    ) {
      setFormError(
        'Use a lowercase slug with letters, ' +
          'numbers and hyphens.',
      )
      return
    }

    if (form.feeUgx.trim() === '') {
      setFormError('Enter the delivery fee in UGX.')
      return
    }

    const feeUgx = Number(form.feeUgx)

    if (
      !Number.isSafeInteger(feeUgx) ||
      feeUgx < 0 ||
      feeUgx > MAX_FEE
    ) {
      setFormError(
        'Enter a valid non-negative whole-UGX fee.',
      )
      return
    }

    if (
      editingId !== null &&
      currentEditingZone?.isActive
    ) {
      setFormError(
        'This delivery zone is active. Deactivate it ' +
          'before making changes.',
      )
      return
    }

    const payload: ZoneInput = {
      name,
      slug,
      feeUgx,
    }

    busyRef.current = true
    setBusy(true)

    try {
      if (editingId === null) {
        await createDeliveryZone(payload)

        setNotice(
          'Delivery zone created successfully. ' +
            'It remains inactive until approved.',
        )
      } else {
        await updateDeliveryZone(editingId, payload)

        setNotice(
          'Delivery-zone details updated successfully.',
        )
      }

      resetForm()
      setReloadVersion((value) => value + 1)
    } catch (error: unknown) {
      setFormError(getErrorMessage(error))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  // ==========================================
  // ACTIVATION HANDLERS
  // ==========================================

  const beginActivation = (zone: DeliveryZone) => {
    if (busyRef.current) return

    setActivationRequest({
      zoneId: zone.id,
      activate: !zone.isActive,
    })

    setApprovalConfirmed(false)
    setActionError(null)
    setNotice(null)
  }

  const cancelActivation = () => {
    if (busyRef.current) return

    setActivationRequest(null)
    setApprovalConfirmed(false)
    setActionError(null)
  }

  const confirmActivation = async () => {
    if (
      !activationRequest ||
      !confirmationZone ||
      busyRef.current
    ) {
      return
    }

    if (
      activationRequest.activate &&
      !approvalConfirmed
    ) {
      setActionError(
        'You must confirm that the real delivery ' +
          'coverage and fee have been approved.',
      )
      return
    }

    setActionError(null)
    setNotice(null)

    busyRef.current = true
    setBusy(true)

    try {
      const updated = await setDeliveryZoneActivation(
        activationRequest.zoneId,
        activationRequest.activate,
      )

      setNotice(
        updated.isActive
          ? `${updated.name} is now active and available at checkout.`
          : `${updated.name} has been deactivated and is no longer selectable for new delivery orders.`,
      )

      setActivationRequest(null)
      setApprovalConfirmed(false)
      setReloadVersion((value) => value + 1)
    } catch (error: unknown) {
      setActionError(getErrorMessage(error))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  // ==========================================
  // ACCESS RESTRICTION
  // ==========================================

  if (accessStatus === 401 || accessStatus === 403) {
    return (
      <main className="min-h-[70vh] bg-cream px-5 py-20">
        <section className="mx-auto max-w-lg rounded-[2rem] border border-brand/10 bg-white p-9 text-center">
          <LockKeyhole
            size={42}
            className="mx-auto text-brand-light"
          />

          <h1 className="mt-6 font-display text-3xl text-brand">
            {accessStatus === 401
              ? 'Staff sign-in required'
              : 'Staff access only'}
          </h1>

          <p className="mt-4 text-sm leading-7 text-brand/60">
            {accessStatus === 401
              ? 'Sign in with an authorized staff account.'
              : 'This account cannot manage Loyce Dairies delivery zones.'}
          </p>

          <Link
            to={
              accessStatus === 401
                ? '/login'
                : '/account'
            }
            className="mt-7 inline-flex rounded-full bg-brand px-7 py-3.5 text-sm font-bold text-white"
          >
            {accessStatus === 401
              ? 'Go to login'
              : 'Back to my account'}
          </Link>
        </section>
      </main>
    )
  }

  // ==========================================
  // MAIN DASHBOARD
  // ==========================================

  return (
    <main className="min-h-screen bg-cream">
      {/* HEADER */}
      <section className="border-b border-brand/10 bg-sage/60">
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
          <Link
            to="/staff/orders"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand/65 hover:text-brand"
          >
            <ArrowLeft size={17} />
            Back to staff orders
          </Link>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-light">
                LOYCE DAIRIES · STAFF
              </p>

              <h1 className="mt-4 font-display text-4xl text-brand sm:text-5xl">
                Delivery zones
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-brand/65">
                Configure delivery coverage and fees.
                Only approved, active zones are
                available during customer checkout.
              </p>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-bold text-brand">
              <ShieldCheck size={18} />
              Staff workspace
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        {/* SUMMARY */}
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Total zones"
            value={zones.length}
          />

          <SummaryCard
            label="Active zones"
            value={activeZones}
          />

          <SummaryCard
            label="Inactive zones"
            value={inactiveZones}
          />
        </div>

        {/* FEEDBACK */}
        {notice && (
          <div
            role="status"
            className="mt-7 flex items-start gap-3 rounded-2xl bg-sage p-5 text-sm text-brand"
          >
            <CheckCircle2
              size={20}
              className="shrink-0 text-brand-light"
            />

            {notice}
          </div>
        )}

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* ==================================
              ZONES LIST
          ================================== */}

          <section className="min-w-0 rounded-[2rem] border border-brand/10 bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Truck
                  size={25}
                  className="text-brand-light"
                />

                <h2 className="font-display text-2xl text-brand">
                  Configured zones
                </h2>
              </div>

              <button
                type="button"
                onClick={refreshZones}
                disabled={loading || busy}
                className="inline-flex items-center gap-2 rounded-full border border-brand/15 px-4 py-2.5 text-xs font-bold text-brand hover:bg-sage disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading ? 'animate-spin' : ''
                  }
                />
                Refresh
              </button>
            </div>

            {loading && (
              <div
                role="status"
                className="mt-8 flex items-center gap-3 text-sm text-brand/60"
              >
                <LoaderCircle
                  size={20}
                  className="animate-spin"
                />
                Loading delivery zones...
              </div>
            )}

            {loadError && (
              <div
                role="alert"
                className="mt-7 rounded-2xl bg-amber-50 p-5 text-sm text-amber-800"
              >
                <AlertCircle
                  size={20}
                  className="mb-3"
                />
                {loadError}
              </div>
            )}

            {!loading &&
              !loadError &&
              zones.length === 0 && (
                <div className="py-14 text-center">
                  <MapPin
                    size={38}
                    className="mx-auto text-brand/30"
                  />

                  <h3 className="mt-5 font-display text-2xl text-brand">
                    No delivery zones yet
                  </h3>

                  <p className="mt-3 text-sm text-brand/60">
                    Use the form to create an
                    inactive delivery zone.
                  </p>
                </div>
              )}

            <div className="mt-7 space-y-4">
              {zones.map((zone) => (
                <article
                  key={zone.id}
                  className="rounded-2xl border border-brand/10 bg-cream p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-brand">
                        {zone.name}
                      </h3>

                      <p className="mt-1 break-all text-xs text-brand/50">
                        {zone.slug}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                        zone.isActive
                          ? 'bg-sage text-brand'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {zone.isActive
                        ? 'Active'
                        : 'Inactive'}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-brand/10 pt-5">
                    <div>
                      <p className="text-xs text-brand/50">
                        Delivery fee
                      </p>

                      <p className="mt-1 text-lg font-extrabold text-brand">
                        {formatPrice(zone.feeUgx)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || zone.isActive}
                        onClick={() =>
                          beginEditing(zone)
                        }
                        className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-white px-4 py-2.5 text-xs font-bold text-brand hover:bg-sage disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          beginActivation(zone)
                        }
                        className="rounded-full bg-brand px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-light disabled:opacity-50"
                      >
                        {zone.isActive
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>
                    </div>
                  </div>

                  {zone.isActive && (
                    <p className="mt-4 text-xs leading-6 text-brand/55">
                      Deactivate this zone before
                      changing its delivery fee
                      or coverage.
                    </p>
                  )}

                  {/* ACTIVATION CONFIRMATION */}
                  {activationRequest?.zoneId ===
                    zone.id && (
                    <div className="mt-5 rounded-xl border border-brand/15 bg-white p-5">
                      <h4 className="text-sm font-bold text-brand">
                        {activationRequest.activate
                          ? 'Approve zone activation?'
                          : 'Deactivate this zone?'}
                      </h4>

                      <p className="mt-3 text-xs leading-6 text-brand/65">
                        {activationRequest.activate
                          ? 'Activating this zone makes it selectable by customers and applies its configured fee at checkout.'
                          : 'Deactivating this zone removes it from future delivery checkout choices. Existing orders are retained.'}
                      </p>

                      {activationRequest.activate && (
                        <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs leading-6 text-brand">
                          <input
                            type="checkbox"
                            checked={approvalConfirmed}
                            onChange={(event) =>
                              setApprovalConfirmed(
                                event.target.checked,
                              )
                            }
                            disabled={busy}
                            className="mt-1 accent-brand"
                          />

                          I confirm that Loyce Dairies
                          has approved this actual
                          delivery area and its
                          configured fee of{' '}
                          {formatPrice(zone.feeUgx)}.
                        </label>
                      )}

                      {actionError && (
                        <p
                          role="alert"
                          className="mt-4 text-xs text-red-700"
                        >
                          {actionError}
                        </p>
                      )}

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            void confirmActivation()
                          }
                          disabled={
                            busy ||
                            (activationRequest.activate &&
                              !approvalConfirmed)
                          }
                          className="rounded-full bg-brand px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40"
                        >
                          {busy
                            ? 'Saving...'
                            : activationRequest.activate
                              ? 'Approve and activate'
                              : 'Confirm deactivation'}
                        </button>

                        <button
                          type="button"
                          onClick={cancelActivation}
                          disabled={busy}
                          className="rounded-full border border-brand/15 px-5 py-2.5 text-xs font-bold text-brand"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          {/* ==================================
              CREATE / EDIT FORM
          ================================== */}

          <aside className="rounded-[2rem] border border-brand/10 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              {editingId === null ? (
                <Plus
                  size={24}
                  className="text-brand-light"
                />
              ) : (
                <Pencil
                  size={24}
                  className="text-brand-light"
                />
              )}

              <h2 className="font-display text-2xl text-brand">
                {editingId === null
                  ? 'Add delivery zone'
                  : 'Edit delivery zone'}
              </h2>
            </div>

            <p className="mt-4 text-sm leading-7 text-brand/60">
              {editingId === null
                ? 'New zones are inactive until explicitly approved.'
                : 'Update this inactive zone before making it available to customers.'}
            </p>

            <form
              onSubmit={(event) => {
                void handleSave(event)
              }}
              className="mt-7 space-y-5"
            >
              <div>
                <label
                  htmlFor="zone-name"
                  className="mb-2 block text-sm font-bold text-brand"
                >
                  Zone name
                </label>

                <input
                  id="zone-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Approved delivery area"
                  disabled={busy}
                  className="w-full rounded-xl border border-brand/15 bg-cream px-4 py-3.5 text-sm text-brand outline-none focus:border-brand-light"
                />
              </div>

              <div>
                <label
                  htmlFor="zone-slug"
                  className="mb-2 block text-sm font-bold text-brand"
                >
                  Zone slug
                </label>

                <input
                  id="zone-slug"
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={form.slug}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      slug: event.target.value,
                    }))
                  }
                  placeholder="approved-delivery-area"
                  disabled={busy}
                  className="w-full rounded-xl border border-brand/15 bg-cream px-4 py-3.5 text-sm text-brand outline-none focus:border-brand-light"
                />

                <p className="mt-2 text-xs text-brand/50">
                  Lowercase letters, numbers,
                  and hyphens only.
                </p>
              </div>

              <div>
                <label
                  htmlFor="zone-fee"
                  className="mb-2 block text-sm font-bold text-brand"
                >
                  Delivery fee (UGX)
                </label>

                <input
                  id="zone-fee"
                  type="number"
                  min={0}
                  max={MAX_FEE}
                  step={1}
                  required
                  value={form.feeUgx}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      feeUgx: event.target.value,
                    }))
                  }
                  placeholder="Enter approved fee"
                  disabled={busy}
                  className="w-full rounded-xl border border-brand/15 bg-cream px-4 py-3.5 text-sm text-brand outline-none focus:border-brand-light"
                />

                <p className="mt-2 text-xs leading-6 text-brand/50">
                  Enter a whole-UGX amount.
                  A zero fee means free delivery;
                  use it only when explicitly approved.
                </p>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
                >
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-4 text-sm font-bold text-white hover:bg-brand-light disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    {editingId === null
                      ? 'Create inactive zone'
                      : 'Save changes'}
                  </>
                )}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand/15 px-6 py-3 text-sm font-bold text-brand disabled:opacity-50"
                >
                  <X size={17} />
                  Cancel editing
                </button>
              )}
            </form>

            <div className="mt-8 rounded-2xl bg-sage p-5">
              <ShieldCheck
                size={23}
                className="text-brand-light"
              />

              <h3 className="mt-3 text-sm font-bold text-brand">
                Delivery configuration
              </h3>

              <p className="mt-3 text-xs leading-6 text-brand/65">
                Only active zones appear on the
                customer checkout page. Do not
                activate development test zones
                or unapproved delivery fees.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

// ==========================================
// DASHBOARD SUMMARY CARD
// ==========================================

type SummaryCardProps = {
  label: string
  value: number
}

function SummaryCard({
  label,
  value,
}: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-brand/10 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand/55">
        {label}
      </p>

      <p className="mt-3 font-display text-4xl text-brand">
        {value}
      </p>
    </div>
  )
}
