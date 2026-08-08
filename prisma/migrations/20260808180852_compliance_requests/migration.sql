-- CreateTable
CREATE TABLE "compliance_requests" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "handledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compliance_requests_shopDomain_idx" ON "compliance_requests"("shopDomain");

