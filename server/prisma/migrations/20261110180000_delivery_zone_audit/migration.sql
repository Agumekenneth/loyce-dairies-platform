-- CreateEnum
CREATE TYPE "DeliveryZoneAuditAction" AS ENUM ('CREATED', 'UPDATED', 'ACTIVATED', 'DEACTIVATED');

-- CreateTable
CREATE TABLE "DeliveryZoneAuditEvent" (
    "id" TEXT NOT NULL,
    "zoneId" INTEGER NOT NULL,
    "changedById" TEXT NOT NULL,
    "action" "DeliveryZoneAuditAction" NOT NULL,
    "previousValues" JSONB,
    "newValues" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryZoneAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryZoneAuditEvent_zoneId_createdAt_idx" ON "DeliveryZoneAuditEvent"("zoneId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryZoneAuditEvent_changedById_createdAt_idx" ON "DeliveryZoneAuditEvent"("changedById", "createdAt");

-- AddForeignKey
ALTER TABLE "DeliveryZoneAuditEvent" ADD CONSTRAINT "DeliveryZoneAuditEvent_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DeliveryZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryZoneAuditEvent" ADD CONSTRAINT "DeliveryZoneAuditEvent_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
