import type { ActionFunctionArgs } from "@remix-run/node";
import { verifyWebhookOrThrow } from "../utils/webhook-verification.server";

interface CustomerDataRequestPayload {
  shop_id: number;
  shop_domain: string;
  orders_requested: number[];
  customer: {
    id: number;
    email: string;
    phone?: string;
  };
  data_request: {
    id: number;
  };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Verify HMAC signature - throws 401 if invalid
    const body = await verifyWebhookOrThrow(request);
    
    // Parse the webhook payload
    const payload: CustomerDataRequestPayload = JSON.parse(body);
    
    console.log(`Received customers/data_request webhook for shop: ${payload.shop_domain}`);
    console.log("Customer data request payload:", JSON.stringify(payload, null, 2));
    
    // Handle customer data request for GDPR compliance
    // This webhook is called when a customer requests their data from a store
    // You must provide the requested customer data to the store owner within 30 days
    
    const { shop_id, shop_domain, customer, orders_requested, data_request } = payload;
    
    // TODO: Implement your data retrieval logic here
    // 1. Query your database for all data related to this customer
    // 2. Compile the data in a readable format
    // 3. Provide this data to the store owner through your preferred method
    //    (email, admin interface, API endpoint, etc.)
    
    // Example implementation:
    console.log(`Processing data request ${data_request.id} for customer ${customer.id} (${customer.email})`);
    console.log(`Shop: ${shop_domain} (ID: ${shop_id})`);
    console.log(`Orders requested: ${orders_requested.join(', ')}`);
    
    // Log for compliance tracking
    console.log(`[COMPLIANCE] Customer data request received and processed for customer ${customer.id} in shop ${shop_domain}`);
    
    return new Response("OK", { status: 200 });
  } catch (error) {
    if (error instanceof Response) {
      // HMAC verification failed - return the 401 response
      return error;
    }
    
    console.error("Customer data request webhook error:", error);
    return new Response("Error processing customer data request webhook", { status: 500 });
  }
};