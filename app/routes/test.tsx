import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const loader = async () => {
  return json({ 
    message: "Test route is working!",
    timestamp: new Date().toISOString(),
    env: {
      nodeEnv: process.env.NODE_ENV,
      shopifyApiKey: process.env.SHOPIFY_API_KEY ? "SET" : "NOT SET",
      databaseUrl: process.env.NETLIFY_DATABASE_URL ? "SET" : "NOT SET"
    }
  });
};

export default function Test() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>🧪 Test Route</h1>
      <p><strong>Message:</strong> {data.message}</p>
      <p><strong>Timestamp:</strong> {data.timestamp}</p>
      <h2>Environment Check:</h2>
      <ul>
        <li>NODE_ENV: {data.env.nodeEnv}</li>
        <li>SHOPIFY_API_KEY: {data.env.shopifyApiKey}</li>
        <li>DATABASE_URL: {data.env.databaseUrl}</li>
      </ul>
      <h2>Navigation Test:</h2>
      <ul>
        <li><a href="/app">Go to /app</a></li>
        <li><a href="/auth/login">Go to /auth/login</a></li>
        <li><a href="/">Go to root</a></li>
      </ul>
    </div>
  );
}