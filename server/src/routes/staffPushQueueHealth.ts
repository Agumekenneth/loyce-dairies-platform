import { Router } from 'express'
import type { RequestHandler } from 'express'

import { prisma } from '../lib/prisma.js'
import { getCurrentSession } from '../lib/session.js'

// ==========================================
// LOYCE DAIRIES
// STAFF FIREBASE DELIVERY QUEUE MONITORING
// ==========================================

const router = Router()

// Never cache delivery-monitoring data.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// ==========================================
// VERIFIED STAFF ACCESS
// ==========================================

const requireStaff: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const session = await getCurrentSession(req)

    if (!session) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      })
      return
    }

    const staff = await prisma.customer.findUnique({
      where: {
        id: session.customer.id,
      },
      select: {
        role: true,
        isActive: true,
        emailVerifiedAt: true,
      },
    })

    if (
      !staff ||
      staff.role !== 'STAFF' ||
      !staff.isActive ||
      !staff.emailVerifiedAt
    ) {
      res.status(403).json({
        success: false,
        message: 'Verified staff access required.',
      })
      return
    }

    next()
  } catch (error) {
    next(error)
  }
}

router.use(requireStaff)

// ==========================================
// GET /api/admin/push-queue/health
// ==========================================

router.get('/health', async (_req, res, next) => {
  try {
    const [statuses, failedJobs, activeDevices] =
      await Promise.all([
        prisma.staffPushDeliveryJob.groupBy({
          by: ['status'],
          _count: {
            _all: true,
          },
        }),

        prisma.staffPushDeliveryJob.findMany({
          where: {
            status: 'FAILED',
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: 10,
          select: {
            attempts: true,
            lastErrorCode: true,
            updatedAt: true,

            order: {
              select: {
                orderNumber: true,
                status: true,
              },
            },
          },
        }),

        prisma.staffPushDevice.count({
          where: {
            isActive: true,
            revokedAt: null,
            platform: 'ANDROID',
            staff: {
              role: 'STAFF',
              isActive: true,
              emailVerifiedAt: {
                not: null,
              },
            },
          },
        }),
      ])

    const counts = {
      PENDING: 0,
      PROCESSING: 0,
      SENT: 0,
      FAILED: 0,
      CANCELLED: 0,
    }

    for (const entry of statuses) {
      counts[entry.status] = entry._count._all
    }

    const totalJobs = Object.values(counts)
      .reduce((sum, value) => sum + value, 0)

    res.status(200).json({
      success: true,

      data: {
        evaluatedAt: new Date().toISOString(),

        summary: {
          totalJobs,
          ...counts,
          activeDevices,
        },

        recentFailures: failedJobs.map((job) => ({
          orderNumber: job.order.orderNumber,
          orderStatus: job.order.status,
          attempts: job.attempts,
          lastErrorCode: job.lastErrorCode,
          updatedAt: job.updatedAt.toISOString(),
        })),
      },
    })
  } catch (error) {
    next(error)
  }
})

export default router
