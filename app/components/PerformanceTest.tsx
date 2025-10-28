import { useEffect, useState } from 'react';

export function PerformanceTest() {
  const [webVitalsStatus, setWebVitalsStatus] = useState<string>('Checking...');
  const [appBridgeStatus, setAppBridgeStatus] = useState<string>('Checking...');
  const [metricsReceived, setMetricsReceived] = useState<any[]>([]);

  useEffect(() => {
    // Check App Bridge status
    const checkAppBridge = () => {
      if (window.shopify) {
        setAppBridgeStatus('✅ App Bridge loaded');
        
        if (window.shopify.webVitals) {
          setWebVitalsStatus('✅ Web Vitals API available');
        } else {
          setWebVitalsStatus('❌ Web Vitals API not available');
        }
      } else {
        setAppBridgeStatus('❌ App Bridge not loaded');
        setWebVitalsStatus('❌ Web Vitals API not available');
      }
    };

    // Check immediately and after a delay
    checkAppBridge();
    const timeout = setTimeout(checkAppBridge, 2000);

    // Listen for Web Vitals metrics
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      if (args[0]?.includes?.('[Web Vitals] Received metrics:')) {
        setMetricsReceived(prev => [...prev, args[1]]);
      }
      originalConsoleLog(...args);
    };

    return () => {
      clearTimeout(timeout);
      console.log = originalConsoleLog;
    };
  }, []);

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px' }}>
      <h3>Performance Tracking Status</h3>
      <div>
        <strong>App Bridge Status:</strong> {appBridgeStatus}
      </div>
      <div>
        <strong>Web Vitals Status:</strong> {webVitalsStatus}
      </div>
      <div>
        <strong>Metrics Received:</strong> {metricsReceived.length}
      </div>
      {metricsReceived.length > 0 && (
        <div>
          <strong>Latest Metrics:</strong>
          <pre style={{ fontSize: '12px', background: '#f5f5f5', padding: '10px' }}>
            {JSON.stringify(metricsReceived[metricsReceived.length - 1], null, 2)}
          </pre>
        </div>
      )}
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        <p>This component helps verify that performance tracking is working correctly.</p>
        <p>Check the browser console for detailed Web Vitals logs.</p>
      </div>
    </div>
  );
}
