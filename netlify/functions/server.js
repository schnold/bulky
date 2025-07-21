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

// Create a completely clean event object that the Netlify adapter can safely use
function createCleanEvent(originalEvent) {
  if (!originalEvent) {
    console.error('Event object is null or undefined');
    throw new Error('Event object is required');
  }

  // Extract headers safely
  const headers = originalEvent.headers || {};
  const host = headers.host || headers.Host || 'b1-bulk-product-seo-enhancer.netlify.app';
  const protocol = headers['x-forwarded-proto'] || headers['X-Forwarded-Proto'] || 'https';
  const path = originalEvent.path || '/';
  const method = originalEvent.httpMethod || 'GET';
  
  // Handle query parameters
  let queryString = '';
  let queryStringParameters = {};
  let multiValueQueryStringParameters = {};
  
  if (originalEvent.rawQuery) {
    queryString = originalEvent.rawQuery;
    // Parse rawQuery into queryStringParameters
    const searchParams = new URLSearchParams(originalEvent.rawQuery);
    for (const [key, value] of searchParams.entries()) {
      queryStringParameters[key] = value;
    }
  } else if (originalEvent.queryStringParameters) {
    queryStringParameters = originalEvent.queryStringParameters || {};
    queryString = new URLSearchParams(queryStringParameters).toString();
  }
  
  if (originalEvent.multiValueQueryStringParameters) {
    multiValueQueryStringParameters = originalEvent.multiValueQueryStringParameters;
  }
  
  // Construct the full URL
  const fullUrl = `${protocol}://${host}${path}${queryString ? `?${queryString}` : ''}`;
  
  // Validate the URL
  try {
    new URL(fullUrl);
  } catch (urlError) {
    console.error('Constructed URL is invalid:', fullUrl, 'Error:', urlError);
    // If we can't construct a valid URL, use the fallback
    const fallbackUrl = 'https://b1-bulk-product-seo-enhancer.netlify.app/';
    console.log('Using fallback URL:', fallbackUrl);
    
    return {
      version: '2.0',
      routeKey: '$default',
      rawPath: '/',
      rawQueryString: '',
      headers: {
        host: 'b1-bulk-product-seo-enhancer.netlify.app',
        'x-forwarded-proto': 'https',
        ...headers
      },
      queryStringParameters: {},
      multiValueQueryStringParameters: {},
      pathParameters: {},
      stageVariables: {},
      body: originalEvent.body || null,
      isBase64Encoded: originalEvent.isBase64Encoded || false,
      requestContext: originalEvent.requestContext || {
        accountId: 'netlify',
        apiId: 'netlify',
        stage: 'prod',
        requestId: 'netlify-request',
        http: {
          method: method,
          path: '/',
          protocol: 'HTTP/1.1',
          sourceIp: '0.0.0.0'
        }
      },
      // Properties used by Netlify adapter
      path: '/',
      httpMethod: method,
      rawUrl: fallbackUrl
    };
  }

  // Create a clean event object with all required properties
  const cleanEvent = {
    version: originalEvent.version || '2.0',
    routeKey: originalEvent.routeKey || '$default',
    rawPath: path,
    rawQueryString: queryString,
    headers: {
      host: host,
      'x-forwarded-proto': protocol,
      ...headers
    },
    queryStringParameters: queryStringParameters,
    multiValueQueryStringParameters: multiValueQueryStringParameters,
    pathParameters: originalEvent.pathParameters || {},
    stageVariables: originalEvent.stageVariables || {},
    body: originalEvent.body || null,
    isBase64Encoded: originalEvent.isBase64Encoded || false,
    requestContext: originalEvent.requestContext || {
      accountId: 'netlify',
      apiId: 'netlify',
      stage: 'prod',
      requestId: 'netlify-request',
      http: {
        method: method,
        path: path,
        protocol: 'HTTP/1.1',
        sourceIp: '0.0.0.0'
      }
    },
    // Properties used by Netlify adapter
    path: path,
    httpMethod: method,
    rawUrl: fullUrl
  };

  console.log('Created clean event with URL:', cleanEvent.rawUrl);
  console.log('Event properties:', {
    path: cleanEvent.path,
    httpMethod: cleanEvent.httpMethod,
    host: cleanEvent.headers.host,
    queryString: cleanEvent.rawQueryString
  });

  return cleanEvent;
}

// Create the standard Netlify Remix handler
const remixHandler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV,
});

export const handler = async (event, context) => {
  try {
    // Re-validate environment on each request
    if (!process.env.SHOPIFY_APP_URL) {
      process.env.SHOPIFY_APP_URL = 'https://b1-bulk-product-seo-enhancer.netlify.app';
    }
    
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = 'production';
    }

    // Create a completely clean event object
    const cleanEvent = createCleanEvent(event);
    
    // Call the Netlify Remix handler with the clean event
    return await remixHandler(cleanEvent, context);
    
  } catch (error) {
    console.error('Handler error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      input: error.input
    });
    
    // Log the event details that caused the error
    console.error('Original event that caused error:', {
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