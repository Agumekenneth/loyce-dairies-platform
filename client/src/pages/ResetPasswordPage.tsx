
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'

import { Link } from 'react-router-dom'

import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
} from 'lucide-react'

import AuthPageFrame from '../components/auth/AuthPageFrame'

import {
  resetCustomerPassword,
} from '../services/accountSecurityApi'

type ResetStatus =
  | 'ready'
  | 'submitting'
  | 'completed'

export default function ResetPasswordPage() {
  // Capture the token from the email link.
  // Never put this value in localStorage.
  const tokenRef = useRef<string | null>(
    new URLSearchParams(
      window.location.search,
    ).get('token'),
  )

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] =
    useState('')

  const [showPasswords, setShowPasswords] =
    useState(false)

  const [status, setStatus] =
    useState<ResetStatus>('ready')

  const [error, setError] = useState<string | null>(
    null,
  )

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null)

  // ==========================================
  // REMOVE TOKEN FROM VISIBLE URL
  // ==========================================

  useEffect(() => {
    if (tokenRef.current) {
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.hash,
      )
    }
  }, [])

  const tokenIsValid =
    typeof tokenRef.current === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(
      tokenRef.current,
    )

  // ==========================================
  // RESET CUSTOMER PASSWORD
  // ==========================================

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (status === 'submitting') return

    const token = tokenRef.current

    setError(null)

    if (
      !token ||
      !/^[A-Za-z0-9_-]{43}$/.test(token)
    ) {
      setError(
        'Your password reset link is invalid or missing.',
      )
      return
    }

    if (
      newPassword.length < 12 ||
      newPassword.length > 128
    ) {
      setError(
        'Your password must contain between 12 and 128 characters.',
      )
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Your passwords do not match.')
      return
    }

    setStatus('submitting')

    try {
      const message = await resetCustomerPassword({
        token,
        newPassword,
        confirmPassword,
      })

      setNewPassword('')
      setConfirmPassword('')

      // The one-time token is no longer needed.
      tokenRef.current = null

      setSuccessMessage(message)
      setStatus('completed')
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to reset your password.',
      )

      setStatus('ready')
    }
  }

  return (
    <AuthPageFrame
      eyebrow="SECURE PASSWORD RESET"
      title="Create a new password."
      description="Choose a new password for your Loyce Dairies account."
    >
      {/* ======================================
          RESET COMPLETED
      ====================================== */}

      {status === 'completed' ? (
        <div
          role="status"
          className="py-8 text-center"
        >
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sage">
            <CheckCircle2
              size={43}
              className="text-brand-light"
              aria-hidden="true"
            />
          </div>

          <h2 className="mt-7 font-display text-3xl text-brand">
            Password updated!
          </h2>

          <p className="mt-4 text-sm leading-7 text-brand/65">
            {successMessage ??
              'Your password has been changed successfully.'}
          </p>

          <p className="mt-3 text-xs leading-6 text-brand/55">
            Your previous account sessions have
            been revoked. Sign in with your new password.
          </p>

          <Link
            to="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-light"
          >
            Sign in
            <ArrowRight
              size={18}
              aria-hidden="true"
            />
          </Link>
        </div>
      ) : !tokenIsValid ? (
        /* ====================================
            INVALID OR MISSING TOKEN
        ==================================== */

        <div className="py-8 text-center">
          <CircleAlert
            size={43}
            className="mx-auto text-amber-600"
            aria-hidden="true"
          />

          <h2 className="mt-6 font-display text-3xl text-brand">
            Reset link missing
          </h2>

          <p className="mt-4 text-sm leading-7 text-brand/65">
            Please open the password-reset link
            from your email or request a new one.
          </p>

          <Link
            to="/forgot-password"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-4 text-sm font-bold text-white hover:bg-brand-light"
          >
            Request a new link
            <ArrowRight
              size={18}
              aria-hidden="true"
            />
          </Link>
        </div>
      ) : (
        /* ====================================
            RESET PASSWORD FORM
        ==================================== */

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* New password */}
          <div>
            <label
              htmlFor="reset-new-password"
              className="mb-2 block text-sm font-bold text-brand"
            >
              New password
            </label>

            <div className="flex items-center gap-3 rounded-xl border border-brand/15 bg-cream px-4 focus-within:border-brand-light">
              <LockKeyhole
                size={18}
                className="shrink-0 text-brand/45"
                aria-hidden="true"
              />

              <input
                id="reset-new-password"
                type={
                  showPasswords
                    ? 'text'
                    : 'password'
                }
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(event.target.value)
                }
                placeholder="Create a new password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                className="min-w-0 flex-1 bg-transparent py-4 text-sm text-brand outline-none placeholder:text-brand/35"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPasswords(
                    (current) => !current,
                  )
                }
                aria-label={
                  showPasswords
                    ? 'Hide passwords'
                    : 'Show passwords'
                }
                aria-pressed={showPasswords}
                className="text-brand/50 hover:text-brand"
              >
                {showPasswords ? (
                  <EyeOff size={19} />
                ) : (
                  <Eye size={19} />
                )}
              </button>
            </div>

            <p className="mt-2 text-xs text-brand/50">
              Use between 12 and 128 characters.
            </p>
          </div>

          {/* Confirm password */}
          <div>
            <label
              htmlFor="reset-confirm-password"
              className="mb-2 block text-sm font-bold text-brand"
            >
              Confirm new password
            </label>

            <div className="flex items-center gap-3 rounded-xl border border-brand/15 bg-cream px-4 focus-within:border-brand-light">
              <LockKeyhole
                size={18}
                className="shrink-0 text-brand/45"
                aria-hidden="true"
              />

              <input
                id="reset-confirm-password"
                type={
                  showPasswords
                    ? 'text'
                    : 'password'
                }
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Repeat your new password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                className="w-full bg-transparent py-4 text-sm text-brand outline-none placeholder:text-brand/35"
              />
            </div>
          </div>

          {/* Error feedback */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <CircleAlert
                size={19}
                className="shrink-0"
                aria-hidden="true"
              />

              <p>{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-brand px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'submitting' ? (
              <>
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                />
                Updating password...
              </>
            ) : (
              <>
                Update password
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <p className="text-center text-xs leading-6 text-brand/55">
            For your security, all previous
            sessions will be signed out.
          </p>
        </form>
      )}

      {status !== 'completed' && (
        <div className="mt-8 border-t border-brand/10 pt-6 text-center">
          <Link
            to="/forgot-password"
            className="text-sm font-bold text-brand-light hover:text-brand"
          >
            Request another reset link
          </Link>
        </div>
      )}
    </AuthPageFrame>
  )
}
