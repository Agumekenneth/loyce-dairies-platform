-- CreateEnum
CREATE TYPE "StaffPushDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StaffPushDeliveryJob" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "StaffPushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lastErrorCode" VARCHAR(120),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPushDeliveryJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffPushDeliveryJob_status_nextAttemptAt_idx" ON "StaffPushDeliveryJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "StaffPushDeliveryJob_status_lockedUntil_idx" ON "StaffPushDeliveryJob"("status", "lockedUntil");

-- CreateIndex
CREATE INDEX "StaffPushDeliveryJob_deviceId_status_idx" ON "StaffPushDeliveryJob"("deviceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPushDeliveryJob_orderId_deviceId_key" ON "StaffPushDeliveryJob"("orderId", "deviceId");

-- AddForeignKey
ALTER TABLE "StaffPushDeliveryJob" ADD CONSTRAINT "StaffPushDeliveryJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPushDeliveryJob" ADD CONSTRAINT "StaffPushDeliveryJob_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "StaffPushDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
