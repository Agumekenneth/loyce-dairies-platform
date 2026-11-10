
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5000/api'
).replace(/\/+$/, '')

// ==========================================
// API RESPONSE TYPES
// ==========================================

type SecurityApiResponse = {
  success: boolean
  message?: string
}

type ResetPasswordDetails = {
  token: string
  newPassword: string
  confirmPassword: string
}

// ==========================================
// SHARED SECURITY REQUEST
// ==========================================

async function securityRequest(
  endpoint: string,
  data: Record<string, string>,
): Promise<string> {
  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'omit',
        cache: 'no-store',
        body: JSON.stringify(data),
      },
    )
  } catch {
    throw new Error(
      'Unable to connect to the Loyce Dairies server.',
    )
  }

  let result: SecurityApiResponse

  try {
    result =
      (await response.json()) as SecurityApiResponse
  } catch {
    throw new Error(
      'The server returned an invalid response.',
    )
  }

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message ??
        `Request failed with status ${response.status}.`,
    )
  }

  return result.message ?? 'Request completed successfully.'
}

// ==========================================
// REQUEST EMAIL VERIFICATION
// ==========================================

export async function requestEmailVerification(
  email: string,
): Promise<string> {
  return securityRequest(
    '/auth/email/verification/request',
    {
      email: email.trim().toLowerCase(),
    },
  )
}

// ==========================================
// CONFIRM EMAIL VERIFICATION
// ==========================================

export async function confirmEmailVerification(
  token: string,
): Promise<string> {
  return securityRequest(
    '/auth/email/verification/confirm',
    { token },
  )
}

// ==========================================
// REQUEST PASSWORD RESET
// ==========================================

export async function requestPasswordReset(
  email: string,
): Promise<string> {
  return securityRequest(
    '/auth/password/forgot',
    {
      email: email.trim().toLowerCase(),
    },
  )
}

// ==========================================
// CONFIRM PASSWORD RESET
// ==========================================

export async function resetCustomerPassword({
  token,
  newPassword,
  confirmPassword,
}: ResetPasswordDetails): Promise<string> {
  return securityRequest(
    '/auth/password/reset',
    {
      token,
      newPassword,
      confirmPassword,
    },
  )
}
