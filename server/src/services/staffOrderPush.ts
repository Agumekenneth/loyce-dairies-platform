import {
  applicationDefault,
  getApps,
  initializeApp,
} from 'firebase-admin/app'

import {
  getMessaging,
} from 'firebase-admin/messaging'

import { prisma } from '../lib/prisma.js'

// ==========================================
// LOYCE DAIRIES PLATFORM
// FIREBASE STAFF ORDER PUSH NOTIFICATIONS
// ==========================================

const FIREBASE_APP_NAME = 'loyce-staff-push'

const ANDROID_CHANNEL_ID = 'loyce_orders_v1'

const MAX_BATCH_SIZE = 500

const DEVICE_FRESHNESS_DAYS = 30

// ==========================================
// DELIVERY RESULT
// ==========================================

export type StaffPushResult = {
  attempted: number
  accepted: number
  failed: number
  invalidated: number
}

// ==========================================
// INITIALIZE FIREBASE ADMIN
// ==========================================

function getFirebaseMessaging() {
  const existingApp = getApps().find(
    (app) => app.name === FIREBASE_APP_NAME,
  )

  const app = existingApp ?? initializeApp(
    {
      credential: applicationDefault(),
      projectId: 'loyce-dairies',
    },
    FIREBASE_APP_NAME,
  )

  return getMessaging(app)
}

// ==========================================
// SEND NOTIFICATION FOR A NEW ORDER
// ==========================================

export async function sendStaffNewOrderPush(
  orderId: string,
): Promise<StaffPushResult> {

  const result: StaffPushResult = {
    attempted: 0,
    accepted: 0,
    failed: 0,
    invalidated: 0,
  }

  // Confirm that the order exists.
  // Never accept order details from
  // an unauthenticated notification caller.

  const order = await prisma.order.findUnique({
    where: { id: orderId },

    select: {
      id: true,
      orderNumber: true,
      status: true,
    },
  })

  if (!order || order.status !== 'PENDING') {
    return result
  }

  // Avoid sending to old, inactive,
  // revoked, or unauthorized staff devices.

  const freshSince = new Date(
    Date.now() -
      DEVICE_FRESHNESS_DAYS *
      24 * 60 * 60 * 1000,
  )

  const devices =
    await prisma.staffPushDevice.findMany({
      where: {
        isActive: true,
        revokedAt: null,
        platform: 'ANDROID',

        lastSeenAt: {
          gte: freshSince,
        },

        staff: {
          role: 'STAFF',
          isActive: true,

          emailVerifiedAt: {
            not: null,
          },
        },
      },

      select: {
        id: true,
        token: true,
      },
    })

  if (devices.length === 0) {
    return result
  }

  const messaging = getFirebaseMessaging()

  // No customer phone number, address,
  // payment information, or private
  // order details are placed in FCM.

  const title = 'New Loyce Dairies order'

  const body =
    `Order ${order.orderNumber} is awaiting review.`

  const route =
    `/staff/orders?orderId=${encodeURIComponent(order.id)}`

  // Firebase supports up to 500
  // registration targets per multicast call.

  for (
    let offset = 0;
    offset < devices.length;
    offset += MAX_BATCH_SIZE
  ) {
    const batch = devices.slice(
      offset,
      offset + MAX_BATCH_SIZE,
    )

    const tokens = batch.map(
      (device) => device.token,
    )

    result.attempted += batch.length

    try {
      const response =
        await messaging.sendEachForMulticast({
          tokens,

          notification: {
            title,
            body,
          },

          data: {
            type: 'NEW_ORDER',
            orderId: order.id,
            route,
          },

          android: {
            priority: 'high',

            notification: {
              channelId: ANDROID_CHANNEL_ID,
            },
          },
        })

      result.accepted += response.successCount
      result.failed += response.failureCount

      const invalidIds: string[] = []

      response.responses.forEach(
        (item, index) => {
          if (item.success) {
            return
          }

          const code = item.error?.code

          if (
            code ===
              'messaging/registration-token-not-registered' ||
            code ===
              'messaging/invalid-registration-token'
          ) {
            const device = batch[index]

            if (device) {
              invalidIds.push(device.id)
            }
          }
        },
      )

      // Deactivate tokens known to be
      // invalid. Transient FCM failures
      // do not cause device revocation.

      if (invalidIds.length > 0) {
        const updated =
          await prisma.staffPushDevice.updateMany({
            where: {
              id: {
                in: invalidIds,
              },
              isActive: true,
            },

            data: {
              isActive: false,
              revokedAt: new Date(),
            },
          })

        result.invalidated += updated.count
      }

    } catch {
      // Never log device tokens or
      // Firebase credential contents.

      result.failed += batch.length

      console.error(
        'Loyce Dairies FCM batch delivery failed.',
      )
    }
  }

  return result
}
