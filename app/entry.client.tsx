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