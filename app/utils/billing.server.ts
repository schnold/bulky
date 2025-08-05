/**
 * Billing utilities for Shopify App using API-based billing
 * 
 * This app uses API-based billing model, which means:
 * - App handles billing through GraphQL mutations
 * - Uses appSubscriptionCreate to create subscriptions
 * - App receives webhooks when subscriptions change
 * - Provides direct control over billing flow
 * 
 * For more info: https://shopify.dev/docs/apps/launch/billing-models#api-based-billing
 */
import { redirect } from "@remix-run/node";
import { authenticate, STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN } from "../shopify.server";
import { getUserByShop } from "../models/user.server";

export async function requireBilling(request: Request, plans: (typeof STARTER_PLAN | typeof PRO_PLAN | typeof ENTERPRISE_PLAN)[] = [STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN]) {
  // Authenticate to ensure we have a valid admin session; session.shop is used for shop scoping
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const host = url.searchParams.get("host");

  const hasSubscription = await hasActiveSubscription(request);
  
  if (!hasSubscription) {
    // Redirect to pricing page, preserving embedded context via host and shop for authentication on pricing page
    const qp = new URLSearchParams();
    if (host) qp.set("host", host);
    if (session?.shop) qp.set("shop", session.shop);
    throw redirect(`/app/pricing${qp.toString() ? `?${qp.toString()}` : ""}`);
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
  // Authenticate and use session.shop for fetching user and preserving pricing redirects
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const host = url.searchParams.get("host");
  
  // Check if user has enough credits
  const user = await getUserByShop(session.shop);
  if (!user) {
    const qp = new URLSearchParams();
    if (host) qp.set("host", host);
    if (session?.shop) qp.set("shop", session.shop);
    throw redirect(`/app/pricing${qp.toString() ? `?${qp.toString()}` : ""}`);
  }

  if (user.credits < requiredCredits) {
    // If no credits, check if they have an active subscription
    const hasSubscription = await hasActiveSubscription(request);
    if (!hasSubscription) {
      const qp = new URLSearchParams();
      if (host) qp.set("host", host);
      if (session?.shop) qp.set("shop", session.shop);
      throw redirect(`/app/pricing${qp.toString() ? `?${qp.toString()}` : ""}`);
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

// Managed pricing app configuration
// This app uses Shopify's managed pricing, so billing is handled by Shopify's interface
export async function createManagedPricingUrl(request: Request, planName: string) {
  // Authenticate and use session.shop to scope pricing; also preserve host for embedded context
  const { session } = await authenticate.admin(request);
  const reqUrl = new URL(request.url);
  const host = reqUrl.searchParams.get("host") || undefined;
  
  // Validate plan name
  const validPlans = [STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN];
  if (!validPlans.includes(planName)) {
    throw new Error("Invalid plan name");
  }

  const shopDomain = session.shop;
  const appHandle = "b1-bulk-product-seo-optimizer"; // Your app handle from shopify.app.toml
  
  // For managed pricing apps, try the simpler URL format:
  // https://admin.shopify.com/store/{shop-name}/charges/{app-handle}/pricing_plans
  const shopName = shopDomain.replace('.myshopify.com', '');
  
  // Try different URL formats based on environment variable or default
  const urlFormat = process.env.SHOPIFY_BILLING_URL_FORMAT || 'charges';
  
  const urlFormats: { [key: string]: string } = {
    charges: `https://admin.shopify.com/store/${shopName}/charges/${appHandle}/pricing_plans`,
    billing: `https://admin.shopify.com/store/${shopName}/billing/${appHandle}/pricing_plans`,
    apps: `https://admin.shopify.com/store/${shopName}/apps/${appHandle}/pricing_plans`
  };
  
  const baseUrl = urlFormats[urlFormat] || urlFormats.charges;
  
  // For managed pricing, we need to break out of the iframe
  // Don't set embedded=1 as it causes X-Frame-Options issues
  const url = new URL(baseUrl);
  // Preserve authentication/embedded context across redirects
  url.searchParams.set("shop", shopDomain);
  if (host) url.searchParams.set("host", host);
  
  // Add plan-specific parameter if needed
  if (planName !== 'starter_plan') {
    url.searchParams.set('plan', planName);
  }
  
  const managedPricingUrl = url.toString();
  
  console.log(`[BILLING] Creating managed pricing URL for ${session.shop}:`, {
    planName,
    managedPricingUrl,
    shopDomain,
    shopName,
    appHandle,
    embedded: false,
    urlFormat,
    availableFormats: Object.keys(urlFormats),
    selectedFormat: baseUrl,
    host
  });

  return {
    confirmationUrl: managedPricingUrl,
    isManaged: true
  };
}

// API-based billing using appSubscriptionCreate mutation
// This provides better control and eliminates shop URL prompts
export async function createAppSubscription(
  request: Request,
  planName: string,
  host?: string,
) {
  const { session, admin } = await authenticate.admin(request);
  
  // Validate plan name
  const validPlans = [STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN];
  if (!validPlans.includes(planName)) {
    throw new Error("Invalid plan name");
  }

  // Plan pricing configuration
  const planConfig: { [key: string]: { amount: number; name: string; planKey: string } } = {
    [STARTER_PLAN]: { amount: 9.99, name: "Starter Plan", planKey: "starter_plan" },
    [PRO_PLAN]: { amount: 29.99, name: "Pro Plan", planKey: "pro_plan" },
    [ENTERPRISE_PLAN]: { amount: 59.99, name: "Enterprise Plan", planKey: "enterprise_plan" }
  };

  const config = planConfig[planName];

  // Create return URL that goes back to pricing page with success parameters
  const returnUrl = `${new URL(request.url).origin}/app/pricing?shop=${session.shop}&upgraded=true&planId=${config.planKey}`;

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
        }
        confirmationUrl
      }
    }
  `;

  const variables = {
    name: config.name,
    returnUrl,
    test: true, // Force test charges for now (was: process.env.NODE_ENV !== "production")
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: {
              amount: config.amount,
              currencyCode: "USD"
            },
            interval: "EVERY_30_DAYS"
          }
        }
      }
    ]
  };

  console.log(`[BILLING] Creating app subscription for ${session.shop}:`, {
    planName,
    config,
    returnUrl,
    isTest: variables.test
  });

  try {
    const response = await admin.graphql(mutation, { variables });
    const data = await response.json() as {
      errors?: any[];
      data?: {
        appSubscriptionCreate?: {
          userErrors: any[];
          appSubscription?: {
            id: string;
            name: string;
            status: string;
          };
          confirmationUrl?: string;
        };
      };
    };

    console.log(`[BILLING] GraphQL response:`, JSON.stringify(data, null, 2));

    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const result = data.data?.appSubscriptionCreate;
    if (!result) {
      throw new Error("No appSubscriptionCreate payload in response");
    }
    if (Array.isArray(result.userErrors) && result.userErrors.length > 0) {
      throw new Error(`Subscription creation errors: ${JSON.stringify(result.userErrors)}`);
    }

    if (!result.confirmationUrl) {
      throw new Error("No confirmation URL received from Shopify");
    }

    // Do not mutate Shopify's confirmation URL; just return it
    const finalConfirmationUrl = result.confirmationUrl;

    console.log(`[BILLING] Subscription created successfully:`, {
      subscriptionId: result.appSubscription?.id,
      confirmationUrl: finalConfirmationUrl,
      shop: session.shop
    });

    return {
      confirmationUrl: finalConfirmationUrl,
      appSubscription: result.appSubscription,
      isManaged: false
    };
  } catch (error) {
    console.error(`[BILLING] Failed to create app subscription:`, {
      error: error instanceof Error ? error.message : String(error),
      planName,
      shop: session.shop,
      variables
    });
    throw error;
  }
}
