import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { syncUserPlanWithSubscription } from "../models/user.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  
  const shop = url.searchParams.get("shop") || session.shop;
  const planKey = url.searchParams.get("planKey");
  const host = url.searchParams.get("host");
  
  console.log(`[SUBSCRIPTION-CALLBACK] Processing callback:`, {
    shop,
    planKey,
    host,
    allParams: Object.fromEntries(url.searchParams.entries())
  });

  try {
    // Query current active subscriptions to sync user plan
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
    
    console.log(`[SUBSCRIPTION-CALLBACK] Current subscriptions:`, JSON.stringify(data, null, 2));
    
    const subscriptions = data.data?.currentAppInstallation?.activeSubscriptions || [];
    
    // Sync user plan with subscription
    if (subscriptions.length > 0) {
      await syncUserPlanWithSubscription(shop, subscriptions);
      console.log(`[SUBSCRIPTION-CALLBACK] User plan synced successfully`);
    }
    
    // Redirect back to pricing page with success parameters
    const redirectUrl = new URL("/app/pricing", new URL(request.url).origin);
    redirectUrl.searchParams.set("shop", shop);
    redirectUrl.searchParams.set("upgraded", "true");
    if (planKey) redirectUrl.searchParams.set("planId", planKey);
    if (host) redirectUrl.searchParams.set("host", host);
    
    console.log(`[SUBSCRIPTION-CALLBACK] Redirecting to:`, redirectUrl.toString());
    
    return redirect(redirectUrl.toString());
  } catch (error) {
    console.error(`[SUBSCRIPTION-CALLBACK] Error processing callback:`, error);
    
    // Redirect to pricing page with error
    const redirectUrl = new URL("/app/pricing", new URL(request.url).origin);
    redirectUrl.searchParams.set("shop", shop);
    redirectUrl.searchParams.set("error", "callback_failed");
    if (host) redirectUrl.searchParams.set("host", host);
    
    return redirect(redirectUrl.toString());
  }
};