import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { shop, topic, payload } = await authenticate.webhook(request);
    
    console.log(`Received ${topic} webhook for ${shop}`);
    console.log("Shop redact payload:", JSON.stringify(payload, null, 2));
    
    // Handle shop data redaction for GDPR compliance
    // This webhook is called when a shop requests their data to be deleted
    // You should implement your data cleanup logic here
    
    // For now, we'll just log the request
    console.log(`Shop ${shop} data redaction requested`);
    
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Shop redact webhook error:", error);
    return new Response("Error processing shop redact webhook", { status: 500 });
  }
};