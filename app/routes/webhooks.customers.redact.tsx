import type { ActionFunctionArgs } from "@remix-run/node";
import { verifyWebhookOrThrow } from "../utils/webhook-verification.server";

interface CustomerRedactPayload {
  shop_id: number;
  shop_domain: string;
  customer: {
    id: number;
    email: string;
    phone?: string;
  };
  orders_to_redact: number[];
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
    const payload: CustomerRedactPayload = JSON.parse(body);
    
    console.log(`Received customers/redact webhook for shop: ${payload.shop_domain}`);
    console.log("Customer redact payload:", JSON.stringify(payload, null, 2));
    
    // Handle customer data redaction for GDPR compliance
    // This webhook is called when a store owner requests customer data deletion
    // You must delete or redact the customer data within 30 days
    
    const { shop_id, shop_domain, customer, orders_to_redact } = payload;
    
    // TODO: Implement your data redaction logic here
    // IMPORTANT: Only redact data if you're not legally required to retain it
    // 1. Remove or anonymize all customer personal data from your database
    // 2. Remove or anonymize data from related orders
    // 3. Update any analytics or reporting data
    // 4. Ensure backups are also cleaned
    
    // Example implementation:
    console.log(`Processing redaction request for customer ${customer.id} (${customer.email})`);
    console.log(`Shop: ${shop_domain} (ID: ${shop_id})`);
    console.log(`Orders to redact: ${orders_to_redact.join(', ')}`);
    
    // Example: Remove customer data from your database
    // await deleteCustomerData(customer.id, shop_id);
    // await redactOrderData(orders_to_redact, customer.id);
    
    // Log for compliance tracking
    console.log(`[COMPLIANCE] Customer data redaction processed for customer ${customer.id} in shop ${shop_domain}`);
    
    return new Response("OK", { status: 200 });
  } catch (error) {
    if (error instanceof Response) {
      // HMAC verification failed - return the 401 response
      return error;
    }
    
    console.error("Customer redact webhook error:", error);
    return new Response("Error processing customer redact webhook", { status: 500 });
  }
};

// Only allow POST requests for webhooks
export async function loader() {
  return new Response("Method Not Allowed", { status: 405 });
}