import type { ActionFunctionArgs } from "@remix-run/node";
import { createHmac, timingSafeEqual } from "crypto";

async function verifyWebhook(request: Request): Promise<{ isValid: boolean; body: string }> {
  const signature = request.headers.get("X-Shopify-Hmac-Sha256");
  const body = await request.text();
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_API_SECRET || "";

  if (!signature || !secret) {
    return { isValid: false, body };
  }

  try {
    const hmac = createHmac("sha256", secret);
    hmac.update(body, "utf8");
    const calculatedSignature = hmac.digest("base64");

    const providedSignature = Buffer.from(signature, "base64");
    const expectedSignature = Buffer.from(calculatedSignature, "base64");

    if (providedSignature.length !== expectedSignature.length) {
      return { isValid: false, body };
    }

    const isValid = timingSafeEqual(providedSignature, expectedSignature);
    return { isValid, body };
  } catch {
    return { isValid: false, body };
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const verification = await verifyWebhook(request);
  
  if (!verification.isValid) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  try {
    const payload = JSON.parse(verification.body);
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
    
    return new Response("OK", { status: 200 });
    
  } catch (error) {
    console.error("Compliance webhook error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}