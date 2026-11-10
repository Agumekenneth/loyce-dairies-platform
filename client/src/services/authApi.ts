
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5000/api'
).replace(/\/+$/, '')

// ==========================================
// CUSTOMER TYPES
// ==========================================

export type Customer = {
  id: string
  fullName: string
  email: string
  phone: string | null
  emailVerifiedAt: string | null
}

export type LoginCredentials = {
  email: string
  password: string
}

export type RegistrationDetails = {
  fullName: string
  email: string
  phone?: string
  password: string
}

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

  headers.set('Accept', 'application/json')

  if (options.body) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        headers,
        credentials: 'include',
        cache: 'no-store',
      },
    )
  } catch {
    throw new Error(
      'Unable to connect to the Loyce Dairies server.',
    )
  }

  const result = (await response.json()) as ApiResponse<T>

  if (!response.ok || !result.success) {
    throw new Error(
      result.message ??
        `Request failed with status ${response.status}`,
    )
  }

  return result
}

// ==========================================
// CUSTOMER REGISTRATION
// ==========================================

export async function registerCustomer(
  details: RegistrationDetails,
): Promise<Customer> {
  const response = await authRequest<Customer>(
    '/auth/register',
    {
      method: 'POST',
      body: JSON.stringify(details),
    },
  )

  if (!response.data) {
    throw new Error('Registration response is incomplete.')
  }

  return response.data
}

// ==========================================
// CUSTOMER LOGIN
// ==========================================

export async function loginCustomer(
  credentials: LoginCredentials,
): Promise<Customer> {
  const response = await authRequest<Customer>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(credentials),
    },
  )

  if (!response.data) {
    throw new Error('Login response is incomplete.')
  }

  return response.data
}

// ==========================================
// CURRENT CUSTOMER SESSION
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

  // No active session is a normal guest state.
  if (response.status === 401) {
    return null
  }

  const result =
    (await response.json()) as ApiResponse<SessionResponse>

  if (!response.ok || !result.success || !result.data) {
    throw new Error(
      result.message ??
        'Unable to verify the customer session.',
    )
  }

  return result.data.customer
}

// ==========================================
// CUSTOMER LOGOUT
// ==========================================

export async function logoutCustomer(): Promise<void> {
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
