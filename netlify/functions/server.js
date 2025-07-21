import { createRequestHandler } from "@netlify/remix-adapter";
import * as build from "../../build/server/index.js";

// Custom request handler that fixes URL issues
const createCustomRequestHandler = ({ build, mode }) => {
  const baseHandler = createRequestHandler({ build, mode });
  
  return async (event, context) => {
    // Ensure the event has all required URL properties
    if (!event.rawUrl) {
      const host = event.headers.host || 'b1-bulk-product-seo-enhancer.netlify.app';
      const protocol = event.headers['x-forwarded-proto'] || 'https';
      const path = event.path || '/';
      const query = event.rawQuery ? `?${event.rawQuery}` : '';
      event.rawUrl = `${protocol}://${host}${path}${query}`;
    }
    
    // Ensure all URL-related properties are defined
    event.path = event.path || '/';
    event.rawQuery = event.rawQuery || '';
    event.queryStringParameters = event.queryStringParameters || {};
    event.multiValueQueryStringParameters = event.multiValueQueryStringParameters || {};
    
    // Log the final event properties
    console.log('Processed event URL properties:', {
      rawUrl: event.rawUrl,
      path: event.path,
      rawQuery: event.rawQuery,
      httpMethod: event.httpMethod
    });
    
    return baseHandler(event, context);
  };
};

const remixHandler = createCustomRequestHandler({
  build,
  mode: process.env.NODE_ENV,
});

export const handler = async (event, context) => {
  // Set environment variables that might be missing in Netlify runtime
  if (!process.env.SHOPIFY_APP_URL) {
    process.env.SHOPIFY_APP_URL = 'https://b1-bulk-product-seo-enhancer.netlify.app';
  }
  
  // Ensure NODE_ENV is set
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }

  // Log environment variables for debugging
  console.log('SHOPIFY_APP_URL:', process.env.SHOPIFY_APP_URL);
  console.log('NODE_ENV:', process.env.NODE_ENV);

  try {
    return await remixHandler(event, context);
  } catch (error) {
    console.error('Handler error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      input: error.input
    });
    
    // Log the event details that caused the error
    console.error('Event that caused error:', {
      rawUrl: event.rawUrl,
      path: event.path,
      httpMethod: event.httpMethod,
      headers: event.headers ? Object.keys(event.headers) : 'no headers'
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};