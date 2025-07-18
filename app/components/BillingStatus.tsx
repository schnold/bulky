import React from "react";
import { Link } from "@remix-run/react";
import {
  Banner,
  Text,
  Button,
  InlineStack,
  Badge,
  Box,
  Card,
  BlockStack,
} from "@shopify/polaris";

interface BillingStatusProps {
  user: {
    plan: string;
    credits: number;
  };
  subscription?: {
    planName: string;
    status: string;
  } | null;
  showFullCard?: boolean;
}

export function BillingStatus({ user, subscription, showFullCard = false }: BillingStatusProps) {
  const isFreePlan = user.plan === "free";
  const lowCredits = user.credits < 10;
  const noCredits = user.credits === 0;

  if (showFullCard) {
    return (
      <Card>
        <Box padding="400">
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <BlockStack gap="100">
                <Text variant="headingMd" as="h3">
                  Current Plan
                </Text>
                <InlineStack gap="200" align="center">
                  <Badge tone={isFreePlan ? "warning" : "success"}>
                    {subscription?.planName || "Free Plan"}
                  </Badge>
                  <Text variant="bodySm" tone="subdued">
                    {user.credits} credits remaining
                  </Text>
                </InlineStack>
              </BlockStack>
              <Link to="/app/pricing">
                <Button variant="primary" size="slim">
                  {isFreePlan ? "Upgrade Plan" : "Manage Plan"}
                </Button>
              </Link>
            </InlineStack>
            
            {noCredits && (
              <Banner
                title="No credits remaining"
                tone="critical"
                action={{
                  content: "Upgrade Plan",
                  url: "/app/pricing",
                }}
              >
                <Text>
                  You've used all your optimization credits. Upgrade to continue optimizing products.
                </Text>
              </Banner>
            )}
            
            {lowCredits && !noCredits && (
              <Banner
                title="Low credits"
                tone="warning"
                action={{
                  content: "View Plans",
                  url: "/app/pricing",
                }}
              >
                <Text>
                  You have {user.credits} credits remaining. Consider upgrading for more optimizations.
                </Text>
              </Banner>
            )}
          </BlockStack>
        </Box>
      </Card>
    );
  }

  if (noCredits) {
    return (
      <Banner
        title="No credits remaining"
        tone="critical"
        action={{
          content: "Upgrade Plan",
          url: "/app/pricing",
        }}
      >
        <Text>
          You've used all your optimization credits. Upgrade to continue optimizing products.
        </Text>
      </Banner>
    );
  }

  if (lowCredits) {
    return (
      <Banner
        title="Low credits"
        tone="warning"
        action={{
          content: "View Plans",
          url: "/app/pricing",
        }}
      >
        <Text>
          You have {user.credits} credits remaining. Consider upgrading for more optimizations.
        </Text>
      </Banner>
    );
  }

  return null;
}