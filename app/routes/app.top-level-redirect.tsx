import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

/**
 * Forces a top-level redirect out of the embedded iframe.
 * Usage: /app/top-level-redirect?to=<absolute-or-relative-url>
 * - If "to" is relative, it will be resolved against the current request origin.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const toParam = url.searchParams.get("to");

  if (!toParam) {
    throw new Response("Missing 'to' query parameter", { status: 400 });
  }

  // Allow relative targets by resolving against current origin
  let target: string;
  try {
    target = new URL(toParam, url.origin).toString();
  } catch {
    // Fallback to raw string if URL parsing fails (still attempt redirect client-side)
    target = toParam;
  }

  return json({ to: target });
}

export default function TopLevelRedirect() {
  const { to } = useLoaderData<typeof loader>();

  // Build script that safely attempts to assign the top window location
  const script = `
    (function() {
      try {
        var target = ${JSON.stringify(to)};
        // Prefer replacing history to avoid back button loops
        if (window.top === window.self) {
          window.location.replace(target);
        } else {
          window.top.location.replace(target);
        }
      } catch (e) {
        try {
          window.location.replace(${JSON.stringify(to)});
        } catch (e2) {
          // Last resort
          window.location.href = ${JSON.stringify(to)};
        }
      }
    })();
  `;

  // Render minimal HTML with meta refresh as a non-JS fallback
  return (
    <html>
      <head>
        <meta httpEquiv="refresh" content={`0;url=${to}`} />
        <title>Redirecting...</title>
      </head>
      <body>
        <p>Redirecting... If you are not redirected, <a href={to}>click here</a>.</p>
        <script
          dangerouslySetInnerHTML={{
            __html: script,
          }}
        />
      </body>
    </html>
  ) as any;
}
