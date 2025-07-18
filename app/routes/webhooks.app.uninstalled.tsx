import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { shop, session, topic } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    // Webhook requests can trigger multiple times and after an app has already been uninstalled.
    // If this webhook already ran, the session may have been deleted previously.
    if (session) {
      await db.session.deleteMany({ where: { shop } });
      console.log(`Cleaned up session data for uninstalled shop: ${shop}`);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("App uninstalled webhook error:", error);
    return new Response("Error processing app uninstalled webhook", { status: 500 });
  }
};
