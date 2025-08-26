import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, useSearchParams, useNavigate } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { AppProvider as PolarisAppProvider, Frame } from "@shopify/polaris";
import { NavMenu } from "@shopify/app-bridge-react";
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
  const navigate = useNavigate();
  const host = searchParams.get("host");

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

  // Robust navigation handler for embedded apps
  const handleNavClick = useCallback((path: string, label: string) => {
    console.log(`[NAV] Clicking ${label}:`, { path, host, searchParams: Object.fromEntries(searchParams) });
    
    // Check for potential issues
    if (!path) {
      console.error(`[NAV] Empty path for ${label}`);
      return false;
    }
    
    try {
      // Use programmatic navigation as fallback for embedded apps
      console.log(`[NAV] Attempting navigation to: ${path}`);
      
      // Add small delay to prevent double-clicks
      setTimeout(() => {
        navigate(path, { replace: false });
      }, 10);
      
    } catch (error) {
      console.error(`[NAV] Navigation failed for ${label}:`, error);
      // Fallback to window location
      try {
        window.location.href = path;
      } catch (fallbackError) {
        console.error(`[NAV] Fallback navigation also failed:`, fallbackError);
      }
    }
  }, [navigate, host, searchParams]);

  // Create navigation paths with host parameter
  const getNavPath = useCallback((basePath: string) => {
    return `${basePath}${host ? `?host=${host}` : ''}`;
  }, [host]);

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <PolarisAppProvider i18n={polarisTranslations}>
        <Frame>
          <NavMenu>
            <Link 
              to={getNavPath('/app')} 
              rel="home"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick(getNavPath('/app'), 'Home');
              }}
            >
              Home
            </Link>
            <Link 
              to={getNavPath('/app/products')}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick(getNavPath('/app/products'), 'SEO Optimization');
              }}
            >
              SEO Optimization
            </Link>
            <Link 
              to={getNavPath('/app/pricing')}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick(getNavPath('/app/pricing'), 'Pricing');
              }}
            >
              Pricing
            </Link>
            <Link 
              to={getNavPath('/app/help')}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick(getNavPath('/app/help'), 'Help & Support');
              }}
            >
              Help & Support
            </Link>
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
