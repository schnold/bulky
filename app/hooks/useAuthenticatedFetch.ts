import { useCallback } from "react";
import { useModernAppBridge } from "../components/ModernAppBridge";

interface UseAuthenticatedFetchOptions {
  onError?: (error: any) => void;
  baseURL?: string;
}

/**
 * Modern authenticated fetch hook using session tokens
 * 
 * With direct API access enabled in shopify.app.toml, fetch calls to Shopify's Admin API
 * are automatically authenticated using session tokens when using the shopify: protocol
 * or when making requests to your own backend that validates session tokens.
 * 
 * For calls to Shopify Admin API, use: fetch('shopify:admin/api/2025-01/graphql.json', ...)
 * For calls to your backend, the session token is automatically included in the Authorization header
 */
export function useAuthenticatedFetch(options: UseAuthenticatedFetchOptions = {}) {
  const { onError, baseURL } = options;
  const { shopify, isReady } = useModernAppBridge();

  /**
   * Get the current session token (ID token) from App Bridge
   */
  const getSessionToken = useCallback(async (): Promise<string> => {
    if (!isReady || !shopify) {
      throw new Error("App Bridge not ready");
    }

    try {
      const token = await shopify.idToken();
      return token;
    } catch (error) {
      console.error("[AUTH_FETCH] Failed to get session token:", error);
      throw new Error("Failed to obtain session token");
    }
  }, [shopify, isReady]);

  /**
   * Authenticated fetch for your app's backend endpoints
   * Automatically includes the session token in the Authorization header
   */
  const authenticatedFetch = useCallback(async (
    url: string, 
    requestOptions: RequestInit = {}
  ) => {
    try {
      // Get session token
      const token = await getSessionToken();
      
      const fullURL = baseURL ? `${baseURL}${url}` : url;
      
      const defaultHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      };

      const response = await fetch(fullURL, {
        ...requestOptions,
        headers: {
          ...defaultHeaders,
          ...requestOptions.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorData}`);
      }

      return response;
    } catch (error) {
      console.error("[AUTH_FETCH] Request failed:", error);
      if (onError) {
        onError(error);
      }
      throw error;
    }
  }, [baseURL, onError, getSessionToken]);

  /**
   * Direct API access to Shopify Admin GraphQL
   * Uses the shopify: protocol for automatic authentication
   */
  const shopifyGraphQL = useCallback(async (
    query: string,
    variables?: Record<string, any>
  ) => {
    try {
      const response = await fetch('shopify:admin/api/2025-01/graphql.json', {
        method: 'POST',
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`GraphQL request failed: ${response.status} - ${errorData}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
      }

      return result;
    } catch (error) {
      console.error("[SHOPIFY_GRAPHQL] Request failed:", error);
      if (onError) {
        onError(error);
      }
      throw error;
    }
  }, [onError]);

  const get = useCallback(async (url: string, options: RequestInit = {}) => {
    return authenticatedFetch(url, { ...options, method: "GET" });
  }, [authenticatedFetch]);

  const post = useCallback(async (url: string, data?: any, options: RequestInit = {}) => {
    return authenticatedFetch(url, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }, [authenticatedFetch]);

  const put = useCallback(async (url: string, data?: any, options: RequestInit = {}) => {
    return authenticatedFetch(url, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }, [authenticatedFetch]);

  const patch = useCallback(async (url: string, data?: any, options: RequestInit = {}) => {
    return authenticatedFetch(url, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }, [authenticatedFetch]);

  const del = useCallback(async (url: string, options: RequestInit = {}) => {
    return authenticatedFetch(url, { ...options, method: "DELETE" });
  }, [authenticatedFetch]);

  return {
    authenticatedFetch,
    get,
    post,
    put,
    patch,
    delete: del,
    getSessionToken,
    shopifyGraphQL, // Direct API access to Shopify Admin GraphQL
  };
}

export default useAuthenticatedFetch;