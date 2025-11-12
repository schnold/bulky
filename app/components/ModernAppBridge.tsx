/**
 * Modern App Bridge utilities and re-exports
 *
 * This file provides a centralized location for App Bridge functionality.
 * It uses the official @shopify/app-bridge-react hooks and utilities.
 *
 * Note: AppProvider from @shopify/shopify-app-remix already initializes App Bridge,
 * so no custom provider is needed.
 */

import { useAppBridge } from '@shopify/app-bridge-react';
import { useCallback } from 'react';

/**
 * Hook to access the App Bridge instance
 * This replaces the old useModernAppBridge hook
 */
export function useModernAppBridge() {
  const app = useAppBridge();

  return {
    shopify: typeof window !== 'undefined' ? window.shopify : null,
    isReady: !!app,
    app, // The official App Bridge instance
  };
}

/**
 * Hook to show toast notifications using App Bridge
 */
export function useToast() {
  const { shopify } = useModernAppBridge();

  const show = useCallback((message: string, options?: { isError?: boolean; duration?: number }) => {
    if (!shopify) {
      console.warn('[Toast] App Bridge not ready');
      return;
    }

    try {
      shopify.toast?.show(message, {
        duration: options?.duration || 5000,
        isError: options?.isError || false,
      });
    } catch (error) {
      console.error('[Toast] Error showing toast:', error);
    }
  }, [shopify]);

  return { show };
}

/**
 * Hook to access the resource picker
 */
export function useResourcePicker() {
  const { shopify } = useModernAppBridge();

  const open = useCallback(async (options: { type: 'product' | 'collection'; multiple?: boolean }) => {
    if (!shopify || !shopify.resourcePicker) {
      throw new Error('Resource picker not available');
    }

    return await shopify.resourcePicker({
      type: options.type,
      multiple: options.multiple !== false,
    });
  }, [shopify]);

  return { open };
}

/**
 * Hook for modal actions
 */
export function useModal() {
  const { shopify } = useModernAppBridge();

  const show = useCallback((options: {
    title?: string;
    message: string;
    primaryAction?: { content: string; onAction: () => void };
    secondaryAction?: { content: string; onAction: () => void };
  }) => {
    if (!shopify || !shopify.modal) {
      console.warn('[Modal] App Bridge not ready');
      return;
    }

    try {
      shopify.modal.show(options.message, {
        title: options.title,
      });
    } catch (error) {
      console.error('[Modal] Error showing modal:', error);
    }
  }, [shopify]);

  return { show };
}

// Re-export official App Bridge React hooks and components
export { useAppBridge } from '@shopify/app-bridge-react';

// Add type declaration for the shopify global variable
declare global {
  interface Window {
    shopify?: {
      webVitals?: {
        onReport: (cb: (metrics: any) => void) => void;
      };
      toast?: {
        show: (message: string, options?: { duration?: number; isError?: boolean }) => void;
      };
      modal?: {
        show: (message: string, options?: { title?: string }) => void;
      };
      resourcePicker?: (options: { type: string; multiple?: boolean }) => Promise<any>;
      config?: {
        apiKey?: string;
        host?: string;
        locale?: string;
        sessionToken?: string;
        shop?: string;
      };
      idToken?: () => Promise<string>;
      environment?: {
        embedded: boolean;
        mobile: boolean;
        pos: boolean;
      };
    };
  }
}

