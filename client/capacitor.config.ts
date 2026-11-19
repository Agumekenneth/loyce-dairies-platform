
import type { CapacitorConfig } from '@capacitor/cli'

/// <reference types="@capacitor/push-notifications" />

// ==========================================
// LOYCE DAIRIES
// ANDROID AND IOS CONFIGURATION
// ==========================================

// Explicit opt-in for store-release builds.
const isRelease =
  process.env.LOYCE_MOBILE_RELEASE === '1'

// Development modes are never allowed
// when building an official release.
const canUseDevelopmentMode =
  !isRelease &&
  process.env.NODE_ENV !== 'production'

const localDevelopmentRequested =
  process.env.LOYCE_ANDROID_LOCAL_DEV === '1'

const usbDevelopmentRequested =
  process.env.LOYCE_ANDROID_USB_DEV === '1'

const stagingDevelopmentRequested =
  process.env.LOYCE_ANDROID_STAGING_DEV === '1'

// ==========================================
// RELEASE SAFETY CHECKS
// ==========================================

if (
  isRelease &&
  (
    localDevelopmentRequested ||
    usbDevelopmentRequested ||
    stagingDevelopmentRequested
  )
) {
  throw new Error(
    'Mobile release cannot use Android ' +
    'development or staging settings.',
  )
}

if (
  canUseDevelopmentMode &&
  usbDevelopmentRequested &&
  stagingDevelopmentRequested
) {
  throw new Error(
    'Choose either USB development ' +
    'or Railway staging, not both.',
  )
}

const isLocalDevelopment =
  canUseDevelopmentMode &&
  localDevelopmentRequested

const isUsbDevelopment =
  canUseDevelopmentMode &&
  usbDevelopmentRequested

const isStagingDevelopment =
  canUseDevelopmentMode &&
  stagingDevelopmentRequested

const STAGING_URL =
  'https://loyce-api-production.up.railway.app'

// ==========================================
// CAPACITOR CONFIGURATION
// ==========================================

const config: CapacitorConfig = {
  appId: 'com.loycedairies.app',
  appName: 'Loyce Dairies',

  // Release apps use bundled React assets.
  webDir: 'dist',

  android: {
    allowMixedContent:
      isLocalDevelopment ||
      isUsbDevelopment,
  },

  // ========================================
  // DEVELOPMENT-ONLY WEBVIEW SETTINGS
  // ========================================

  ...(isStagingDevelopment
    ? {
        // Existing working Railway staging.
        // Never included in a release build.
        server: {
          url: STAGING_URL,
          cleartext: false,
        },
      }
    : isUsbDevelopment
      ? {
          // Existing ADB USB testing mode.
          server: {
            hostname: '127.0.0.1',
            androidScheme: 'http',
            cleartext: true,
          },
        }
      : {}),

  // ========================================
  // NATIVE NOTIFICATION SETTINGS
  // ========================================

  plugins: {
    PushNotifications: {
      presentationOptions: [
        'badge',
        'sound',
        'banner',
        'list',
      ],
    },
  },
}

export default config
