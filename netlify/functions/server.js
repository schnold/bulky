import { createRequestHandler } from "@netlify/remix-adapter";
import * as build from "../../build/server/index.js";

const remixHandler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV,
});

export const handler = async (event, context) => {
  // Debug logging
  console.log('Netlify event:', JSON.stringify(event, null, 2));
  
  // Ensure we have a valid URL
  if (!event.rawUrl && !event.path) {
    console.error('No URL found in event');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No URL provided' })
    };
  }

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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};