import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/apiClient'

type RequestStatus = {
  status: 'PENDING' | 'COMPLETED'
  requestedAt: string
  processedAt: string | null
}

type DeletionResponse = {
  success: boolean
  message?: string
  data?: RequestStatus | null
}

async function readDeletionResponse(response: Response) {
  const result = await response.json() as DeletionResponse

  if (!response.ok || result.success !== true) {
    throw new Error(result.message ?? 'Unable to process the request.')
  }

  return result
}

export default function AccountDeletionPage() {
  const {
    customer,
    isAuthenticated,
    isLoading,
  } = useAuth()

  const [status, setStatus] = useState<RequestStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || customer?.role !== 'CUSTOMER') {
      setStatus(null)
      return
    }

    let active = true
    setStatusLoading(true)

    void (async () => {
      try {
        const response = await apiFetch('/account-deletion')
        const result = await readDeletionResponse(response)
        if (active) setStatus(result.data ?? null)
      } catch (caught: unknown) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Unable to check deletion request status.',
          )
        }
      } finally {
        if (active) setStatusLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [isAuthenticated, customer?.id, customer?.role])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting || confirmation !== 'DELETE ACCOUNT') return

    setSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      const response = await apiFetch('/account-deletion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password,
          confirmation,
        }),
      })
      const result = await readDeletionResponse(response)
      setStatus(result.data ?? null)
      setMessage(result.message ?? 'Your request has been recorded.')
      setPassword('')
      setConfirmation('')
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to record your account-deletion request.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-cream px-5 py-12 lg:px-8">
      <section className="mx-auto max-w-2xl rounded-3xl border border-brand/10 bg-white p-6 sm:p-10">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-light">
          Account privacy
        </p>
        <h1 className="mt-3 font-display text-4xl text-brand">
          Request account deletion
        </h1>
        <p className="mt-5 text-sm leading-7 text-brand/75">
          You can request deletion of your Loyce Dairies customer
          account and associated personal information. We verify
          your identity before recording a request. Placing a request
          does not immediately delete your account.
        </p>
        <p className="mt-3 text-sm leading-7 text-brand/75">
          Information connected to existing purchases may require
          additional handling or limited retention for legitimate
          business, security, or legal obligations. Request
          processing is not yet automatic.
        </p>

        {isLoading ? (
          <p className="mt-8 text-sm text-brand/70" role="status">
            Checking your session...
          </p>
        ) : !isAuthenticated ? (
          <div className="mt-8 rounded-2xl bg-sage p-6">
            <p className="text-sm leading-6 text-brand">
              To submit a deletion request, sign in to the
              customer account you wish to remove.
            </p>
            <Link
              className="mt-4 inline-block rounded-full bg-brand px-6 py-3 text-sm font-bold text-white"
              to="/login"
            >
              Sign in to request deletion
            </Link>
          </div>
        ) : customer?.role !== 'CUSTOMER' ? (
          <p className="mt-8 rounded-xl bg-sage p-4 text-sm text-brand">
            This request form applies to customer accounts only.
            Staff accounts must be handled through the business
            administration process.
          </p>
        ) : (
          <div className="mt-8">
            <p className="text-sm text-brand/75">
              Signed in as <strong>{customer.email}</strong>
            </p>

            {statusLoading && (
              <p role="status" className="mt-4 text-sm text-brand/65">
                Checking existing requests...
              </p>
            )}

            {status && (
              <div className="mt-5 rounded-2xl bg-sage p-5 text-sm leading-7 text-brand" role="status">
                <p className="font-bold">
                  Request status: {status.status === 'PENDING' ? 'Pending processing' : 'Processed'}
                </p>
                <p>
                  Submitted: {new Date(status.requestedAt).toLocaleDateString()}
                </p>
                {status.status === 'PENDING' && (
                  <p>
                    Your account has not yet been deleted. No further
                    request is necessary.
                  </p>
                )}
              </div>
            )}

            {!statusLoading && !status && (
              <form onSubmit={(event) => { void submit(event) }} className="mt-6 space-y-5">
                <div>
                  <label htmlFor="deletion-password" className="block text-sm font-bold text-brand">
                    Confirm your account password
                  </label>
                  <input
                    id="deletion-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    maxLength={128}
                    className="mt-2 w-full rounded-xl border border-brand/20 bg-cream px-4 py-3 text-brand"
                  />
                </div>

                <div>
                  <label htmlFor="deletion-confirmation" className="block text-sm font-bold text-brand">
                    Type DELETE ACCOUNT to confirm
                  </label>
                  <input
                    id="deletion-confirmation"
                    type="text"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    required
                    autoComplete="off"
                    className="mt-2 w-full rounded-xl border border-brand/20 bg-cream px-4 py-3 text-brand"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || confirmation !== 'DELETE ACCOUNT' || !password}
                  className="rounded-full bg-brand px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Submitting request...' : 'Submit deletion request'}
                </button>
              </form>
            )}

            {message && (
              <p role="status" className="mt-5 rounded-xl bg-sage p-4 text-sm text-brand">
                {message}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
