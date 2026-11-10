
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Mail,
  Send,
} from 'lucide-react'

import AuthPageFrame from '../components/auth/AuthPageFrame'

import {
  requestPasswordReset,
} from '../services/accountSecurityApi'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] =
    useState(false)

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null)

  const [error, setError] = useState<string | null>(
    null,
  )

  // ==========================================
  // REQUEST PASSWORD RECOVERY
  // ==========================================

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (isSubmitting) return

    setError(null)
    setIsSubmitting(true)

    try {
      const message = await requestPasswordReset(
        email,
      )

      // The backend intentionally responds with
      // a generic message to avoid disclosing
      // whether a customer email exists.
      setSuccessMessage(message)
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to request password recovery.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPageFrame
      eyebrow="ACCOUNT RECOVERY"
      title="Forgot your password?"
      description="Enter the email address associated with your Loyce Dairies account to request password-reset instructions."
    >
      {/* ======================================
          REQUEST SUCCESS
      ====================================== */}

      {successMessage ? (
        <div
          role="status"
          className="py-7 text-center"
        >
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sage">
            <CheckCircle2
              size={42}
              className="text-brand-light"
              aria-hidden="true"
            />
          </div>

          <h2 className="mt-7 font-display text-3xl text-brand">
            Check your inbox
          </h2>

          <p className="mt-5 text-sm leading-7 text-brand/65">
            {successMessage}
          </p>

          <p className="mt-4 text-xs leading-6 text-brand/50">
            If an email is sent, the reset link will
            expire after 30 minutes.
          </p>

          <button
            type="button"
            onClick={() => {
              setSuccessMessage(null)
              setError(null)
            }}
            className="mt-7 text-sm font-bold text-brand-light hover:text-brand"
          >
            Make another request
          </button>

          <div className="mt-8 border-t border-brand/10 pt-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-bold text-brand"
            >
              <ArrowLeft
                size={17}
                aria-hidden="true"
              />
              Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        <>
          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div>
              <label
                htmlFor="forgot-password-email"
                className="mb-2 block text-sm font-bold text-brand"
              >
                Email address
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-brand/15 bg-cream px-4 focus-within:border-brand-light">
                <Mail
                  size={18}
                  className="shrink-0 text-brand/45"
                  aria-hidden="true"
                />

                <input
                  id="forgot-password-email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  maxLength={254}
                  className="w-full bg-transparent py-4 text-sm text-brand outline-none placeholder:text-brand/35"
                />
              </div>

              <p className="mt-3 text-xs leading-6 text-brand/55">
                If the account is eligible, we'll send
                password-reset instructions to this address.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-brand px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />
                  Sending request...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Request password reset
                </>
              )}
            </button>
          </form>

          <p className="mt-8 border-t border-brand/10 pt-6 text-center text-sm text-brand/65">
            Remember your password?{' '}
            <Link
              to="/login"
              className="font-bold text-brand-light hover:text-brand"
            >
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthPageFrame>
  )
}
