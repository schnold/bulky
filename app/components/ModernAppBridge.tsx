import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Modern App Bridge Context using the global shopify variable
 * This replaces the old createApp approach with the CDN-based App Bridge
 */

interface ModernAppBridgeContextType {
  shopify: typeof window.shopify | null;
  isReady: boolean;
}

const ModernAppBridgeContext = createContext<ModernAppBridgeContextType>({
  shopify: null,
  isReady: false,
});

export function ModernAppBridgeProvider({ children }: { children: React.ReactNode }) {
  const [shopify, setShopify] = useState<typeof window.shopify | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Wait for the global shopify variable to be available
    const checkShopify = () => {
      if (typeof window !== 'undefined' && window.shopify) {
        setShopify(window.shopify);
        setIsReady(true);
        console.log('[Modern App Bridge] Shopify global variable ready');
      } else {
        // Retry after a short delay if not available yet
        setTimeout(checkShopify, 100);
      }
    };

    checkShopify();
  }, []);

  return (
    <ModernAppBridgeContext.Provider value={{ shopify, isReady }}>
      {children}
    </ModernAppBridgeContext.Provider>
  );
}

/**
 * Hook to access the modern App Bridge shopify global variable
 */
export function useModernAppBridge() {
  const context = useContext(ModernAppBridgeContext);
  if (!context) {
    throw new Error('useModernAppBridge must be used within ModernAppBridgeProvider');
  }
  return context;
}

/**
 * Hook to show toast notifications using modern App Bridge
 */
export function useToast() {
  const { shopify, isReady } = useModernAppBridge();

  const show = (message: string, options?: { isError?: boolean; duration?: number }) => {
    if (!isReady || !shopify) {
      console.warn('[Toast] App Bridge not ready');
      return;
    }

    shopify.toast.show(message, {
      duration: options?.duration || 5000,
      isError: options?.isError || false,
    });
  };

  return { show };
}

/**
 * Hook to access the resource picker
 */
export function useResourcePicker() {
  const { shopify, isReady } = useModernAppBridge();

  const open = async (options: { type: 'product' | 'collection'; multiple?: boolean }) => {
    if (!isReady || !shopify) {
      throw new Error('App Bridge not ready');
    }

    return await shopify.resourcePicker({
      type: options.type,
      multiple: options.multiple !== false,
    });
  };

  return { open };
}

/**
 * Hook for modal actions
 */
export function useModal() {
  const { shopify, isReady } = useModernAppBridge();

  const show = (options: { 
    title?: string; 
    message: string;
    primaryAction?: { content: string; onAction: () => void };
    secondaryAction?: { content: string; onAction: () => void };
  }) => {
    if (!isReady || !shopify) {
      console.warn('[Modal] App Bridge not ready');
      return;
    }

    shopify.modal.show(options.message, {
      title: options.title,
    });
  };

  return { show };
}

// Add type declaration for the shopify global variable
declare global {
  interface Window {
    shopify: {
      toast: {
        show: (message: string, options?: { duration?: number; isError?: boolean }) => void;
      };
      modal: {
        show: (message: string, options?: { title?: string }) => void;
      };
      resourcePicker: (options: { type: string; multiple?: boolean }) => Promise<any>;
      config: {
        apiKey: string;
        host: string;
        locale: string;
        sessionToken?: string;
      };
      idToken: () => Promise<string>;
      environment: {
        embedded: boolean;
        mobile: boolean;
        pos: boolean;
      };
    };
  }
}

