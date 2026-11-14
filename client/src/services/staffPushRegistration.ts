
import { Capacitor } from '@capacitor/core'

import type {
  PluginListenerHandle,
} from '@capacitor/core'

import {
  PushNotifications,
} from '@capacitor/push-notifications'

// ==========================================
// LOYCE DAIRIES PLATFORM
// STAFF FIREBASE PUSH REGISTRATION
//
// Features:
// - Android notification permissions
// - Custom new-order notification channel
// - Firebase FCM token registration
// - Secure Express API registration
// - PostgreSQL device activation
// - Error handling and listener cleanup
// ==========================================

const REGISTRATION_TIMEOUT_MS = 45_000

// Must match the Android channel ID
// configured in the backend FCM sender.

export const STAFF_ORDER_CHANNEL_ID =
  'loyce_orders_v1'

const ORDER_NOTIFICATION_SOUND =
  'loyce_dairies_new_order_chime.wav'

// ==========================================
// API CONFIGURATION
// ==========================================

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5000/api'
).replace(/\/+$/, '')

// ==========================================
// CUSTOM ERROR
// ==========================================

export class StaffPushRegistrationError
  extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StaffPushRegistrationError'
  }
}

// ==========================================
// VERIFY NATIVE ANDROID PLATFORM
// ==========================================

function requireNativeAndroid(): void {
  if (
    !Capacitor.isNativePlatform() ||
    Capacitor.getPlatform() !== 'android'
  ) {
    throw new StaffPushRegistrationError(
      'Staff push registration requires the native Android application.',
    )
  }
}

// ==========================================
// REQUEST NOTIFICATION PERMISSION
// ==========================================

async function ensureNotificationPermission():
  Promise<void> {

  let permission =
    await PushNotifications.checkPermissions()

  if (permission.receive !== 'granted') {
    permission =
      await PushNotifications.requestPermissions()
  }

  if (permission.receive !== 'granted') {
    throw new StaffPushRegistrationError(
      'Notification permission was not granted. Enable notifications for Loyce Dairies in Android Settings.',
    )
  }
}

// ==========================================
// CONFIGURE ANDROID NOTIFICATION CHANNEL
// ==========================================

async function configureOrderNotificationChannel():
  Promise<void> {

  try {
    await PushNotifications.createChannel({
      id: STAFF_ORDER_CHANNEL_ID,

      name: 'New customer orders',

      description:
        'Audible Loyce Dairies alerts when customers place new orders.',

      // HIGH importance:
      // Requests prominent notification alerts.
      importance: 5,

      // Android reads this file from:
      // android/app/src/main/res/raw/
      sound: ORDER_NOTIFICATION_SOUND,

      vibration: true,
      lights: true,

      // Show notification details on
      // the lock screen where allowed.
      visibility: 0,
    })
  } catch {
    throw new StaffPushRegistrationError(
      'Unable to configure the Android new-order notification channel.',
    )
  }
}

// ==========================================
// GET FIREBASE CLOUD MESSAGING TOKEN
// ==========================================

async function getAndroidFcmToken():
  Promise<string> {

  let successListener:
    PluginListenerHandle | undefined

  let errorListener:
    PluginListenerHandle | undefined

  let timeoutId:
    ReturnType<typeof setTimeout> | undefined

  let resolveToken!: (token: string) => void
  let rejectToken!: (error: Error) => void

  const tokenPromise = new Promise<string>(
    (resolve, reject) => {
      resolveToken = resolve
      rejectToken = reject
    },
  )

  try {
    // Listeners must be registered before
    // requesting a Firebase token.

    successListener =
      await PushNotifications.addListener(
        'registration',
        (token) => {
          if (
            typeof token.value !== 'string' ||
            token.value.length < 20
          ) {
            rejectToken(
              new StaffPushRegistrationError(
                'Firebase returned an invalid registration token.',
              ),
            )

            return
          }

          resolveToken(token.value)
        },
      )

    errorListener =
      await PushNotifications.addListener(
        'registrationError',
        () => {
          rejectToken(
            new StaffPushRegistrationError(
              'Firebase could not register this Android device.',
            ),
          )
        },
      )

    // Prevent an indefinite loading state
    // when Firebase cannot return a token.

    const timeoutPromise =
      new Promise<string>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new StaffPushRegistrationError(
              'Firebase registration timed out. Check your internet connection and Google Play services.',
            ),
          )
        }, REGISTRATION_TIMEOUT_MS)
      })

    // Request the device registration
    // token from Firebase.

    void PushNotifications.register().catch(
      (error: unknown) => {
        rejectToken(
          error instanceof Error
            ? new StaffPushRegistrationError(
                error.message,
              )
            : new StaffPushRegistrationError(
                'Firebase registration could not start.',
              ),
        )
      },
    )

    const token = await Promise.race([
      tokenPromise,
      timeoutPromise,
    ])

    return token

  } finally {
    // Always remove temporary listeners
    // and the registration timeout.

    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }

    await Promise.allSettled([
      successListener?.remove(),
      errorListener?.remove(),
    ])
  }
}

// ==========================================
// SAVE DEVICE TOKEN IN POSTGRESQL
// THROUGH AUTHENTICATED EXPRESS API
// ==========================================

async function saveStaffPushToken(
  token: string,
): Promise<void> {

  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}/admin/push-devices`,
      {
        method: 'POST',

        credentials: 'include',
        cache: 'no-store',

        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Loyce-Request': '1',
        },

        body: JSON.stringify({
          token,
          platform: 'ANDROID',
        }),
      },
    )
  } catch {
    throw new StaffPushRegistrationError(
      'Firebase registration succeeded, but the Loyce Dairies backend could not be reached.',
    )
  }

  // Read the response safely without
  // exposing or logging the FCM token.

  const payload: unknown =
    await response.json().catch(() => null)

  const data =
    payload !== null &&
    typeof payload === 'object'
      ? payload
      : null

  const serverMessage =
    data &&
    'message' in data &&
    typeof data.message === 'string'
      ? data.message
      : null

  if (!response.ok) {
    throw new StaffPushRegistrationError(
      serverMessage ??
        `Device registration failed with status ${response.status}.`,
    )
  }

  if (
    !data ||
    !('success' in data) ||
    data.success !== true
  ) {
    throw new StaffPushRegistrationError(
      'The Loyce Dairies server did not confirm device registration.',
    )
  }
}

// ==========================================
// MAIN STAFF DEVICE REGISTRATION
// ==========================================

export async function registerStaffPushDevice():
  Promise<void> {

  // 1. Verify application platform.

  requireNativeAndroid()

  // 2. Ensure Android allows notifications.

  await ensureNotificationPermission()

  // 3. Configure the native Android
  // notification channel and custom sound.

  await configureOrderNotificationChannel()

  // 4. Obtain Firebase registration token.

  const token = await getAndroidFcmToken()

  // 5. Register this device with the
  // authenticated staff backend.
  //
  // PostgreSQL determines device ownership
  // using the current staff session.

  await saveStaffPushToken(token)

  // Successful completion means:
  // - Android permission granted
  // - Notification channel configured
  // - Firebase token obtained
  // - Backend registration confirmed
  //
  // Actual push delivery will be tested
  // after checkout integration.
}
