import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";

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
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  
  console.error("Root ErrorBoundary caught error:", error);
  
  if (isRouteErrorResponse(error)) {
    return (
      <html>
        <head>
          <title>Error {error.status}</title>
          <Meta />
          <Links />
        </head>
        <body>
          <div style={{ padding: "20px", fontFamily: "system-ui" }}>
            <h1>Error {error.status}</h1>
            <p>{error.statusText}</p>
            <p>Something went wrong. Please try refreshing the page.</p>
          </div>
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
        <div style={{ padding: "20px", fontFamily: "system-ui" }}>
          <h1>Application Error</h1>
          <p>Something went wrong. Please try refreshing the page.</p>
          {process.env.NODE_ENV === "development" && (
            <pre style={{ background: "#f5f5f5", padding: "10px", overflow: "auto" }}>
              {error instanceof Error ? error.stack : String(error)}
            </pre>
          )}
        </div>
        <Scripts />
      </body>
    </html>
  );
}
