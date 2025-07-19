import prisma from "../db.server";

export async function ensureUserExists(shop: string, includeKeywords = false) {
  // Normalize shop name (trim whitespace, ensure lowercase)
  const normalizedShop = shop.trim().toLowerCase();
  console.log(`🔍 Looking for user with shop: ${normalizedShop} (original: ${shop})`);
  
  try {
    const user = await prisma.user.findUnique({
      where: { shop: normalizedShop },
      include: {
        subscriptions: {
          where: { status: "active" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        keywords: includeKeywords,
      },
    });

    if (!user) {
      console.log(`👤 User not found for shop: ${normalizedShop}, creating new user...`);
      
      // Create new user with default free plan
      const newUser = await prisma.user.create({
        data: {
          shop: normalizedShop,
          plan: "free",
          credits: 10,
          onboardingCompleted: false,
        },
        include: {
          subscriptions: {
            where: { status: "active" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          keywords: includeKeywords,
        },
      });
      
      console.log(`🆕 Created new user for shop: ${normalizedShop} with ID: ${newUser.id}`);
      return newUser;
    }

    console.log(`✅ Found existing user for shop: ${normalizedShop} with ID: ${user.id}, keywords: ${user.keywords?.length || 0}`);
    return user;
  } catch (error) {
    console.error(`❌ Error in ensureUserExists for shop ${normalizedShop}:`, error);
    throw error;
  }
}

export async function resetUserCredits(shop: string, credits: number) {
  return await prisma.user.update({
    where: { shop },
    data: { credits },
  });
}

export async function getUserWithSubscription(shop: string) {
  return await prisma.user.findUnique({
    where: { shop },
    include: {
      subscriptions: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}