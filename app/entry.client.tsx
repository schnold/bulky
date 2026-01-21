import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { RemixBrowser } from "@remix-run/react";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";
import { getInitialNamespaces } from "remix-i18next/client";
import i18n from "./i18n"; // your i18n configuration file

async function hydrate() {
  await i18next
    .use(initReactI18next) // Tell i18next to use the react-i18next plugin
    .use(LanguageDetector) // Setup a client-side language detector
    .use(Backend) // Setup your backend
    .init({
      ...i18n, // spread the configuration
      // This function detects the namespaces your routes rendered server-side used
      ns: getInitialNamespaces(),
      backend: { loadPath: "/locales/{{lng}}/{{ns}}.json" },
      detection: {
        // Here only enable htmlTag detection, we'll detect the language only
        // server-side with remix-i18next, then the server will add the
        // lang attribute to the html tag and i18next will use it here
        order: ["htmlTag"],
        // Because we only use htmlTag, there's no need to cache the language in
        // cookies or localStorage, so we can disable it
        caches: [],
      },
    });

  startTransition(() => {
    hydrateRoot(
      document,
      <I18nextProvider i18n={i18next}>
        <StrictMode>
          <RemixBrowser />
        </StrictMode>
      </I18nextProvider>
    );
  });
}

if (window.requestIdleCallback) {
  window.requestIdleCallback(hydrate);
} else {
  // Safari doesn't support requestIdleCallback
  // https://caniuse.com/requestidlecallback
  window.setTimeout(hydrate, 1);
}

// Enhanced Web Vitals monitoring with proper App Bridge integration

// Wait for App Bridge to be fully loaded before registering Web Vitals
function initializeWebVitals() {
  const maxRetries = 50; // 5 seconds max wait time
  let retryCount = 0;

  function checkAndRegister() {
    if (window?.shopify?.webVitals?.onReport) {
      try {
        console.log('[Web Vitals] Registering performance monitoring callback');

        window.shopify.webVitals.onReport((metrics: any) => {
          console.log('[Web Vitals] Received metrics:', metrics);

          const monitorUrl = "/web-vitals-metrics";
          const data = JSON.stringify(metrics);

          if (navigator.sendBeacon) {
            const success = navigator.sendBeacon(monitorUrl, data);
            console.log('[Web Vitals] Beacon sent:', success);
          } else {
            // Fallback to fetch if sendBeacon is not available
            fetch(monitorUrl, {
              method: 'POST',
              body: data,
              headers: {
                'Content-Type': 'application/json',
              },
              keepalive: true
            }).then(response => {
              console.log('[Web Vitals] Fetch response:', response.status);
            }).catch(error => {
              console.error('[Web Vitals] Fetch error:', error);
            });
          }
        });

        console.log('[Web Vitals] Successfully registered callback');
        return;
      } catch (error) {
        console.error('[Web Vitals] Error registering callback:', error);
      }
    }

    retryCount++;
    if (retryCount < maxRetries) {
      setTimeout(checkAndRegister, 100);
    } else {
      console.warn('[Web Vitals] Failed to register callback after maximum retries');
    }
  }

  // Start checking after a short delay to ensure App Bridge is loaded
  setTimeout(checkAndRegister, 100);
}

// Initialize Web Vitals monitoring
initializeWebVitals();