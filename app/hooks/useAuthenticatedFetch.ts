import { useCallback, useRef } from "react";
import { getSessionTokenAuth } from "../utils/session-token";

interface UseAuthenticatedFetchOptions {
  onError?: (error: any) => void;
  baseURL?: string;
}

export function useAuthenticatedFetch(options: UseAuthenticatedFetchOptions = {}) {
  const { onError, baseURL } = options;
  const sessionTokenAuthRef = useRef(getSessionTokenAuth());

  const authenticatedFetch = useCallback(async (
    url: string, 
    requestOptions: RequestInit = {}
  ) => {
    try {
      const sessionTokenAuth = sessionTokenAuthRef.current;
      const authFetch = sessionTokenAuth.getAuthenticatedFetch();
      
      const fullURL = baseURL ? `${baseURL}${url}` : url;
      
      const defaultHeaders = {
        "Content-Type": "application/json",
      };

      const response = await authFetch(fullURL, {
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
  }, [baseURL, onError]);

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

  const getSessionToken = useCallback(async () => {
    try {
      const sessionTokenAuth = sessionTokenAuthRef.current;
      return await sessionTokenAuth.getSessionToken();
    } catch (error) {
      console.error("[AUTH_FETCH] Failed to get session token:", error);
      throw error;
    }
  }, []);

  return {
    authenticatedFetch,
    get,
    post,
    put,
    patch,
    delete: del,
    getSessionToken,
  };
}

export default useAuthenticatedFetch;