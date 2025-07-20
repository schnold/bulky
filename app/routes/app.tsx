import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";
import { ensureUserAndSession } from "../utils/session.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Ensure this only runs on the server - check for Node.js environment
  if (typeof process === "undefined" || !process.env) {
    throw new Error("This loader should only run on the server");
  }

  try {
    console.log(`🔍 App loader - Request URL: ${request.url}`);
    
    const { session } = await authenticate.admin(request);

    if (!session || !session.shop) {
      console.error("❌ App loader - No valid session found");
      throw new Error("No valid session found");
    }

    console.log(`✅ App loader - Session found for shop: ${session.shop}`);

    // Ensure user and session exist for this shop - this will create them if they don't exist
    await ensureUserAndSession(session.shop);

    const apiKey = process.env.SHOPIFY_API_KEY || "";
    console.log(`✅ App loader - Returning API key: ${apiKey ? 'SET' : 'NOT SET'}`);

    return { apiKey };
  } catch (error) {
    console.error("❌ App loader error:", error);
    // Return a basic response to prevent 500 error
    return { apiKey: process.env.SHOPIFY_API_KEY || "", error: "Authentication failed" };
  }
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  console.log(`🎨 App component rendering with API key: ${apiKey ? 'SET' : 'NOT SET'}`);

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/products">SEO Optimizer</Link>
        <Link to="/app/pricing">Pricing</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();
  console.error("❌ App ErrorBoundary caught error:", error);
  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
