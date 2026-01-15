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

export async function updateUserPlanAndAddCredits(shop: string, newPlan: string, creditsToAdd: number) {
  const user = await getUserByShop(shop);
  if (!user) {
    throw new Error(`User not found for shop: ${shop}`);
  }

  // If switching to free plan, don't add any credits, just change the plan
  if (newPlan === "free") {
    return await prisma.user.update({
      where: { shop },
      data: { plan: newPlan },
    });
  }

  // For paid plans, add credits to existing balance
  const newCreditsBalance = user.credits + creditsToAdd;
  
  console.log(`[CREDITS] Adding credits for ${shop}:`, {
    oldPlan: user.plan,
    newPlan,
    oldCredits: user.credits,
    creditsToAdd,
    newCreditsBalance
  });

  return await prisma.user.update({
    where: { shop },
    data: { 
      plan: newPlan, 
      credits: newCreditsBalance 
    },
  });
}

export async function updateUserCredits(shop: string, credits: number) {
  return await prisma.user.update({
    where: { shop },
    data: { credits },
  });
}

export async function addUserCredits(shop: string, creditsToAdd: number) {
  if (creditsToAdd <= 0) {
    console.log(`[CREDITS] Skipping credit addition for ${shop}: creditsToAdd is ${creditsToAdd}`);
    return await getUserByShop(shop);
  }
  
  const user = await prisma.user.update({
    where: { shop },
    data: {
      credits: { increment: creditsToAdd },
    },
  });
  
  console.log(`[CREDITS] Added ${creditsToAdd} credits to ${shop}. New balance: ${user.credits}`);
  return user;
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
  
  const result = await updateUserPlanAndAddCredits(shop, userPlan, userCredits);
  
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
      const result = await updateUserPlanAndAddCredits(shop, expectedPlan, expectedCredits);
      const updatedUser = await getUserByShop(shop);
      return { updated: true, newPlan: expectedPlan, newCredits: updatedUser?.credits || 0 };
    } else {
      console.log(`[SYNC] User plan is already in sync`);
      return { updated: false, currentPlan: user.plan, currentCredits: user.credits };
    }
  } else {
    console.log(`[SYNC] No active subscription found`);

    // Preserve manually granted enterprise plans (indicated by enterprise plan with enterprise-level credits)
    // Enterprise plans may be manually granted and should not be downgraded
    if (user.plan === "enterprise" && user.credits >= PLAN_CREDITS.enterprise) {
      console.log(`[SYNC] Preserving manually granted enterprise plan for ${shop}`);
      return { updated: false, currentPlan: user.plan, currentCredits: user.credits };
    }

    // No active subscription, should be on free plan (but preserve enterprise)
    if (user.plan !== "free") {
      const result = await updateUserPlanAndAddCredits(shop, "free", 0); // Free plan gets 0 credits added
      const updatedUser = await getUserByShop(shop);
      return { updated: true, newPlan: "free", newCredits: updatedUser?.credits || 0 };
    } else {
      return { updated: false, currentPlan: "free", currentCredits: user.credits };
    }
  }
}

// ==================== DISCOUNT CODE MANAGEMENT ====================

/**
 * Create a new discount code
 * Admin-only function for creating discount codes
 */
export async function createDiscountCode(data: {
  code: string;
  creditsToGrant: number;
  maxUses?: number;
  expiresAt?: Date;
  description?: string;
}) {
  // Normalize code to uppercase for consistency
  const normalizedCode = data.code.toUpperCase().trim();

  return await prisma.discountCode.create({
    data: {
      code: normalizedCode,
      creditsToGrant: data.creditsToGrant,
      maxUses: data.maxUses,
      expiresAt: data.expiresAt,
      description: data.description,
    },
  });
}

/**
 * Validate a discount code
 * Returns error message if invalid, null if valid
 */
export async function validateDiscountCode(code: string, shop: string): Promise<{
  valid: boolean;
  error?: string;
  discountCode?: any;
}> {
  const normalizedCode = code.toUpperCase().trim();

  // Find the discount code
  const discountCode = await prisma.discountCode.findUnique({
    where: { code: normalizedCode },
    include: {
      redemptions: {
        where: { shop },
      },
    },
  });

  // Code doesn't exist
  if (!discountCode) {
    return { valid: false, error: "Invalid discount code" };
  }

  // Code is deactivated
  if (!discountCode.isActive) {
    return { valid: false, error: "This discount code is no longer active" };
  }

  // Code has expired
  if (discountCode.expiresAt && new Date() > discountCode.expiresAt) {
    return { valid: false, error: "This discount code has expired" };
  }

  // Code has reached max uses
  if (discountCode.maxUses && discountCode.currentUses >= discountCode.maxUses) {
    return { valid: false, error: "This discount code has reached its usage limit" };
  }

  // User has already used this code
  if (discountCode.redemptions.length > 0) {
    return { valid: false, error: "You have already used this discount code" };
  }

  // Code is valid
  return { valid: true, discountCode };
}

/**
 * Redeem a discount code and add credits to user account
 * This function handles the entire redemption process with security checks
 */
export async function redeemDiscountCode(code: string, shop: string): Promise<{
  success: boolean;
  error?: string;
  creditsGranted?: number;
  newBalance?: number;
}> {
  const normalizedCode = code.toUpperCase().trim();

  console.log(`[DISCOUNT] Attempting to redeem code "${normalizedCode}" for shop: ${shop}`);

  // Validate the code
  const validation = await validateDiscountCode(normalizedCode, shop);
  if (!validation.valid || !validation.discountCode) {
    console.log(`[DISCOUNT] Validation failed: ${validation.error}`);
    return { success: false, error: validation.error };
  }

  const discountCode = validation.discountCode;

  try {
    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Get the user
      const user = await tx.user.findUnique({
        where: { shop },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Create redemption record (this will fail if already redeemed due to unique constraint)
      await tx.discountCodeRedemption.create({
        data: {
          discountCodeId: discountCode.id,
          shop,
          creditsGranted: discountCode.creditsToGrant,
        },
      });

      // Update discount code usage count
      await tx.discountCode.update({
        where: { id: discountCode.id },
        data: {
          currentUses: { increment: 1 },
        },
      });

      // Add credits to user account
      const updatedUser = await tx.user.update({
        where: { shop },
        data: {
          credits: { increment: discountCode.creditsToGrant },
        },
      });

      return {
        creditsGranted: discountCode.creditsToGrant,
        newBalance: updatedUser.credits,
      };
    });

    console.log(`[DISCOUNT] Successfully redeemed code "${normalizedCode}":`, result);

    return {
      success: true,
      creditsGranted: result.creditsGranted,
      newBalance: result.newBalance,
    };
  } catch (error) {
    console.error(`[DISCOUNT] Error redeeming code:`, error);

    // Check if it's a unique constraint violation
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { success: false, error: "You have already used this discount code" };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to redeem discount code"
    };
  }
}

/**
 * Get discount code info (without sensitive details)
 */
export async function getDiscountCodeInfo(code: string) {
  const normalizedCode = code.toUpperCase().trim();

  const discountCode = await prisma.discountCode.findUnique({
    where: { code: normalizedCode },
    select: {
      id: true,
      code: true,
      creditsToGrant: true,
      isActive: true,
      expiresAt: true,
      description: true,
      currentUses: true,
      maxUses: true,
    },
  });

  return discountCode;
}

/**
 * Check if a shop has already redeemed a specific code
 */
export async function hasRedeemedCode(code: string, shop: string): Promise<boolean> {
  const normalizedCode = code.toUpperCase().trim();

  const discountCode = await prisma.discountCode.findUnique({
    where: { code: normalizedCode },
  });

  if (!discountCode) {
    return false;
  }

  const redemption = await prisma.discountCodeRedemption.findUnique({
    where: {
      discountCodeId_shop: {
        discountCodeId: discountCode.id,
        shop,
      },
    },
  });

  return !!redemption;
}

/**
 * Deactivate a discount code (admin function)
 */
export async function deactivateDiscountCode(code: string) {
  const normalizedCode = code.toUpperCase().trim();

  return await prisma.discountCode.update({
    where: { code: normalizedCode },
    data: { isActive: false },
  });
}