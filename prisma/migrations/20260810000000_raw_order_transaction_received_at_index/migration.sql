-- CreateIndex
CREATE INDEX "raw_orders_storeId_receivedAt_idx" ON "raw_orders"("storeId", "receivedAt");

-- CreateIndex
CREATE INDEX "raw_transactions_storeId_receivedAt_idx" ON "raw_transactions"("storeId", "receivedAt");
