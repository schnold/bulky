import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getSessionTokenInfo } from "../utils/session-token.server";

/**
 * API endpoint to get session information using session token
 * This endpoint can be called from the frontend with authenticated fetch
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const sessionInfo = await getSessionTokenInfo(request);
  
  if (!sessionInfo.isValid) {
    return json({ 
      error: sessionInfo.error, 
      authenticated: false 
    }, { status: 401 });
  }

  return json({
    authenticated: true,
    shop: sessionInfo.shop,
    userId: sessionInfo.userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle POST requests with session token authentication
 */
export async function action({ request }: ActionFunctionArgs) {
  const sessionInfo = await getSessionTokenInfo(request);
  
  if (!sessionInfo.isValid) {
    return json({ 
      error: sessionInfo.error, 
      authenticated: false 
    }, { status: 401 });
  }

  // Handle the authenticated request
  const body = await request.text();
  let data;
  
  try {
    data = body ? JSON.parse(body) : {};
  } catch (error) {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Example: Echo back the data with session info
  return json({
    success: true,
    receivedData: data,
    sessionInfo: {
      shop: sessionInfo.shop,
      userId: sessionInfo.userId,
      timestamp: new Date().toISOString(),
    },
  });
}