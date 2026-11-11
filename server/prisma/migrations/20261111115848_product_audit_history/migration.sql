-- CreateEnum
CREATE TYPE "ProductAuditAction" AS ENUM ('CREATED', 'UPDATED', 'ACTIVATED', 'DEACTIVATED');

-- CreateTable
CREATE TABLE "ProductAuditEvent" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "changedById" TEXT NOT NULL,
    "action" "ProductAuditAction" NOT NULL,
    "previousValues" JSONB,
    "newValues" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductAuditEvent_productId_createdAt_idx" ON "ProductAuditEvent"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductAuditEvent_changedById_createdAt_idx" ON "ProductAuditEvent"("changedById", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductAuditEvent" ADD CONSTRAINT "ProductAuditEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAuditEvent" ADD CONSTRAINT "ProductAuditEvent_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
