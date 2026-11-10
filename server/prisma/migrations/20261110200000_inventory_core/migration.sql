
-- ==========================================
-- LOYCE DAIRIES PLATFORM
-- MILESTONE 4.7.1
-- INVENTORY DATABASE MIGRATION
-- ==========================================

-- Existing products begin with zero recorded
-- inventory until staff enter verified stock.

-- ==========================================
-- PRODUCT STOCK QUANTITY
-- ==========================================

ALTER TABLE "Product"
ADD COLUMN "stockQuantity"
INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Product"
ADD CONSTRAINT "Product_stockQuantity_nonnegative"
CHECK ("stockQuantity" >= 0);

-- ==========================================
-- INVENTORY ACTION ENUM
-- ==========================================

CREATE TYPE "InventoryAction" AS ENUM (
    'STAFF_SET',
    'ORDER_PLACED'
);

-- ==========================================
-- INVENTORY EVENT TABLE
-- ==========================================

CREATE TABLE "InventoryEvent" (
    "id" TEXT NOT NULL,

    "productId" INTEGER,
    "productName" TEXT NOT NULL,
    "productUnit" TEXT NOT NULL,

    "orderId" TEXT,
    "changedById" TEXT,

    "action" "InventoryAction" NOT NULL,

    "quantityChange" INTEGER NOT NULL,
    "quantityBefore" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,

    "note" TEXT,

    "createdAt" TIMESTAMP(3)
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryEvent_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "InventoryEvent_quantities_nonnegative"
        CHECK (
            "quantityBefore" >= 0
            AND "quantityAfter" >= 0
        )
);

-- ==========================================
-- INVENTORY INDEXES
-- ==========================================

CREATE INDEX "InventoryEvent_productId_createdAt_idx"
ON "InventoryEvent"("productId", "createdAt");

CREATE INDEX "InventoryEvent_orderId_idx"
ON "InventoryEvent"("orderId");

CREATE INDEX "InventoryEvent_changedById_createdAt_idx"
ON "InventoryEvent"("changedById", "createdAt");

-- ==========================================
-- INVENTORY FOREIGN KEYS
-- ==========================================

ALTER TABLE "InventoryEvent"
ADD CONSTRAINT "InventoryEvent_productId_fkey"
FOREIGN KEY ("productId")
REFERENCES "Product"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "InventoryEvent"
ADD CONSTRAINT "InventoryEvent_orderId_fkey"
FOREIGN KEY ("orderId")
REFERENCES "Order"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "InventoryEvent"
ADD CONSTRAINT "InventoryEvent_changedById_fkey"
FOREIGN KEY ("changedById")
REFERENCES "Customer"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
