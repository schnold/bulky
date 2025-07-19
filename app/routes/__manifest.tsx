import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    // Get all the 'p' parameters (pages) from the query string
    const pages = searchParams.getAll("p");
    const version = searchParams.get("version") || "1.0.0";
    
    // Build the full redirect URL using the application URL from config
    const baseUrl = process.env.SHOPIFY_APP_URL || "https://b1-bulk-product-seo-enhancer.netlify.app";
    
    console.log(`📋 Manifest request:`, { pages, version, baseUrl });
    
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
    
    console.log(`✅ Generated manifest:`, manifest);
    
    return json(manifest, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("❌ Manifest error:", error);
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace");
    
    // Return a more detailed error response for debugging
    return json(
      { 
        error: "Failed to generate manifest",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: process.env.NODE_ENV === "development" && error instanceof Error ? error.stack : undefined
      },
      { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}