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

    // Build redirect back to pricing with success indicator (top-level breakout)
    const appBase = process.env.SHOPIFY_APP_URL || "http://localhost:3000";
    const finalDestination = new URL("/app/pricing", appBase);
    finalDestination.searchParams.set("success", "true");
    finalDestination.searchParams.set("upgraded", "true");
    if (planKey) finalDestination.searchParams.set("planKey", planKey);
    finalDestination.searchParams.set("shop", session.shop);
    if (host) finalDestination.searchParams.set("host", host);

    // Route through top-level redirect to avoid embedding admin/shop pages in iframe
    const topLevel = new URL("/app/top-level-redirect", appBase);
    topLevel.searchParams.set("to", finalDestination.toString());

    return redirect(topLevel.toString());
  } catch (error) {
    console.error("[SUBSCRIPTION-CALLBACK] Failed to process callback:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      shop,
      host,
      planKey,
    });

    // On failure, still send the user back to pricing but with an error flag (top-level breakout)
    const appBase = process.env.SHOPIFY_APP_URL || "http://localhost:3000";
    const finalDestination = new URL("/app/pricing", appBase);
    finalDestination.searchParams.set("success", "false");
    finalDestination.searchParams.set("error", "subscription_callback_failed");
    if (planKey) finalDestination.searchParams.set("planKey", planKey);
    if (shop) finalDestination.searchParams.set("shop", shop);
    if (host) finalDestination.searchParams.set("host", host);

    const topLevel = new URL("/app/top-level-redirect", appBase);
    topLevel.searchParams.set("to", finalDestination.toString());

    return redirect(topLevel.toString());
  }
};

export default function SubscriptionCallback() {
  // This route should never render as it immediately redirects in the loader.
  return null;
}
