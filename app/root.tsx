import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useChangeLanguage } from "remix-i18next/react";
import { useTranslation } from "react-i18next";
import i18nextServer from "./i18next.server";

// Loader to provide the API key and locale to the frontend
export async function loader({ request }: LoaderFunctionArgs) {
  const locale = await i18nextServer.getLocale(request);
  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    locale,
  });
}

export default function App() {
  const { apiKey, locale } = useLoaderData<typeof loader>();
  const { i18n } = useTranslation();

  // This hook will change the i18next instance language to the one in the locale variable
  useChangeLanguage(locale);

  return (
    <html lang={i18n.language}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="shopify-debug" content="web-vitals" />
        {/* Modern App Bridge - API Key meta tag for automatic authentication */}
        <meta name="shopify-api-key" content={apiKey} />
        <Meta />
        <Links />
        {/* Modern App Bridge - CDN script that auto-updates */}
        <script
          src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          onError={(e) => {
            console.error('Failed to load App Bridge script:', e);
          }}
        />
        {/* Safety script to prevent inject.js errors */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Enhanced App Bridge initialization and debugging
              console.log('[App Bridge] Starting initialization...');
              
              // Check if we're in an iframe context
              if (window !== window.top) {
                console.log('[App Bridge] Running in iframe context');
              } else {
                console.log('[App Bridge] Running in top-level context');
              }
              
              // Monitor App Bridge script loading
              const script = document.querySelector('script[src*="app-bridge.js"]');
              if (script) {
                script.addEventListener('load', function() {
                  console.log('[App Bridge] Script loaded successfully');
                  
                  // Check if shopify global is available
                  setTimeout(() => {
                    if (window.shopify) {
                      console.log('[App Bridge] Shopify global available:', {
                        hasWebVitals: !!window.shopify.webVitals,
                        hasConfig: !!window.shopify.config,
                        apiKey: window.shopify.config?.apiKey ? 'present' : 'missing'
                      });
                    } else {
                      console.warn('[App Bridge] Shopify global not available after script load');
                    }
                  }, 100);
                });
                
                script.addEventListener('error', function(e) {
                  console.error('[App Bridge] Script failed to load:', e);
                });
              }
              
              // Prevent inject.js errors by ensuring DOM is ready
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                  console.log('[App Bridge] DOM ready, App Bridge should be available');
                });
              } else {
                console.log('[App Bridge] DOM already ready');
              }
            `,
          }}
        />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

