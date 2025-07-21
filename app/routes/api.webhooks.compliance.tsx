import type { ActionFunctionArgs } from "@remix-run/node";
import { verifyWebhookOrThrow } from "../utils/webhook-verification.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Verify webhook HMAC - will throw 401 Response if invalid
    const body = await verifyWebhookOrThrow(request);
    
    // Parse the webhook payload
    const payload = JSON.parse(body);
    const topic = request.headers.get("X-Shopify-Topic");
    
    // Handle different compliance topics
    switch (topic) {
      case "customers/data_request":
        console.log("Customer data request received:", payload);
        break;
      
      case "customers/redact":
        console.log("Customer data redaction request received:", payload);
        break;
      
      case "shop/redact":
        console.log("Shop data redaction request received:", payload);
        break;
      
      default:
        console.log("Unknown compliance topic:", topic);
    }
    
    // Return 200 OK to acknowledge receipt
    return new Response("OK", { status: 200 });
    
  } catch (error) {
    // verifyWebhookOrThrow already throws 401 for invalid HMAC
    // This catches other errors
    if (error instanceof Response) {
      throw error;
    }
    
    console.error("Compliance webhook error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}