import { useEffect, useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";

// Define action response types
type ActionResponse =
  | { success: true; message: string }
  | { error: string };

type UserData = {
  id: string;
  shop: string;
  plan: string;
  credits: number;
  keywords?: Array<{ id: string; keyword: string; }>;
  createdAt: string;
  updatedAt: string;
};

import { useFetcher, useLoaderData, useSearchParams } from "@remix-run/react";
import { useTranslation } from "../i18n-shim";
import { Select } from "@shopify/polaris";
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
  Spinner,
  SkeletonBodyText,
  SkeletonDisplayText,
  Modal,
  FormLayout,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { DeleteIcon, PlusIcon, MagicIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import i18nextServer from "../i18next.server";
import prisma from "../db.server";
import { getUserByShop, redeemDiscountCode, getCreditsForPlan } from "../models/user.server";
import { ensureUserExists } from "../utils/db.server";
import { checkRateLimit } from "../services/rate-limit.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, sessionToken } = await authenticate.admin(request);

  if (!session || !session.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // For embedded apps, sessionToken is automatically validated by authenticate.admin
  // sessionToken contains: sub (user ID), dest (shop domain), etc.
  if (sessionToken) {
    console.log(`🔐 Session token validated for shop: ${sessionToken.dest}, user: ${sessionToken.sub}`);
  }

  // Return minimal data for immediate UI render
  return json({
    shop: session.shop,
    // User data will be loaded async
    user: null
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const t = await i18nextServer.getFixedT(request);
  try {
    const { admin, session, sessionToken } = await authenticate.admin(request);

    if (!session || !session.shop) {
      return json({ error: "Authentication failed" }, { status: 401 });
    }

    // For embedded apps, sessionToken is automatically validated by authenticate.admin
    // This ensures the request is authenticated using session tokens
    if (sessionToken) {
      console.log(`🔐 Action - Session token validated for shop: ${sessionToken.dest}, user: ${sessionToken.sub}`);
    }

    const formData = await request.formData();
    const intent = formData.get("intent");

    // Ensure user exists before any operations
    const user = await ensureUserExists(session.shop);

    if (!user) {
      return json({ error: "Failed to create or find user" }, { status: 500 });
    }

    if (intent === "redeemDiscountCode") {
      const code = (formData.get("code") as string)?.toUpperCase().trim();
      if (!code) return json({ error: "Code is required" }, { status: 400 });

      // Protect against brute-forcing discount codes (5 attempts per 10 minutes)
      const rateLimit = await checkRateLimit(session.shop, "redeem-discount", 5, 600);
      if (!rateLimit.allowed) {
        return json({
          error: "Too many attempts",
          message: "You've tried too many codes. Please wait 10 minutes before trying again."
        }, { status: 429 });
      }

      const result = await redeemDiscountCode(code, session.shop);
      return json(result);
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

        return json({ success: true, message: t("toast_keyword_added") });
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

      return json({ success: true, message: t("toast_keyword_deleted") });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Action error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};

export default function Index() {
  const { t, i18n: i18nInstance } = useTranslation();
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionResponse>();
  const userDataFetcher = useFetcher<{ user?: UserData; error?: string }>();
  const accountDataFetcher = useFetcher<{ user?: Pick<UserData, 'plan' | 'credits' | 'shop' | 'createdAt'>; error?: string }>();
  const discountFetcher = useFetcher<{ success: boolean; error?: string; creditsGranted?: number; newBalance?: number }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [newKeyword, setNewKeyword] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [discountApplied, setDiscountApplied] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const keywordGenFetcher = useFetcher<{ success?: boolean; error?: string; message?: string; keywordsAdded?: number; keywords?: string[] }>();

  const isLoading = ["loading", "submitting"].includes(fetcher.state);
  const isUserDataLoading = ["loading", "submitting"].includes(userDataFetcher.state);
  const isAccountDataLoading = ["loading", "submitting"].includes(accountDataFetcher.state);
  const isDiscountLoading = ["loading", "submitting"].includes(discountFetcher.state);
  const isKeywordGenLoading = ["loading", "submitting"].includes(keywordGenFetcher.state);

  // Get user data - either from the async fetch or null for loading state
  const user = userDataFetcher.data?.user;
  const userDataError = userDataFetcher.data?.error;

  // Get account data separately
  const accountData = accountDataFetcher.data?.user;
  const accountDataError = accountDataFetcher.data?.error;

  // Load user data on mount
  useEffect(() => {
    userDataFetcher.load("/api/user-data");
    accountDataFetcher.load("/api/user-data");
  }, []);

  // Re-fetch user data after successful keyword operations
  useEffect(() => {
    if (fetcher.data && 'success' in fetcher.data && fetcher.data.success) {
      userDataFetcher.load("/api/user-data");
      // Also refresh account data in case credits were updated
      accountDataFetcher.load("/api/user-data");
    }
  }, [fetcher.data]);

  // Handle AI keyword generation responses
  useEffect(() => {
    if (keywordGenFetcher.data) {
      if (keywordGenFetcher.data.success) {
        const message = keywordGenFetcher.data.message ||
          `Successfully generated ${keywordGenFetcher.data.keywordsAdded || 0} keyword(s)`;
        setToastMessage(message);
        setToastError(false);
        setShowToast(true);
        setShowAIModal(false);
        setAiInput("");
        // Refresh user data to show new keywords
        userDataFetcher.load("/api/user-data");
      } else if (keywordGenFetcher.data.error) {
        setToastMessage(keywordGenFetcher.data.error);
        setToastError(true);
        setShowToast(true);
      }
    }
  }, [keywordGenFetcher.data]);

  // Handle discount code redemption responses
  useEffect(() => {
    if (discountFetcher.data) {
      if (discountFetcher.data.success) {
        setToastMessage(t("toast_discount_success", { credits: discountFetcher.data.creditsGranted, balance: discountFetcher.data.newBalance }));
        setToastError(false);
        setShowToast(true);
        setDiscountCode("");
        setDiscountApplied(true);
        // Refresh account data to show new credit balance
        accountDataFetcher.load("/api/user-data");
      } else if (discountFetcher.data.error) {
        setToastMessage(discountFetcher.data.error);
        setToastError(true);
        setShowToast(true);
      }
    }
  }, [discountFetcher.data]);

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
    if (newKeyword.trim() === "" || !user) return;

    fetcher.submit(
      {
        intent: "addKeyword",
        keyword: newKeyword.trim(),
      },
      { method: "POST" }
    );
  }, [newKeyword, fetcher, user]);

  const handleDeleteKeyword = useCallback((keywordId: string) => {
    if (!user) return;

    fetcher.submit(
      {
        intent: "deleteKeyword",
        keywordId,
      },
      { method: "POST" }
    );
  }, [fetcher, user]);

  const handleApplyDiscount = useCallback(() => {
    if (discountCode.trim() === "") return;

    const formData = new FormData();
    formData.append("code", discountCode.trim());

    discountFetcher.submit(formData, {
      method: "POST",
      action: "/app/redeem-discount",
    });
  }, [discountCode, discountFetcher]);

  const handleGenerateKeywords = useCallback(() => {
    if (aiInput.trim() === "" || isKeywordGenLoading) return;

    const formData = new FormData();
    formData.append("userInput", aiInput.trim());

    keywordGenFetcher.submit(formData, {
      method: "POST",
      action: "/api/generate-keywords",
    });
  }, [aiInput, keywordGenFetcher, isKeywordGenLoading]);



  // Check if user has Pro or Enterprise plan
  const hasProOrEnterprise = user && (user.plan === "pro" || user.plan === "enterprise");

  const getPlanBadge = (plan: string) => {
    const planConfig = {
      free: { status: "info" as const, children: t("plan_free") },
      starter: { status: "success" as const, children: t("plan_starter") },
      pro: { status: "warning" as const, children: t("plan_pro") },
      enterprise: { status: "critical" as const, children: t("plan_enterprise") },
    };

    return planConfig[plan as keyof typeof planConfig] || { status: "info" as const, children: plan };
  };

  // Loading component for keywords section
  const KeywordsLoadingState = () => (
    <Card>
      <BlockStack gap="400">
        <SkeletonDisplayText size="medium" />
        <SkeletonBodyText lines={2} />
        <InlineStack gap="200">
          <div style={{ flex: 1 }}>
            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <SkeletonBodyText lines={1} />
            </Box>
          </div>
          <Box padding="300" background="bg-surface-secondary" borderRadius="200" minWidth="80px">
            <SkeletonBodyText lines={1} />
          </Box>
        </InlineStack>
        <Box padding="300" background="bg-surface-secondary" borderRadius="200">
          <InlineStack align="center" gap="200">
            <Spinner size="small" />
            <Text as="span" variant="bodySm" tone="subdued">{t("loading_keywords")}</Text>
          </InlineStack>
        </Box>
      </BlockStack>
    </Card>
  );

  // Loading component for account overview
  const AccountLoadingState = () => (
    <Card>
      <BlockStack gap="400">
        <SkeletonDisplayText size="medium" />
        <BlockStack gap="300">
          <InlineStack align="space-between">
            <SkeletonBodyText lines={1} />
            <Box padding="100" background="bg-surface-secondary" borderRadius="100" minWidth="80px">
              <SkeletonBodyText lines={1} />
            </Box>
          </InlineStack>
          <InlineStack align="space-between">
            <SkeletonBodyText lines={1} />
            <SkeletonBodyText lines={1} />
          </InlineStack>
          <Box>
            <SkeletonBodyText lines={3} />
          </Box>
        </BlockStack>
        <Box padding="300" background="bg-surface-secondary" borderRadius="200">
          <SkeletonBodyText lines={1} />
        </Box>
      </BlockStack>
    </Card>
  );

  // Loading component for quick stats
  const QuickStatsLoadingState = () => (
    <Card>
      <BlockStack gap="200">
        <SkeletonDisplayText size="medium" />
        <BlockStack gap="200">
          {[1, 2, 3].map(i => (
            <InlineStack key={i} align="space-between">
              <SkeletonBodyText lines={1} />
              <SkeletonBodyText lines={1} />
            </InlineStack>
          ))}
        </BlockStack>
      </BlockStack>
    </Card>
  );

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
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  {t("welcome_title")}
                </Text>
                <Text variant="bodyMd" as="p">
                  {t("welcome_description")}
                </Text>
                <Button
                  variant="primary"
                  onClick={() => navigate("/app/products")}
                >
                  {t("optimize_products_btn")}
                </Button>
              </BlockStack>
            </Card>



            {/* Keywords Management Card */}
            {!user && isUserDataLoading ? (
              <KeywordsLoadingState />
            ) : userDataError ? (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">{t("seo_keywords_title")}</Text>
                  <Box padding="400" background="bg-surface-critical" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="critical" alignment="center">
                      Error loading keywords: {userDataError}
                    </Text>
                  </Box>
                </BlockStack>
              </Card>
            ) : user ? (
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      {t("seo_keywords_title")}
                    </Text>
                    {(!user.keywords || user.keywords.length < 3) && (
                      <Badge tone="attention">
                        {t("seo_keywords_badge")}
                      </Badge>
                    )}
                  </InlineStack>

                  <Text variant="bodySm" tone="subdued" as="p">
                    {t("seo_keywords_description")}
                  </Text>

                  {/* Add Keyword Input */}
                  <InlineStack gap="200">
                    <div style={{ flex: 1 }}>
                      <TextField
                        label={t("new_keyword_placeholder")}
                        labelHidden
                        value={newKeyword}
                        onChange={setNewKeyword}
                        placeholder={t("new_keyword_placeholder")}
                        autoComplete="off"
                      />
                    </div>
                    <Button
                      onClick={handleAddKeyword}
                      disabled={isLoading || newKeyword.trim() === ""}
                      icon={PlusIcon}
                      loading={isLoading}
                    >
                      {t("add_btn")}
                    </Button>
                    {hasProOrEnterprise && (
                      <Button
                        onClick={() => setShowAIModal(true)}
                        disabled={isLoading}
                        icon={MagicIcon}
                        variant="secondary"
                        size="medium"
                        accessibilityLabel="Generate keywords with AI"
                      />
                    )}
                  </InlineStack>

                  {/* Keywords List */}
                  {user.keywords && user.keywords.length > 0 ? (
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        {t("your_keywords_label", { count: user.keywords.length })}
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
                        {t("no_keywords_msg")}
                      </Text>
                    </Box>
                  )}
                </BlockStack>
              </Card>
            ) : null}
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="500">


              {/* Plan & Credits Card */}
              {!accountData && isAccountDataLoading ? (
                <AccountLoadingState />
              ) : accountDataError ? (
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">{t("account_overview_title")}</Text>
                    <Box padding="400" background="bg-surface-critical" borderRadius="200">
                      <Text as="p" variant="bodySm" tone="critical" alignment="center">
                        Error loading account data: {accountDataError}
                      </Text>
                    </Box>
                  </BlockStack>
                </Card>
              ) : accountData ? (
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">
                      {t("account_overview_title")}
                    </Text>

                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd">
                          {t("current_plan_label")}
                        </Text>
                        <Badge {...getPlanBadge(accountData.plan)} />
                      </InlineStack>

                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd">
                          {t("optimization_credits_label")}
                        </Text>
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          {accountData.credits}
                        </Text>
                      </InlineStack>

                      {/* Credits Progress Bar */}
                      <Box>
                        <Text variant="bodySm" tone="subdued" as="p">
                          {t("credits_usage_label")}
                        </Text>
                        <ProgressBar
                          progress={(accountData.credits / 100) * 100} // Assuming 100 is max for visual
                          size="small"
                        />
                        <Text variant="bodySm" tone="subdued" as="p">
                          {accountData.credits > 5 ? t("usage_good") : accountData.credits > 0 ? t("usage_low") : t("usage_empty")}
                        </Text>
                      </Box>
                    </BlockStack>

                    <Button
                      variant="primary"
                      fullWidth
                      disabled={accountData.plan !== "free"}
                      onClick={() => navigate(`/app/pricing?${new URLSearchParams(window.location.search)}`)}
                    >
                      {accountData.plan === "free" ? t("upgrade_plan_btn") : t("manage_subscription_btn")}
                    </Button>
                  </BlockStack>
                </Card>
              ) : null}

              {/* Discount Code Card */}
              {accountData && !discountApplied ? (
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">
                      {t("have_discount_title")}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {t("have_discount_description")}
                    </Text>
                    <TextField
                      label="Discount Code"
                      value={discountCode}
                      onChange={setDiscountCode}
                      placeholder="Enter code"
                      autoComplete="off"
                      disabled={isDiscountLoading}
                    />
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={handleApplyDiscount}
                      disabled={!discountCode.trim() || isDiscountLoading}
                      loading={isDiscountLoading}
                    >
                      {t("apply_code_btn")}
                    </Button>
                  </BlockStack>
                </Card>
              ) : null}

              {/* Quick Stats */}
              {(!user && isUserDataLoading) || (!accountData && isAccountDataLoading) ? (
                <QuickStatsLoadingState />
              ) : (user || accountData) ? (
                <Card>
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingMd">
                      {t("quick_stats_title")}
                    </Text>
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodySm">
                          {t("shop_label")}
                        </Text>
                        <Text as="span" variant="bodySm" fontWeight="semibold">
                          {accountData?.shop || user?.shop || loaderData.shop}
                        </Text>
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodySm">
                          {t("keywords_label")}
                        </Text>
                        <Text as="span" variant="bodySm" fontWeight="semibold">
                          {user?.keywords?.length || 0}
                        </Text>
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodySm">
                          {t("member_since_label")}
                        </Text>
                        <Text as="span" variant="bodySm" fontWeight="semibold">
                          {accountData?.createdAt ? new Date(accountData.createdAt).toLocaleDateString() :
                            user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Loading...'}
                        </Text>
                      </InlineStack>
                    </BlockStack>
                  </BlockStack>
                </Card>
              ) : null}
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
      {toastMarkup}

      {/* AI Keyword Generation Modal */}
      <Modal
        open={showAIModal}
        onClose={() => {
          setShowAIModal(false);
          setAiInput("");
        }}
        title={t("ai_modal_title")}
        primaryAction={{
          content: t("generate_btn"),
          onAction: handleGenerateKeywords,
          disabled: aiInput.trim() === "" || isKeywordGenLoading,
          loading: isKeywordGenLoading,
        }}
        secondaryActions={[
          {
            content: t("cancel_btn"),
            onAction: () => {
              setShowAIModal(false);
              setAiInput("");
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text variant="bodyMd" as="p">
              {t("ai_modal_description")}
            </Text>

            <FormLayout>
              <TextField
                label={t("ai_modal_input_label")}
                value={aiInput}
                onChange={setAiInput}
                placeholder={t("ai_modal_input_placeholder")}
                multiline={4}
                helpText={t("ai_modal_input_help")}
                autoComplete="off"
                disabled={isKeywordGenLoading}
              />
            </FormLayout>

            {isKeywordGenLoading && (
              <Box padding="400">
                <InlineStack align="center" gap="200">
                  <Spinner size="small" />
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t("ai_modal_generating")}
                  </Text>
                </InlineStack>
              </Box>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}