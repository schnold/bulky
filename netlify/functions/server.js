import { createRequestHandler } from "@netlify/remix-adapter";
import * as build from "../../build/server/index.js";

const remixHandler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV,
});

export const handler = async (event, context) => {
  // Debug logging
  console.log('Netlify event:', JSON.stringify(event, null, 2));
  
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

  // Ensure we have a valid URL and construct it properly if needed
  if (!event.rawUrl && !event.path) {
    console.error('No URL found in event');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No URL provided' })
    };
  }

  // Fix for Netlify adapter URL construction issue
  if (!event.rawUrl && event.path) {
    const host = event.headers.host || 'b1-bulk-product-seo-enhancer.netlify.app';
    const protocol = event.headers['x-forwarded-proto'] || 'https';
    const query = event.rawQuery ? `?${event.rawQuery}` : '';
    event.rawUrl = `${protocol}://${host}${event.path}${query}`;
    console.log('Constructed rawUrl:', event.rawUrl);
  }

  console.log('Final event.rawUrl:', event.rawUrl);

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
      headers: event.headers
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};