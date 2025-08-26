import { useState, useCallback } from "react";
import { Button, Card, TextContainer, Banner, BlockStack, Spinner } from "@shopify/polaris";
import useAuthenticatedFetch from "../hooks/useAuthenticatedFetch";

interface SessionInfo {
  authenticated: boolean;
  shop?: string;
  userId?: string;
  timestamp?: string;
  error?: string;
}

export function SessionTokenTester() {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { get, post, getSessionToken } = useAuthenticatedFetch({
    onError: (err) => {
      setError(err.message);
      setLoading(false);
    },
  });

  const testSessionInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await get("/api/session-info");
      const data = await response.json();
      setSessionInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch session info");
    } finally {
      setLoading(false);
    }
  }, [get]);

  const testAuthenticatedPost = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await post("/api/session-info", {
        message: "Hello from authenticated client!",
        timestamp: new Date().toISOString(),
      });
      const data = await response.json();
      setSessionInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to make authenticated request");
    } finally {
      setLoading(false);
    }
  }, [post]);

  const testRawSessionToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = await getSessionToken();
      setSessionInfo({
        authenticated: true,
        shop: "Token retrieved successfully",
        userId: token.substring(0, 20) + "...", // Show first 20 chars
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get session token");
    } finally {
      setLoading(false);
    }
  }, [getSessionToken]);

  return (
    <Card>
      <BlockStack gap="500">
        <TextContainer>
          <h2>Session Token Authentication Test</h2>
          <p>Test the session token authentication implementation.</p>
        </TextContainer>

        <BlockStack gap="300">
          <Button 
            variant="primary"
            loading={loading} 
            onClick={testSessionInfo}
            disabled={loading}
          >
            Test Session Info (GET)
          </Button>
          
          <Button 
            loading={loading} 
            onClick={testAuthenticatedPost}
            disabled={loading}
          >
            Test Authenticated POST
          </Button>
          
          <Button 
            loading={loading} 
            onClick={testRawSessionToken}
            disabled={loading}
          >
            Get Raw Session Token
          </Button>
        </BlockStack>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Spinner size="small" />
            <span>Making authenticated request...</span>
          </div>
        )}

        {error && (
          <Banner tone="critical" title="Authentication Error">
            <p>{error}</p>
          </Banner>
        )}

        {sessionInfo && !error && (
          <Card>
            <BlockStack gap="300">
              <h3>Session Information</h3>
              {sessionInfo.authenticated ? (
                <Banner tone="success" title="Authentication Successful">
                  <BlockStack gap="200">
                    {sessionInfo.shop && <p><strong>Shop:</strong> {sessionInfo.shop}</p>}
                    {sessionInfo.userId && <p><strong>User ID:</strong> {sessionInfo.userId}</p>}
                    {sessionInfo.timestamp && <p><strong>Timestamp:</strong> {sessionInfo.timestamp}</p>}
                  </BlockStack>
                </Banner>
              ) : (
                <Banner tone="warning" title="Authentication Failed">
                  <p>{sessionInfo.error || "Unknown authentication error"}</p>
                </Banner>
              )}
              
              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                  Raw Response Data
                </summary>
                <pre style={{ 
                  background: '#f6f6f7', 
                  padding: '12px', 
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '12px'
                }}>
                  {JSON.stringify(sessionInfo, null, 2)}
                </pre>
              </details>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Card>
  );
}