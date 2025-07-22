import prisma from "../db.server";

export interface ProductOptimizationStatus {
  shopifyProductId: string;
  isOptimized: boolean;
  optimizedAt?: Date;
}

/**
 * Get optimization status for multiple products efficiently
 * @param productIds Array of Shopify product IDs
 * @param shop Shop domain
 * @returns Map of product ID to optimization status
 */
export async function getOptimizationStatusForProducts(
  productIds: string[],
  shop: string
): Promise<Map<string, ProductOptimizationStatus>> {
  const optimizations = await prisma.productOptimization.findMany({
    where: {
      shopifyProductId: {
        in: productIds,
      },
      shop: shop,
    },
    select: {
      shopifyProductId: true,
      isOptimized: true,
      optimizedAt: true,
    },
  });

  const statusMap = new Map<string, ProductOptimizationStatus>();
  
  // Add existing optimizations to map
  optimizations.forEach((opt) => {
    statusMap.set(opt.shopifyProductId, {
      shopifyProductId: opt.shopifyProductId,
      isOptimized: opt.isOptimized,
      optimizedAt: opt.optimizedAt || undefined,
    });
  });

  // Add non-optimized products to map
  productIds.forEach((id) => {
    if (!statusMap.has(id)) {
      statusMap.set(id, {
        shopifyProductId: id,
        isOptimized: false,
      });
    }
  });

  return statusMap;
}

/**
 * Mark a product as optimized in the database
 * @param productId Shopify product ID
 * @param shop Shop domain
 * @param userId User ID
 * @param optimizedData Optional optimized data to store
 */
export async function markProductAsOptimized(
  productId: string,
  shop: string,
  userId: string,
  optimizedData?: {
    title?: string;
    handle?: string;
    productType?: string;
  }
) {
  return await prisma.productOptimization.upsert({
    where: {
      shopifyProductId_shop: {
        shopifyProductId: productId,
        shop: shop,
      },
    },
    update: {
      isOptimized: true,
      optimizedAt: new Date(),
      optimizedTitle: optimizedData?.title,
      optimizedHandle: optimizedData?.handle,
      optimizedType: optimizedData?.productType,
      updatedAt: new Date(),
    },
    create: {
      shopifyProductId: productId,
      shop: shop,
      userId: userId,
      isOptimized: true,
      optimizedAt: new Date(),
      optimizedTitle: optimizedData?.title,
      optimizedHandle: optimizedData?.handle,
      optimizedType: optimizedData?.productType,
    },
  });
}

/**
 * Get optimization statistics for a shop
 * @param shop Shop domain
 * @returns Object with optimization counts
 */
export async function getOptimizationStats(shop: string) {
  const totalOptimized = await prisma.productOptimization.count({
    where: {
      shop: shop,
      isOptimized: true,
    },
  });

  const optimizedThisMonth = await prisma.productOptimization.count({
    where: {
      shop: shop,
      isOptimized: true,
      optimizedAt: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    },
  });

  return {
    totalOptimized,
    optimizedThisMonth,
  };
}