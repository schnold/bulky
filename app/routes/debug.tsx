import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const loader = async () => {
  try {
    // Test if Shopify server is working
    const { login } = await import("../shopify.server");
    
    return json({ 
      status: "OK",
      shopifyLogin: login ? "Available" : "Not Available",
      env: {
        shopifyApiKey: process.env.SHOPIFY_API_KEY ? "SET" : "NOT SET",
        shopifyApiSecret: process.env.SHOPIFY_API_SECRET ? "SET" : "NOT SET",
        shopifyAppUrl: process.env.SHOPIFY_APP_URL || "NOT SET",
        scopes: process.env.SCOPES || "NOT SET",
        databaseUrl: process.env.NETLIFY_DATABASE_URL ? "SET" : "NOT SET",
      }
    });
  } catch (error) {
    return json({ 
      status: "ERROR",
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });
  }
};

export default function Debug() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <div style={{ padding: "20px", fontFamily: "monospace", backgroundColor: "#f5f5f5" }}>
      <h1>🐛 Debug Information</h1>
      
      <h2>Status: {data.status}</h2>
      
      {data.status === "ERROR" ? (
        <div style={{ backgroundColor: "#ffebee", padding: "10px", borderRadius: "4px" }}>
          <h3>Error:</h3>
          <p>{data.error}</p>
          {data.stack && (
            <details>
              <summary>Stack Trace</summary>
              <pre>{data.stack}</pre>
            </details>
          )}
        </div>
      ) : (
        <div>
          <h3>Shopify Integration:</h3>
          <p>Login Function: {data.shopifyLogin}</p>
          
          <h3>Environment Variables:</h3>
          <ul>
            {Object.entries(data.env).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {value}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <h3>Route Tests:</h3>
      <ul>
        <li><a href="/">Root (/)</a></li>
        <li><a href="/test">Test Route</a></li>
        <li><a href="/auth/login">Auth Login (404?)</a></li>
        <li><a href="/app">App Route</a></li>
      </ul>
    </div>
  );
}