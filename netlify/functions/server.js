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

  try {
    return await remixHandler(event, context);
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};