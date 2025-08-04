import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { 
  updateUserPlan, 
  createSubscription, 
  updateSubscription, 
  getSubscriptionByShopifyId,
  getCreditsForPlan 
} from "../models/user.server";
import { ensureUserExists } from "../utils/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { topic, shop, session, payload } = await authenticate.webhook(request);
    
    console.log(`Received webhook: ${topic} for shop: ${shop}`);
    console.log("Payload:", JSON.stringify(payload, null, 2));

    if (topic === "APP_SUBSCRIPTIONS_UPDATE") {
      await handleAppSubscriptionUpdate(shop, payload);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
};

async function handleAppSubscriptionUpdate(shop: string, payload: any) {
  const subscription = payload.app_subscription;
  
  // Ensure user exists
  const user = await ensureUserExists(shop);

  // Get or create subscription record
  let subscriptionRecord = await getSubscriptionByShopifyId(subscription.id);
  
  const planName = subscription.name;
  const status = subscription.status.toLowerCase();
  const currentPeriodStart = new Date(subscription.current_period_start);
  const currentPeriodEnd = new Date(subscription.current_period_end);
  const trialStart = subscription.trial_start ? new Date(subscription.trial_start) : undefined;
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : undefined;
  const isTest = subscription.test || false;

  if (!subscriptionRecord) {
    // Create new subscription
    subscriptionRecord = await createSubscription({
      shopifySubscriptionId: subscription.id,
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
      subscriptionId: subscriptionRecord.id,
      shopifySubscriptionId: subscription.id,
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
    
    await updateSubscription(subscription.id, updateData);
    
    console.log(`[WEBHOOK] Updated existing subscription:`, {
      subscriptionId: subscriptionRecord.id,
      shopifySubscriptionId: subscription.id,
      planName,
      status,
      updateData
    });
  }

  // Update user plan and credits based on subscription status
  let userPlan = "free";
  let userCredits = 10;

  if (status === "active") {
    // Map subscription name to user plan
    // Note: These names must match exactly what Shopify sends in the webhook
    const planMap: { [key: string]: string } = {
      "Starter Plan": "starter",
      "Pro Plan": "pro", 
      "Enterprise Plan": "enterprise",
      // Also handle the plan IDs that might be sent
      "starter_plan": "starter",
      "pro_plan": "pro",
      "enterprise_plan": "enterprise"
    };
    
    userPlan = planMap[planName] || "free";
    userCredits = getCreditsForPlan(planName);
    
    console.log(`[WEBHOOK] Plan mapping:`, {
      receivedPlanName: planName,
      mappedUserPlan: userPlan,
      credits: userCredits,
      allValidPlans: Object.keys(planMap)
    });
  }

  try {
    const updateResult = await updateUserPlan(shop, userPlan, userCredits);
    
    console.log(`[WEBHOOK] Successfully updated user ${user.id} to plan ${userPlan} with ${userCredits} credits`, {
      shop,
      oldPlan: user.plan,
      newPlan: userPlan,
      oldCredits: user.credits,
      newCredits: userCredits,
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