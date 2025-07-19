import React from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Box,
  Grid,
  Badge,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getCurrentSubscription } from "../utils/billing.server";
import { BillingStatus } from "../components/BillingStatus";
import { ensureUserExists } from "../utils/db.server";
import { ClientOnly } from "../components/ClientOnly";

interface LoaderData {
  user: {
    id: string;
    shop: string;
    plan: string;
    credits: number;
    onboardingCompleted: boolean;
  };
  subscription?: {
    planName: string;
    status: string;
  } | null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  // Get user and subscription data
  const user = await ensureUserExists(session.shop);
  const subscription = await getCurrentSubscription(request);

  return json<LoaderData>({
    user: {
      id: user.id,
      shop: user.shop,
      plan: user.plan,
      credits: user.credits,
      onboardingCompleted: user.onboardingCompleted,
    },
    subscription: subscription ? {
      planName: subscription.name,
      status: "active",
    } : null,
  });
};

export default function Dashboard() {
  const { user, subscription } = useLoaderData<typeof loader>();

  const isFreePlan = user.plan === "free";
  const planName = subscription?.planName || "Free Plan";

  return (
    <ClientOnly fallback={<div>Loading dashboard...</div>}>
      <Page>
        <TitleBar title="Dashboard" />
        
        {/* Welcome Section */}
        <Card>
          <Box padding="600">
            <BlockStack gap="400">
              <Text variant="heading2xl" as="h1">
                Welcome to Bulky SEO Optimizer
              </Text>
              <Text variant="bodyLg" tone="subdued" as="p">
                Boost your Shopify store's visibility with AI-powered SEO optimization
              </Text>
            </BlockStack>
          </Box>
        </Card>

        {/* Billing Status */}
        <BillingStatus user={user} subscription={subscription} showFullCard />

        {/* Quick Actions */}
        <Grid columns={{ xs: 1, md: 2 }}>
          <Grid.Cell>
            <Card>
              <Box padding="500">
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">
                    Optimize Products
                  </Text>
                  <Text variant="bodyMd" tone="subdued" as="p">
                    Enhance your product listings with AI-powered SEO optimization
                  </Text>
                  <Box>
                    <Link to="/app/products">
                      <Button variant="primary" size="large">
                        Start Optimizing
                      </Button>
                    </Link>
                  </Box>
                </BlockStack>
              </Box>
            </Card>
          </Grid.Cell>
          
          <Grid.Cell>
            <Card>
              <Box padding="500">
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">
                    {isFreePlan ? "Upgrade Plan" : "Manage Subscription"}
                  </Text>
                  <Text variant="bodyMd" tone="subdued" as="p">
                    {isFreePlan 
                      ? "Unlock more features and credits with a premium plan"
                      : "View your current subscription and billing details"
                    }
                  </Text>
                  <Box>
                    <Link to="/app/pricing">
                      <Button variant={isFreePlan ? "primary" : "secondary"} size="large">
                        {isFreePlan ? "View Plans" : "Manage Plan"}
                      </Button>
                    </Link>
                  </Box>
                </BlockStack>
              </Box>
            </Card>
          </Grid.Cell>
        </Grid>

        {/* Stats Overview */}
        <Card>
          <Box padding="600">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Your Account Overview
              </Text>
              
              <Grid columns={{ xs: 1, md: 3 }}>
                <Grid.Cell>
                  <Box padding="400">
                    <BlockStack gap="200" align="center">
                      <Text variant="heading2xl" as="p">
                        {user.credits}
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        Credits Remaining
                      </Text>
                    </BlockStack>
                  </Box>
                </Grid.Cell>
                
                <Grid.Cell>
                  <Box padding="400">
                    <BlockStack gap="200" align="center">
                      <Badge tone={isFreePlan ? "warning" : "success"}>
                        {planName}
                      </Badge>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        Current Plan
                      </Text>
                    </BlockStack>
                  </Box>
                </Grid.Cell>
                
                <Grid.Cell>
                  <Box padding="400">
                    <BlockStack gap="200" align="center">
                      <Text variant="heading2xl" as="p">
                        {user.shop}
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        Shop Domain
                      </Text>
                    </BlockStack>
                  </Box>
                </Grid.Cell>
              </Grid>
            </BlockStack>
          </Box>
        </Card>

        {/* Getting Started */}
        {!user.onboardingCompleted && (
          <Card>
            <Box padding="600">
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Getting Started
                </Text>
                <Text variant="bodyMd" tone="subdued" as="p">
                  Follow these steps to optimize your first products:
                </Text>
                
                <BlockStack gap="300">
                  <InlineStack gap="200" align="start">
                    <Box>
                      <Badge tone="info">1</Badge>
                    </Box>
                    <Text variant="bodyMd" as="p">
                      Go to the Products page and select products to optimize
                    </Text>
                  </InlineStack>
                  
                  <InlineStack gap="200" align="start">
                    <Box>
                      <Badge tone="info">2</Badge>
                    </Box>
                    <Text variant="bodyMd" as="p">
                      Choose between Quick Optimize or Advanced Optimize with custom context
                    </Text>
                  </InlineStack>
                  
                  <InlineStack gap="200" align="start">
                    <Box>
                      <Badge tone="info">3</Badge>
                    </Box>
                    <Text variant="bodyMd" as="p">
                      Review your optimized products and watch your SEO improve
                    </Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Box>
          </Card>
        )}

        {/* Feature Highlights */}
        <Card>
          <Box padding="600">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                What You Get
              </Text>
              
              <Grid columns={{ xs: 1, md: 2 }}>
                <Grid.Cell>
                  <BlockStack gap="300">
                    <InlineStack gap="200" align="start">
                      <Text variant="bodyMd" fontWeight="semibold" as="p">
                        ✨ AI-Powered Optimization
                      </Text>
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued" as="p">
                      Advanced AI algorithms optimize your product titles, descriptions, and metadata for better search rankings.
                    </Text>
                  </BlockStack>
                </Grid.Cell>
                
                <Grid.Cell>
                  <BlockStack gap="300">
                    <InlineStack gap="200" align="start">
                      <Text variant="bodyMd" fontWeight="semibold" as="p">
                        📊 Performance Analytics
                      </Text>
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued" as="p">
                      Track your SEO improvements with detailed analytics and performance metrics.
                    </Text>
                  </BlockStack>
                </Grid.Cell>
                
                <Grid.Cell>
                  <BlockStack gap="300">
                    <InlineStack gap="200" align="start">
                      <Text variant="bodyMd" fontWeight="semibold" as="p">
                        🚀 Bulk Processing
                      </Text>
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued" as="p">
                      Optimize multiple products at once to save time and improve efficiency.
                    </Text>
                  </BlockStack>
                </Grid.Cell>
                
                <Grid.Cell>
                  <BlockStack gap="300">
                    <InlineStack gap="200" align="start">
                      <Text variant="bodyMd" fontWeight="semibold" as="p">
                        🎯 Custom Context
                      </Text>
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued" as="p">
                      Provide custom context for more accurate and relevant optimizations.
                    </Text>
                  </BlockStack>
                </Grid.Cell>
              </Grid>
            </BlockStack>
          </Box>
        </Card>
      </Page>
    </ClientOnly>
  );
}