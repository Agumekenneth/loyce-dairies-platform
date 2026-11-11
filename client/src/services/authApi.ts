
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5000/api'
).replace(/\/+$/, '')

// ==========================================
// LOYCE DAIRIES PLATFORM
// CUSTOMER AUTHENTICATION API
// STAFF ROLE SUPPORT
// MILESTONE 4.7.3
// ==========================================

// ==========================================
// CUSTOMER ROLES
// ==========================================

export type CustomerRole =
  | 'CUSTOMER'
  | 'STAFF'

// ==========================================
// CUSTOMER TYPES
// ==========================================

export type Customer = {
  id: string
  fullName: string
  email: string
  phone: string | null
  emailVerifiedAt: string | null

  // The authenticated customer's role
  // is returned by the backend.
  //
  // This supports role-aware frontend
  // navigation and staff workspace links.
  //
  // Backend authorization remains
  // responsible for enforcing permissions.

  role: CustomerRole
}

// ==========================================
// LOGIN CREDENTIALS
// ==========================================

export type LoginCredentials = {
  email: string
  password: string
}

// ==========================================
// REGISTRATION DETAILS
// ==========================================

export type RegistrationDetails = {
  fullName: string
  email: string
  phone?: string
  password: string
}

// ==========================================
// API RESPONSE TYPES
// ==========================================

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

type SessionResponse = {
  customer: Customer

  session: {
    expiresAt: string
  }
}

// ==========================================
// COMMON API REQUEST
// ==========================================

async function authRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers)

  headers.set(
    'Accept',
    'application/json',
  )

  if (options.body) {
    headers.set(
      'Content-Type',
      'application/json',
    )
  }

  let response: Response

  // ========================================
  // SEND AUTHENTICATED REQUEST
  // ========================================

  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,

        headers,

        // Send the HTTP-only session cookie.
        credentials: 'include',

        // Avoid caching authentication state.
        cache: 'no-store',
      },
    )
  } catch {
    throw new Error(
      'Unable to connect to the Loyce Dairies server.',
    )
  }

  // ========================================
  // PARSE RESPONSE
  // ========================================

  let result: ApiResponse<T>

  try {
    result = (
      await response.json()
    ) as ApiResponse<T>
  } catch {
    throw new Error(
      'The authentication server returned an invalid response.',
    )
  }

  // ========================================
  // HANDLE API ERRORS
  // ========================================

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ??
        `Request failed with status ${response.status}`,
    )
  }

  return result
}

// ==========================================
// CUSTOMER REGISTRATION
//
// POST /api/auth/register
// ==========================================

export async function registerCustomer(
  details: RegistrationDetails,
): Promise<Customer> {
  const response =
    await authRequest<Customer>(
      '/auth/register',
      {
        method: 'POST',

        body: JSON.stringify(
          details,
        ),
      },
    )

  if (!response.data) {
    throw new Error(
      'Registration response is incomplete.',
    )
  }

  // Registration does not automatically
  // authenticate the newly created account.

  return response.data
}

// ==========================================
// CUSTOMER LOGIN
//
// POST /api/auth/login
// ==========================================

export async function loginCustomer(
  credentials: LoginCredentials,
): Promise<Customer> {
  const response =
    await authRequest<Customer>(
      '/auth/login',
      {
        method: 'POST',

        body: JSON.stringify(
          credentials,
        ),
      },
    )

  if (!response.data) {
    throw new Error(
      'Login response is incomplete.',
    )
  }

  // The backend now includes:
  //
  // role: 'CUSTOMER' | 'STAFF'
  //
  // AuthContext stores this customer
  // object after successful login.

  return response.data
}

// ==========================================
// CURRENT CUSTOMER SESSION
//
// GET /api/auth/me
// ==========================================

export async function getCurrentCustomer():
  Promise<Customer | null> {
  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}/auth/me`,
      {
        method: 'GET',

        credentials: 'include',
        cache: 'no-store',

        headers: {
          Accept: 'application/json',
        },
      },
    )
  } catch {
    throw new Error(
      'Unable to connect to the Loyce Dairies server.',
    )
  }

  // ========================================
  // HANDLE GUEST SESSION
  // ========================================

  // HTTP 401 indicates that no valid
  // authenticated session exists.

  if (response.status === 401) {
    return null
  }

  // ========================================
  // PARSE SESSION RESPONSE
  // ========================================

  let result: ApiResponse<SessionResponse>

  try {
    result = (
      await response.json()
    ) as ApiResponse<SessionResponse>
  } catch {
    throw new Error(
      'Unable to read the customer session response.',
    )
  }

  if (
    !response.ok ||
    !result.success ||
    !result.data?.customer
  ) {
    throw new Error(
      result.message ??
        'Unable to verify the customer session.',
    )
  }

  // ========================================
  // RETURN AUTHENTICATED CUSTOMER
  // ========================================

  // The backend is the source of truth
  // for customer identity and role.
  //
  // For staff accounts, the response
  // includes role: 'STAFF'.

  return result.data.customer
}

// ==========================================
// CUSTOMER LOGOUT
//
// POST /api/auth/logout
// ==========================================

export async function logoutCustomer():
  Promise<void> {
  await authRequest<void>(
    '/auth/logout',
    {
      method: 'POST',

      headers: {
        'X-Loyce-Request': '1',
      },
    },
  )
}
