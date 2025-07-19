import { createRequestHandler } from "@remix-run/netlify";
import * as build from "../../build/server/index.js";

// Ensure React is available globally for SSR
import React from "react";
import ReactDOM from "react-dom";

// Make React available globally to prevent hooks issues
if (typeof global !== "undefined") {
  global.React = React;
  global.ReactDOM = ReactDOM;
}

// Polyfill for server environment
if (typeof window === "undefined") {
  global.window = {};
  global.document = {};
  
  // Only set navigator if it doesn't already exist or is not read-only
  if (typeof global.navigator === "undefined") {
    try {
      global.navigator = { userAgent: "node" };
    } catch (error) {
      // Navigator might be read-only, skip setting it
      console.log("Navigator already exists or is read-only, skipping polyfill");
    }
  }
}

const baseHandler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV || "production",
});

export const handler = async (event, context) => {
  try {
    // Add request logging for debugging
    console.log(`🌐 Request: ${event.httpMethod} ${event.path}`);
    
    // Check for database URL (Netlify provides DATABASE_URL automatically)
    const databaseUrl = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
    
    console.log(`🔍 Environment check:`);
    console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    console.log(`- NETLIFY_DATABASE_URL: ${process.env.NETLIFY_DATABASE_URL ? 'SET' : 'NOT SET'}`);
    console.log(`- Using: ${databaseUrl ? 'DATABASE URL FOUND' : 'NO DATABASE URL'}`);
    
    if (!databaseUrl) {
      console.error("❌ No database URL found in environment variables");
      console.error("Available env vars:", Object.keys(process.env).filter(key => key.includes('DATABASE')));
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: "Database configuration error",
          details: "No DATABASE_URL or NETLIFY_DATABASE_URL found"
        }),
        headers: {
          "Content-Type": "application/json",
        },
      };
    }
    
    // Set the database URL for Prisma if it's not already set
    if (!process.env.DATABASE_URL && process.env.NETLIFY_DATABASE_URL) {
      process.env.DATABASE_URL = process.env.NETLIFY_DATABASE_URL;
    }
    
    // Handle the request
    const response = await baseHandler(event, context);
    
    // Log response status for debugging
    console.log(`✅ Response status: ${response.statusCode}`);
    
    return response;
  } catch (error) {
    console.error("❌ Server function error:", error);
    console.error("❌ Error stack:", error.stack);
    
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