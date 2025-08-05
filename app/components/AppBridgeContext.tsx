import { createContext, useContext, useMemo } from 'react';
import { useSearchParams } from '@remix-run/react';

interface AppBridgeContextType {
  host: string | null;
}

const AppBridgeContext = createContext<AppBridgeContextType | undefined>(undefined);

export function AppBridgeProvider({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams();
  const host = searchParams.get('host');

  const value = useMemo(() => ({ host }), [host]);

  return (
    <AppBridgeContext.Provider value={value}>
      {children}
    </AppBridgeContext.Provider>
  );
}

export function useAppBridge() {
  const context = useContext(AppBridgeContext);
  if (context === undefined) {
    throw new Error('useAppBridge must be used within an AppBridgeProvider');
  }
  return context;
}

