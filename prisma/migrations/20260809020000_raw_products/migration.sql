-- CreateTable
CREATE TABLE "raw_products" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopifyId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raw_products_storeId_shopifyId_idx" ON "raw_products"("storeId", "shopifyId");

-- AddForeignKey
ALTER TABLE "raw_products" ADD CONSTRAINT "raw_products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
