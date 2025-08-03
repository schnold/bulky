import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getUserByShop } from "../models/user.server";

export async function hasActiveSubscription(request: Request): Promise<boolean> {
  try {
    const { admin } = await authenticate.admin(request);
    
    const response = await admin.graphql(
      `#graphql
      query GetAppSubscriptions {
        currentAppInstallation {
          activeSubscriptions {
            id
            status
          }
        }
      }`
    );

    const responseJson = await response.json();
    const activeSubscriptions = responseJson.data?.currentAppInstallation?.activeSubscriptions || [];
    
    return activeSubscriptions.length > 0;
  } catch (error) {
    console.error("Error checking subscription:", error);
    return false;
  }
}

export async function getCurrentSubscription(request: Request) {
  try {
    const { admin } = await authenticate.admin(request);
    
    const response = await admin.graphql(
      `#graphql
      query GetAppSubscriptions {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            createdAt
            test
            lineItems {
              plan {
                pricingDetails {
                  ... on AppRecurringPricing {
                    price {
                      amount
                      currencyCode
                    }
                    interval
                  }
                }
              }
            }
          }
        }
      }`
    );

    const responseJson = await response.json();
    const activeSubscriptions = responseJson.data?.currentAppInstallation?.activeSubscriptions || [];
    
    return activeSubscriptions.length > 0 ? activeSubscriptions[0] : null;
  } catch (error) {
    console.error("Error getting current subscription:", error);
    return null;
  }
}

export async function requireBilling(request: Request) {
  const hasSubscription = await hasActiveSubscription(request);
  
  if (!hasSubscription) {
    throw redirect("/app/pricing");
  }
  
  return await getCurrentSubscription(request);
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