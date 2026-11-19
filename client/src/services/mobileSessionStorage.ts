
import { Capacitor } from '@capacitor/core'

import {
  SecureStorage,
} from '@aparajita/capacitor-secure-storage'

// ==========================================
// LOYCE DAIRIES
// NATIVE MOBILE SESSION STORAGE
//
// Android: Keystore-backed encryption
// iOS: Keychain
// Web: Existing cookie authentication
// ==========================================

const SESSION_KEY =
  'loyce.mobile.session.token.v1'

const SESSION_TOKEN_PATTERN =
  /^[A-Za-z0-9_-]{43}$/

// ==========================================
// IDENTIFY BUNDLED MOBILE APPLICATIONS
// ==========================================

export function isBundledNativeMobileApp():
  boolean {
  if (
    typeof window === 'undefined' ||
    !Capacitor.isNativePlatform()
  ) {
    return false
  }

  const platform = Capacitor.getPlatform()

  if (platform === 'android') {
    return (
      window.location.origin ===
      'https://localhost'
    )
  }

  if (platform === 'ios') {
    return (
      window.location.origin ===
      'capacitor://localhost'
    )
  }

  return false
}

// ==========================================
// REQUIRE NATIVE SECURE STORAGE
// ==========================================

async function requireSecureStorage():
  Promise<void> {
  if (!isBundledNativeMobileApp()) {
    throw new Error(
      'Native session storage is unavailable ' +
      'in this application environment.',
    )
  }

  // Keep iOS tokens in the device-local
  // Keychain, not synchronized to iCloud.
  // No-op on Android.

  await SecureStorage.setSynchronize(false)
}

// ==========================================
// SAVE AUTHENTICATED MOBILE SESSION
// ==========================================

export async function saveMobileSessionToken(
  token: string,
): Promise<void> {
  await requireSecureStorage()

  if (!SESSION_TOKEN_PATTERN.test(token)) {
    throw new Error(
      'Invalid mobile session token.',
    )
  }

  await SecureStorage.setItem(
    SESSION_KEY,
    token,
  )
}

// ==========================================
// RETRIEVE EXISTING MOBILE SESSION
// ==========================================

export async function getMobileSessionToken():
  Promise<string | null> {
  if (!isBundledNativeMobileApp()) {
    return null
  }

  await requireSecureStorage()

  const token =
    await SecureStorage.getItem(SESSION_KEY)

  if (token === null) {
    return null
  }

  if (!SESSION_TOKEN_PATTERN.test(token)) {
    await SecureStorage.removeItem(
      SESSION_KEY,
    )

    return null
  }

  return token
}

// ==========================================
// CLEAR MOBILE SESSION AFTER LOGOUT
// ==========================================

export async function clearMobileSessionToken():
  Promise<void> {
  if (!isBundledNativeMobileApp()) {
    return
  }

  await requireSecureStorage()

  await SecureStorage.removeItem(
    SESSION_KEY,
  )
}
