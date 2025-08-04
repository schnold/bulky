import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { 
  updateUserPlan, 
  updateUserPlanAndAddCredits,
  createSubscription, 
  updateSubscription, 
  getSubscriptionByShopifyId,
  getCreditsForPlan 
} from "../models/user.server";
import { ensureUserExists } from "../utils/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { topic, shop, session, payload } = await authenticate.webhook(request);
    
    console.log(`[WEBHOOK] Received webhook: ${topic} for shop: ${shop}`);
    console.log(`[WEBHOOK] Session:`, session ? 'Valid' : 'None');
    console.log(`[WEBHOOK] Raw payload:`, JSON.stringify(payload, null, 2));

    if (topic === "APP_SUBSCRIPTIONS_UPDATE") {
      await handleAppSubscriptionUpdate(shop, payload);
      console.log(`[WEBHOOK] Successfully processed APP_SUBSCRIPTIONS_UPDATE for ${shop}`);
    } else {
      console.log(`[WEBHOOK] Unhandled webhook topic: ${topic} (received payload:`, JSON.stringify(payload, null, 2), ')');
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error(`[WEBHOOK] Error processing webhook:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    });
    return new Response("Error processing webhook", { status: 500 });
  }
};

async function handleAppSubscriptionUpdate(shop: string, payload: any) {
  console.log(`[WEBHOOK] Processing app subscription update for shop: ${shop}`);
  console.log(`[WEBHOOK] Full payload structure:`, JSON.stringify(payload, null, 2));
  
  const subscription = payload.app_subscription;
  
  if (!subscription) {
    console.error(`[WEBHOOK] No app_subscription found in payload:`, payload);
    throw new Error("No app_subscription found in webhook payload");
  }
  
  // Handle both 'id' and 'admin_graphql_api_id' fields
  const subscriptionId = subscription.id || subscription.admin_graphql_api_id;
  
  if (!subscriptionId) {
    console.error(`[WEBHOOK] No subscription ID found:`, subscription);
    throw new Error("No subscription ID found in webhook payload");
  }
  
  console.log(`[WEBHOOK] Using subscription ID:`, subscriptionId);
  
  console.log(`[WEBHOOK] Processing subscription:`, {
    id: subscriptionId,
    name: subscription.name,
    status: subscription.status
  });
  
  // Ensure user exists
  const user = await ensureUserExists(shop);

  // Get or create subscription record
  let subscriptionRecord = await getSubscriptionByShopifyId(subscriptionId);
  
  const planName = subscription.name;
  const status = subscription.status.toLowerCase();
  
  // Handle missing date fields gracefully
  const currentPeriodStart = subscription.current_period_start ? new Date(subscription.current_period_start) : new Date();
  const currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
  const trialStart = subscription.trial_start ? new Date(subscription.trial_start) : undefined;
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : undefined;
  const isTest = subscription.test || false;

  if (!subscriptionRecord) {
    // Create new subscription
    const newSubscription = await createSubscription({
      shopifySubscriptionId: subscriptionId,
      userId: user.id,
      planName,
      status,
      currentPeriodStart,
      currentPeriodEnd,
      trialStart,
      trialEnd,
      isTest,
    });
    
    console.log(`[WEBHOOK] Created new subscription record:`, {
      subscriptionId: newSubscription.id,
      shopifySubscriptionId: subscriptionId,
      planName,
      status
    });
  } else {
    // Update existing subscription
    const updateData: any = {
      planName,
      status,
      currentPeriodStart,
      currentPeriodEnd,
    };
    
    if (status === "cancelled") {
      updateData.cancelledAt = new Date();
    }
    
    await updateSubscription(subscriptionId, updateData);
    
    console.log(`[WEBHOOK] Updated existing subscription:`, {
      subscriptionId: subscriptionRecord.id,
      shopifySubscriptionId: subscriptionId,
      planName,
      status,
      updateData
    });
  }

  // Update user plan and credits based on subscription status
  let userPlan = "free";
  let userCredits = 10;

  if (status === "active") {
    // Enhanced plan mapping to handle all possible plan name variations
    const planMap: { [key: string]: string } = {
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
    userPlan = planMap[planName] || planMap[planName?.toLowerCase()] || "free";
    userCredits = getCreditsForPlan(planName);
    
    console.log(`[WEBHOOK] Enhanced plan mapping:`, {
      receivedPlanName: planName,
      planNameLowerCase: planName?.toLowerCase(),
      mappedUserPlan: userPlan,
      credits: userCredits,
      allValidPlans: Object.keys(planMap),
      subscriptionStatus: status
    });
  } else {
    console.log(`[WEBHOOK] Subscription not active, setting to free plan:`, {
      receivedPlanName: planName,
      subscriptionStatus: status,
      userPlan: "free",
      userCredits: 10
    });
  }

  try {
    // Use the new function that adds credits instead of setting them
    const updateResult = await updateUserPlanAndAddCredits(shop, userPlan, userCredits);
    
    console.log(`[WEBHOOK] Successfully updated user ${user.id} to plan ${userPlan}, added ${userCredits} credits`, {
      shop,
      oldPlan: user.plan,
      newPlan: userPlan,
      oldCredits: user.credits,
      creditsAdded: userPlan === "free" ? 0 : userCredits,
      subscriptionStatus: status,
      subscriptionPlanName: planName,
      updateResult
    });
  } catch (error) {
    console.error(`[WEBHOOK] Failed to update user plan:`, {
      error: error instanceof Error ? error.message : String(error),
      shop,
      userId: user.id,
      attemptedPlan: userPlan,
      attemptedCredits: userCredits,
      subscriptionPlanName: planName
    });
    throw error; // Re-throw to ensure webhook processing fails if user update fails
  }
}