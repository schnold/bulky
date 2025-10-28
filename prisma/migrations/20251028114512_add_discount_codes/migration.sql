-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "creditsToGrant" INTEGER NOT NULL,
    "maxUses" INTEGER,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCodeRedemption" (
    "id" TEXT NOT NULL,
    "discountCodeId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "creditsGranted" INTEGER NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountCodeRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");

-- CreateIndex
CREATE INDEX "DiscountCode_code_idx" ON "DiscountCode"("code");

-- CreateIndex
CREATE INDEX "DiscountCodeRedemption_shop_idx" ON "DiscountCodeRedemption"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCodeRedemption_discountCodeId_shop_key" ON "DiscountCodeRedemption"("discountCodeId", "shop");

-- AddForeignKey
ALTER TABLE "DiscountCodeRedemption" ADD CONSTRAINT "DiscountCodeRedemption_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
