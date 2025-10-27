import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError, useSearchParams } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { AppProvider as PolarisAppProvider, Frame } from "@shopify/polaris";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import polarisTranslations from "@shopify/polaris/locales/en.json" with { type: "json" };
import { useCallback } from "react";

import { ModernAppBridgeProvider } from "../components/ModernAppBridge";
import { authenticate } from "../shopify.server";

export const links = () => [
  { rel: "preload", href: polarisStyles, as: "style" },
  { rel: "stylesheet", href: polarisStyles },
];

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

  // Create navigation paths with host parameter
  const getNavPath = useCallback((basePath: string) => {
    return `${basePath}${host ? `?host=${host}` : ''}`;
  }, [host]);

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <ModernAppBridgeProvider>
        <PolarisAppProvider i18n={polarisTranslations}>
          <Frame>
            <NavMenu>
              <a href={getNavPath('/app')} rel="home">
                Home
              </a>
              <a href={getNavPath('/app/products')}>
                SEO Optimization
              </a>
              <a href={getNavPath('/app/pricing')}>
                Pricing
              </a>
              <a href={getNavPath('/app/help')}>
                Help & Support
              </a>
            </NavMenu>
            <Outlet />
          </Frame>
        </PolarisAppProvider>
      </ModernAppBridgeProvider>
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
