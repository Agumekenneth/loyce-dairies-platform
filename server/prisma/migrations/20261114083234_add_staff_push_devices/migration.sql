-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('ANDROID', 'IOS');

-- CreateTable
CREATE TABLE "StaffPushDevice" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "token" VARCHAR(2048) NOT NULL,
    "platform" "PushPlatform" NOT NULL DEFAULT 'ANDROID',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffPushDevice_token_key" ON "StaffPushDevice"("token");

-- CreateIndex
CREATE INDEX "StaffPushDevice_staffId_isActive_idx" ON "StaffPushDevice"("staffId", "isActive");

-- CreateIndex
CREATE INDEX "StaffPushDevice_lastSeenAt_idx" ON "StaffPushDevice"("lastSeenAt");

-- AddForeignKey
ALTER TABLE "StaffPushDevice" ADD CONSTRAINT "StaffPushDevice_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
