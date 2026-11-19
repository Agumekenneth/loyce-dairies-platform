// Hosted Pesapal API 3.0 integration.
// No card data or mobile-money PIN ever passes through Loyce servers.
const ROOTS = {
  sandbox: 'https://cybqa.pesapal.com/pesapalv3',
  live: 'https://pay.pesapal.com/v3',
} as const

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Pesapal returned an invalid response.')
  }
  return value as JsonRecord
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Pesapal response missing ${field}.`)
  }
  return value.trim()
}

function providerConfig() {
  const mode = process.env.LOYCE_PESAPAL_MODE
  if (mode !== 'sandbox' && mode !== 'live') {
    throw new Error('Pesapal payment mode is not configured.')
  }
  if (process.env.LOYCE_PESAPAL_ENABLED !== '1') {
    throw new Error('Online payments are not enabled.')
  }
  // Live payments require a separate explicit release gate.
  if (mode === 'live' && process.env.LOYCE_PESAPAL_LIVE_APPROVED !== '1') {
    throw new Error('Live payment processing has not been approved.')
  }
  const key = process.env.LOYCE_PESAPAL_CONSUMER_KEY
  const secret = process.env.LOYCE_PESAPAL_CONSUMER_SECRET
  const notificationId = process.env.LOYCE_PESAPAL_IPN_ID
  const publicUrl = process.env.LOYCE_PAYMENT_PUBLIC_URL
  if (!key || !secret || !notificationId ||
      !/^[a-f0-9-]{36}$/i.test(notificationId) || !publicUrl) {
    throw new Error('Pesapal merchant credentials, IPN ID or callback URL are missing.')
  }
  const url = new URL(publicUrl)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Payment callback URL must use HTTPS.')
  }
  return { mode, key, secret, notificationId, origin: url.origin, root: ROOTS[mode] }
}

export function onlinePaymentsAvailable(): boolean {
  try { providerConfig(); return true } catch { return false }
}

export function onlinePaymentMode(): 'sandbox' | 'live' | 'disabled' {
  if (!onlinePaymentsAvailable()) return 'disabled'
  return process.env.LOYCE_PESAPAL_MODE === 'live' ? 'live' : 'sandbox'
}

async function callPesapal(
  path: string,
  body?: JsonRecord,
  token?: string,
): Promise<JsonRecord> {
  const config = providerConfig()
  const response = await fetch(config.root + '/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) {
    throw new Error(`Pesapal request failed (HTTP ${response.status}).`)
  }
  const result = asRecord(await response.json())
  // Some successful status responses contain an error object whose
  // code/message fields are all null. That is not a provider failure.
  if (result.error != null) {
    const detail = result.error
    if (typeof detail !== 'object' ||
        (detail !== null && (
          (detail as JsonRecord).code != null ||
          (detail as JsonRecord).message != null ||
          (detail as JsonRecord).error_type != null
        ))) {
      throw new Error('Pesapal reported a payment processing error.')
    }
  }
  return result
}

async function accessToken(): Promise<string> {
  const { key, secret } = providerConfig()
  const auth = await callPesapal('Auth/RequestToken', {
    consumer_key: key,
    consumer_secret: secret,
  })
  return requireString(auth.token, 'token')
}

export async function initiatePesapalPayment(order: {
  orderNumber: string
  totalUgx: number
  recipientName: string
  contactPhone: string
  email: string
}): Promise<{ trackingId: string; redirectUrl: string; merchantReference: string }> {
  const config = providerConfig()
  if (!Number.isSafeInteger(order.totalUgx) || order.totalUgx <= 0) {
    throw new Error('Invalid order total for payment.')
  }
  const names = order.recipientName.trim().split(/\s+/)
  const result = await callPesapal('Transactions/SubmitOrderRequest', {
    id: order.orderNumber,
    currency: 'UGX',
    amount: order.totalUgx,
    description: 'Loyce Dairies ' + order.orderNumber,
    callback_url: config.origin + '/api/payments/pesapal/callback',
    cancellation_url: config.origin + '/api/payments/pesapal/callback',
    notification_id: config.notificationId,
    redirect_mode: 'TOP_WINDOW',
    billing_address: {
      email_address: order.email,
      phone_number: order.contactPhone,
      country_code: 'UG',
      first_name: names[0] ?? '',
      last_name: names.slice(1).join(' '),
    },
  }, await accessToken())

  const trackingId = requireString(result.order_tracking_id, 'order_tracking_id')
  const merchantReference = requireString(result.merchant_reference, 'merchant_reference')
  const redirectUrl = requireString(result.redirect_url, 'redirect_url')
  const destination = new URL(redirectUrl)
  const expected = new URL(config.root)
  if (destination.protocol !== 'https:' ||
      destination.hostname !== expected.hostname ||
      destination.username || destination.password) {
    throw new Error('Pesapal returned an unexpected checkout destination.')
  }
  if (merchantReference !== order.orderNumber) {
    throw new Error('Pesapal returned a different merchant reference.')
  }
  return { trackingId, redirectUrl, merchantReference }
}

export type PesapalTransaction = {
  merchantReference: string
  status: 'COMPLETED' | 'FAILED' | 'REVERSED' | 'PENDING' | 'INVALID'
  amount: number
  currency: string
}

export async function verifyPesapalTransaction(trackingId: string): Promise<PesapalTransaction> {
  const result = await callPesapal(
    'Transactions/GetTransactionStatus?orderTrackingId=' +
    encodeURIComponent(trackingId),
    undefined,
    await accessToken(),
  )
  const code = Number(result.status_code)
  const status = code === 1 ? 'COMPLETED'
    : code === 2 ? 'FAILED'
    : code === 3 ? 'REVERSED'
    : code === 0 ? 'INVALID'
    : 'PENDING'
  return {
    merchantReference: requireString(result.merchant_reference, 'merchant_reference'),
    status,
    amount: Number(result.amount),
    currency: requireString(result.currency, 'currency').toUpperCase(),
  }
}
