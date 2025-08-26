import createApp from "@shopify/app-bridge";
import { getSessionToken, authenticatedFetch } from "@shopify/app-bridge/utilities";

interface AppBridgeConfig {
  apiKey: string;
  host: string;
  forceRedirect?: boolean;
}

export class SessionTokenAuth {
  private app: any;
  private sessionToken: string | null = null;

  constructor(config: AppBridgeConfig) {
    this.app = createApp({
      apiKey: config.apiKey,
      host: config.host,
      forceRedirect: config.forceRedirect ?? true,
    });
  }

  /**
   * Get session token from Shopify App Bridge
   */
  async getSessionToken(): Promise<string> {
    if (this.sessionToken) {
      return this.sessionToken;
    }

    try {
      this.sessionToken = await getSessionToken(this.app);
      return this.sessionToken;
    } catch (error) {
      console.error("Failed to get session token:", error);
      throw new Error("Authentication failed - unable to get session token");
    }
  }

  /**
   * Create authenticated fetch function
   */
  getAuthenticatedFetch() {
    return authenticatedFetch(this.app);
  }

  /**
   * Create authenticated fetch with custom fetch wrapper
   */
  getAuthenticatedFetchWithOptions(customFetch?: typeof fetch) {
    return authenticatedFetch(this.app, customFetch);
  }

  /**
   * Make authenticated API request
   */
  async authenticatedRequest(url: string, options: RequestInit = {}) {
    const authFetch = this.getAuthenticatedFetch();
    return authFetch(url, options);
  }

  /**
   * Get the App Bridge instance
   */
  getApp() {
    return this.app;
  }

  /**
   * Clear cached session token (useful for logout/token refresh)
   */
  clearSessionToken() {
    this.sessionToken = null;
  }
}

// Global instance holder
let globalSessionTokenAuth: SessionTokenAuth | null = null;

/**
 * Initialize global session token authentication
 */
export function initializeSessionTokenAuth(config: AppBridgeConfig): SessionTokenAuth {
  globalSessionTokenAuth = new SessionTokenAuth(config);
  return globalSessionTokenAuth;
}

/**
 * Get global session token authentication instance
 */
export function getSessionTokenAuth(): SessionTokenAuth {
  if (!globalSessionTokenAuth) {
    throw new Error("Session token auth not initialized. Call initializeSessionTokenAuth first.");
  }
  return globalSessionTokenAuth;
}

/**
 * React hook for session token authentication
 */
export function useSessionTokenAuth() {
  return getSessionTokenAuth();
}

/**
 * Custom fetch wrapper that ensures proper headers and error handling
 */
export function createCustomFetch(options: {
  baseURL?: string;
  headers?: Record<string, string>;
  onError?: (error: any) => void;
} = {}) {
  return async (url: string, requestOptions: RequestInit = {}) => {
    const fullURL = options.baseURL ? `${options.baseURL}${url}` : url;
    
    const requestHeaders = {
      "Content-Type": "application/json",
      ...options.headers,
      ...requestOptions.headers,
    };

    try {
      const response = await fetch(fullURL, {
        ...requestOptions,
        headers: requestHeaders,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (options.onError) {
        options.onError(error);
      }
      throw error;
    }
  };
}