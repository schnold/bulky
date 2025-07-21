import type { ActionFunctionArgs } from "@remix-run/node";
import { verifyWebhookOrThrow } from "../utils/webhook-verification.server";

interface ShopRedactPayload {
  shop_id: number;
  shop_domain: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  // Only accept POST requests for webhooks
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // Verify HMAC signature - throws 401 if invalid
    const body = await verifyWebhookOrThrow(request);
    
    // Parse the webhook payload
    const payload: ShopRedactPayload = JSON.parse(body);
    
    console.log(`Received shop/redact webhook for shop: ${payload.shop_domain}`);
    console.log("Shop redact payload:", JSON.stringify(payload, null, 2));
    
    // Handle shop data redaction for GDPR compliance
    // This webhook is called 48 hours after a shop uninstalls your app
    // You must delete all shop data within 30 days
    
    const { shop_id, shop_domain } = payload;
    
    // TODO: Implement your shop data cleanup logic here
    // 1. Remove all shop-related data from your database
    // 2. Remove any cached data or files
    // 3. Update analytics to remove shop data
    // 4. Ensure backups are also cleaned
    
    // Example implementation:
    console.log(`Processing shop data redaction for shop ${shop_domain} (ID: ${shop_id})`);
    
    // Example: Remove shop data from your database
    // await deleteShopData(shop_id);
    // await removeShopFiles(shop_domain);
    // await cleanupShopAnalytics(shop_id);
    
    // Log for compliance tracking
    console.log(`[COMPLIANCE] Shop data redaction processed for shop ${shop_domain} (ID: ${shop_id})`);
    
    return new Response("OK", { status: 200 });
  } catch (error) {
    if (error instanceof Response) {
      // HMAC verification failed - return the 401 response
      return error;
    }
    
    console.error("Shop redact webhook error:", error);
    return new Response("Error processing shop redact webhook", { status: 500 });
  }
};

// Only allow POST requests for webhooks
export async function loader() {
  return new Response("Method Not Allowed", { status: 405 });
}