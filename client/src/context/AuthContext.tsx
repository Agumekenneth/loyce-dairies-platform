
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  getCurrentCustomer,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
  type Customer,
  type LoginCredentials,
  type RegistrationDetails,
} from '../services/authApi'

// ==========================================
// AUTHENTICATION TYPES
// ==========================================

type AuthStatus =
  | 'checking'
  | 'authenticated'
  | 'guest'
  | 'error'

type AuthContextValue = {
  customer: Customer | null
  status: AuthStatus
  isAuthenticated: boolean
  isLoading: boolean
  isSubmitting: boolean
  error: string | null

  login: (credentials: LoginCredentials) => Promise<void>
  register: (details: RegistrationDetails) => Promise<Customer>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'An unexpected authentication error occurred.'
}

// ==========================================
// AUTHENTICATION PROVIDER
// ==========================================

export function AuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [customer, setCustomer] = useState<Customer | null>(
    null,
  )

  const [status, setStatus] = useState<AuthStatus>(
    'checking',
  )

  const [error, setError] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Prevent older session requests from overwriting
  // more recent authentication state.
  const requestVersion = useRef(0)

  // ==========================================
  // VERIFY EXISTING SESSION
  // ==========================================

  const refreshSession = useCallback(async () => {
    const version = ++requestVersion.current

    setStatus('checking')
    setError(null)

    try {
      const currentCustomer = await getCurrentCustomer()

      if (version !== requestVersion.current) return

      setCustomer(currentCustomer)

      setStatus(
        currentCustomer ? 'authenticated' : 'guest',
      )
    } catch (caughtError: unknown) {
      if (version !== requestVersion.current) return

      setCustomer(null)
      setStatus('error')
      setError(getErrorMessage(caughtError))
    }
  }, [])

  // Check the session when the application loads.
  useEffect(() => {
    void refreshSession()

    return () => {
      requestVersion.current += 1
    }
  }, [refreshSession])

  // ==========================================
  // CUSTOMER LOGIN
  // ==========================================

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const version = ++requestVersion.current

      setIsSubmitting(true)
      setError(null)

      try {
        const loggedInCustomer =
          await loginCustomer(credentials)

        if (version === requestVersion.current) {
          setCustomer(loggedInCustomer)
          setStatus('authenticated')
        }
      } catch (caughtError: unknown) {
        if (version === requestVersion.current) {
          setError(getErrorMessage(caughtError))
          setCustomer(null)
          setStatus('guest')
        }

        throw caughtError
      } finally {
        if (version === requestVersion.current) {
          setIsSubmitting(false)
        }
      }
    },
    [],
  )

  // ==========================================
  // CUSTOMER REGISTRATION
  // ==========================================

  const register = useCallback(
    async (
      details: RegistrationDetails,
    ): Promise<Customer> => {
      setIsSubmitting(true)
      setError(null)

      try {
        const registeredCustomer =
          await registerCustomer(details)

        // Registration does not automatically log
        // the customer into the application.
        return registeredCustomer
      } catch (caughtError: unknown) {
        setError(getErrorMessage(caughtError))
        throw caughtError
      } finally {
        setIsSubmitting(false)
      }
    },
    [],
  )

  // ==========================================
  // CUSTOMER LOGOUT
  // ==========================================

  const logout = useCallback(async () => {
    const version = ++requestVersion.current

    setIsSubmitting(true)
    setError(null)

    try {
      await logoutCustomer()

      if (version === requestVersion.current) {
        setCustomer(null)
        setStatus('guest')
      }
    } catch (caughtError: unknown) {
      if (version === requestVersion.current) {
        setError(getErrorMessage(caughtError))
      }

      throw caughtError
    } finally {
      if (version === requestVersion.current) {
        setIsSubmitting(false)
      }
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // ==========================================
  // SHARED AUTHENTICATION STATE
  // ==========================================

  const isAuthenticated =
    status === 'authenticated' && customer !== null

  const isLoading = status === 'checking'

  const value = useMemo<AuthContextValue>(
    () => ({
      customer,
      status,
      isAuthenticated,
      isLoading,
      isSubmitting,
      error,
      login,
      register,
      logout,
      refreshSession,
      clearError,
    }),
    [
      customer,
      status,
      isAuthenticated,
      isLoading,
      isSubmitting,
      error,
      login,
      register,
      logout,
      refreshSession,
      clearError,
    ],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ==========================================
// CUSTOM AUTHENTICATION HOOK
// ==========================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error(
      'useAuth must be used within an AuthProvider',
    )
  }

  return context
}
