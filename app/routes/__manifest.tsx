import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  
  // Get the redirect URL from query params (typically the auth/login page)
  const redirectPath = searchParams.get("p") || "/auth/login";
  const version = searchParams.get("version") || "1.0.0";
  
  // Build the full redirect URL using the application URL from config
  const baseUrl = "https://b1-bulk-product-seo-enhancer.netlify.app";
  const redirectUrl = `${baseUrl}${redirectPath}`;
  
  // Create the manifest response that Shopify expects for app authentication
  const manifest = {
    name: "b1: Bulk Product SEO Optimizer",
    version,
    redirect_url: redirectUrl,
    application_url: baseUrl,
    client_id: "fa9d90437a467b7215e296d9eb003d7d",
    embedded: true,
    timestamp: new Date().toISOString(),
  };
  
  return json(manifest, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}