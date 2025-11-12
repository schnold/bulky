import { useCallback, useRef } from "react";
import { useModernAppBridge } from "../components/ModernAppBridge";

interface UseAuthenticatedFetchOptions {
  onError?: (error: any) => void;
  baseURL?: string;
}

interface TokenCache {
  token: string;
  expiresAt: number; // Timestamp when token expires
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
 *
 * TOKEN CACHING: Session tokens have a 1-minute lifetime per Shopify documentation.
 * This hook caches tokens for 50 seconds (safe margin) to reduce redundant requests
 * while ensuring tokens are always fresh.
 */
export function useAuthenticatedFetch(options: UseAuthenticatedFetchOptions = {}) {
  const { onError, baseURL } = options;
  const { shopify, isReady } = useModernAppBridge();

  // Token cache with 50-second TTL (10-second safety margin before 1-minute expiry)
  const tokenCache = useRef<TokenCache | null>(null);

  /**
   * Get the current session token (ID token) from App Bridge
   * Implements smart caching with 50-second TTL
   */
  const getSessionToken = useCallback(async (forceRefresh = false): Promise<string> => {
    if (!isReady || !shopify) {
      throw new Error("App Bridge not ready");
    }

    // Check cache validity (50-second TTL)
    const now = Date.now();
    if (!forceRefresh && tokenCache.current && tokenCache.current.expiresAt > now) {
      console.log("[AUTH_FETCH] Using cached session token");
      return tokenCache.current.token;
    }

    try {
      console.log("[AUTH_FETCH] Fetching fresh session token");
      const token = await shopify.idToken();

      // Cache token with 50-second TTL (10-second safety margin)
      tokenCache.current = {
        token,
        expiresAt: now + 50000, // 50 seconds
      };

      return token;
    } catch (error) {
      console.error("[AUTH_FETCH] Failed to get session token:", error);
      throw new Error("Failed to obtain session token");
    }
  }, [shopify, isReady]);

  /**
   * Authenticated fetch for your app's backend endpoints
   * Automatically includes the session token in the Authorization header
   * Implements automatic retry with token refresh on 401 errors
   */
  const authenticatedFetch = useCallback(async (
    url: string,
    requestOptions: RequestInit = {},
    isRetry = false
  ) => {
    try {
      // Get session token (force refresh if this is a retry)
      const token = await getSessionToken(isRetry);

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

      // Handle 401 Unauthorized - token may have expired
      if (response.status === 401 && !isRetry) {
        console.warn("[AUTH_FETCH] 401 Unauthorized - retrying with fresh token");

        // Retry once with a fresh token
        return authenticatedFetch(url, requestOptions, true);
      }

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
   * API version: 2025-04 (latest stable)
   */
  const shopifyGraphQL = useCallback(async (
    query: string,
    variables?: Record<string, any>
  ) => {
    try {
      const response = await fetch('shopify:admin/api/2025-04/graphql.json', {
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