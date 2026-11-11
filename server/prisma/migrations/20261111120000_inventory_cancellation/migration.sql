-- ==========================================
-- LOYCE DAIRIES PLATFORM
-- MILESTONE 4.7.2
-- INVENTORY CANCELLATION MIGRATION
-- ==========================================

-- Add the inventory restoration action.
--
-- Existing inventory events and stock
-- quantities remain unchanged.

ALTER TYPE "InventoryAction"
ADD VALUE IF NOT EXISTS 'ORDER_CANCELLED';
