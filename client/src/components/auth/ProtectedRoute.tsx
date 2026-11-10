
import { Navigate, Outlet } from 'react-router-dom'
import {
  AlertCircle,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react'

import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute() {
  const {
    status,
    refreshSession,
  } = useAuth()

  // Check the existing customer session.
  if (status === 'checking') {
    return (
      <main
        role="status"
        className="flex min-h-[60vh] flex-col items-center justify-center bg-cream px-5 text-center"
      >
        <LoaderCircle
          size={38}
          className="animate-spin text-brand-light"
          aria-hidden="true"
        />

        <h1 className="mt-6 font-display text-3xl text-brand">
          Checking your account
        </h1>

        <p className="mt-3 text-sm text-brand/60">
          Verifying your Loyce Dairies session.
        </p>
      </main>
    )
  }

  // A server error is not the same as being signed out.
  if (status === 'error') {
    return (
      <main
        role="alert"
        className="flex min-h-[60vh] flex-col items-center justify-center bg-cream px-5 text-center"
      >
        <AlertCircle
          size={38}
          className="text-amber-600"
          aria-hidden="true"
        />

        <h1 className="mt-6 font-display text-3xl text-brand">
          Account temporarily unavailable
        </h1>

        <p className="mt-3 max-w-md text-sm leading-7 text-brand/60">
          We couldn't verify your session. Please check
          your connection and try again.
        </p>

        <button
          type="button"
          onClick={() => {
            void refreshSession()
          }}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-sm font-bold text-white hover:bg-brand-light"
        >
          <RefreshCw size={17} aria-hidden="true" />
          Try again
        </button>
      </main>
    )
  }

  // Guests must sign in before accessing the account.
  if (status !== 'authenticated') {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  return <Outlet />
}
