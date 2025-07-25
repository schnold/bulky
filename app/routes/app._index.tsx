import { useEffect, useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";

// Define action response types
type ActionResponse =
  | { success: true; message: string }
  | { error: string };
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  InlineStack,
  Badge,
  TextField,
  Toast,
  ProgressBar,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { DeleteIcon, PlusIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {

  const { admin, session } = await authenticate.admin(request);

  if (!session || !session.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  console.log(`🔍 LOADER - Session shop: ${session.shop}`);

  // Get user data from database (user is guaranteed to exist from app.tsx loader)
  const { ensureUserExists } = await import("../utils/db.server");
  const user = await ensureUserExists(session.shop, true); // Include keywords

  console.log(`🔍 LOADER - User found:`, {
    id: user.id,
    shop: user.shop,
    keywordsCount: user.keywords?.length || 0,
    keywords: user.keywords?.map(k => k.keyword) || []
  });

  return json({ user });
};

export const action = async ({ request }: ActionFunctionArgs) => {

  try {
    const { admin, session } = await authenticate.admin(request);

    if (!session || !session.shop) {
      return json({ error: "Authentication failed" }, { status: 401 });
    }

    const formData = await request.formData();
    const intent = formData.get("intent");

    // Ensure user exists before any operations
    const { ensureUserExists } = await import("../utils/db.server");
    const user = await ensureUserExists(session.shop);

    if (!user) {
      return json({ error: "Failed to create or find user" }, { status: 500 });
    }

    if (intent === "addKeyword") {
      const keyword = formData.get("keyword") as string;

      if (!keyword || keyword.trim() === "") {
        return json({ error: "Keyword cannot be empty" }, { status: 400 });
      }

      try {
        console.log(`🏷️ Adding keyword "${keyword.trim()}" for user ${user.id} (shop: ${session.shop})`);
        console.log(`🔍 User details:`, { id: user.id, shop: user.shop, plan: user.plan });

        const newKeyword = await prisma.keyword.create({
          data: {
            keyword: keyword.trim(),
            userId: user.id,
          }
        });

        console.log(`✅ Successfully created keyword with ID: ${newKeyword.id}`);

        // Verify the keyword was actually created
        const verifyKeyword = await prisma.keyword.findUnique({
          where: { id: newKeyword.id },
          include: { user: true }
        });
        console.log(`🔍 Verification - keyword exists:`, verifyKeyword ? 'YES' : 'NO');
        if (verifyKeyword) {
          console.log(`🔍 Keyword details:`, {
            id: verifyKeyword.id,
            keyword: verifyKeyword.keyword,
            userId: verifyKeyword.userId,
            userShop: verifyKeyword.user.shop
          });
        }

        return json({ success: true, message: "Keyword added successfully" });
      } catch (error) {
        console.error(`❌ Failed to create keyword:`, error);
        return json({ error: "Keyword already exists" }, { status: 400 });
      }
    }

    if (intent === "deleteKeyword") {
      const keywordId = formData.get("keywordId") as string;

      await prisma.keyword.delete({
        where: {
          id: keywordId,
          userId: user.id, // Ensure user can only delete their own keywords
        }
      });

      return json({ success: true, message: "Keyword deleted successfully" });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Action error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};

export default function Index() {
  const { user } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionResponse>();
  const navigate = useNavigate();

  const [newKeyword, setNewKeyword] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);

  const isLoading = ["loading", "submitting"].includes(fetcher.state);

  // Handle form responses
  useEffect(() => {
    if (fetcher.data && 'success' in fetcher.data && fetcher.data.success) {
      setToastMessage(fetcher.data.message);
      setToastError(false);
      setShowToast(true);
      setNewKeyword(""); // Clear input on success
      // Remix will automatically revalidate the loader data after successful action
    } else if (fetcher.data && 'error' in fetcher.data) {
      setToastMessage(fetcher.data.error);
      setToastError(true);
      setShowToast(true);
    }
  }, [fetcher.data]);

  const handleAddKeyword = useCallback(() => {
    if (newKeyword.trim() === "") return;

    fetcher.submit(
      {
        intent: "addKeyword",
        keyword: newKeyword.trim(),
      },
      { method: "POST" }
    );
  }, [newKeyword, fetcher]);

  const handleDeleteKeyword = useCallback((keywordId: string) => {
    fetcher.submit(
      {
        intent: "deleteKeyword",
        keywordId,
      },
      { method: "POST" }
    );
  }, [fetcher]);

  const getPlanBadge = (plan: string) => {
    const planConfig = {
      free: { status: "info" as const, children: "Free Plan" },
      starter: { status: "success" as const, children: "Starter Plan" },
      pro: { status: "warning" as const, children: "Pro Plan" },
      enterprise: { status: "critical" as const, children: "Enterprise Plan" },
    };

    return planConfig[plan as keyof typeof planConfig] || { status: "info" as const, children: plan };
  };

  const toastMarkup = showToast ? (
    <Toast
      content={toastMessage}
      error={toastError}
      onDismiss={() => setShowToast(false)}
    />
  ) : null;

  return (
    <Page>
      <TitleBar title="AI Product Optimizer Dashboard" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            {/* Welcome Card */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Welcome to your Bulk AI Product Optimizer 💫
                </Text>
                <Text variant="bodyMd" as="p">
                  Optimize your Shopify products with AI-powered SEO using 2025 best practices.
                </Text>
                <Button 
                  variant="primary"
                  onClick={() => navigate("/app/products")}
                >
                  Optimize Products
                </Button>
              </BlockStack>
            </Card>

            {/* Keywords Management Card */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    SEO Keywords
                  </Text>
                  {(!user.keywords || user.keywords.length < 3) && (
                    <Badge tone="attention">
                      Add 3+ keywords for better results
                    </Badge>
                  )}
                </InlineStack>

                <Text variant="bodySm" tone="subdued" as="p">
                  Manage your target keywords for product optimization. More keywords = better AI optimization results.
                </Text>

                {/* Add Keyword Input */}
                <InlineStack gap="200">
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="New Keyword"
                      labelHidden
                      value={newKeyword}
                      onChange={setNewKeyword}
                      placeholder="e.g., running shoes"
                      autoComplete="off"
                    />
                  </div>
                  <Button
                    onClick={handleAddKeyword}
                    disabled={isLoading || newKeyword.trim() === ""}
                    icon={PlusIcon}
                    loading={isLoading}
                  >
                    Add
                  </Button>
                </InlineStack>

                {/* Keywords List */}
                {user.keywords && user.keywords.length > 0 ? (
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Your Keywords ({user.keywords.length})
                    </Text>
                    <Box
                      padding="300"
                      background="bg-surface-secondary"
                      borderRadius="200"
                    >
                      <BlockStack gap="200">
                        {user.keywords.map((keyword) => (
                          <InlineStack key={keyword.id} align="space-between">
                            <Text as="span" variant="bodySm">{keyword.keyword}</Text>
                            <Button
                              size="slim"
                              variant="tertiary"
                              icon={DeleteIcon}
                              onClick={() => handleDeleteKeyword(keyword.id)}
                              disabled={isLoading}
                              tone="critical"
                            />
                          </InlineStack>
                        ))}
                      </BlockStack>
                    </Box>
                  </BlockStack>
                ) : (
                  <Box
                    padding="400"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                      No keywords added yet. Add your first keyword to get started!
                    </Text>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              {/* Plan & Credits Card */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Account Overview
                  </Text>

                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Current Plan
                      </Text>
                      <Badge {...getPlanBadge(user.plan)} />
                    </InlineStack>

                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Optimization Credits
                      </Text>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {user.credits}
                      </Text>
                    </InlineStack>

                    {/* Credits Progress Bar */}
                    <Box>
                      <Text variant="bodySm" tone="subdued" as="p">
                        Credits Usage
                      </Text>
                      <ProgressBar
                        progress={(user.credits / 100) * 100} // Assuming 100 is max for visual
                        size="small"
                      />
                      <Text variant="bodySm" tone="subdued" as="p">
                        {user.credits > 5 ? "Good" : user.credits > 0 ? "Low" : "Empty"}
                      </Text>
                    </Box>
                  </BlockStack>

                  <Button
                    variant="primary"
                    fullWidth
                    disabled={user.plan !== "free"}
                  >
                    {user.plan === "free" ? "Upgrade Plan" : "Manage Subscription"}
                  </Button>
                </BlockStack>
              </Card>

              {/* Quick Stats */}
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Quick Stats
                  </Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm">
                        Shop
                      </Text>
                      <Text as="span" variant="bodySm" fontWeight="semibold">
                        {user.shop}
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm">
                        Keywords
                      </Text>
                      <Text as="span" variant="bodySm" fontWeight="semibold">
                        {user.keywords?.length || 0}
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm">
                        Member Since
                      </Text>
                      <Text as="span" variant="bodySm" fontWeight="semibold">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
      {toastMarkup}
    </Page>
  );
}