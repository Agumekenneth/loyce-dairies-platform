/**
 * LOYCE DAIRIES PLATFORM
 * CENTRALIZED TRUSTED ORIGIN CONFIGURATION
 *
 * Supports:
 * - Production website
 * - Android application
 * - iOS application
 * - Local development
 *
 * Native access is controlled using:
 * LOYCE_NATIVE_MOBILE_ENABLED
 */

const NATIVE_MOBILE_ORIGINS = [
  'https://localhost',
  'capacitor://localhost',
] as const

// ==========================================
// APPLICATION ENVIRONMENT
// ==========================================

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

function isNativeMobileEnabled(): boolean {
  return (
    process.env.LOYCE_NATIVE_MOBILE_ENABLED === '1'
  )
}

// ==========================================
// TRUSTED ORIGIN CONFIGURATION
// ==========================================

export function getTrustedClientOrigins(): Set<string> {
  const production = isProduction()

  const configuredClientUrl =
    process.env.CLIENT_URL

  if (production && !configuredClientUrl) {
    throw new Error(
      'CLIENT_URL must be configured in production.',
    )
  }

  const clientOrigin = new URL(
    configuredClientUrl ??
      'http://localhost:5173',
  ).origin

  const allowedOrigins = new Set<string>([
    clientOrigin,
  ])

  // ========================================
  // LOCAL DEVELOPMENT
  // ========================================

  if (
    !production &&
    process.env.LOYCE_ANDROID_LOCAL_DEV === '1'
  ) {
    allowedOrigins.add(
      'http://localhost:5173',
    )

    allowedOrigins.add(
      'http://127.0.0.1',
    )

    allowedOrigins.add(
      'https://localhost',
    )
  }

  // ========================================
  // NATIVE MOBILE APPLICATIONS
  // ========================================

  if (isNativeMobileEnabled()) {
    for (const origin of NATIVE_MOBILE_ORIGINS) {
      allowedOrigins.add(origin)
    }
  }

  return allowedOrigins
}
