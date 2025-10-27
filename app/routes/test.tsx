import { Page, Card, Text, Button, BlockStack, InlineStack } from "@shopify/polaris";
import { AuthenticationTest } from "../components/AuthenticationTest";

export default function Test() {
  return (
    <Page title="App Tests">
      <BlockStack gap="500">
        {/* Authentication Test */}
        <AuthenticationTest />
        
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Polaris CSS Test
            </Text>
            <Text variant="bodyMd" as="p">
              This page tests if Polaris CSS is loading correctly.
            </Text>
            <InlineStack gap="300">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="tertiary">Tertiary</Button>
            </InlineStack>
          </BlockStack>
        </Card>
        
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              CSS Variables Test
            </Text>
            <div style={{
              padding: '16px',
              backgroundColor: 'var(--p-color-bg-surface)',
              border: '1px solid var(--p-color-border)',
              borderRadius: '8px'
            }}>
              <Text variant="bodyMd" as="p">
                If you can see this text with proper styling and the border, CSS variables are working.
              </Text>
            </div>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Raw HTML Test
            </Text>
            <div style={{
              padding: '20px',
              backgroundColor: '#f6f6f7',
              border: '1px solid #c9cccf',
              borderRadius: '8px',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#202223' }}>Raw HTML Styling</h3>
              <p style={{ margin: '0', color: '#6d7175' }}>
                This uses raw CSS to verify the page is working at all.
              </p>
            </div>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}