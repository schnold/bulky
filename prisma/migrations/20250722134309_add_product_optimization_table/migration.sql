-- CreateTable
CREATE TABLE "ProductOptimization" (
    "id" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isOptimized" BOOLEAN NOT NULL DEFAULT false,
    "optimizedAt" TIMESTAMP(3),
    "optimizedTitle" TEXT,
    "optimizedHandle" TEXT,
    "optimizedType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOptimization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductOptimization_shop_idx" ON "ProductOptimization"("shop");

-- CreateIndex
CREATE INDEX "ProductOptimization_userId_idx" ON "ProductOptimization"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOptimization_shopifyProductId_shop_key" ON "ProductOptimization"("shopifyProductId", "shop");

-- AddForeignKey
ALTER TABLE "ProductOptimization" ADD CONSTRAINT "ProductOptimization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
