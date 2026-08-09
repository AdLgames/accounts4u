-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "incurredOn" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "paidOn" DATE,
    "notes" TEXT,
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bills_storeId_incurredOn_idx" ON "bills"("storeId", "incurredOn");

-- CreateIndex
CREATE INDEX "bills_storeId_paidOn_idx" ON "bills"("storeId", "paidOn");

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- NOTE: store_settings.monthlyAdSpend/recurringExpenses are deliberately
-- NOT dropped here. They're superseded by the Bill model but the app code
-- built against this migration is still being rolled out -- dropping these
-- columns before that code is live would break the currently-deployed
-- Settings page the same way the trialEndsAt migration gap did. Dropped in
-- a follow-up migration once the new code is confirmed working live.
