import type { EntryContext } from "@remix-run/node";
import { createReadableStreamFromReadable } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { PassThrough } from "stream";
import { StrictMode } from "react";
import { addDocumentResponseHeaders } from "./shopify.server";

import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";
import i18n from "./i18n"; // your i18n configuration file
import i18nextServer from "./i18next.server";
import { resolve } from "node:path";

export const streamTimeout = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  addDocumentResponseHeaders(request, responseHeaders);

  const instance = createInstance();
  const lng = await i18nextServer.getLocale(request);
  const ns = i18nextServer.getRouteNamespaces(remixContext);

  await instance
    .use(initReactI18next) // Tell our instance to use react-i18next
    .use(Backend) // Setup our backend
    .init({
      ...i18n, // spread the configuration
      lng, // The locale we detected above
      ns, // The namespaces the routes about to render wants
      backend: { loadPath: resolve("./public/locales/{{lng}}/{{ns}}.json") },
    });

  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? '')
    ? "onAllReady"
    : "onShellReady";

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <I18nextProvider i18n={instance}>
        <StrictMode>
          <RemixServer
            context={remixContext}
            url={request.url}
          />
        </StrictMode>
      </I18nextProvider>,
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
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        },
      }
    );

    setTimeout(abort, streamTimeout + 1000);
  });
}

// This function is now imported from shopify.server.ts
// The addDocumentResponseHeaders function from Shopify handles iframe protection
