-- CreateTable
CREATE TABLE "StaffOrderAlert" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffOrderAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffOrderAlertRead" (
    "staffId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffOrderAlertRead_pkey" PRIMARY KEY ("staffId","alertId")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffOrderAlert_orderId_key" ON "StaffOrderAlert"("orderId");

-- CreateIndex
CREATE INDEX "StaffOrderAlert_createdAt_idx" ON "StaffOrderAlert"("createdAt");

-- CreateIndex
CREATE INDEX "StaffOrderAlertRead_alertId_idx" ON "StaffOrderAlertRead"("alertId");

-- AddForeignKey
ALTER TABLE "StaffOrderAlert" ADD CONSTRAINT "StaffOrderAlert_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOrderAlertRead" ADD CONSTRAINT "StaffOrderAlertRead_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOrderAlertRead" ADD CONSTRAINT "StaffOrderAlertRead_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "StaffOrderAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
