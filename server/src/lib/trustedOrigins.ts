/**
 * LOYCE DAIRIES PLATFORM
 * Trusted frontend origins
 *
 * Shared configuration for:
 * - Express CORS
 * - Authentication requests
 * - Staff operations
 * - Customer checkout
 * - Android and iOS mobile applications
 */

const PRODUCTION_MOBILE_ORIGINS = new Set([
  'https://localhost',
  'capacitor://localhost',
])

export function getTrustedClientOrigins(): Set<string> {
  const isProduction =
    process.env.NODE_ENV === 'production'

  const configuredClientUrl = process.env.CLIENT_URL

  if (isProduction && !configuredClientUrl) {
    throw new Error(
      'CLIENT_URL must be configured in production.',
    )
  }

  const clientOrigin = new URL(
    configuredClientUrl ?? 'http://localhost:5173',
  ).origin

  const origins = new Set<string>([
    clientOrigin,
  ])

  // Preserve existing local development access.
  if (
    !isProduction &&
    process.env.LOYCE_ANDROID_LOCAL_DEV === '1'
  ) {
    origins.add('http://localhost:5173')
    origins.add('http://127.0.0.1')
    origins.add('https://localhost')
  }

  // Allow explicitly configured production
  // Android and iOS WebView origins.
  if (isProduction) {
    const mobileOrigins = (
      process.env.LOYCE_MOBILE_APP_ORIGINS ?? ''
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)

    for (const origin of mobileOrigins) {
      if (!PRODUCTION_MOBILE_ORIGINS.has(origin)) {
        throw new Error(
          `Unsupported production mobile origin: ${origin}`,
        )
      }

      origins.add(origin)
    }
  }

  return origins
}
