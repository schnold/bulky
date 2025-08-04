/**
 * Billing utilities for Shopify Managed Pricing App
 * 
 * This app uses Shopify's Managed Pricing model, which means:
 * - Shopify handles all billing and payment processing
 * - Users subscribe through Shopify's hosted pricing page
 * - App receives webhooks when subscriptions change
 * - App CANNOT use appSubscriptionCreate or other billing mutations
 * 
 * For more info: https://shopify.dev/docs/apps/launch/billing-models#managed-pricing
 */
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

// Managed pricing app configuration
// This app uses Shopify's managed pricing, so billing is handled by Shopify's interface
export async function createManagedPricingUrl(request: Request, planName: string) {
  const { session } = await authenticate.admin(request);
  
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
  
  // Add minimal embedded app parameters
  const url = new URL(baseUrl);
  url.searchParams.set('embedded', '1');
  url.searchParams.set('shop', shopDomain);
  
  const managedPricingUrl = url.toString();
  
  console.log(`[BILLING] Creating managed pricing URL for ${session.shop}:`, {
    planName,
    managedPricingUrl,
    shopDomain,
    shopName,
    appHandle,
    embedded: true,
    urlFormat,
    availableFormats: Object.keys(urlFormats),
    selectedFormat: baseUrl
  });

  return {
    confirmationUrl: managedPricingUrl,
    isManaged: true
  };
}