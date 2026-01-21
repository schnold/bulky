import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import i18nextServer from "../i18next.server";
import { Outlet, useLoaderData, useRouteError, useSearchParams } from "@remix-run/react";
import { useTranslation } from "../i18n-shim";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { AppProvider as PolarisAppProvider, Frame } from "@shopify/polaris";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { useCallback, useEffect, useState } from "react";

import { IframeErrorBoundary } from "../components/IframeErrorBoundary";
import { authenticate } from "../shopify.server";

export const links = () => [
  { rel: "preload", href: polarisStyles, as: "style" },
  { rel: "stylesheet", href: polarisStyles },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, sessionToken } = await authenticate.admin(request);

  // For embedded apps, sessionToken is automatically validated by authenticate.admin
  // sessionToken contains: sub (user ID), dest (shop domain), etc.
  if (sessionToken) {
    console.log(`🔐 App layout - Session token validated for shop: ${sessionToken.dest}, user: ${sessionToken.sub}`);
  }

  // Ensure user exists for this session
  if (session?.shop) {
    const { ensureUserExists } = await import("../utils/db.server");
    await ensureUserExists(session.shop);
  }

  const locale = await i18nextServer.getLocale(request);

  return { apiKey: process.env.SHOPIFY_API_KEY || "", locale };
};

export default function App() {
  const { apiKey, locale } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const host = searchParams.get("host");

  const [polarisTranslations, setPolarisTranslations] = useState<any>(null);

  useEffect(() => {
    // Load Polaris translations based on detected locale
    const loadTranslations = async () => {
      try {
        let translations;
        if (locale === 'es') {
          translations = await import("@shopify/polaris/locales/es.json");
        } else {
          translations = await import("@shopify/polaris/locales/en.json");
        }
        setPolarisTranslations(translations.default || translations);
      } catch (error) {
        console.error("Failed to load Polaris translations", error);
        // Fallback to English
        const translations = await import("@shopify/polaris/locales/en.json");
        setPolarisTranslations(translations.default || translations);
      }
    };
    loadTranslations();
  }, [locale]);

  // Create navigation paths with host parameter
  const getNavPath = useCallback((basePath: string) => {
    return `${basePath}${host ? `?host=${host}` : ''}`;
  }, [host]);

  return (
    <IframeErrorBoundary>
      <AppProvider isEmbeddedApp apiKey={apiKey}>
        <PolarisAppProvider i18n={polarisTranslations || {}}>
          <Frame>
            <NavMenu>
              <a href={getNavPath('/app')} rel="home">
                {t("nav.home")}
              </a>
              <a href={getNavPath('/app/products')}>
                {t("nav.seo_optimization")}
              </a>
              <a href={getNavPath('/app/pricing')}>
                {t("nav.pricing")}
              </a>
              <a href={getNavPath('/app/help')}>
                {t("nav.help")}
              </a>
            </NavMenu>
            <Outlet />
          </Frame>
        </PolarisAppProvider>
      </AppProvider>
    </IframeErrorBoundary>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
