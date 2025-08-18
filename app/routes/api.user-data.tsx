import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    if (!session || !session.shop) {
      throw new Response("Unauthorized", { status: 401 });
    }

    console.log(`🔍 API USER DATA - Session shop: ${session.shop}`);

    // Get user data from database (user is guaranteed to exist from app.tsx loader)
    const { ensureUserExists } = await import("../utils/db.server");
    let user = await ensureUserExists(session.shop, true); // Include keywords

    // Check current subscriptions and sync if needed
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
      
      // Sync user plan with actual subscription status (fallback if webhook was missed)
      const { syncUserPlanWithSubscription } = await import("../models/user.server");
      const syncResult = await syncUserPlanWithSubscription(session.shop, subscriptions);
      if (syncResult?.updated) {
        console.log(`🔄 API USER DATA: User plan synced successfully:`, syncResult);
        // Get fresh user data after sync (don't mutate existing object)
        user = await ensureUserExists(session.shop, true);
      }
    } catch (error) {
      console.error('🔄 API USER DATA: Error syncing user plan:', error);
    }

    console.log(`🔍 API USER DATA - User found:`, {
      id: user.id,
      shop: user.shop,
      plan: user.plan,
      credits: user.credits,
      keywordsCount: user.keywords?.length || 0,
      keywords: user.keywords?.map(k => k.keyword) || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });

    return json({ user });
  } catch (error) {
    console.error("API USER DATA Error:", error);
    return json({ error: "Failed to fetch user data" }, { status: 500 });
  }
};