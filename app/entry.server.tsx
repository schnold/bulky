import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import {
  createReadableStreamFromReadable,
  type EntryContext,
} from "@remix-run/node";
import { isbot } from "isbot";
import { addDocumentResponseHeaders } from "./shopify.server";
import { StrictMode } from "react";

export const streamTimeout = 5000;

// Helper function to ensure we have a valid URL
function ensureValidUrl(request: Request): string {
  const fallbackUrl = 'https://b1-bulk-product-seo-enhancer.netlify.app/';
  
  try {
    if (!request.url || request.url === 'undefined' || request.url === 'null') {
      console.warn('request.url is invalid, using fallback URL:', fallbackUrl);
      return fallbackUrl;
    }
    
    // Test if the URL is valid by creating a URL object
    new URL(request.url);
    return request.url;
  } catch (error) {
    console.error('Invalid request.url detected:', request.url, 'Error:', error);
    console.warn('Using fallback URL:', fallbackUrl);
    return fallbackUrl;
  }
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  try {
    addDocumentResponseHeaders(request, responseHeaders);
    const userAgent = request.headers.get("user-agent");
    const callbackName = isbot(userAgent ?? '')
      ? "onAllReady"
      : "onShellReady";

    // Ensure we have a valid URL for RemixServer
    const url = ensureValidUrl(request);

    return new Promise((resolve, reject) => {
      const { pipe, abort } = renderToPipeableStream(
        <StrictMode>
          <RemixServer
            context={remixContext}
            url={url}
          />
        </StrictMode>,
        {
          [callbackName]: () => {
            const body = new PassThrough();
            const stream = createReadableStreamFromReadable(body);

            responseHeaders.set("Content-Type", "text/html");
            resolve(
              new Response(stream, {
                headers: responseHeaders,
                status: responseStatusCode,
              })
            );
            pipe(body);
          },
          onShellError(error) {
            console.error('Shell error in entry.server:', error);
            reject(error);
          },
          onError(error) {
            responseStatusCode = 500;
            console.error('Render error in entry.server:', error);
          },
        }
      );

      // Automatically timeout the React renderer after 6 seconds, which ensures
      // React has enough time to flush down the rejected boundary contents
      setTimeout(abort, streamTimeout + 1000);
    });
  } catch (error) {
    console.error('Critical error in entry.server handleRequest:', error);
    // Return a basic error response
    return new Response('Internal Server Error', { 
      status: 500,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }
}
