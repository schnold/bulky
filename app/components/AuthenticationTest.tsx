import { useState, useEffect } from "react";
import { Card, BlockStack, Text, Button, Badge, Box, InlineStack, Divider } from "@shopify/polaris";
import { useModernAppBridge, useToast } from "./ModernAppBridge";
import { useAuthenticatedFetch } from "../hooks/useAuthenticatedFetch";

/**
 * Authentication Test Component
 * 
 * This component tests the modern App Bridge and session token authentication.
 * Use this to verify that:
 * 1. App Bridge is loaded and ready
 * 2. Session tokens can be obtained
 * 3. Authenticated requests work properly
 */
export function AuthenticationTest() {
  const { shopify, isReady } = useModernAppBridge();
  const { getSessionToken, shopifyGraphQL } = useAuthenticatedFetch();
  const toast = useToast();

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [shopInfo, setShopInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check App Bridge on mount
  useEffect(() => {
    if (isReady && shopify) {
      console.log("✅ App Bridge loaded successfully");
      console.log("App Bridge config:", shopify.config);
    }
  }, [isReady, shopify]);

  const handleGetSessionToken = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = await getSessionToken();
      setSessionToken(token);
      console.log("✅ Session token obtained:", token.substring(0, 50) + "...");
      toast.show("Session token obtained successfully!", { isError: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get session token";
      setError(errorMessage);
      console.error("❌ Failed to get session token:", err);
      toast.show(errorMessage, { isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestDirectAPI = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await shopifyGraphQL(`
        query {
          shop {
            name
            email
            plan {
              displayName
            }
          }
        }
      `);
      
      setShopInfo(result.data.shop);
      console.log("✅ Direct API access successful:", result);
      toast.show("Direct API access successful!", { isError: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Direct API access failed";
      setError(errorMessage);
      console.error("❌ Direct API access failed:", err);
      toast.show(errorMessage, { isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestToast = () => {
    toast.show("Test toast notification! 🎉", { isError: false });
  };

  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h2">
          🧪 Authentication & App Bridge Test
        </Text>

        <Divider />

        {/* App Bridge Status */}
        <Box>
          <InlineStack gap="200" align="space-between">
            <Text variant="bodyMd" as="p">App Bridge Status:</Text>
            {isReady ? (
              <Badge tone="success">Ready ✅</Badge>
            ) : (
              <Badge tone="warning">Loading...</Badge>
            )}
          </InlineStack>
        </Box>

        {isReady && shopify && (
          <Box padding="300" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="200">
              <Text variant="bodyMd" fontWeight="semibold" as="p">App Bridge Config:</Text>
              <Text variant="bodySm" tone="subdued" as="p">
                API Key: {shopify.config?.apiKey ? "✅ Set" : "❌ Missing"}
              </Text>
              <Text variant="bodySm" tone="subdued" as="p">
                Host: {shopify.config?.host ? "✅ Set" : "❌ Missing"}
              </Text>
              <Text variant="bodySm" tone="subdued" as="p">
                Embedded: {shopify.environment?.embedded ? "✅ Yes" : "❌ No"}
              </Text>
            </BlockStack>
          </Box>
        )}

        <Divider />

        {/* Session Token Test */}
        <BlockStack gap="300">
          <Text variant="headingSm" as="h3">1. Session Token Test</Text>
          <Button
            onClick={handleGetSessionToken}
            loading={isLoading}
            disabled={!isReady}
          >
            Get Session Token
          </Button>
          
          {sessionToken && (
            <Box padding="300" background="bg-surface-success-subdued" borderRadius="200">
              <BlockStack gap="200">
                <Text variant="bodyMd" fontWeight="semibold" as="p">✅ Session Token Obtained</Text>
                <Text variant="bodySm" tone="subdued" as="p" breakWord>
                  {sessionToken.substring(0, 100)}...
                </Text>
              </BlockStack>
            </Box>
          )}
        </BlockStack>

        <Divider />

        {/* Direct API Test */}
        <BlockStack gap="300">
          <Text variant="headingSm" as="h3">2. Direct API Access Test</Text>
          <Button
            onClick={handleTestDirectAPI}
            loading={isLoading}
            disabled={!isReady}
            variant="primary"
          >
            Test Shopify GraphQL API
          </Button>
          
          {shopInfo && (
            <Box padding="300" background="bg-surface-success-subdued" borderRadius="200">
              <BlockStack gap="200">
                <Text variant="bodyMd" fontWeight="semibold" as="p">✅ Shop Information Retrieved</Text>
                <Text variant="bodySm" as="p">
                  <strong>Shop Name:</strong> {shopInfo.name}
                </Text>
                <Text variant="bodySm" as="p">
                  <strong>Email:</strong> {shopInfo.email}
                </Text>
                <Text variant="bodySm" as="p">
                  <strong>Plan:</strong> {shopInfo.plan?.displayName}
                </Text>
              </BlockStack>
            </Box>
          )}
        </BlockStack>

        <Divider />

        {/* Toast Test */}
        <BlockStack gap="300">
          <Text variant="headingSm" as="h3">3. Toast Notification Test</Text>
          <Button
            onClick={handleTestToast}
            disabled={!isReady}
          >
            Show Test Toast
          </Button>
        </BlockStack>

        {/* Error Display */}
        {error && (
          <>
            <Divider />
            <Box padding="300" background="bg-surface-critical-subdued" borderRadius="200">
              <BlockStack gap="200">
                <Text variant="bodyMd" fontWeight="semibold" tone="critical" as="p">
                  ❌ Error
                </Text>
                <Text variant="bodySm" tone="critical" as="p">
                  {error}
                </Text>
              </BlockStack>
            </Box>
          </>
        )}

        <Divider />

        <Box padding="300" background="bg-surface-info-subdued" borderRadius="200">
          <Text variant="bodySm" tone="subdued" as="p">
            ℹ️ All tests should pass if the modern App Bridge and session token authentication are properly configured.
            Check the browser console for detailed logs.
          </Text>
        </Box>
      </BlockStack>
    </Card>
  );
}

