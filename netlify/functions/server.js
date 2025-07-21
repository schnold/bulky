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

// Custom request handler that fixes URL issues
const createCustomRequestHandler = ({ build, mode }) => {
  const baseHandler = createRequestHandler({ build, mode });
  
  return async (event, context) => {
    try {
      // Validate the incoming event
      if (!event) {
        throw new Error('Event object is undefined');
      }
      
      const host = event.headers?.host || 'b1-bulk-product-seo-enhancer.netlify.app';
      const protocol = event.headers?.['x-forwarded-proto'] || 'https';
      const path = event.path || '/';
      const query = event.rawQuery ? `?${event.rawQuery}` : '';
      
      // Construct the full URL if rawUrl is missing or undefined
      const constructedUrl = `${protocol}://${host}${path}${query}`;
      
      // Ensure rawUrl is always defined
      if (!event.rawUrl || event.rawUrl === 'undefined' || event.rawUrl === 'null') {
        event.rawUrl = constructedUrl;
      }
      
      // Ensure all URL-related properties are defined and valid
      event.path = path;
      event.rawQuery = event.rawQuery || '';
      event.queryStringParameters = event.queryStringParameters || {};
      event.multiValueQueryStringParameters = event.multiValueQueryStringParameters || {};
      event.headers = event.headers || {};
      
      // Ensure httpMethod is set
      event.httpMethod = event.httpMethod || 'GET';
      
      // Log the processed event properties for debugging
      console.log('Processed event URL properties:', {
        rawUrl: event.rawUrl,
        path: event.path,
        rawQuery: event.rawQuery,
        httpMethod: event.httpMethod,
        host: host,
        protocol: protocol
      });
      
      // Validate that rawUrl is a proper URL before proceeding
      try {
        new URL(event.rawUrl);
      } catch (urlError) {
        console.error('Invalid URL detected, using fallback:', event.rawUrl, 'Error:', urlError);
        event.rawUrl = constructedUrl;
        console.log('Using fallback URL:', event.rawUrl);
        
        // Test the fallback URL too
        try {
          new URL(event.rawUrl);
        } catch (fallbackError) {
          console.error('Even fallback URL is invalid:', event.rawUrl, 'Error:', fallbackError);
          // Use a hardcoded fallback as last resort
          event.rawUrl = 'https://b1-bulk-product-seo-enhancer.netlify.app/';
          console.log('Using hardcoded fallback URL:', event.rawUrl);
        }
      }
      
      return await baseHandler(event, context);
    } catch (error) {
      console.error('Error in custom request handler:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Internal server error',
          message: error.message,
          timestamp: new Date().toISOString()
        })
      };
    }
  };
};

const remixHandler = createCustomRequestHandler({
  build,
  mode: process.env.NODE_ENV,
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