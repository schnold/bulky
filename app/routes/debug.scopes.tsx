import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, Text, BlockStack } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  try {
    // Check current app installation and scopes
    const query = `
      query {
        app {
          id
          handle
          installation {
            launchUrl
            uninstallUrl
            accessScopes {
              handle
              description
            }
          }
        }
      }
    `;

    const response = await admin.graphql(query);
    const data = await response.json();

    console.log("App scope debug data:", JSON.stringify(data, null, 2));

    return json({
      shop: session.shop,
      appData: data,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        shopifyAppUrl: process.env.SHOPIFY_APP_URL,
        scopes: process.env.SCOPES,
      }
    });
  } catch (error) {
    console.error("Scope debug error:", error);
    return json({
      shop: session.shop,
      error: error instanceof Error ? error.message : String(error),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        shopifyAppUrl: process.env.SHOPIFY_APP_URL,
        scopes: process.env.SCOPES,
      }
    });
  }
};

export default function DebugScopes() {
  const data = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Debug: App Scopes & Configuration" />
      
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Store Information</Text>
            <Text as="p">Shop: {data.shop}</Text>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Environment Configuration</Text>
            <Text as="p">NODE_ENV: {data.environment.nodeEnv}</Text>
            <Text as="p">SHOPIFY_APP_URL: {data.environment.shopifyAppUrl}</Text>
            <Text as="p">SCOPES: {data.environment.scopes}</Text>
          </BlockStack>
        </Card>

        {data.appData && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">App Installation Data</Text>
              <pre style={{ background: '#f6f6f7', padding: '16px', borderRadius: '8px', fontSize: '12px' }}>
                {JSON.stringify(data.appData, null, 2)}
              </pre>
            </BlockStack>
          </Card>
        )}

        {data.error && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2" tone="critical">Error</Text>
              <Text as="p" tone="critical">{data.error}</Text>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
