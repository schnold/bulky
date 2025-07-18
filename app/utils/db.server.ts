import prisma from "../db.server";

export async function ensureUserExists(shop: string, includeKeywords = false) {
  const user = await prisma.user.findUnique({
    where: { shop },
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
    // Create new user with default free plan
    const newUser = await prisma.user.create({
      data: {
        shop,
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
    
    console.log(`🆕 Created new user for shop: ${shop}`);
    return newUser;
  }

  return user;
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