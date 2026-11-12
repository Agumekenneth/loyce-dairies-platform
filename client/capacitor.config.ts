
import type { CapacitorConfig } from '@capacitor/cli'

/// <reference types="@capacitor/push-notifications" />

// ==========================================
// LOYCE DAIRIES PLATFORM
// MILESTONE 4.15
// ANDROID AND IOS APPLICATION CONFIGURATION
// ==========================================

const config: CapacitorConfig = {
  // Native application identifier.
  // Confirm the final identifier before
  // Firebase registration or store release.
  appId: 'com.loycedairies.app',

  // Display name on Android and iOS.
  appName: 'Loyce Dairies',

  // Vite production build directory.
  webDir: 'dist',

  // ========================================
  // NATIVE PUSH NOTIFICATION PRESENTATION
  // ========================================

  plugins: {
    PushNotifications: {
      // Configure foreground presentation.
      // Background notifications additionally
      // require native permissions, Firebase,
      // APNs setup and server-side delivery.
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
