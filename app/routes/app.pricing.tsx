import { useState, useEffect } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Box,
  Badge,
  Divider,
  Icon,
  Grid,
  Banner,
  Toast,
  Frame,
  Collapsible,
} from "@shopify/polaris";
import { CheckIcon, XIcon, ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate, STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN } from "../shopify.server";
import { ensureUserExists } from "../utils/db.server";
import { createAppSubscription } from "../utils/billing.server";
import { manuallyUpdateUserPlan, syncUserPlanWithSubscription } from "../models/user.server";

// Plan constants - keep in sync with shopify.server.ts
const FREE_PLAN = "Free Plan";

interface PlanFeature {
  name: string;
  free: boolean | string;
  starter: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
}

const planFeatures: PlanFeature[] = [
  {
    name: "Monthly SEO Optimization Credits",
    free: "10 credits",
    starter: "100 credits",
    pro: "500 credits",
    enterprise: "Unlimited",
  },
  {
    name: "AI Product Description Enhancement",
    free: true,
    starter: true,
    pro: true,
    enterprise: true,
  },
  {
    name: "Advanced SEO Title Optimization",
    free: false,
    starter: true,
    pro: true,
    enterprise: true,
  },
  {
    name: "Meta Description Generation",
    free: true,
    starter: true,
    pro: true,
    enterprise: true,
  },
  {
    name: "Keyword Research & Suggestions",
    free: "Basic",
    starter: "Basic",
    pro: "Advanced",
    enterprise: "Advanced",
  },
  {
    name: "Competitor Analysis",
    free: false,
    starter: false,
    pro: false,
    enterprise: true,
  },
  {
    name: "Bulk Product Optimization",
    free: "Up to 3",
    starter: "Up to 30",
    pro: "Up to 100",
    enterprise: "Unlimited",
  },
  {
    name: "Priority Support",
    free: false,
    starter: false,
    pro: "Email",
    enterprise: "Phone & Email",
  },
];

interface LoaderData {
  user: {
    id: string;
    shop: string;
    plan: string;
    credits: number;
  };
  currentSubscription: {
    id: string;
    planName: string;
    status: string;
  } | null;
  success: boolean;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  let user = await ensureUserExists(session.shop);
  
  // Check for success parameter (user returning from Shopify confirmation)
  const url = new URL(request.url);
  const success = url.searchParams.get("success") === "true";
  
  // Log return from billing for debugging
  if (success) {
    console.log('[BILLING] User returned from billing with shop:', {
      shop: session.shop,
      searchParams: Object.fromEntries(url.searchParams),
      userAgent: request.headers.get('user-agent')
    });
  }

  // Check current billing status using manual GraphQL
  let currentSubscription = null;
  try {
    const { admin } = await authenticate.admin(request);
    const query = `
      query {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            currentPeriodEnd
            test
          }
        }
      }
    `;
    
    const response = await admin.graphql(query);
    const data = await response.json();
    
    console.log('[BILLING] Current subscriptions check:', JSON.stringify(data, null, 2));
    
    const subscriptions = data.data?.currentAppInstallation?.activeSubscriptions || [];
    if (subscriptions.length > 0) {
      const activeSubscription = subscriptions[0];
      currentSubscription = {
        id: activeSubscription.id,
        planName: activeSubscription.name,
        status: activeSubscription.status,
      };
    }
    
    // Sync user plan with actual subscription status (fallback if webhook was missed)
    try {
      const syncResult = await syncUserPlanWithSubscription(session.shop, subscriptions);
      if (syncResult?.updated) {
        console.log(`[PRICING] User plan synced successfully:`, syncResult);
        // Get fresh user data after sync (don't mutate existing object)
        user = await ensureUserExists(session.shop);
      }
    } catch (error) {
      console.error('[PRICING] Error syncing user plan:', error);
    }
  } catch (error) {
    console.error('[BILLING] Error checking subscriptions:', error);
  }

  return json<LoaderData>({
    user: {
      id: user.id,
      shop: user.shop,
      plan: user.plan,
      credits: user.credits,
    },
    currentSubscription,
    success,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");
  const rawPlan = formData.get("plan") as string;
  const host = formData.get("host") as string | undefined;

  // Normalize incoming client plan aliases to canonical plan names expected by billing
  const PLAN_ALIAS_MAP: Record<string, string> = {
    starter_plan: STARTER_PLAN,
    pro_plan: PRO_PLAN,
    enterprise_plan: ENTERPRISE_PLAN,
    // Allow Free Plan pass-through (not billed)
    "Free Plan": "Free Plan",
    // Also accept canonical names directly
    "Starter Plan": STARTER_PLAN,
    "Pro Plan": PRO_PLAN,
    "Enterprise Plan": ENTERPRISE_PLAN,
  };
  const planName = PLAN_ALIAS_MAP[rawPlan];

  if (intent === "subscribe") {
    console.log(`[BILLING] Subscribe request initiated:`, {
      shop: session.shop,
      planName,
      isTest: process.env.NODE_ENV !== "production",
      timestamp: new Date().toISOString()
    });
    
    // Validate plan name exists (after normalization)
    const validPlans = [STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN];
    if (!planName || !validPlans.includes(planName)) {
      console.error(`[BILLING] Invalid plan selected:`, { rawPlan, resolvedPlan: planName, validPlans });
      return json({ error: "Invalid plan selected" }, { status: 400 });
    }

    try {
      console.log(`[BILLING] Creating app subscription for plan:`, planName);

      // Create app subscription using GraphQL API (eliminates shop URL prompts)
      const result = await createAppSubscription(request, planName, host);
      
      console.log(`[BILLING] App subscription created successfully:`, {
        confirmationUrl: result.confirmationUrl,
        shop: session.shop,
        planName,
        subscriptionId: result.appSubscription?.id,
        isManaged: result.isManaged
      });
      
      // Return the URL to the client for iframe breakout redirect
      return json({ 
        redirectUrl: result.confirmationUrl,
        isManaged: result.isManaged 
      });
    } catch (error) {
      console.error(`[BILLING] Billing request failed:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        shop: session.shop,
        planName,
        timestamp: new Date().toISOString()
      });
      return json({ error: "Failed to process subscription" }, { status: 400 });
    }
  }

  if (intent === "manualUpdate") {
    const planName = formData.get("planName") as string;
    
    try {
      console.log(`[MANUAL] Manual plan update requested for ${session.shop} to plan: ${planName}`);
      
      await manuallyUpdateUserPlan(session.shop, planName);
      
      return json({ 
        success: true, 
        message: `Plan manually updated to ${planName} with appropriate credits` 
      });
    } catch (error) {
      console.error(`[MANUAL] Manual plan update failed:`, {
        error: error instanceof Error ? error.message : String(error),
        shop: session.shop,
        planName,
      });
      return json({ error: "Failed to update plan manually" }, { status: 400 });
    }
  }

  if (intent === "cancel") {
    const subscriptionId = formData.get("subscriptionId") as string;
    
    console.log(`[BILLING] Cancel request initiated:`, {
      shop: session.shop,
      subscriptionId,
      isTest: process.env.NODE_ENV !== "production",
      timestamp: new Date().toISOString()
    });
    
    try {
      const { admin } = await authenticate.admin(request);
      
      const mutation = `
        mutation appSubscriptionCancel($id: ID!) {
          appSubscriptionCancel(id: $id) {
            userErrors {
              field
              message
            }
            appSubscription {
              id
              status
            }
          }
        }
      `;
      
      const variables = { id: subscriptionId };
      
      const response = await admin.graphql(mutation, { variables });
      const data = await response.json();
      
      console.log(`[BILLING] Cancel GraphQL response:`, JSON.stringify(data, null, 2));
      
      if ((data as any).errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify((data as any).errors)}`);
      }
      
      const result = data.data?.appSubscriptionCancel;
      if (result?.userErrors?.length > 0) {
        throw new Error(`Subscription cancellation errors: ${JSON.stringify(result.userErrors)}`);
      }

      console.log(`[BILLING] Subscription cancelled successfully:`, { subscriptionId, shop: session.shop });
      return json({ success: true, message: "Subscription cancelled successfully" });
    } catch (error) {
      console.error(`[BILLING] Subscription cancellation failed:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        subscriptionId,
        shop: session.shop,
        timestamp: new Date().toISOString()
      });
      return json({ error: "Failed to cancel subscription" }, { status: 400 });
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

const FeatureIcon = ({ included }: { included: boolean | string }) => {
  if (included === false) {
    return <Icon source={XIcon} tone="critical" />;
  }
  return <Icon source={CheckIcon} tone="success" />;
};

const PricingCard = ({
  title,
  price,
  period,
  description,
  features,
  buttonText,
  buttonVariant,
  isPopular,
  isFree,
  isCurrentPlan,
  onSubscribe,
  loading
}: {
  title: string;
  price: string;
  period: string;
  description: string;
  features: (boolean | string)[];
  buttonText: string;
  buttonVariant: "primary" | "secondary";
  isPopular?: boolean;
  isFree?: boolean;
  isCurrentPlan?: boolean;
  onSubscribe: () => void;
  loading: boolean;
}) => {
  return (
    <Card>
      <div
        style={{
          background: isCurrentPlan
            ? 'linear-gradient(135deg, #e0f2fe 0%, #f1f8ff 100%)'
            : isPopular
              ? 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
              : isFree
                ? 'linear-gradient(135deg, #fefefe 0%, #f9fafb 100%)'
                : undefined,
          borderRadius: '12px',
          border: isCurrentPlan ? '2px solid #1976d2' : undefined,
          position: 'relative' as const,
          minHeight: '100%',
        }}
      >
        <Box padding="600">
          <BlockStack gap="500">
            {/* Header */}
            <Box>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="start">
                  <Text variant="headingLg" as="h3" tone={isPopular ? "magic" : undefined}>
                    {title}
                  </Text>
                  {isCurrentPlan && (
                    <Badge tone="info" size="small">
                      ✓ Current Plan
                    </Badge>
                  )}
                  {isPopular && !isCurrentPlan && (
                    <Badge tone="magic" size="small">
                      Most Popular
                    </Badge>
                  )}
                  {isFree && !isCurrentPlan && (
                    <Badge tone="success" size="small">
                      Free Forever
                    </Badge>
                  )}
                </InlineStack>

                <Box>
                  <InlineStack gap="100" blockAlign="end">
                    <Text
                      variant="heading2xl"
                      as="p"
                      tone={isPopular ? "magic" : isFree ? "success" : undefined}
                    >
                      {price}
                    </Text>
                    {period && (
                      <Text variant="bodyMd" tone="subdued" as="p">
                        {period}
                      </Text>
                    )}
                  </InlineStack>
                </Box>

                <Text variant="bodyMd" tone="subdued" as="p">
                  {description}
                </Text>
              </BlockStack>
            </Box>

            <Divider />

            {/* Features */}
            <Box>
              <BlockStack gap="300">
                {planFeatures.map((feature, index) => (
                  <InlineStack key={index} gap="300" align="start" wrap={false}>
                    <Box paddingBlockStart="050" minWidth="24px">
                      <FeatureIcon included={features[index]} />
                    </Box>
                    <Box>
                      <BlockStack gap="100">
                        <Text variant="bodyMd" breakWord as="p">
                          {feature.name}
                        </Text>
                        {typeof features[index] === "string" && (
                          <Text variant="bodySm" tone="subdued" as="p">
                            {features[index]}
                          </Text>
                        )}
                      </BlockStack>
                    </Box>
                  </InlineStack>
                ))}
              </BlockStack>
            </Box>

            {/* CTA Button */}
            <Box paddingBlockStart="500">
              <Button
                variant={isPopular ? "primary" : buttonVariant}
                size="large"
                fullWidth
                onClick={onSubscribe}
                loading={loading}
                disabled={isCurrentPlan}
                tone={isFree ? "success" : undefined}
              >
                {isCurrentPlan ? "Current Plan" : buttonText}
              </Button>
            </Box>
          </BlockStack>
        </Box>
      </div>
    </Card>
  );
};

const FAQItem = ({ question, answer, isOpen, onToggle }: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) => {
  return (
    <Card>
      <Box>
        <div
          role="button"
          tabIndex={0}
          style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
          onClick={onToggle}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}
        >
          <Box padding="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd" as="h3">
                {question}
              </Text>
              <Icon source={isOpen ? ChevronUpIcon : ChevronDownIcon} />
            </InlineStack>
          </Box>
        </div>
        <Collapsible open={isOpen} id={`faq-collapsible-${question.replace(/\s+/g, '-').toLowerCase()}`}>
          <Box paddingInlineStart="400" paddingInlineEnd="400" paddingBlockEnd="400">
            <Text variant="bodyMd" tone="subdued" as="p">
              {answer}
            </Text>
          </Box>
        </Collapsible>
      </Box>
    </Card>
  );
};

// Error boundary component to catch React errors
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('[BILLING] Caught error:', error);
      if (error.message.includes('Minified React error')) {
        setHasError(true);
        // Try to recover after a brief delay
        setTimeout(() => setHasError(false), 1000);
      }
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  
  if (hasError) {
    return (
      <Page>
        <Banner tone="warning">
          <Text as="p">The app is recovering from an error. Please wait a moment...</Text>
        </Banner>
      </Page>
    );
  }
  
  return <>{children}</>;
}

export default function Pricing() {
  const { user, currentSubscription, success } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showToast, setShowToast] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Set client flag to avoid hydration issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle success parameter from URL and clean up problematic parameters
  useEffect(() => {
    if (success) {
      setShowSuccessToast(true);
      
      // Clean up URL parameters that might cause issues after payment
      try {
        const currentUrl = new URL(window.location.href);
        const hasCleanupParams = currentUrl.searchParams.has('success') || 
                                currentUrl.searchParams.has('processed') || 
                                currentUrl.searchParams.has('billing_redirect');
        
        if (hasCleanupParams) {
          // Remove parameters that are no longer needed
          currentUrl.searchParams.delete('processed');
          currentUrl.searchParams.delete('billing_redirect');
          // Keep success parameter for toast display
          
          window.history.replaceState({}, '', currentUrl.toString());
        }
      } catch (error) {
        console.warn('[BILLING] Error cleaning URL parameters:', error);
      }
    }
  }, [success]);

  // Handle billing API confirmation URL redirect (also needs iframe breakout)
  useEffect(() => {
    // Only run on client side to avoid hydration issues
    if (!isClient) return;

    // Guard: ensure actionData shape before accessing properties
    const hasRedirect =
      !!actionData &&
      typeof actionData === "object" &&
      "redirectUrl" in (actionData as any) &&
      typeof (actionData as any).redirectUrl === "string" &&
      (actionData as any).redirectUrl.length > 0;

    if (!hasRedirect) return;
    if (navigation.state !== "idle") return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const hasProcessedRedirect = urlParams.get("processed") === "true";

      if (!hasProcessedRedirect) {
        console.log("[BILLING] Redirecting to billing confirmation URL:", (actionData as any).redirectUrl);

        // Set processed flag immediately to prevent re-execution
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.set("processed", "true");
        window.history.replaceState({}, "", cleanUrl.toString());

        // Force full page navigation to break out of any problematic iframe context
        (window.top || window).location.assign((actionData as any).redirectUrl as string);
      }
    } catch (error) {
      console.error("[BILLING] Error in redirect handler:", error);
      // Fallback: still try to redirect even if there's an error
      try {
        (window.top || window).location.assign((actionData as any).redirectUrl as string);
      } catch {
        // no-op
      }
    }
  }, [actionData, navigation.state, isClient]);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  // const app = useAppBridge();

  // Import plan constants for consistency
  const IMPORTED_STARTER_PLAN = "starter_plan";
  const IMPORTED_PRO_PLAN = "pro_plan";
  const IMPORTED_ENTERPRISE_PLAN = "enterprise_plan";

  const isLoading = navigation.state === "submitting";
  // Provide user feedback if a click occurs but no redirect has happened yet
  useEffect(() => {
    if (navigation.state === "submitting") {
      // Optional: could show a toast/spinner; using console for lightweight signal
      console.log("[BILLING] Submitting subscription request…");
    }
  }, [navigation.state]);

  // Note: App Bridge redirect handling removed since we now use server-side redirects
  // This provides better embedded app context maintenance for managed pricing

  // Helper function to check if current plan matches
  const isCurrentPlan = (planKey: string) => {
    if (!currentSubscription) {
      return false;
    }
    
    // Check against both the planName from subscription and mapped values
    const planMapping: { [key: string]: string[] } = {
      "starter_plan": ["starter_plan", "Starter Plan"],
      "pro_plan": ["pro_plan", "Pro Plan"],
      "enterprise_plan": ["enterprise_plan", "Enterprise Plan"]
    };
    
    const possibleNames = planMapping[planKey] || [planKey];
    return possibleNames.includes(currentSubscription.planName);
  };

  // Helper function to check if user has an active plan based on user.plan
  const isUserOnPlan = (planKey: string) => {
    const planMapping: { [key: string]: string } = {
      "starter_plan": "starter",
      "pro_plan": "pro", 
      "enterprise_plan": "enterprise"
    };
    
    return user.plan === planMapping[planKey];
  };

  const faqData = [
    {
      question: "How do optimization credits work?",
      answer: "Each product optimization uses 1 credit. When you upgrade plans, new credits are added to your existing balance. Credits don't expire, so you can accumulate them over time. The Free plan includes 10 credits to get you started."
    },
    {
      question: "Can I change plans anytime?",
      answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and you'll be charged or credited accordingly."
    },
    {
      question: "What happens to my data if I cancel?",
      answer: "Your optimized content stays on your store permanently. You'll lose access to new optimizations but keep all previous work."
    },
    {
      question: "How does billing work?",
      answer: "Billing is handled entirely by Shopify for your security and convenience. You're billed monthly through Shopify's system on the date you subscribe. The Free plan is always free with no hidden costs. You can cancel or change plans at any time through your Shopify admin."
    },
    {
      question: "Is the Free plan really free forever?",
      answer: "Yes! The Free plan includes 5 optimization credits per month forever, with access to basic SEO features. No credit card required."
    }
  ];

  const handleSubscribe = async (planName: string) => {
    // Get the host from the current URL to preserve embedded context
    const urlParams = new URLSearchParams(window.location.search);
    const host = urlParams.get("host");

    // Skip form submission for free plan since it doesn't require billing
    if (planName === FREE_PLAN) {
      return;
    }

    // Prefer Remix fetcher via form submit to ensure actionData is populated
    try {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = window.location.pathname + window.location.search;
      form.style.display = "none";

      const intentInput = document.createElement("input");
      intentInput.type = "hidden";
      intentInput.name = "intent";
      intentInput.value = "subscribe";
      form.appendChild(intentInput);

      const planInput = document.createElement("input");
      planInput.type = "hidden";
      planInput.name = "plan";
      planInput.value = planName;
      form.appendChild(planInput);

      if (host) {
        const hostInput = document.createElement("input");
        hostInput.type = "hidden";
        hostInput.name = "host";
        hostInput.value = host;
        form.appendChild(hostInput);
      }

      document.body.appendChild(form);
      form.submit();
    } catch (e) {
      console.error("[BILLING] Failed to submit subscribe action:", e);
    }
  };

  const handleCancel = () => {
    if (currentSubscription) {
      const form = document.createElement("form");
      form.method = "POST";
      form.style.display = "none";

      const intentInput = document.createElement("input");
      intentInput.type = "hidden";
      intentInput.name = "intent";
      intentInput.value = "cancel";
      form.appendChild(intentInput);

      const subscriptionInput = document.createElement("input");
      subscriptionInput.type = "hidden";
      subscriptionInput.name = "subscriptionId";
      subscriptionInput.value = currentSubscription.id;
      form.appendChild(subscriptionInput);

      document.body.appendChild(form);
      form.submit();
    }
  };

  const toastMarkup = (actionData && 'success' in actionData && actionData.success && showToast) ? (
    <Toast
      content={('message' in actionData && typeof actionData.message === 'string' ? actionData.message : null) || "Plan updated successfully!"}
      onDismiss={() => setShowToast(false)}
    />
  ) : null;

  // Note: redirect toast removed since we now use server-side redirects

  const successToastMarkup = showSuccessToast ? (
    <Toast
      content="Subscription created successfully! Your plan is now active."
      onDismiss={() => setShowSuccessToast(false)}
    />
  ) : null;

  return (
    <ErrorBoundary>
      <Frame>
        <Page>
          <TitleBar title="Pricing & Plans" />

          {/* Header Section */}
          <div
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '16px',
              color: 'white'
            }}
          >
            <Box padding="800">
              <BlockStack gap="500" align="center">
                <Text variant="heading2xl" as="h1" alignment="center" tone="text-inverse">
                  Choose Your SEO Optimization Plan
                </Text>
                <Text variant="bodyLg" alignment="center" tone="text-inverse" as="p">
                  Transform your Shopify store with AI-powered SEO optimization.
                  <br />
                  Start free and scale as you grow.
                  <br /><br />
                  <strong>✅ Billing is securely managed by Shopify</strong>
                  <br />
                  <strong>✅ One-click subscription management</strong>
                  <br />
                  <strong>✅ Cancel anytime through Shopify</strong>
                </Text>

                {process.env.NODE_ENV === "development" && (
                  <Box paddingBlockStart="200">
                    <Banner tone="warning">
                      <Text as="p" variant="bodySm">
                        Debug Info: User Plan = "{user.plan}", Subscription = {currentSubscription ? `"${currentSubscription.planName}"` : "none"}
                      </Text>
                      {actionData && 'message' in actionData && actionData.message && (
                        <Text as="p" variant="bodySm" fontWeight="semibold">
                          Last Result: {String(actionData.message)}
                        </Text>
                      )}
                      <Text as="p" variant="bodySm" tone="subdued">
                        ✅ Now using API-based billing (appSubscriptionCreate) - no more shop URL prompts!
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        🔧 Fixed webhook to handle both 'id' and 'admin_graphql_api_id' fields
                      </Text>
                      <Box paddingBlockStart="300">
                        <Text as="p" variant="bodySm" fontWeight="semibold">
                          Manual Plan Update (Development Only):
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          ℹ️ Credits are now ADDED to balance, not SET (except free plan)
                        </Text>
                        <InlineStack gap="200" blockAlign="center">
                          <Button 
                            size="micro" 
                            onClick={() => {
                              const form = document.createElement("form");
                              form.method = "POST";
                              form.style.display = "none";
                              
                              const intentInput = document.createElement("input");
                              intentInput.type = "hidden";
                              intentInput.name = "intent";
                              intentInput.value = "manualUpdate";
                              form.appendChild(intentInput);
                              
                              const planInput = document.createElement("input");
                              planInput.type = "hidden";
                              planInput.name = "planName";
                              planInput.value = "starter_plan";
                              form.appendChild(planInput);
                              
                              document.body.appendChild(form);
                              form.submit();
                            }}
                          >
                            Set Starter
                          </Button>
                          <Button 
                            size="micro" 
                            onClick={() => {
                              const form = document.createElement("form");
                              form.method = "POST";
                              form.style.display = "none";
                              
                              const intentInput = document.createElement("input");
                              intentInput.type = "hidden";
                              intentInput.name = "intent";
                              intentInput.value = "manualUpdate";
                              form.appendChild(intentInput);
                              
                              const planInput = document.createElement("input");
                              planInput.type = "hidden";
                              planInput.name = "planName";
                              planInput.value = "pro_plan";
                              form.appendChild(planInput);
                              
                              document.body.appendChild(form);
                              form.submit();
                            }}
                          >
                            Set Pro
                          </Button>
                          <Button 
                            size="micro" 
                            onClick={() => {
                              const form = document.createElement("form");
                              form.method = "POST";
                              form.style.display = "none";
                              
                              const intentInput = document.createElement("input");
                              intentInput.type = "hidden";
                              intentInput.name = "intent";
                              intentInput.value = "manualUpdate";
                              form.appendChild(intentInput);
                              
                              const planInput = document.createElement("input");
                              planInput.type = "hidden";
                              planInput.name = "planName";
                              planInput.value = "free";
                              form.appendChild(planInput);
                              
                              document.body.appendChild(form);
                              form.submit();
                            }}
                          >
                            Set Free
                          </Button>
                        </InlineStack>
                      </Box>
                    </Banner>
                  </Box>
                )}
              </BlockStack>
            </Box>
          </div>

          {/* Pricing Cards */}
          <Box paddingBlockStart="800">
            <Grid columns={{ xs: 1, sm: 1, md: 2, lg: 4 }} gap={{ xs: "400", sm: "500", md: "600", lg: "600" }}>
              <Grid.Cell>
                <PricingCard
                  title="Free"
                  price="$0"
                  period=""
                  description="Perfect for trying out our SEO optimization"
                  features={planFeatures.map(f => f.free)}
                  buttonText={user.plan === "free" && !currentSubscription ? "Current Plan" : "Get Started Free"}
                  buttonVariant="secondary"
                  isFree={true}
                  isCurrentPlan={user.plan === "free" && !currentSubscription}
                  onSubscribe={() => handleSubscribe(FREE_PLAN)}
                  loading={isLoading}
                />
              </Grid.Cell>

              <Grid.Cell>
                <PricingCard
                  title="Starter"
                  price="$9.99"
                  period="per month"
                  description="Perfect for small stores getting started with SEO"
                  features={planFeatures.map(f => f.starter)}
                  buttonText={isCurrentPlan(IMPORTED_STARTER_PLAN) || isUserOnPlan(IMPORTED_STARTER_PLAN) ? "Current Plan" : "Choose Plan"}
                  buttonVariant="secondary"
                  isCurrentPlan={isCurrentPlan(IMPORTED_STARTER_PLAN) || isUserOnPlan(IMPORTED_STARTER_PLAN)}
                  onSubscribe={() => handleSubscribe(IMPORTED_STARTER_PLAN)}
                  loading={isLoading}
                />
              </Grid.Cell>

              <Grid.Cell>
                <PricingCard
                  title="Pro"
                  price="$29.99"
                  period="per month"
                  description="For growing stores that need advanced SEO features"
                  features={planFeatures.map(f => f.pro)}
                  buttonText={isCurrentPlan(IMPORTED_PRO_PLAN) || isUserOnPlan(IMPORTED_PRO_PLAN) ? "Current Plan" : "Choose Plan"}
                  buttonVariant="primary"
                  isPopular={true}
                  isCurrentPlan={isCurrentPlan(IMPORTED_PRO_PLAN) || isUserOnPlan(IMPORTED_PRO_PLAN)}
                  onSubscribe={() => handleSubscribe(IMPORTED_PRO_PLAN)}
                  loading={isLoading}
                />
              </Grid.Cell>

              <Grid.Cell>
                <PricingCard
                  title="Enterprise"
                  price="$59.99"
                  period="per month"
                  description="For large stores with unlimited optimization needs"
                  features={planFeatures.map(f => f.enterprise)}
                  buttonText={isCurrentPlan(IMPORTED_ENTERPRISE_PLAN) || isUserOnPlan(IMPORTED_ENTERPRISE_PLAN) ? "Current Plan" : "Choose Plan"}
                  buttonVariant="secondary"
                  isCurrentPlan={isCurrentPlan(IMPORTED_ENTERPRISE_PLAN) || isUserOnPlan(IMPORTED_ENTERPRISE_PLAN)}
                  onSubscribe={() => handleSubscribe(IMPORTED_ENTERPRISE_PLAN)}
                  loading={isLoading}
                />
              </Grid.Cell>
            </Grid>
          </Box>

          {/* Current Subscription Status */}
          {currentSubscription && (
            <Box paddingBlockStart="800">
              <Banner
                title={`Currently subscribed to ${currentSubscription.planName}`}
                tone="success"
                action={{
                  content: "Cancel Subscription",
                  onAction: handleCancel,
                }}
              >
                <Text as="p">
                  You have <strong>{user.credits} optimization credits</strong> remaining this month. Your subscription renews automatically through Shopify.
                  {process.env.NODE_ENV === "development" && (
                    <Text as="span" variant="bodySm" tone="subdued">
                      <br />💡 Dev note: Plan changes ADD credits to your balance (except switching to free)
                    </Text>
                  )}
                </Text>
              </Banner>
            </Box>
          )}

          {/* FAQ Section */}
          <Box paddingBlockStart="1000">
            <Card>
              <Box padding="800">
                <BlockStack gap="800">
                  <Text variant="heading2xl" as="h2" alignment="center">
                    Frequently Asked Questions
                  </Text>

                  <BlockStack gap="400">
                    {faqData.map((faq, index) => (
                      <FAQItem
                        key={index}
                        question={faq.question}
                        answer={faq.answer}
                        isOpen={openFAQ === index}
                        onToggle={() => setOpenFAQ(openFAQ === index ? null : index)}
                      />
                    ))}
                  </BlockStack>
                </BlockStack>
              </Box>
            </Card>
          </Box>

          {toastMarkup}
          {successToastMarkup}
        </Page>
      </Frame>
    </ErrorBoundary>
  );
}
