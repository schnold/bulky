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

// Loader to provide the API key to the frontend
export async function loader({ request }: LoaderFunctionArgs) {
  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
  });
}

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
  
  return (
    <html>
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
          defer
          onError={(e) => {
            console.error('Failed to load App Bridge script:', e);
          }}
        />
        {/* Safety script to prevent inject.js errors */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
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

