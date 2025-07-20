import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  console.log(`🔍 Catch-all route hit for: ${pathname}`);

  // Handle __manifest requests
  if (pathname === "/__manifest") {
    console.log(`🔍 Handling manifest request`);
    const searchParams = url.searchParams;

    // Get all the 'p' parameters (pages) from the query string
    const pages = searchParams.getAll("p");
    const version = searchParams.get("version") || "1.0.0";

    // Build the full redirect URL using the application URL from config
    const baseUrl = process.env.SHOPIFY_APP_URL || "https://b1-bulk-product-seo-enhancer.netlify.app";

    // Create the manifest response that Shopify expects for app authentication
    const manifest = {
      name: "b1: Bulk Product SEO Optimizer",
      version,
      pages: pages.length > 0 ? pages : ["/app"],
      application_url: baseUrl,
      client_id: process.env.SHOPIFY_API_KEY || "fa9d90437a467b7215e296d9eb003d7d",
      embedded: true,
      timestamp: new Date().toISOString(),
    };

    console.log(`🔍 Returning manifest:`, manifest);

    return new Response(JSON.stringify(manifest), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  
  // This catch-all route should only handle truly unmatched routes
  // All /app/* routes should be handled by their specific route files
  throw new Response("Not Found", { status: 404 });
}