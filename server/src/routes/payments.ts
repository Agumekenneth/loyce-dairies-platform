
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { getCurrentSession } from '../lib/session.js'
import {
  initiatePesapalPayment,
  onlinePaymentsAvailable,
  onlinePaymentMode,
  verifyPesapalTransaction,
} from '../services/pesapal.js'

const router = Router()

const onlineMethods = new Set([
  'MTN_MOMO',
  'AIRTEL_MONEY',
  'CARD',
])

const requestLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

const ipnLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

// ==========================================
// SAFE PESAPAL ERROR DIAGNOSTICS
// ==========================================

// Do not log raw exceptions from external
// payment services. They may contain URLs,
// headers, credentials or customer data.

function paymentFailureCode(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'UNKNOWN_FAILURE'
  }

  const httpMatch =
    /^Pesapal request failed \(HTTP (\d{3})\)\.$/
      .exec(error.message)

  if (httpMatch) {
    return `PESAPAL_HTTP_${httpMatch[1]}`
  }

  switch (error.message) {
    case 'Pesapal payment mode is not configured.':
      return 'INVALID_PAYMENT_MODE'

    case 'Online payments are not enabled.':
      return 'PAYMENTS_DISABLED'

    case 'Live payment processing has not been approved.':
      return 'LIVE_PAYMENT_BLOCKED'

    case 'Pesapal merchant credentials, IPN ID or callback URL are missing.':
      return 'INCOMPLETE_PAYMENT_CONFIGURATION'

    case 'Payment callback URL must use HTTPS.':
      return 'INVALID_CALLBACK_URL'

    case 'Invalid order total for payment.':
      return 'INVALID_ORDER_AMOUNT'

    case 'Pesapal returned an invalid response.':
      return 'INVALID_PROVIDER_RESPONSE'

    case 'Pesapal reported a payment processing error.':
      return 'PROVIDER_REPORTED_ERROR'

    case 'Pesapal response missing token.':
      return 'MISSING_AUTH_TOKEN'

    case 'Pesapal response missing order_tracking_id.':
      return 'MISSING_TRACKING_ID'

    case 'Pesapal response missing merchant_reference.':
      return 'MISSING_MERCHANT_REFERENCE'

    case 'Pesapal response missing redirect_url.':
      return 'MISSING_CHECKOUT_URL'

    case 'Pesapal returned an unexpected checkout destination.':
      return 'UNEXPECTED_CHECKOUT_DESTINATION'

    case 'Pesapal returned a different merchant reference.':
      return 'MERCHANT_REFERENCE_MISMATCH'

    default:
      break
  }

  if (
    error.name === 'TimeoutError' ||
    error.name === 'AbortError'
  ) {
    return 'REQUEST_TIMEOUT'
  }

  if (error instanceof TypeError) {
    return 'NETWORK_OR_URL_ERROR'
  }

  return 'UNCLASSIFIED_FAILURE'
}

// ==========================================
// PUBLIC PAYMENT CONFIGURATION
// ==========================================

router.get('/config', (_req, res) => {
  res.set('Cache-Control', 'no-store')

  res.json({
    success: true,
    data: {
      onlineAvailable: onlinePaymentsAvailable(),
      mode: onlinePaymentMode(),
    },
  })
})

// ==========================================
// VERIFY PAYMENT THROUGH PESAPAL
// ==========================================

async function reconcile(
  trackingId: string,
  reference: string,
) {
  // Callbacks and IPNs are notifications,
  // not evidence of completed payment.

  const order = await prisma.order.findFirst({
    where: {
      paymentProvider: 'PESAPAL',
      paymentProviderReference: reference,
      paymentProviderTrackingId: trackingId,
    },
    select: {
      id: true,
      totalUgx: true,
      status: true,
      paymentStatus: true,
    },
  })

  if (!order) {
    throw new Error(
      'Unrecognized or not-yet-registered payment reference.',
    )
  }

  const transaction =
    await verifyPesapalTransaction(trackingId)

  if (
    transaction.merchantReference !== reference ||
    transaction.currency !== 'UGX' ||
    !Number.isFinite(transaction.amount) ||
    Math.abs(
      transaction.amount - order.totalUgx,
    ) > 0.001
  ) {
    throw new Error(
      'Payment reference, currency or amount mismatch.',
    )
  }

  const paymentStatus =
    transaction.status === 'COMPLETED'
      ? 'PAID'
      : transaction.status === 'FAILED'
        ? 'FAILED'
        : transaction.status === 'REVERSED'
          ? 'REFUNDED'
          : 'PENDING'

  // Preserve monotonic payment transitions:
  // a late FAILED/PENDING event cannot
  // overwrite a verified PAID payment.

  const eligiblePriorStatuses =
    paymentStatus === 'PAID'
      ? ['PENDING', 'FAILED', 'PAID'] as const
      : paymentStatus === 'REFUNDED'
        ? ['PAID', 'REFUNDED'] as const
        : paymentStatus === 'FAILED'
          ? ['PENDING', 'FAILED'] as const
          : ['PENDING'] as const

  await prisma.order.updateMany({
    where: {
      id: order.id,
      paymentStatus: {
        in: [...eligiblePriorStatuses],
      },
    },
    data: {
      paymentStatus,
      paymentProviderState: transaction.status,
      ...(paymentStatus === 'PAID'
        ? { paymentVerifiedAt: new Date() }
        : {}),
    },
  })

  return order.id
}

// ==========================================
// PESAPAL IPN PROCESSING
// ==========================================

async function processIpn(
  req: {
    query: Record<string, unknown>
    body?: unknown
  },
  res: {
    status: (code: number) => {
      json: (value: unknown) => unknown
    }
    set: (key: string, value: string) => void
  },
) {
  res.set('Cache-Control', 'no-store')

  const values = {
    ...req.query,
    ...(req.body &&
    typeof req.body === 'object' &&
    !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {}),
  }

  const parsed = z.object({
    OrderTrackingId: z.string().uuid(),
    OrderMerchantReference: z.string().min(1).max(50),
    OrderNotificationType: z.literal('IPNCHANGE'),
  }).safeParse(values)

  if (
    !parsed.success ||
    !onlinePaymentsAvailable()
  ) {
    res.status(400).json({ status: 400 })
    return
  }

  try {
    await reconcile(
      parsed.data.OrderTrackingId,
      parsed.data.OrderMerchantReference,
    )

    res.status(200).json({
      orderNotificationType: 'IPNCHANGE',
      orderTrackingId: parsed.data.OrderTrackingId,
      orderMerchantReference:
        parsed.data.OrderMerchantReference,
      status: 200,
    })
  } catch {
    // Do not acknowledge an unverified
    // notification as successful.

    res.status(503).json({ status: 500 })
  }
}

router.get(
  '/pesapal/ipn',
  ipnLimit,
  async (req, res) => {
    await processIpn(req, res)
  },
)

router.post(
  '/pesapal/ipn',
  ipnLimit,
  async (req, res) => {
    await processIpn(req, res)
  },
)

// ==========================================
// PESAPAL CUSTOMER CALLBACK
// ==========================================

router.get(
  '/pesapal/callback',
  async (req, res) => {
    const query = z.object({
      OrderTrackingId: z.string().uuid(),
      OrderMerchantReference: z.string().min(1).max(50),
    }).safeParse(req.query)

    if (
      query.success &&
      onlinePaymentsAvailable()
    ) {
      try {
        await reconcile(
          query.data.OrderTrackingId,
          query.data.OrderMerchantReference,
        )
      } catch {
        // The IPN may reconcile the
        // payment asynchronously.
      }
    }

    const configured = process.env.CLIENT_URL
    let destination = '/'

    if (configured) {
      try {
        const client = new URL(configured)

        if (
          client.protocol === 'https:' ||
          (
            process.env.NODE_ENV !== 'production' &&
            client.hostname === 'localhost'
          )
        ) {
          destination = client.origin + '/account'
        }
      } catch {
        // Fall back to same-origin.
      }
    }

    res.set('Cache-Control', 'no-store')
    res.redirect(303, destination)
  },
)

// ==========================================
// START HOSTED PESAPAL CHECKOUT
// ==========================================

// Order creation is handled by
// POST /api/orders/checkout.
//
// An ambiguous payment initiation failure
// must not automatically create another
// provider session or customer order.

router.post(
  '/orders/:orderId/start',
  requestLimit,
  async (req, res) => {
    res.set('Cache-Control', 'no-store')

    if (req.get('X-Loyce-Request') !== '1') {
      res.status(403).json({
        success: false,
        message: 'Missing request header.',
      })
      return
    }

    const session = await getCurrentSession(req)

    if (
      !session ||
      session.customer.role !== 'CUSTOMER'
    ) {
      res.status(401).json({
        success: false,
        message: 'Customer sign-in required.',
      })
      return
    }

    if (!onlinePaymentsAvailable()) {
      res.status(503).json({
        success: false,
        message: 'Online payments are unavailable.',
      })
      return
    }

    const orderId =
      z.string().cuid().safeParse(req.params.orderId)

    if (!orderId.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid order reference.',
      })
      return
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId.data,
        customerId: session.customer.id,
      },
      select: {
        id: true,
        orderNumber: true,
        paymentProvider: true,
        paymentMethod: true,
        paymentProviderState: true,
        paymentProviderCheckoutUrl: true,
        paymentStatus: true,
        status: true,
        totalUgx: true,
        recipientName: true,
        contactPhone: true,
      },
    })

    if (
      !order ||
      !onlineMethods.has(order.paymentMethod) ||
      order.paymentProvider !== 'PESAPAL' ||
      order.status === 'CANCELLED'
    ) {
      res.status(404).json({
        success: false,
        message: 'Payable order not found.',
      })
      return
    }

    if (order.paymentStatus === 'PAID') {
      res.status(409).json({
        success: false,
        message: 'This order has already been paid.',
      })
      return
    }

    if (order.paymentProviderCheckoutUrl) {
      res.json({
        success: true,
        data: {
          redirectUrl:
            order.paymentProviderCheckoutUrl,
        },
      })
      return
    }

    // Atomically reserve initiation rights.

    const lock = await prisma.order.updateMany({
      where: {
        id: order.id,
        paymentProviderState: 'NEW',
        paymentProviderCheckoutUrl: null,
      },
      data: {
        paymentProviderState: 'INITIATING',
      },
    })

    if (lock.count !== 1) {
      res.status(409).json({
        success: false,
        message:
          'Payment initiation is already in progress or needs staff review. Do not place another order.',
      })
      return
    }

    // This identifies which stage failed
    // without recording sensitive data.

    let stage:
      | 'PESAPAL_REQUEST'
      | 'DATABASE_PERSISTENCE' =
        'PESAPAL_REQUEST'

    try {
      const result = await initiatePesapalPayment({
        orderNumber: order.orderNumber,
        totalUgx: order.totalUgx,
        recipientName: order.recipientName,
        contactPhone: order.contactPhone,
        email: session.customer.email,
      })

      stage = 'DATABASE_PERSISTENCE'

      await prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          paymentProviderTrackingId:
            result.trackingId,
          paymentProviderCheckoutUrl:
            result.redirectUrl,
          paymentProviderState:
            'AWAITING_PAYMENT',
        },
      })

      res.json({
        success: true,
        data: {
          redirectUrl: result.redirectUrl,
        },
      })
    } catch (error: unknown) {
      // Log only allowlisted diagnostic
      // information, never raw exceptions.

      console.error(
        '[Pesapal] Payment initiation failed',
        {
          orderId: order.id,
          stage,
          code: paymentFailureCode(error),
        },
      )

      await prisma.order.updateMany({
        where: {
          id: order.id,
          paymentProviderState: 'INITIATING',
        },
        data: {
          paymentProviderState:
            'INITIATION_REVIEW_REQUIRED',
        },
      })

      res.status(502).json({
        success: false,
        message:
          'The order was saved but payment could not be started. Check order history and contact support; do not place a duplicate order.',
      })
    }
  },
)

// ==========================================
// GET CUSTOMER PAYMENT STATUS
// ==========================================

router.get(
  '/orders/:orderId/status',
  requestLimit,
  async (req, res) => {
    res.set('Cache-Control', 'no-store')

    const session = await getCurrentSession(req)

    if (!session) {
      res.status(401).json({
        success: false,
        message: 'Sign-in required.',
      })
      return
    }

    const id =
      z.string().cuid().safeParse(req.params.orderId)

    if (!id.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid order ID.',
      })
      return
    }

    const order = await prisma.order.findFirst({
      where: {
        id: id.data,
        customerId: session.customer.id,
      },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        paymentProviderState: true,
        paymentProviderTrackingId: true,
        paymentProviderReference: true,
        paymentProviderCheckoutUrl: true,
      },
    })

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found.',
      })
      return
    }

    if (
      order.paymentProviderTrackingId &&
      order.paymentProviderReference &&
      onlinePaymentsAvailable() &&
      order.paymentStatus !== 'REFUNDED'
    ) {
      try {
        await reconcile(
          order.paymentProviderTrackingId,
          order.paymentProviderReference,
        )
      } catch {
        // Display existing stored status.
      }
    }

    const updated =
      await prisma.order.findUniqueOrThrow({
        where: {
          id: order.id,
        },
        select: {
          orderNumber: true,
          paymentStatus: true,
          paymentProviderState: true,
          paymentProviderCheckoutUrl: true,
        },
      })

    res.json({
      success: true,
      data: updated,
    })
  },
)

export default router
