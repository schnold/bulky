import { createHmac, timingSafeEqual } from "crypto";

export interface WebhookVerificationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Verifies the HMAC signature of a Shopify webhook
 * @param body - The raw webhook body as string
 * @param signature - The X-Shopify-Hmac-Sha256 header value
 * @param secret - The webhook secret from environment variables
 * @returns Promise<WebhookVerificationResult>
 */
export async function verifyWebhookSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<WebhookVerificationResult> {
  if (!signature) {
    return {
      isValid: false,
      error: "Missing X-Shopify-Hmac-Sha256 header"
    };
  }

  if (!secret) {
    return {
      isValid: false,
      error: "Webhook secret not configured"
    };
  }

  try {
    // Create HMAC using the webhook secret
    const hmac = createHmac("sha256", secret);
    hmac.update(body, "utf8");
    const calculatedSignature = hmac.digest("base64");

    // Compare signatures using timing-safe comparison
    const providedSignature = Buffer.from(signature, "base64");
    const expectedSignature = Buffer.from(calculatedSignature, "base64");

    if (providedSignature.length !== expectedSignature.length) {
      return {
        isValid: false,
        error: "Signature length mismatch"
      };
    }

    const isValid = timingSafeEqual(providedSignature, expectedSignature);

    return {
      isValid,
      error: isValid ? undefined : "Invalid HMAC signature"
    };
  } catch (error) {
    return {
      isValid: false,
      error: `HMAC verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Middleware to verify webhook HMAC and return 401 if invalid
 */
export async function verifyWebhookOrThrow(request: Request): Promise<string> {
  const signature = request.headers.get("X-Shopify-Hmac-Sha256");
  const body = await request.text();
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_API_SECRET || "";

  const verification = await verifyWebhookSignature(body, signature, secret);
  
  if (!verification.isValid) {
    throw new Response("Unauthorized", { 
      status: 401,
      statusText: verification.error || "Invalid webhook signature"
    });
  }

  return body;
}