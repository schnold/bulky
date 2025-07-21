import { createRequestHandler } from "@netlify/remix-adapter";
import * as build from "../../build/server/index.js";

// Validate environment variables at startup
function validateEnvironment() {
  const requiredEnvVars = ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.warn('Missing environment variables:', missing.join(', '));
  }
  
  // Ensure SHOPIFY_APP_URL is set
  if (!process.env.SHOPIFY_APP_URL) {
    process.env.SHOPIFY_APP_URL = 'https://b1-bulk-product-seo-enhancer.netlify.app';
    console.warn('SHOPIFY_APP_URL not set, using fallback:', process.env.SHOPIFY_APP_URL);
  }
  
  // Ensure NODE_ENV is set
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
    console.warn('NODE_ENV not set, using:', process.env.NODE_ENV);
  }
  
  console.log('Environment validation complete:');
  console.log('- SHOPIFY_APP_URL:', process.env.SHOPIFY_APP_URL);
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- Required env vars present:', requiredEnvVars.every(v => process.env[v]));
}

// Validate environment at startup
validateEnvironment();

// Function to completely sanitize and reconstruct the event object
function sanitizeEvent(event) {
  if (!event) {
    console.error('Event object is null or undefined');
    throw new Error('Event object is required');
  }

  // Extract headers safely
  const headers = event.headers || {};
  const host = headers.host || headers.Host || 'b1-bulk-product-seo-enhancer.netlify.app';
  const protocol = headers['x-forwarded-proto'] || headers['X-Forwarded-Proto'] || 'https';
  
  // Extract path safely
  const path = event.path || event.rawUrl?.split('?')[0] || '/';
  
  // Extract query safely
  const rawQuery = event.rawQuery || event.queryStringParameters ? 
    new URLSearchParams(event.queryStringParameters || {}).toString() : '';
  
  // Construct the full URL
  const query = rawQuery ? `?${rawQuery}` : '';
  const fullUrl = `${protocol}://${host}${path}${query}`;
  
  // Validate the constructed URL
  try {
    new URL(fullUrl);
  } catch (urlError) {
    console.error('Constructed URL is invalid:', fullUrl, 'Error:', urlError);
    // Use a hardcoded fallback if construction fails
    const fallbackUrl = 'https://b1-bulk-product-seo-enhancer.netlify.app/';
    console.log('Using hardcoded fallback URL:', fallbackUrl);
    return {
      ...event,
      rawUrl: fallbackUrl,
      path: '/',
      rawQuery: '',
      queryStringParameters: {},
      multiValueQueryStringParameters: {},
      headers: {
        ...headers,
        host: 'b1-bulk-product-seo-enhancer.netlify.app'
      },
      httpMethod: event.httpMethod || 'GET'
    };
  }

  // Return sanitized event object
  const sanitizedEvent = {
    ...event,
    rawUrl: fullUrl,
    path: path,
    rawQuery: rawQuery,
    queryStringParameters: event.queryStringParameters || {},
    multiValueQueryStringParameters: event.multiValueQueryStringParameters || {},
    headers: {
      ...headers,
      host: host
    },
    httpMethod: event.httpMethod || 'GET',
    isBase64Encoded: event.isBase64Encoded || false,
    body: event.body || null
  };

  console.log('Sanitized event URL properties:', {
    rawUrl: sanitizedEvent.rawUrl,
    path: sanitizedEvent.path,
    rawQuery: sanitizedEvent.rawQuery,
    httpMethod: sanitizedEvent.httpMethod,
    host: host,
    protocol: protocol
  });

  return sanitizedEvent;
}

// Create the base Remix handler
const baseRemixHandler = createRequestHandler({ 
  build, 
  mode: process.env.NODE_ENV 
});

export const handler = async (event, context) => {
  try {
    // Re-validate environment on each request in case of issues
    if (!process.env.SHOPIFY_APP_URL) {
      process.env.SHOPIFY_APP_URL = 'https://b1-bulk-product-seo-enhancer.netlify.app';
    }
    
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = 'production';
    }

    // Sanitize the event object before passing to Remix
    const sanitizedEvent = sanitizeEvent(event);
    
    // Call the base Remix handler with the sanitized event
    return await baseRemixHandler(sanitizedEvent, context);
    
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
      rawUrl: event?.rawUrl,
      path: event?.path,
      httpMethod: event?.httpMethod,
      headers: event?.headers ? Object.keys(event.headers) : 'no headers'
    });
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      })
    };
  }
};