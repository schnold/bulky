import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { AppProvider } from "@shopify/polaris";

// Import Polaris styles directly
import "@shopify/polaris/build/esm/styles.css";

export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <AppProvider i18n={{}}>
          <Outlet />
        </AppProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  console.error("Root ErrorBoundary caught error:", error);
  console.error("Error details:", {
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : 'No stack trace',
    type: typeof error,
    isRouteError: isRouteErrorResponse(error)
  });

  if (isRouteErrorResponse(error)) {
    return (
      <html>
        <head>
          <title>Error {error.status}</title>
          <Meta />
          <Links />
        </head>
        <body>
          <AppProvider i18n={{}}>
            <div style={{ padding: "20px", fontFamily: "system-ui" }}>
              <h1>Error {error.status}</h1>
              <p>{error.statusText}</p>
              <p>Something went wrong. Please try refreshing the page.</p>
            </div>
          </AppProvider>
          <Scripts />
        </body>
      </html>
    );
  }

  return (
    <html>
      <head>
        <title>Application Error</title>
        <Meta />
        <Links />
      </head>
      <body>
        <AppProvider i18n={{}}>
          <div style={{ padding: "20px", fontFamily: "system-ui" }}>
            <h1>Application Error</h1>
            <p>Something went wrong. Please try refreshing the page.</p>
            {process.env.NODE_ENV === "development" && (
              <pre style={{ background: "#f5f5f5", padding: "10px", overflow: "auto" }}>
                {error instanceof Error ? error.stack : String(error)}
              </pre>
            )}
          </div>
        </AppProvider>
        <Scripts />
      </body>
    </html>
  );
}
