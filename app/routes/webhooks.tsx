import type { ActionFunctionArgs } from "@remix-run/node";
import { verifyWebhookOrThrow } from "../utils/webhook-verification.server";

export async function action({ request }: ActionFunctionArgs) {
  // Only accept POST requests for webhooks
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // Verify HMAC signature - throws 401 if invalid
    const body = await verifyWebhookOrThrow(request);
    
    // Parse the webhook payload
    const payload = JSON.parse(body);
    const topic = request.headers.get("X-Shopify-Topic");
    
    console.log(`Received compliance webhook: ${topic}`);
    console.log("Payload:", JSON.stringify(payload, null, 2));
    
    // Handle different compliance topics
    switch (topic) {
      case "customers/data_request":
        console.log("Customer data request received:", payload);
        // Handle customer data request for GDPR compliance
        // This webhook is called when a customer requests their data from a store
        // You must provide the requested customer data to the store owner within 30 days
        break;
      
      case "customers/redact":
        console.log("Customer data redaction request received:", payload);
        // Handle customer data redaction for GDPR compliance
        // This webhook is called when a store owner requests customer data deletion
        // You must delete or redact the customer data within 30 days
        break;
      
      case "shop/redact":
        console.log("Shop data redaction request received:", payload);
        // Handle shop data redaction for GDPR compliance
        // This webhook is called 48 hours after a shop uninstalls your app
        // You must delete all shop data within 30 days
        break;
      
      default:
        console.log("Unknown compliance topic:", topic);
    }
    
    return new Response("OK", { status: 200 });
    
  } catch (error) {
    if (error instanceof Response) {
      // HMAC verification failed - return the 401 response
      return error;
    }
    
    console.error("Compliance webhook error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// Only allow POST requests for webhooks
export async function loader() {
  return new Response("Method Not Allowed", { status: 405 });
} 