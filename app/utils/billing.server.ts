import { redirect } from "@remix-run/node";
import { authenticate, STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN } from "../shopify.server";
import { getUserByShop } from "../models/user.server";

export async function requireBilling(request: Request, plans: (typeof STARTER_PLAN | typeof PRO_PLAN | typeof ENTERPRISE_PLAN)[] = [STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN]) {
  const hasSubscription = await hasActiveSubscription(request);
  
  if (!hasSubscription) {
    // Redirect to pricing page - this will redirect to Shopify's managed pricing
    throw redirect("/app/pricing");
  }
  
  return { hasActivePayment: true };
}

export async function checkBilling(request: Request, plans: (typeof STARTER_PLAN | typeof PRO_PLAN | typeof ENTERPRISE_PLAN)[] = [STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN]) {
  const { admin } = await authenticate.admin(request);
  
  try {
    const query = `
      query {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            currentPeriodEnd
            test
          }
        }
      }
    `;
    
    const response = await admin.graphql(query);
    const data = await response.json();
    
    const subscriptions = data.data?.currentAppInstallation?.activeSubscriptions || [];
    const hasActivePayment = subscriptions.length > 0;
    
    return {
      hasActivePayment,
      appSubscriptions: subscriptions
    };
  } catch (error) {
    console.error('Error checking billing:', error);
    return {
      hasActivePayment: false,
      appSubscriptions: []
    };
  }
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

// Plan pricing configuration
const PLAN_PRICING = {
  [STARTER_PLAN]: {
    name: "Starter Plan",
    amount: 9.99,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
  },
  [PRO_PLAN]: {
    name: "Pro Plan", 
    amount: 29.99,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
  },
  [ENTERPRISE_PLAN]: {
    name: "Enterprise Plan",
    amount: 59.99,
    currencyCode: "USD", 
    interval: "EVERY_30_DAYS",
  },
};

export async function createSubscription(request: Request, planName: string) {
  const { admin, session } = await authenticate.admin(request);
  
  const planConfig = PLAN_PRICING[planName as keyof typeof PLAN_PRICING];
  if (!planConfig) {
    throw new Error("Invalid plan name");
  }

  const returnUrl = `${process.env.SHOPIFY_APP_URL}/app/pricing?success=true`;
  const isTest = process.env.NODE_ENV !== "production";

  const mutation = `
    mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean) {
      appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: $test) {
        userErrors {
          field
          message
        }
        appSubscription {
          id
          name
          status
          currentPeriodEnd
          test
        }
        confirmationUrl
      }
    }
  `;

  const variables = {
    name: planConfig.name,
    returnUrl,
    test: isTest,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: {
              amount: planConfig.amount,
              currencyCode: planConfig.currencyCode,
            },
            interval: planConfig.interval,
          },
        },
      },
    ],
  };

  console.log(`[BILLING] Creating subscription for ${session.shop}:`, {
    planName: planConfig.name,
    amount: planConfig.amount,
    isTest,
    returnUrl,
  });

  try {
    const response = await admin.graphql(mutation, { variables });
    const data = await response.json();

    console.log(`[BILLING] Subscription creation response:`, JSON.stringify(data, null, 2));

    if ((data as any).errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify((data as any).errors)}`);
    }

    const result = data.data?.appSubscriptionCreate;
    if (result?.userErrors?.length > 0) {
      throw new Error(`Subscription creation errors: ${JSON.stringify(result.userErrors)}`);
    }

    if (!result?.confirmationUrl) {
      throw new Error("No confirmation URL returned from Shopify");
    }

    return {
      confirmationUrl: result.confirmationUrl,
      subscriptionId: result.appSubscription?.id,
    };
  } catch (error) {
    console.error(`[BILLING] Subscription creation failed:`, {
      error: error instanceof Error ? error.message : String(error),
      shop: session.shop,
      planName,
    });
    throw error;
  }
}