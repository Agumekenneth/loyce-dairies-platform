
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
} from 'lucide-react'

import AuthPageFrame from '../components/auth/AuthPageFrame'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const navigate = useNavigate()

  const {
    register,
    isSubmitting,
    isAuthenticated,
    isLoading,
  } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)

  const [submitError, setSubmitError] = useState<string | null>(
    null,
  )

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (isSubmitting) return

    setSubmitError(null)

    if (password !== confirmPassword) {
      setSubmitError('Your passwords do not match.')
      return
    }

    if (password.length < 12) {
      setSubmitError(
        'Your password must contain at least 12 characters.',
      )
      return
    }

    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
      })

      // Registration creates an account but does not
      // automatically create an authenticated session.
      setPassword('')
      setConfirmPassword('')

      navigate('/login', {
        replace: true,
        state: {
          registered: true,
          email: email.trim().toLowerCase(),
        },
      })
    } catch (error: unknown) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Unable to create your account. Please try again.',
      )
    }
  }

  return (
    <AuthPageFrame
      eyebrow="JOIN LOYCE DAIRIES"
      title="Your fresh start begins here."
      description="Create your account and enjoy a simpler way to shop for your favourite dairy essentials."
    >
      {isLoading ? (
        <div
          role="status"
          className="flex items-center justify-center gap-3 py-12 text-sm text-brand/65"
        >
          <LoaderCircle
            size={20}
            className="animate-spin"
          />
          Checking your session...
        </div>
      ) : isAuthenticated ? (
        <div className="py-8 text-center">
          <CheckCircle2
            size={42}
            className="mx-auto text-brand-light"
          />

          <h2 className="mt-5 font-display text-2xl text-brand">
            You already have an active session
          </h2>

          <p className="mt-3 text-sm text-brand/60">
            You're currently signed in to Loyce Dairies.
          </p>

          <Link
            to="/products"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-4 text-sm font-bold text-white hover:bg-brand-light"
          >
            Continue shopping
            <ArrowRight size={17} />
          </Link>
        </div>
      ) : (
        <>
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* Full name */}
            <div>
              <label
                htmlFor="register-full-name"
                className="mb-2 block text-sm font-bold text-brand"
              >
                Full name
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-brand/15 bg-cream px-4 focus-within:border-brand-light">
                <UserRound
                  size={18}
                  className="shrink-0 text-brand/45"
                  aria-hidden="true"
                />

                <input
                  id="register-full-name"
                  type="text"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  placeholder="Your full name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  className="w-full bg-transparent py-4 text-sm text-brand outline-none placeholder:text-brand/35"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="register-email"
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
                  id="register-email"
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
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="register-phone"
                className="mb-2 block text-sm font-bold text-brand"
              >
                Phone number{' '}
                <span className="font-normal text-brand/45">
                  (optional)
                </span>
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-brand/15 bg-cream px-4 focus-within:border-brand-light">
                <Phone
                  size={18}
                  className="shrink-0 text-brand/45"
                  aria-hidden="true"
                />

                <input
                  id="register-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  placeholder="+256 700 000 000"
                  autoComplete="tel"
                  minLength={7}
                  maxLength={20}
                  className="w-full bg-transparent py-4 text-sm text-brand outline-none placeholder:text-brand/35"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="register-password"
                className="mb-2 block text-sm font-bold text-brand"
              >
                Password
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-brand/15 bg-cream px-4 focus-within:border-brand-light">
                <LockKeyhole
                  size={18}
                  className="shrink-0 text-brand/45"
                  aria-hidden="true"
                />

                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Create a password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  className="min-w-0 flex-1 bg-transparent py-4 text-sm text-brand outline-none placeholder:text-brand/35"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword
                      ? 'Hide passwords'
                      : 'Show passwords'
                  }
                  aria-pressed={showPassword}
                  className="text-brand/50 hover:text-brand"
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>

              <p className="mt-2 text-xs text-brand/50">
                Use at least 12 characters.
              </p>
            </div>

            {/* Confirm password */}
            <div>
              <label
                htmlFor="register-confirm-password"
                className="mb-2 block text-sm font-bold text-brand"
              >
                Confirm password
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-brand/15 bg-cream px-4 focus-within:border-brand-light">
                <LockKeyhole
                  size={18}
                  className="shrink-0 text-brand/45"
                  aria-hidden="true"
                />

                <input
                  id="register-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  className="w-full bg-transparent py-4 text-sm text-brand outline-none placeholder:text-brand/35"
                />
              </div>
            </div>

            {/* Validation or API error */}
            {submitError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {submitError}
              </div>
            )}

            {/* Submit */}
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
                  Creating account...
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 border-t border-brand/10 pt-6 text-center text-sm text-brand/60">
            Already have an account?{' '}
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
