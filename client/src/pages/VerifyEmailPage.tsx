
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
  LoaderCircle,
  Mail,
  MailCheck,
  Send,
} from 'lucide-react'

import AuthPageFrame from '../components/auth/AuthPageFrame'
import { useAuth } from '../context/AuthContext'

import {
  confirmEmailVerification,
  requestEmailVerification,
} from '../services/accountSecurityApi'

type VerificationStatus =
  | 'request'
  | 'verifying'
  | 'verified'
  | 'error'

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred.'
}

export default function VerifyEmailPage() {
  const {
    customer,
    isAuthenticated,
    refreshSession,
  } = useAuth()

  // Capture the token once on page load.
  const [token] = useState<string | null>(() => {
    return new URLSearchParams(
      window.location.search,
    ).get('token')
  })

  const verificationStarted = useRef(false)

  const [status, setStatus] =
    useState<VerificationStatus>(
      token ? 'verifying' : 'request',
    )

  const [email, setEmail] = useState('')
  const [isSending, setIsSending] = useState(false)

  const [message, setMessage] = useState<string | null>(
    null,
  )

  // Prefill the email for signed-in customers.
  useEffect(() => {
    if (customer?.email) {
      setEmail((previous) =>
        previous || customer.email,
      )
    }
  }, [customer?.email])

  // ==========================================
  // CONFIRM RECEIVED VERIFICATION TOKEN
  // ==========================================

  useEffect(() => {
    if (!token || verificationStarted.current) return

    verificationStarted.current = true

    // Remove the one-time token from the visible URL.
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.hash,
    )

    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      setStatus('error')
      setMessage('The verification link is invalid.')
      return
    }

    const verify = async () => {
      try {
        const responseMessage =
          await confirmEmailVerification(token)

        setMessage(responseMessage)

        // Refresh the account information so that
        // emailVerifiedAt updates in AuthContext.
        await refreshSession()

        setStatus('verified')
      } catch (error: unknown) {
        setMessage(getErrorMessage(error))
        setStatus('error')
      }
    }

    void verify()
  }, [token, refreshSession])

  // ==========================================
  // REQUEST ANOTHER VERIFICATION EMAIL
  // ==========================================

  const handleRequest = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (isSending) return

    setMessage(null)
    setIsSending(true)

    try {
      const responseMessage =
        await requestEmailVerification(email)

      setMessage(responseMessage)
      setStatus('request')
    } catch (error: unknown) {
      setMessage(getErrorMessage(error))
      setStatus('error')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <AuthPageFrame
      eyebrow="ACCOUNT VERIFICATION"
      title="Let's confirm your email."
      description="Verify your email address to help protect your Loyce Dairies account."
    >
      {/* ======================================
          VERIFICATION IN PROGRESS
      ====================================== */}

      {status === 'verifying' && (
        <div
          role="status"
          className="py-12 text-center"
        >
          <LoaderCircle
            size={42}
            className="mx-auto animate-spin text-brand-light"
            aria-hidden="true"
          />

          <h2 className="mt-6 font-display text-2xl text-brand">
            Verifying your email...
          </h2>

          <p className="mt-3 text-sm leading-7 text-brand/60">
            We're checking your verification link.
          </p>
        </div>
      )}

      {/* ======================================
          VERIFICATION SUCCESSFUL
      ====================================== */}

      {status === 'verified' && (
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
            Email verified!
          </h2>

          <p className="mt-4 text-sm leading-7 text-brand/65">
            {message ??
              'Your email address has been verified successfully.'}
          </p>

          <Link
            to={isAuthenticated ? '/account' : '/login'}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-light"
          >
            {isAuthenticated
              ? 'Go to my account'
              : 'Sign in'}

            <ArrowRight
              size={18}
              aria-hidden="true"
            />
          </Link>
        </div>
      )}

      {/* ======================================
          REQUEST OR RESEND VERIFICATION
      ====================================== */}

      {(status === 'request' || status === 'error') && (
        <>
          <div className="mb-7 flex items-center gap-4 rounded-2xl bg-sage p-5">
            <MailCheck
              size={30}
              className="shrink-0 text-brand-light"
              aria-hidden="true"
            />

            <div>
              <h2 className="text-sm font-bold text-brand">
                Check your email
              </h2>

              <p className="mt-1 text-xs leading-6 text-brand/65">
                If you need a new verification link,
                enter your registered email below.
              </p>
            </div>
          </div>

          {message && (
            <div
              role={
                status === 'error'
                  ? 'alert'
                  : 'status'
              }
              className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm leading-6 ${
                status === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-brand/10 bg-sage text-brand'
              }`}
            >
              {status === 'error' ? (
                <CircleAlert
                  size={19}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle2
                  size={19}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
              )}

              <p>{message}</p>
            </div>
          )}

          <form
            onSubmit={handleRequest}
            className="space-y-6"
          >
            <div>
              <label
                htmlFor="verification-email"
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
                  id="verification-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  className="w-full bg-transparent py-4 text-sm text-brand outline-none placeholder:text-brand/35"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-brand px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? (
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
                  Send verification email
                </>
              )}
            </button>
          </form>

          <p className="mt-7 text-center text-xs leading-6 text-brand/55">
            Verification links expire after 24 hours.
            You can request another link if needed.
          </p>

          <p className="mt-6 border-t border-brand/10 pt-6 text-center text-sm text-brand/65">
            <Link
              to={isAuthenticated ? '/account' : '/login'}
              className="font-bold text-brand-light hover:text-brand"
            >
              {isAuthenticated
                ? 'Return to my account'
                : 'Back to sign in'}
            </Link>
          </p>
        </>
      )}
    </AuthPageFrame>
  )
}
