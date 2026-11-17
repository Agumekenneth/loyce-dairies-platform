-- Privacy-minimized operational audit of successful account erasure.
-- No customer foreign key, name, email, phone or address is stored.
-- Audit creation happens in the erasure transaction, not as a migration backfill.
CREATE TABLE "AccountErasureAudit" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anonymizedOrders" INTEGER NOT NULL,
    CONSTRAINT "AccountErasureAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountErasureAudit_requestId_key"
ON "AccountErasureAudit"("requestId");

CREATE INDEX "AccountErasureAudit_completedAt_idx"
ON "AccountErasureAudit"("completedAt");
