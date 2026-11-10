
import { useState, type FormEvent } from 'react'

import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from 'lucide-react'

import AuthPageFrame from '../components/auth/AuthPageFrame'
import { useAuth } from '../context/AuthContext'

// ==========================================
// LOGIN NAVIGATION STATE
// ==========================================

type LoginNavigationState = {
  registered?: boolean
  email?: string
}

// ==========================================
// CUSTOMER LOGIN PAGE
// ==========================================

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const navigationState = location.state as
    | LoginNavigationState
    | null

  const {
    login,
    isSubmitting,
    isAuthenticated,
    isLoading,
  } = useAuth()

  // ==========================================
  // FORM STATE
  // ==========================================

  const [email, setEmail] = useState(
    typeof navigationState?.email === 'string'
      ? navigationState.email
      : '',
  )

  const [password, setPassword] = useState('')

  const [showPassword, setShowPassword] =
    useState(false)

  const [submitError, setSubmitError] = useState<
    string | null
  >(null)

  const registrationCompleted =
    navigationState?.registered === true

  // ==========================================
  // HANDLE CUSTOMER LOGIN
  // ==========================================

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (isSubmitting || isLoading) return

    setSubmitError(null)

    try {
      await login({
        email: email.trim().toLowerCase(),
        password,
      })

      // Clear the password after successful login.
      setPassword('')

      // Continue to the product catalogue.
      navigate('/products', {
        replace: true,
      })
    } catch (error: unknown) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Unable to sign in. Please try again.',
      )
    }
  }

  // ==========================================
  // PAGE CONTENT
  // ==========================================

  return (
    <AuthPageFrame
      eyebrow="WELCOME BACK"
      title="Good to have you back."
      description="Sign in to your Loyce Dairies account and continue your dairy shopping."
    >
      {/* ======================================
          CHECKING CUSTOMER SESSION
      ====================================== */}

      {isLoading ? (
        <div
          role="status"
          className="flex items-center justify-center gap-3 py-12 text-sm text-brand/65"
        >
          <LoaderCircle
            size={20}
            className="animate-spin"
            aria-hidden="true"
          />

          Checking your session...
        </div>
      ) : isAuthenticated ? (
        /* ====================================
            CUSTOMER ALREADY SIGNED IN
        ==================================== */

        <div className="py-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sage">
            <CheckCircle2
              size={42}
              className="text-brand-light"
              aria-hidden="true"
            />
          </div>

          <h2 className="mt-6 font-display text-2xl text-brand">
            You're already signed in
          </h2>

          <p className="mt-3 text-sm leading-7 text-brand/60">
            Your Loyce Dairies account session
            is currently active.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/account"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-light"
            >
              My account
              <ArrowRight
                size={17}
                aria-hidden="true"
              />
            </Link>

            <Link
              to="/products"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-brand/15 px-7 py-4 text-sm font-bold text-brand transition-colors hover:bg-sage"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      ) : (
        /* ====================================
            CUSTOMER LOGIN FORM
        ==================================== */

        <>
          {/* Successful registration notice */}
          {registrationCompleted && (
            <div
              role="status"
              className="mb-6 flex items-start gap-3 rounded-2xl bg-sage p-4 text-sm text-brand"
            >
              <CheckCircle2
                size={20}
                className="shrink-0 text-brand-light"
                aria-hidden="true"
              />

              <p className="leading-6">
                Account created successfully.
                You can now sign in using your
                registered email and password.
              </p>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* ==================================
                EMAIL ADDRESS
            ================================== */}

            <div>
              <label
                htmlFor="login-email"
                className="mb-2 block text-sm font-bold text-brand"
              >
                Email address
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-brand/15 bg-cream px-4 transition-colors focus-within:border-brand-light">
                <Mail
                  size={18}
                  className="shrink-0 text-brand/45"
                  aria-hidden="true"
                />

                <input
                  id="login-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={254}
                  className="w-full min-w-0 bg-transparent py-4 text-sm text-brand outline-none placeholder:text-brand/35"
                />
              </div>
            </div>

            {/* ==================================
                PASSWORD
            ================================== */}

            <div>
              <label
                htmlFor="login-password"
                className="mb-2 block text-sm font-bold text-brand"
              >
                Password
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-brand/15 bg-cream px-4 transition-colors focus-within:border-brand-light">
                <LockKeyhole
                  size={18}
                  className="shrink-0 text-brand/45"
                  aria-hidden="true"
                />

                <input
                  id="login-password"
                  name="password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="min-w-0 flex-1 bg-transparent py-4 text-sm text-brand outline-none placeholder:text-brand/35"
                />

                <button
                  type="button"
                  onClick={() => {
                    setShowPassword(
                      (current) => !current,
                    )
                  }}
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  aria-pressed={showPassword}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-brand/50 transition-colors hover:bg-sage hover:text-brand focus-visible:outline-2 focus-visible:outline-brand-light"
                >
                  {showPassword ? (
                    <EyeOff
                      size={19}
                      aria-hidden="true"
                    />
                  ) : (
                    <Eye
                      size={19}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </div>
            </div>

            {/* ==================================
                ACCOUNT RECOVERY LINKS
            ================================== */}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                to="/verify-email"
                className="text-xs font-semibold text-brand/65 transition-colors hover:text-brand-light"
              >
                Verify your email
              </Link>

              <Link
                to="/forgot-password"
                className="text-xs font-bold text-brand-light transition-colors hover:text-brand"
              >
                Forgot password?
              </Link>
            </div>

            {/* ==================================
                LOGIN ERROR FEEDBACK
            ================================== */}

            {submitError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
              >
                {submitError}
              </div>
            )}

            {/* ==================================
                LOGIN BUTTON
            ================================== */}

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-brand px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                    aria-hidden="true"
                  />

                  Signing in...
                </>
              ) : (
                <>
                  Sign in

                  <ArrowRight
                    size={18}
                    aria-hidden="true"
                  />
                </>
              )}
            </button>
          </form>

          {/* ======================================
              REGISTRATION LINK
          ====================================== */}

          <p className="mt-8 border-t border-brand/10 pt-6 text-center text-sm text-brand/60">
            Don't have an account?{' '}

            <Link
              to="/register"
              className="font-bold text-brand-light transition-colors hover:text-brand"
            >
              Create an account
            </Link>
          </p>
        </>
      )}
    </AuthPageFrame>
  )
}
