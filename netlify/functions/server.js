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
  
  // Add matchMedia polyfill for Polaris components
  global.window.matchMedia = global.window.matchMedia || function(query) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: function() {},
      removeListener: function() {},
      addEventListener: function() {},
      removeEventListener: function() {},
      dispatchEvent: function() { return false; }
    };
  };
  
  // Add other necessary browser APIs
  global.window.addEventListener = global.window.addEventListener || function() {};
  global.window.removeEventListener = global.window.removeEventListener || function() {};
  global.window.dispatchEvent = global.window.dispatchEvent || function() { return false; };
  
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

export const handler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV || "production",
  getLoadContext: (event, context) => {
    // Add request logging for debugging
    console.log(`🌐 Request: ${event.httpMethod} ${event.path}`);
    
    // Check for database URL (Netlify provides DATABASE_URL automatically)
    const databaseUrl = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
    
    console.log(`🔍 Environment check:`);
    console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    console.log(`- NETLIFY_DATABASE_URL: ${process.env.NETLIFY_DATABASE_URL ? 'SET' : 'NOT SET'}`);
    console.log(`- Using: ${databaseUrl ? 'DATABASE URL FOUND' : 'NO DATABASE URL'}`);
    console.log(`- SHOPIFY_API_KEY: ${process.env.SHOPIFY_API_KEY ? 'SET' : 'NOT SET'}`);
    console.log(`- SHOPIFY_API_SECRET: ${process.env.SHOPIFY_API_SECRET ? 'SET' : 'NOT SET'}`);
    console.log(`- SHOPIFY_APP_URL: ${process.env.SHOPIFY_APP_URL ? 'SET' : 'NOT SET'}`);
    console.log(`- SCOPES: ${process.env.SCOPES ? 'SET' : 'NOT SET'}`);
    console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
    
    // Set the database URL for Prisma if it's not already set
    if (!process.env.DATABASE_URL && process.env.NETLIFY_DATABASE_URL) {
      process.env.DATABASE_URL = process.env.NETLIFY_DATABASE_URL;
    }

    return {
      event,
      context,
    };
  },
});