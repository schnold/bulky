import { createContext, useContext, useMemo } from 'react';

interface SessionContextType {
  shop: string;
  host: string | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children, shop, host }: { children: React.ReactNode; shop: string; host: string | null; }) {
  const value = useMemo(() => ({ shop, host }), [shop, host]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

