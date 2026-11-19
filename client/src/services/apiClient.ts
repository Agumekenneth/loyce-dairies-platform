
import {
  getMobileSessionToken,
  isBundledNativeMobileApp,
} from './mobileSessionStorage'

// ==========================================
// LOYCE DAIRIES PLATFORM
// SHARED API REQUEST CLIENT
//
// Browser: HTTP-only session cookies
// Android/iOS: Secure bearer sessions
// ==========================================

// ==========================================
// RESOLVE API BASE URL
// ==========================================

function getApiBaseUrl(): string {
  const configured = (
    import.meta.env.VITE_API_BASE_URL ??
    'http://localhost:5000/api'
  ).replace(/\/+$/, '')

  if (isBundledNativeMobileApp()) {
    let url: URL

    try {
      url = new URL(configured)
    } catch {
      throw new Error(
        'Native mobile API URL must be absolute.',
      )
    }

    if (
      url.protocol !== 'https:' ||
      url.pathname !== '/api' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        'Native mobile API requires a valid HTTPS /api URL.',
      )
    }
  }

  return configured
}

// ==========================================
// VALIDATE REQUEST DESTINATION
// ==========================================

// Allow only routes inside our configured
// API base. Never forward authorization
// tokens to arbitrary external addresses.

function resolveApiUrl(
  endpoint: string,
): string {
  if (
    !endpoint.startsWith('/') ||
    endpoint.startsWith('//') ||
    endpoint.includes('\\') ||
    endpoint.includes('#')
  ) {
    throw new Error(
      'Invalid Loyce Dairies API endpoint.',
    )
  }

  const base = new URL(
    getApiBaseUrl(),
    window.location.origin,
  )

  const target = new URL(
    `${base.toString()}${endpoint}`,
  )

  if (
    target.origin !== base.origin ||
    !target.pathname.startsWith(
      `${base.pathname}/`,
    )
  ) {
    throw new Error(
      'API request destination is not permitted.',
    )
  }

  return target.toString()
}

// ==========================================
// SHARED AUTHENTICATED REQUEST
// ==========================================

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const native =
    isBundledNativeMobileApp()

  // Validate the destination before
  // retrieving any mobile credentials.

  const url = resolveApiUrl(endpoint)

  const headers = new Headers(
    options.headers,
  )

  if (!headers.has('Accept')) {
    headers.set(
      'Accept',
      'application/json',
    )
  }

  // Prevent callers from accidentally
  // supplying arbitrary bearer tokens.
  // Mobile authentication is managed
  // exclusively by secure storage.

  headers.delete('Authorization')

  // ========================================
  // MUTATING REQUEST PROTECTION
  // ========================================

  const method = (
    options.method ?? 'GET'
  ).toUpperCase()

  if (
    method !== 'GET' &&
    method !== 'HEAD' &&
    !headers.has('X-Loyce-Request')
  ) {
    headers.set(
      'X-Loyce-Request',
      '1',
    )
  }

  // ========================================
  // NATIVE MOBILE AUTHENTICATION
  // ========================================

  if (native) {
    const token =
      await getMobileSessionToken()

    if (token) {
      headers.set(
        'Authorization',
        `Bearer ${token}`,
      )
    }
  }

  // ========================================
  // SEND REQUEST
  // ========================================

  return fetch(url, {
    ...options,

    headers,

    // Website: send session cookies.
    // Mobile: use bearer authentication
    // instead of cross-site cookies.

    credentials: native
      ? 'omit'
      : 'include',

    cache: 'no-store',

    // Avoid following redirects while
    // transmitting native credentials.
    ...(native
      ? {
          redirect: 'error' as const,
          referrerPolicy: 'no-referrer' as const,
        }
      : {}),
  })
}
