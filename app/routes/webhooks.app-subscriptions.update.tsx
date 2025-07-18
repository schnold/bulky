import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { 
  getUserByShop, 
  createUser, 
  updateUserPlan, 
  createSubscription, 
  updateSubscription, 
  getSubscriptionByShopifyId,
  getCreditsForPlan 
} from "../models/user.server";

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
  let user = await getUserByShop(shop);
  if (!user) {
    user = await createUser({ shop });
  }

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
  } else {
    // Update existing subscription
    const updateData: any = {
      status,
      currentPeriodStart,
      currentPeriodEnd,
    };
    
    if (status === "cancelled") {
      updateData.cancelledAt = new Date();
    }
    
    await updateSubscription(subscription.id, updateData);
  }

  // Update user plan and credits based on subscription status
  let userPlan = "free";
  let userCredits = 10;

  if (status === "active") {
    // Map subscription name to user plan
    const planMap: { [key: string]: string } = {
      "Starter Plan": "starter",
      "Pro Plan": "pro",
      "Enterprise Plan": "enterprise",
    };
    
    userPlan = planMap[planName] || "free";
    userCredits = getCreditsForPlan(planName);
  }

  await updateUserPlan(shop, userPlan, userCredits);
  
  console.log(`Updated user ${user.id} to plan ${userPlan} with ${userCredits} credits`);
}