import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError, useSearchParams } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { AppProvider as PolarisAppProvider, Frame } from "@shopify/polaris";
import { NavMenu, useNavigate } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { useCallback, useEffect } from "react";

import { initializeSessionTokenAuth } from "../utils/session-token";

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
  const navigate = useNavigate();

  // Initialize session token authentication
  useEffect(() => {
    if (apiKey && host) {
      try {
        initializeSessionTokenAuth({
          apiKey,
          host,
          forceRedirect: true,
        });
        console.log("[AUTH] Session token authentication initialized", { apiKey, host });
      } catch (error) {
        console.error("[AUTH] Failed to initialize session token auth:", error);
      }
    }
  }, [apiKey, host]);

  // Create navigation paths with host parameter
  const getNavPath = useCallback((basePath: string) => {
    return `${basePath}${host ? `?host=${host}` : ''}`;
  }, [host]);

  const handleNavigation = useCallback((path: string) => {
    navigate(getNavPath(path));
  }, [navigate, getNavPath]);

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <PolarisAppProvider i18n={polarisTranslations}>
        <Frame>
          <NavMenu>
            <button 
              onClick={() => handleNavigation('/app')}
              style={{ all: 'unset', cursor: 'pointer' }}
            >
              Home
            </button>
            <button 
              onClick={() => handleNavigation('/app/products')}
              style={{ all: 'unset', cursor: 'pointer' }}
            >
              SEO Optimization
            </button>
            <button 
              onClick={() => handleNavigation('/app/pricing')}
              style={{ all: 'unset', cursor: 'pointer' }}
            >
              Pricing
            </button>
            <button 
              onClick={() => handleNavigation('/app/help')}
              style={{ all: 'unset', cursor: 'pointer' }}
            >
              Help & Support
            </button>
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
