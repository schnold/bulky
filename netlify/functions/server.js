import { createRequestHandler } from "@netlify/remix-adapter";
import * as build from "../../build/server/index.js";

// Validate environment variables at startup with strict undefined checking
function validateEnvironment() {
  const requiredEnvVars = ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar] || process.env[envVar] === 'undefined');
  
  if (missing.length > 0) {
    console.warn('Missing or undefined environment variables:', missing.join(', '));
  }
  
  // Ensure SHOPIFY_APP_URL is set and not undefined
  if (!process.env.SHOPIFY_APP_URL || process.env.SHOPIFY_APP_URL === 'undefined') {
    process.env.SHOPIFY_APP_URL = 'https://b1-bulk-product-seo-enhancer.netlify.app';
    console.warn('SHOPIFY_APP_URL not set or undefined, using fallback:', process.env.SHOPIFY_APP_URL);
  }
  
  // Ensure NODE_ENV is set and not undefined
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'undefined') {
    process.env.NODE_ENV = 'production';
    console.warn('NODE_ENV not set or undefined, using:', process.env.NODE_ENV);
  }

  // Critical: Ensure no environment variable has the literal string 'undefined'
  // This is a common issue in serverless environments where build-time variables become 'undefined' strings
  Object.keys(process.env).forEach(key => {
    if (process.env[key] === 'undefined') {
      console.warn(`Environment variable ${key} is set to literal 'undefined', clearing it`);
      delete process.env[key];
    }
  });
  
  console.log('Environment validation complete:');
  console.log('- SHOPIFY_APP_URL:', process.env.SHOPIFY_APP_URL);
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- Required env vars present:', requiredEnvVars.every(v => process.env[v] && process.env[v] !== 'undefined'));
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

// Create the standard Netlify Remix handler with proper configuration
const remixHandler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV || 'production',
  // Provide context that ensures environment variables are available
  getLoadContext: () => ({
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL || 'https://b1-bulk-product-seo-enhancer.netlify.app',
    NODE_ENV: process.env.NODE_ENV || 'production',
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
  }),
});

export const handler = async (event, context) => {
  try {
    // Ensure ALL required environment variables are available for Remix runtime
    // This is critical for serverless environments where build-time env vars may not be available at runtime
    if (!process.env.SHOPIFY_APP_URL || process.env.SHOPIFY_APP_URL === 'undefined') {
      process.env.SHOPIFY_APP_URL = 'https://b1-bulk-product-seo-enhancer.netlify.app';
    }
    
    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'undefined') {
      process.env.NODE_ENV = 'production';
    }

    // Ensure these are also set if they exist in context but not in process.env
    if (context.SHOPIFY_API_KEY && !process.env.SHOPIFY_API_KEY) {
      process.env.SHOPIFY_API_KEY = context.SHOPIFY_API_KEY;
    }
    
    if (context.SHOPIFY_API_SECRET && !process.env.SHOPIFY_API_SECRET) {
      process.env.SHOPIFY_API_SECRET = context.SHOPIFY_API_SECRET;
    }

    // Additional debugging to help track down the undefined URL issue
    console.log('Runtime environment check:', {
      'SHOPIFY_APP_URL': process.env.SHOPIFY_APP_URL,
      'NODE_ENV': process.env.NODE_ENV,
      'SHOPIFY_API_KEY': process.env.SHOPIFY_API_KEY ? 'SET' : 'NOT SET',
      'event.url': event?.rawUrl || event?.path || 'undefined',
      'event.method': event?.httpMethod || 'undefined'
    });

    // Create a completely clean event object
    const cleanEvent = createCleanEvent(event);
    
    // Additional safety check: ensure the cleanEvent has all required properties
    // that Remix runtime expects to avoid the "Invalid URL" error
    if (!cleanEvent.rawUrl || cleanEvent.rawUrl === 'undefined') {
      console.warn('cleanEvent.rawUrl is invalid, using fallback');
      cleanEvent.rawUrl = 'https://b1-bulk-product-seo-enhancer.netlify.app/';
    }
    
    if (!cleanEvent.headers.host || cleanEvent.headers.host === 'undefined') {
      console.warn('cleanEvent.headers.host is invalid, using fallback');
      cleanEvent.headers.host = 'b1-bulk-product-seo-enhancer.netlify.app';
    }

    // Create an enhanced context object that includes environment variables
    const enhancedContext = {
      ...context,
      env: {
        SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL || 'https://b1-bulk-product-seo-enhancer.netlify.app',
        NODE_ENV: process.env.NODE_ENV || 'production',
        SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
        SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
      }
    };
    
    // Call the Netlify Remix handler with the clean event and enhanced context
    return await remixHandler(cleanEvent, enhancedContext);
    
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