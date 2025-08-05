import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { ensureUserExists } from "../utils/db.server";
import { syncUserPlanWithSubscription } from "../models/user.server";

/**
 * Dedicated callback route after Shopify subscription confirmation.
 * - Rehydrates session via authenticate.admin(request)
 * - Reads shop, host, planKey from query
 * - Queries activeSubscriptions to confirm subscription
 * - Syncs local user plan with Shopify subscription
 * - Redirects to /app/pricing?upgraded=true&planKey=... (and propagates host/shop)
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || undefined;
  const host = url.searchParams.get("host") || undefined;
  const planKey = url.searchParams.get("planKey") || undefined;

  try {
    // Ensure we can authenticate admin for this request (rehydrates session)
    const { session, admin } = await authenticate.admin(request);

    // Ensure local user exists
    await ensureUserExists(session.shop);

    // Query Shopify for active subscriptions
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

    // Best-effort sync of local plan with Shopify subscription state
    try {
      await syncUserPlanWithSubscription(session.shop, subscriptions);
    } catch (e) {
      console.error("[SUBSCRIPTION-CALLBACK] Error syncing user plan:", e);
    }

    // Build redirect back to pricing with success indicator
    const redirectUrl = new URL("/app/pricing", process.env.SHOPIFY_APP_URL || "http://localhost:3000");
    redirectUrl.searchParams.set("success", "true");
    redirectUrl.searchParams.set("upgraded", "true");
    if (planKey) redirectUrl.searchParams.set("planKey", planKey);
    redirectUrl.searchParams.set("shop", session.shop);
    if (host) redirectUrl.searchParams.set("host", host);

    return redirect(redirectUrl.toString());
  } catch (error) {
    console.error("[SUBSCRIPTION-CALLBACK] Failed to process callback:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      shop,
      host,
      planKey,
    });

    // On failure, still send the user back to pricing but with an error flag
    const redirectUrl = new URL("/app/pricing", process.env.SHOPIFY_APP_URL || "http://localhost:3000");
    redirectUrl.searchParams.set("success", "false");
    redirectUrl.searchParams.set("error", "subscription_callback_failed");
    if (planKey) redirectUrl.searchParams.set("planKey", planKey);
    if (shop) redirectUrl.searchParams.set("shop", shop);
    if (host) redirectUrl.searchParams.set("host", host);

    return redirect(redirectUrl.toString());
  }
};

export default function SubscriptionCallback() {
  // This route should never render as it immediately redirects in the loader.
  return null;
}
