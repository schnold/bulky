import { AppProvider } from "@shopify/polaris";
import { useEffect, useState } from "react";

interface PolarisProviderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PolarisProvider({ children, fallback = null }: PolarisProviderProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // During SSR, return the fallback
  if (!isClient) {
    return <>{fallback}</>;
  }

  // On client, render with Polaris AppProvider
  return (
    <AppProvider i18n={{}}>
      {children}
    </AppProvider>
  );
}