import { redirect } from "@remix-run/node";
import { authenticate, STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN } from "../shopify.server";
import { getUserByShop } from "../models/user.server";

export async function requireBilling(request: Request, plans: (typeof STARTER_PLAN | typeof PRO_PLAN | typeof ENTERPRISE_PLAN)[] = [STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN]) {
  const { session, billing } = await authenticate.admin(request);
  
  const billingCheck = await billing.require({
    plans,
    isTest: process.env.NODE_ENV !== "production",
    onFailure: async () => {
      // Redirect to pricing page for plan selection when no subscription
      throw redirect("/app/pricing");
    },
  });

  return billingCheck;
}

export async function checkBilling(request: Request, plans: (typeof STARTER_PLAN | typeof PRO_PLAN | typeof ENTERPRISE_PLAN)[] = [STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN]) {
  const { session, billing } = await authenticate.admin(request);
  const billingCheck = await billing.check({
    plans,
    isTest: process.env.NODE_ENV !== "production",
  });

  return billingCheck;
}

export async function hasActiveSubscription(request: Request): Promise<boolean> {
  try {
    const billingCheck = await checkBilling(request);
    return billingCheck.hasActivePayment;
  } catch (error) {
    return false;
  }
}

export async function getCurrentSubscription(request: Request) {
  try {
    const billingCheck = await checkBilling(request);
    return billingCheck.appSubscriptions.length > 0 ? billingCheck.appSubscriptions[0] : null;
  } catch (error) {
    return null;
  }
}

export async function checkCreditsAndBilling(request: Request, requiredCredits: number = 1) {
  const { session } = await authenticate.admin(request);
  
  // Check if user has enough credits
  const user = await getUserByShop(session.shop);
  if (!user) {
    throw redirect("/app/pricing");
  }

  if (user.credits < requiredCredits) {
    // If no credits, check if they have an active subscription
    const hasSubscription = await hasActiveSubscription(request);
    if (!hasSubscription) {
      throw redirect("/app/pricing");
    }
    
    // If they have a subscription but no credits, they might be on a usage-based plan
    // For now, we'll allow it but in a real app you'd implement usage billing
  }

  return { user, hasSubscription: await hasActiveSubscription(request) };
}

export async function requestBilling(request: Request, plan: typeof STARTER_PLAN | typeof PRO_PLAN | typeof ENTERPRISE_PLAN, returnUrl?: string) {
  const { session, billing } = await authenticate.admin(request);
  
  // billing.request throws a redirect response, it doesn't return
  await billing.request({
    plan,
    isTest: process.env.NODE_ENV !== "production",
    returnUrl: returnUrl || `${process.env.SHOPIFY_APP_URL}/app?billing=success`,
  });
}

export function getPlanLimits(planName: string) {
  const limits: { [key: string]: { 
    bulkOptimization: number; 
    apiAccess: boolean; 
    competitorAnalysis: boolean; 
    voiceSearch: boolean;
    prioritySupport: boolean;
  } } = {
    "Starter Plan": {
      bulkOptimization: 10,
      apiAccess: false,
      competitorAnalysis: false,
      voiceSearch: false,
      prioritySupport: false,
    },
    "Pro Plan": {
      bulkOptimization: 100,
      apiAccess: false,
      competitorAnalysis: true,
      voiceSearch: true,
      prioritySupport: true,
    },
    "Enterprise Plan": {
      bulkOptimization: 999999,
      apiAccess: true,
      competitorAnalysis: true,
      voiceSearch: true,
      prioritySupport: true,
    },
  };

  return limits[planName] || limits["Starter Plan"];
}