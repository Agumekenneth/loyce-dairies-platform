
/**
 * LOYCE DAIRIES PLATFORM
 * MILESTONE 4.13
 * STAFF ORDER NOTIFICATIONS API
 *
 * Provides:
 * - Notification history
 * - Unread notification counts
 * - Individual staff read receipts
 *
 * Uses the existing authenticated
 * Loyce Dairies session.
 */

import type {
  FulfillmentMethod,
  OrderStatus,
} from './adminOrdersApi'

// ==========================================
// API CONFIGURATION
// ==========================================

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5000/api'
).replace(/\/+$/, '')

// ==========================================
// NOTIFICATION DOMAIN TYPES
// ==========================================

export type StaffNotificationOrder = {
  id: string
  orderNumber: string
  status: OrderStatus
  fulfillmentMethod: FulfillmentMethod
  recipientName: string
  totalUgx: number
  createdAt: string
}

export type StaffNotification = {
  id: string
  type: 'NEW_ORDER'
  title: string
  message: string
  orderId: string
  order: StaffNotificationOrder
  createdAt: string
  readAt: string | null
  isRead: boolean
}

export type StaffNotificationPage = {
  notifications: StaffNotification[]
  unreadCount: number
  nextCursor: string | null
  hasMore: boolean
}

export type NotificationReadResult = {
  alertId: string
  readAt: string | null
  isRead: boolean
  unreadCount: number
}

export type NotificationListOptions = {
  cursor?: string
  limit?: number
  unreadOnly?: boolean
  signal?: AbortSignal
}

// ==========================================
// API RESPONSE TYPES
// ==========================================

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

type NotificationListResponse =
  ApiResponse<StaffNotification[]> & {
    count: number
    unreadCount: number
    nextCursor: string | null
    hasMore: boolean
  }

type UnreadCountResponse = {
  success: boolean
  message?: string
  unreadCount: number
}

type MarkReadResponse =
  ApiResponse<{
    alertId: string
    readAt: string | null
    isRead: boolean
  }> & {
    unreadCount: number
  }

// ==========================================
// NOTIFICATION API ERROR
// ==========================================

export class NotificationApiError extends Error {
  readonly status: number

  constructor(
    status: number,
    message: string,
  ) {
    super(message)

    this.name = 'NotificationApiError'
    this.status = status
  }
}

// ==========================================
// RESPONSE VALIDATION
// ==========================================

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function requireData<T>(
  response: ApiResponse<T>,
): T {
  if (
    response.data === undefined ||
    response.data === null
  ) {
    throw new NotificationApiError(
      500,
      'The notification response is incomplete.',
    )
  }

  return response.data
}

function requireCount(
  value: number,
): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new NotificationApiError(
      500,
      'The notification count is invalid.',
    )
  }

  return value
}

// ==========================================
// AUTHENTICATED NOTIFICATION REQUEST
// ==========================================

async function notificationRequest<
  T extends { success: boolean; message?: string }
>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (
    options.method ?? 'GET'
  ).toUpperCase()

  const headers = new Headers(
    options.headers,
  )

  headers.set(
    'Accept',
    'application/json',
  )

  // Required by the backend for all
  // staff notification write requests.

  if (
    method !== 'GET' &&
    method !== 'HEAD'
  ) {
    headers.set(
      'X-Loyce-Request',
      '1',
    )
  }

  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        method,
        headers,
        credentials: 'include',
        cache: 'no-store',
      },
    )
  } catch (error: unknown) {
    if (
      options.signal?.aborted ||
      (
        error instanceof Error &&
        error.name === 'AbortError'
      )
    ) {
      throw error
    }

    throw new NotificationApiError(
      0,
      'Unable to connect to the Loyce Dairies server.',
    )
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    throw new NotificationApiError(
      response.status,
      'The server returned an invalid notification response.',
    )
  }

  if (
    !isRecord(payload) ||
    typeof payload.success !== 'boolean'
  ) {
    throw new NotificationApiError(
      response.status,
      'The notification response format is invalid.',
    )
  }

  if (
    !response.ok ||
    payload.success !== true
  ) {
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : 'The notification request failed.'

    throw new NotificationApiError(
      response.status,
      message,
    )
  }

  return payload as T
}

// ==========================================
// GET STAFF NOTIFICATIONS
//
// GET /api/admin/notifications
// ==========================================

export async function getStaffNotifications(
  options: NotificationListOptions = {},
): Promise<StaffNotificationPage> {
  const params = new URLSearchParams()

  params.set(
    'limit',
    String(options.limit ?? 25),
  )

  if (options.cursor) {
    params.set(
      'cursor',
      options.cursor,
    )
  }

  if (options.unreadOnly !== undefined) {
    params.set(
      'unreadOnly',
      String(options.unreadOnly),
    )
  }

  const response =
    await notificationRequest<NotificationListResponse>(
      `/admin/notifications?${params.toString()}`,
      {
        signal: options.signal,
      },
    )

  const notifications =
    requireData(response)

  if (!Array.isArray(notifications)) {
    throw new NotificationApiError(
      500,
      'The notification list is invalid.',
    )
  }

  return {
    notifications,
    unreadCount: requireCount(
      response.unreadCount,
    ),
    nextCursor:
      response.nextCursor ?? null,
    hasMore:
      response.hasMore === true,
  }
}

// ==========================================
// GET STAFF UNREAD COUNT
//
// GET /api/admin/notifications/unread-count
// ==========================================

export async function getStaffUnreadCount(
  signal?: AbortSignal,
): Promise<number> {
  const response =
    await notificationRequest<UnreadCountResponse>(
      '/admin/notifications/unread-count',
      {
        signal,
      },
    )

  return requireCount(
    response.unreadCount,
  )
}

// ==========================================
// MARK NOTIFICATION AS READ
//
// PATCH /api/admin/notifications/:alertId/read
// ==========================================

export async function markStaffNotificationRead(
  alertId: string,
  signal?: AbortSignal,
): Promise<NotificationReadResult> {
  if (
    !alertId ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(alertId)
  ) {
    throw new NotificationApiError(
      400,
      'A valid notification ID is required.',
    )
  }

  const response =
    await notificationRequest<MarkReadResponse>(
      `/admin/notifications/${encodeURIComponent(alertId)}/read`,
      {
        method: 'PATCH',
        signal,
      },
    )

  const result =
    requireData(response)

  return {
    alertId: result.alertId,
    readAt: result.readAt,
    isRead: result.isRead,
    unreadCount: requireCount(
      response.unreadCount,
    ),
  }
}
