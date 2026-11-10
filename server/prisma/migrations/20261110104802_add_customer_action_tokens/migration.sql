-- CreateEnum
CREATE TYPE "CustomerTokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "CustomerActionToken" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "purpose" "CustomerTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerActionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerActionToken_tokenHash_key" ON "CustomerActionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerActionToken_expiresAt_idx" ON "CustomerActionToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerActionToken_customerId_purpose_key" ON "CustomerActionToken"("customerId", "purpose");

-- AddForeignKey
ALTER TABLE "CustomerActionToken" ADD CONSTRAINT "CustomerActionToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
