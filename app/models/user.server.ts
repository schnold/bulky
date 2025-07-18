import prisma from "../db.server";

export async function getUserByShop(shop: string) {
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

export async function createUser(data: {
  shop: string;
  plan?: string;
  credits?: number;
}) {
  return await prisma.user.create({
    data: {
      shop: data.shop,
      plan: data.plan || "free",
      credits: data.credits || 10,
    },
  });
}

export async function updateUserPlan(shop: string, plan: string, credits: number) {
  return await prisma.user.update({
    where: { shop },
    data: { plan, credits },
  });
}

export async function updateUserCredits(shop: string, credits: number) {
  return await prisma.user.update({
    where: { shop },
    data: { credits },
  });
}

export async function createSubscription(data: {
  shopifySubscriptionId: string;
  userId: string;
  planName: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  isTest?: boolean;
}) {
  return await prisma.subscription.create({
    data,
  });
}

export async function updateSubscription(
  shopifySubscriptionId: string,
  data: {
    status?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelledAt?: Date;
  }
) {
  return await prisma.subscription.update({
    where: { shopifySubscriptionId },
    data,
  });
}

export async function getSubscriptionByShopifyId(shopifySubscriptionId: string) {
  return await prisma.subscription.findUnique({
    where: { shopifySubscriptionId },
    include: { user: true },
  });
}

export async function getActiveSubscriptionByShop(shop: string) {
  const user = await getUserByShop(shop);
  if (!user) return null;
  
  return await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      status: "active",
    },
    orderBy: { createdAt: "desc" },
  });
}

// Credit allocation based on plan
export const PLAN_CREDITS = {
  free: 10,
  starter: 100,
  pro: 500,
  enterprise: 999999, // Unlimited represented as large number
};

export function getCreditsForPlan(planName: string): number {
  const planMap: { [key: string]: keyof typeof PLAN_CREDITS } = {
    "Starter Plan": "starter",
    "Pro Plan": "pro",
    "Enterprise Plan": "enterprise",
  };
  
  const plan = planMap[planName] || "free";
  return PLAN_CREDITS[plan];
}