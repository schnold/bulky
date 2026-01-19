-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimit_shop_idx" ON "RateLimit"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_shop_action_key" ON "RateLimit"("shop", "action");
