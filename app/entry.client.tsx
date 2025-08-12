import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});

// Monitor Web Vitals from App Bridge if available
declare global {
  interface Window {
    shopify?: {
      webVitals?: {
        onReport: (cb: (metrics: any) => void) => void;
      };
    };
  }
}

if (window?.shopify?.webVitals?.onReport) {
  try {
    window.shopify.webVitals.onReport((metrics: any) => {
      const monitorUrl = "/web-vitals-metrics";
      const data = JSON.stringify(metrics);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(monitorUrl, data);
      }
    });
  } catch {}
}