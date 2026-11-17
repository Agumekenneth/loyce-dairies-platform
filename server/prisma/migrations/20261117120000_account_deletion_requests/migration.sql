-- Track verified account-deletion requests.
-- This migration does not remove customer or order records.
CREATE TYPE "AccountDeletionRequestStatus" AS ENUM ('PENDING', 'COMPLETED');

CREATE TABLE "AccountDeletionRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "AccountDeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountDeletionRequest_customerId_key"
ON "AccountDeletionRequest"("customerId");

CREATE INDEX "AccountDeletionRequest_status_requestedAt_idx"
ON "AccountDeletionRequest"("status", "requestedAt");

ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT
"AccountDeletionRequest_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
