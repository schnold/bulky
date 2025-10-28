import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { redeemDiscountCode } from "../models/user.server";

/**
 * API endpoint for redeeming discount codes
 * POST /app/redeem-discount
 */
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const code = formData.get("code") as string;

    if (!code || typeof code !== "string") {
      return json({ success: false, error: "Discount code is required" }, { status: 400 });
    }

    // Trim and validate code format
    const trimmedCode = code.trim();
    if (trimmedCode.length === 0) {
      return json({ success: false, error: "Discount code cannot be empty" }, { status: 400 });
    }

    if (trimmedCode.length > 50) {
      return json({ success: false, error: "Discount code is too long" }, { status: 400 });
    }

    // Redeem the code
    const result = await redeemDiscountCode(trimmedCode, session.shop);

    if (!result.success) {
      return json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return json({
      success: true,
      creditsGranted: result.creditsGranted,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error("[REDEEM-DISCOUNT] Error:", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to redeem discount code",
      },
      { status: 500 }
    );
  }
}
