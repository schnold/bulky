import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-remix/react";
import { AppProvider } from "@shopify/polaris";
import { NavMenu } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { ensureUserAndSession } from "../utils/session.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {

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
  console.log(`🎨 Current URL: ${typeof window !== 'undefined' ? window.location.href : 'server-side'}`);

  return (
    <ShopifyAppProvider isEmbeddedApp apiKey={apiKey}>
      <AppProvider i18n={{
        Polaris: {
          Avatar: {
            label: 'Avatar',
            labelWithInitials: 'Avatar with initials {initials}',
          },
          ContextualSaveBar: {
            save: 'Save',
            discard: 'Discard',
          },
          TextField: {
            characterCount: '{count} characters',
          },
          TopBar: {
            toggleMenuLabel: 'Toggle menu',
            SearchField: {
              clearButtonLabel: 'Clear',
              search: 'Search',
            },
          },
          Modal: {
            iFrameTitle: 'body markup',
          },
          Frame: {
            skipToContent: 'Skip to content',
            navigationLabel: 'Navigation',
            Navigation: {
              closeMobileNavigationLabel: 'Close navigation',
            },
          },
        },
      }}>
        <NavMenu>
          <Link to="/app" rel="home">
            Home
          </Link>
          <Link to="/app/products">SEO Optimizer</Link>
          <Link to="/app/pricing">Pricing</Link>
        </NavMenu>
        <Outlet />
      </AppProvider>
    </ShopifyAppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();
  console.error("❌ App ErrorBoundary caught error:", error);
  
  // Show a more helpful error message during development
  if (process.env.NODE_ENV === "development") {
    return (
      <div style={{ padding: "20px", fontFamily: "system-ui" }}>
        <h1>App Route Error</h1>
        <p>There was an error in the /app route. Check the console for details.</p>
        <pre style={{ background: "#f5f5f5", padding: "10px", overflow: "auto" }}>
          {error instanceof Error ? error.stack : String(error)}
        </pre>
        <p><strong>Common fixes:</strong></p>
        <ul>
          <li>Make sure you're accessing /app route</li>
          <li>Check your .env file has correct Shopify credentials</li>
          <li>Ensure your app is properly installed in Shopify</li>
        </ul>
      </div>
    );
  }
  
  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
