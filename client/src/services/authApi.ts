
import {
  clearMobileSessionToken,
  getMobileSessionToken,
  isBundledNativeMobileApp,
  saveMobileSessionToken,
} from './mobileSessionStorage'

// ==========================================
// LOYCE DAIRIES
// WEB AND NATIVE MOBILE AUTHENTICATION
// ==========================================

export type CustomerRole =
  | 'CUSTOMER'
  | 'STAFF'

export type Customer = {
  id: string
  fullName: string
  email: string
  phone: string | null
  emailVerifiedAt: string | null
  role: CustomerRole
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

type MobileLoginResponse = {
  customer: Customer
  session: {
    accessToken: string
    expiresAt: string
  }
}

// ==========================================
// API ADDRESS
// ==========================================

function getApiBaseUrl(): string {
  const configured = (
    import.meta.env.VITE_API_BASE_URL ??
    'http://localhost:5000/api'
  ).replace(/\/+$/, '')

  // A bundled mobile app must use an
  // explicit HTTPS backend address.
  //
  // The correct URL will be supplied
  // during the native release build.

  if (isBundledNativeMobileApp()) {
    let url: URL

    try {
      url = new URL(configured)
    } catch {
      throw new Error(
        'The mobile API requires an absolute HTTPS URL.',
      )
    }

    if (
      url.protocol !== 'https:' ||
      !url.hostname ||
      url.pathname !== '/api' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        'The mobile API address must be a valid HTTPS /api endpoint.',
      )
    }
  }

  return configured
}

// ==========================================
// COMMON HTTP REQUEST
// ==========================================

async function sendRequest(
  endpoint: string,
  options: RequestInit = {},
  mobileToken?: string,
): Promise<Response> {
  const native =
    isBundledNativeMobileApp()

  const headers =
    new Headers(options.headers)

  headers.set('Accept', 'application/json')

  if (options.body) {
    headers.set(
      'Content-Type',
      'application/json',
    )
  }

  if (mobileToken) {
    headers.set(
      'Authorization',
      `Bearer ${mobileToken}`,
    )
  }

  try {
    return await fetch(
      `${getApiBaseUrl()}${endpoint}`,
      {
        ...options,
        headers,
        credentials: native
          ? 'omit'
          : 'include',
        cache: 'no-store',
      },
    )
  } catch {
    throw new Error(
      'Unable to connect to the Loyce Dairies server.',
    )
  }
}

// ==========================================
// RESPONSE PARSING
// ==========================================

async function readResponse<T>(
  response: Response,
): Promise<ApiResponse<T>> {
  let result: ApiResponse<T>

  try {
    result =
      await response.json() as ApiResponse<T>
  } catch {
    throw new Error(
      'The authentication server returned an invalid response.',
    )
  }

  if (!response.ok || !result.success) {
    throw new Error(
      result.message ??
      `Request failed with status ${response.status}`,
    )
  }

  return result
}

// ==========================================
// ACCOUNT REGISTRATION
// ==========================================

export async function registerCustomer(
  details: RegistrationDetails,
): Promise<Customer> {
  const response = await sendRequest(
    '/auth/register',
    {
      method: 'POST',
      body: JSON.stringify(details),
    },
  )

  const result =
    await readResponse<Customer>(response)

  if (!result.data) {
    throw new Error(
      'Registration response is incomplete.',
    )
  }

  return result.data
}

// ==========================================
// WEBSITE AND MOBILE LOGIN
// ==========================================

export async function loginCustomer(
  credentials: LoginCredentials,
): Promise<Customer> {
  // Preserve the existing website and
  // Railway staging authentication.

  if (!isBundledNativeMobileApp()) {
    const response = await sendRequest(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      },
    )

    const result =
      await readResponse<Customer>(response)

    if (!result.data) {
      throw new Error(
        'Login response is incomplete.',
      )
    }

    return result.data
  }

  // ========================================
  // NATIVE ANDROID / IOS LOGIN
  // ========================================

  const response = await sendRequest(
    '/auth/mobile/login',
    {
      method: 'POST',
      headers: {
        'X-Loyce-Request': '1',
      },
      body: JSON.stringify(credentials),
    },
  )

  const result =
    await readResponse<MobileLoginResponse>(
      response,
    )

  const customer =
    result.data?.customer

  const accessToken =
    result.data?.session?.accessToken

  if (
    !customer ||
    typeof accessToken !== 'string'
  ) {
    throw new Error(
      'Mobile login response is incomplete.',
    )
  }

  // Store credentials only in native
  // secure storage, never localStorage.

  try {
    await saveMobileSessionToken(accessToken)
  } catch {
    // Best-effort revocation if secure
    // storage fails. Do not expose tokens.

    try {
      await sendRequest(
        '/auth/mobile/logout',
        {
          method: 'POST',
          headers: {
            'X-Loyce-Request': '1',
          },
        },
        accessToken,
      )
    } catch {
      // The session will also expire
      // according to server policy.
    }

    throw new Error(
      'Unable to securely save your mobile session.',
    )
  }

  return customer
}

// ==========================================
// CURRENT SESSION
// ==========================================

export async function getCurrentCustomer():
  Promise<Customer | null> {
  const native =
    isBundledNativeMobileApp()

  let mobileToken: string | undefined

  if (native) {
    const storedToken =
      await getMobileSessionToken()

    if (!storedToken) {
      return null
    }

    mobileToken = storedToken
  }

  const response = await sendRequest(
    '/auth/me',
    { method: 'GET' },
    mobileToken,
  )

  if (response.status === 401) {
    if (native) {
      await clearMobileSessionToken()
    }

    return null
  }

  const result =
    await readResponse<SessionResponse>(
      response,
    )

  if (!result.data?.customer) {
    throw new Error(
      'Unable to verify the customer session.',
    )
  }

  return result.data.customer
}

// ==========================================
// WEBSITE AND MOBILE LOGOUT
// ==========================================

export async function logoutCustomer():
  Promise<void> {
  if (!isBundledNativeMobileApp()) {
    const response = await sendRequest(
      '/auth/logout',
      {
        method: 'POST',
        headers: {
          'X-Loyce-Request': '1',
        },
      },
    )

    await readResponse<void>(response)

    return
  }

  const mobileToken =
    await getMobileSessionToken()

  if (!mobileToken) {
    return
  }

  const response = await sendRequest(
    '/auth/mobile/logout',
    {
      method: 'POST',
      headers: {
        'X-Loyce-Request': '1',
      },
    },
    mobileToken,
  )

  await readResponse<void>(response)

  // Delete the local credential after
  // server-side revocation succeeds.

  await clearMobileSessionToken()
}
