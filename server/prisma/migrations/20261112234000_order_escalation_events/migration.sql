
-- ==========================================
-- LOYCE DAIRIES PLATFORM
-- MILESTONE 4.17
-- PERSISTENT ORDER ESCALATION EVENTS
-- ==========================================

-- ==========================================
-- ESCALATION LEVEL ENUM
-- ==========================================

CREATE TYPE "OrderEscalationLevel" AS ENUM (
    'REMINDER',
    'ESCALATED',
    'CRITICAL'
);

-- ==========================================
-- ORDER ESCALATION EVENT TABLE
-- ==========================================

CREATE TABLE "OrderEscalationEvent" (
    "id" TEXT NOT NULL,

    "orderId" TEXT NOT NULL,

    "level" "OrderEscalationLevel" NOT NULL,

    "createdAt" TIMESTAMP(3)
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEscalationEvent_pkey"
        PRIMARY KEY ("id")
);

-- ==========================================
-- DUPLICATE ESCALATION PREVENTION
-- ==========================================

-- An order can have only one event
-- for each escalation level.
--
-- This prevents multiple workers or
-- repeated scheduled checks from
-- inserting duplicate stage records.

CREATE UNIQUE INDEX
    "OrderEscalationEvent_orderId_level_key"
ON "OrderEscalationEvent"(
    "orderId",
    "level"
);

-- ==========================================
-- ESCALATION HISTORY INDEX
-- ==========================================

CREATE INDEX
    "OrderEscalationEvent_level_createdAt_idx"
ON "OrderEscalationEvent"(
    "level",
    "createdAt"
);

-- ==========================================
-- ORDER RELATIONSHIP
-- ==========================================

ALTER TABLE "OrderEscalationEvent"
ADD CONSTRAINT
    "OrderEscalationEvent_orderId_fkey"
FOREIGN KEY ("orderId")
REFERENCES "Order"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
