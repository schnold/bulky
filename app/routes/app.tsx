import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";
import { ensureUserAndSession } from "../utils/session.server";
import { ClientOnly } from "../components/ClientOnly";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);

    if (!session || !session.shop) {
      throw new Error("No valid session found");
    }

    // Ensure user and session exist for this shop - this will create them if they don't exist
    await ensureUserAndSession(session.shop);

    return { apiKey: process.env.SHOPIFY_API_KEY || "" };
  } catch (error) {
    console.error("App loader error:", error);
    // Return a basic response to prevent 500 error
    return { apiKey: process.env.SHOPIFY_API_KEY || "", error: "Authentication failed" };
  }
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <ClientOnly fallback={<div>Loading...</div>}>
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
    </ClientOnly>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
