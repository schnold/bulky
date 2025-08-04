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
  if (!shopifySubscriptionId) {
    console.error(`[DB] getSubscriptionByShopifyId called with undefined/null ID:`, shopifySubscriptionId);
    return null;
  }
  
  console.log(`[DB] Looking for subscription with Shopify ID: ${shopifySubscriptionId}`);
  
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { shopifySubscriptionId },
      include: { user: true },
    });
    
    console.log(`[DB] Subscription lookup result:`, subscription ? 'FOUND' : 'NOT FOUND');
    return subscription;
  } catch (error) {
    console.error(`[DB] Error looking up subscription:`, {
      shopifySubscriptionId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
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
    // Display names from Shopify managed pricing
    "Starter Plan": "starter",
    "Pro Plan": "pro",
    "Enterprise Plan": "enterprise",
    // Plan IDs that might be sent
    "starter_plan": "starter",
    "pro_plan": "pro", 
    "enterprise_plan": "enterprise",
    // Possible variations with different casing
    "starter": "starter",
    "pro": "pro",
    "enterprise": "enterprise",
    // Handle the actual plan names from Partner Dashboard
    "B1 Bulk Product SEO Optimizer - Starter": "starter",
    "B1 Bulk Product SEO Optimizer - Pro": "pro",
    "B1 Bulk Product SEO Optimizer - Enterprise": "enterprise"
  };
  
  // Try exact match first, then case-insensitive
  const plan = planMap[planName] || planMap[planName?.toLowerCase()] || "free";
  return PLAN_CREDITS[plan];
}

// Manual function to update user plan and credits (for testing/fallback)
export async function manuallyUpdateUserPlan(shop: string, planName: string) {
  const planMapping: { [key: string]: string } = {
    "Starter Plan": "starter",
    "Pro Plan": "pro",
    "Enterprise Plan": "enterprise",
    "starter_plan": "starter",
    "pro_plan": "pro",
    "enterprise_plan": "enterprise"
  };
  
  const userPlan = planMapping[planName] || "free";
  const userCredits = getCreditsForPlan(planName);
  
  console.log(`[MANUAL UPDATE] Updating user plan:`, {
    shop,
    planName,
    userPlan,
    userCredits
  });
  
  const result = await updateUserPlan(shop, userPlan, userCredits);
  
  console.log(`[MANUAL UPDATE] Plan updated successfully for ${shop}`);
  return result;
}

// Sync user plan with current Shopify subscription (fallback if webhook is missed)
export async function syncUserPlanWithSubscription(shop: string, currentSubscriptions: any[]) {
  console.log(`[SYNC] Syncing user plan with subscription for shop: ${shop}`);
  console.log(`[SYNC] Current subscriptions:`, JSON.stringify(currentSubscriptions, null, 2));
  
  const user = await getUserByShop(shop);
  if (!user) {
    console.log(`[SYNC] No user found for shop: ${shop}`);
    return null;
  }
  
  // Check if there's an active subscription
  const activeSubscription = currentSubscriptions.find(sub => sub.status === "ACTIVE");
  
  if (activeSubscription) {
    const planName = activeSubscription.name;
    const planMapping: { [key: string]: string } = {
      "Starter Plan": "starter",
      "Pro Plan": "pro",
      "Enterprise Plan": "enterprise",
      "starter_plan": "starter",
      "pro_plan": "pro",
      "enterprise_plan": "enterprise",
      "starter": "starter",
      "pro": "pro",
      "enterprise": "enterprise",
      "B1 Bulk Product SEO Optimizer - Starter": "starter",
      "B1 Bulk Product SEO Optimizer - Pro": "pro",
      "B1 Bulk Product SEO Optimizer - Enterprise": "enterprise"
    };
    
    const expectedPlan = planMapping[planName] || planMapping[planName?.toLowerCase()] || "free";
    const expectedCredits = getCreditsForPlan(planName);
    
    console.log(`[SYNC] Subscription found:`, {
      subscriptionName: planName,
      expectedPlan,
      currentUserPlan: user.plan,
      expectedCredits,
      currentUserCredits: user.credits
    });
    
    // Only update if there's a mismatch
    if (user.plan !== expectedPlan) {
      console.log(`[SYNC] Plan mismatch detected, updating user plan from ${user.plan} to ${expectedPlan}`);
      await updateUserPlan(shop, expectedPlan, expectedCredits);
      return { updated: true, newPlan: expectedPlan, newCredits: expectedCredits };
    } else {
      console.log(`[SYNC] User plan is already in sync`);
      return { updated: false, currentPlan: user.plan, currentCredits: user.credits };
    }
  } else {
    console.log(`[SYNC] No active subscription found, ensuring user is on free plan`);
    
    // No active subscription, should be on free plan
    if (user.plan !== "free") {
      await updateUserPlan(shop, "free", 10);
      return { updated: true, newPlan: "free", newCredits: 10 };
    } else {
      return { updated: false, currentPlan: "free", currentCredits: user.credits };
    }
  }
}