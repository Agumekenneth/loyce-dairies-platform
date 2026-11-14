
import type { CapacitorConfig } from '@capacitor/cli'

/// <reference types="@capacitor/push-notifications" />

// ==========================================
// LOYCE DAIRIES PLATFORM
// ANDROID AND IOS CONFIGURATION
// ==========================================

// Enable local Android API access when
// testing with the emulator or USB phone.
const isAndroidLocalDevelopment =
  process.env.LOYCE_ANDROID_LOCAL_DEV === '1'

// Physical-phone testing uses ADB reverse
// and http://127.0.0.1:5000.
//
// This option must NEVER be enabled
// for production or store releases.
const isUsbPhoneDevelopment =
  process.env.LOYCE_ANDROID_USB_DEV === '1' &&
  process.env.NODE_ENV !== 'production'

const config: CapacitorConfig = {
  // ========================================
  // APPLICATION IDENTITY
  // ========================================

  appId: 'com.loycedairies.app',
  appName: 'Loyce Dairies',

  webDir: 'dist',

  // ========================================
  // LOCAL ANDROID WEBVIEW
  // ========================================

  android: {
    allowMixedContent:
      isAndroidLocalDevelopment ||
      isUsbPhoneDevelopment,
  },

  // ========================================
  // PHYSICAL ANDROID PHONE
  // ========================================

  // Development only:
  //
  // App: http://127.0.0.1
  // API: http://127.0.0.1:5000
  //
  // The matching scheme and hostname
  // allow SameSite=Lax session cookies
  // to be sent on authenticated requests.
  //
  // The backend still enforces CORS,
  // origin validation and authentication.

  ...(isUsbPhoneDevelopment
    ? {
        server: {
          hostname: '127.0.0.1',
          androidScheme: 'http',
          cleartext: true,
        },
      }
    : {}),

  // ========================================
  // PUSH NOTIFICATIONS
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
