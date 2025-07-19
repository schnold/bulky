import { createRequestHandler } from "@remix-run/netlify";
import * as build from "../../build/server/index.js";

const baseHandler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV || "production",
});

export const handler = async (event, context) => {
  try {
    // Add request logging for debugging
    console.log(`🌐 Request: ${event.httpMethod} ${event.path}`);
    console.log(`🔍 Headers:`, JSON.stringify(event.headers, null, 2));
    
    // Ensure NETLIFY_DATABASE_URL is available
    if (!process.env.NETLIFY_DATABASE_URL) {
      console.error("❌ NETLIFY_DATABASE_URL environment variable is not set");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database configuration error" }),
        headers: {
          "Content-Type": "application/json",
        },
      };
    }
    
    // Handle the request
    const response = await baseHandler(event, context);
    
    // Log response status for debugging
    console.log(`✅ Response status: ${response.statusCode}`);
    
    return response;
  } catch (error) {
    console.error("❌ Server function error:", error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Internal server error",
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
};