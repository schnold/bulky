import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, useSearchParams } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { AppProvider as PolarisAppProvider, Frame } from "@shopify/polaris";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import polarisTranslations from "@shopify/polaris/locales/en.json";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Ensure user exists for this session
  if (session?.shop) {
    const { ensureUserExists } = await import("../utils/db.server");
    await ensureUserExists(session.shop);
  }

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const host = searchParams.get("host");

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <PolarisAppProvider i18n={polarisTranslations}>
        <Frame>
          <NavMenu>
            <Link to="/app" rel="home">
              Home
            </Link>
            <Link to={`/app/products${host ? `?host=${host}` : ''}`}>SEO Optimization</Link>
            <Link to={`/app/pricing${host ? `?host=${host}` : ''}`}>Pricing</Link>
            <Link to={`/app/help${host ? `?host=${host}` : ''}`}>Help & Support</Link>
          </NavMenu>
          <Outlet />
        </Frame>
      </PolarisAppProvider>
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
