-- Provider checkout references are recorded on the existing Order.
-- Nullable columns preserve every historical cash order.
-- No payment credentials or cardholder data are stored here.
ALTER TABLE "Order"
  ADD COLUMN "paymentProvider" TEXT,
  ADD COLUMN "paymentProviderReference" TEXT,
  ADD COLUMN "paymentProviderTrackingId" TEXT,
  ADD COLUMN "paymentProviderCheckoutUrl" TEXT,
  ADD COLUMN "paymentProviderState" TEXT,
  ADD COLUMN "paymentVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Order_paymentProviderReference_key"
  ON "Order"("paymentProviderReference");
CREATE UNIQUE INDEX "Order_paymentProviderTrackingId_key"
  ON "Order"("paymentProviderTrackingId");
