import { useState } from "react";
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
import { authenticate } from "../shopify.server";
import { ensureUserExists } from "../utils/db.server";

// Plan constants - keep in sync with shopify.server.ts
const FREE_PLAN = "Free Plan";
const STARTER_PLAN = "Starter Plan";
const PRO_PLAN = "Pro Plan";
const ENTERPRISE_PLAN = "Enterprise Plan";

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
  billingSuccess?: boolean;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session, billing } = await authenticate.admin(request);
    console.log(`[PRICING] Loader called for shop: ${session.shop}`);
    
    const { STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN } = await import("../shopify.server");

    const user = await ensureUserExists(session.shop);
    console.log(`[PRICING] User loaded: ${user.id} for shop: ${user.shop}`);
    
    const url = new URL(request.url);
    const billingSuccess = url.searchParams.get("billing") === "success";

    // Check current billing status
    console.log(`[PRICING] Checking billing status for plans: ${[STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN]}`);
    console.log(`[PRICING] Using test mode: ${process.env.NODE_ENV !== "production"}`);
    
    let currentSubscription = null;
    try {
      const billingCheck = await billing.check({
        plans: [STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN],
        isTest: process.env.NODE_ENV !== "production",
      });

      currentSubscription = billingCheck.appSubscriptions.length > 0
        ? {
          id: billingCheck.appSubscriptions[0].id,
          planName: billingCheck.appSubscriptions[0].name,
          status: "active",
        }
        : null;
    } catch (billingError) {
      console.error(`[PRICING] Billing check failed:`, billingError);
      // Continue without subscription info - user will see free plan
      currentSubscription = null;
    }

    console.log(`[PRICING] Current subscription:`, currentSubscription);

    // If billing was successful, log it
    if (billingSuccess && currentSubscription) {
      console.log(`[BILLING] Billing completed successfully for shop: ${session.shop}`, {
        planName: currentSubscription.planName,
        subscriptionId: currentSubscription.id,
        timestamp: new Date().toISOString()
      });
    }

    return json<LoaderData>({
      user: {
        id: user.id,
        shop: user.shop,
        plan: user.plan,
        credits: user.credits,
      },
      currentSubscription,
      billingSuccess,
    });
  } catch (error) {
    console.error(`[PRICING] Loader error:`, error);
    throw error;
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session, billing } = await authenticate.admin(request);
    const { STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN } = await import("../shopify.server");

    const formData = await request.formData();
    const intent = formData.get("intent");
    const planName = formData.get("plan") as string;
    
    console.log(`[PRICING] Action called: intent=${intent}, plan=${planName}, shop=${session.shop}`);

  if (intent === "subscribe") {
    console.log(`[BILLING] Subscribe request initiated:`, {
      shop: session.shop,
      planName,
      isTest: process.env.NODE_ENV !== "production",
      timestamp: new Date().toISOString()
    });
    
    try {
      // Map plan names to actual plan objects
      const planMap = {
        [STARTER_PLAN]: STARTER_PLAN,
        [PRO_PLAN]: PRO_PLAN,
        [ENTERPRISE_PLAN]: ENTERPRISE_PLAN,
      };

      const selectedPlan = planMap[planName as keyof typeof planMap];
      if (!selectedPlan) {
        console.error(`[BILLING] Invalid plan selected:`, { planName, availablePlans: Object.keys(planMap) });
        return json({ error: "Invalid plan selected" }, { status: 400 });
      }

      console.log(`[BILLING] Initiating billing request for plan:`, selectedPlan);
      
      // billing.request throws a redirect response, it doesn't return
      await billing.request({
        plan: selectedPlan as typeof STARTER_PLAN | typeof PRO_PLAN | typeof ENTERPRISE_PLAN,
        isTest: process.env.NODE_ENV !== "production",
        returnUrl: `${process.env.SHOPIFY_APP_URL}/app/pricing?billing=success`,
      });

      console.log(`[BILLING] Billing request completed successfully`);
      // This line should never be reached due to the redirect above
      return json({ success: true });
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

  if (intent === "cancel") {
    const subscriptionId = formData.get("subscriptionId") as string;
    
    console.log(`[BILLING] Cancel request initiated:`, {
      shop: session.shop,
      subscriptionId,
      isTest: process.env.NODE_ENV !== "production",
      timestamp: new Date().toISOString()
    });
    
    try {
      await billing.cancel({
        subscriptionId,
        isTest: process.env.NODE_ENV !== "production",
        prorate: true,
      });

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
  } catch (error) {
    console.error(`[PRICING] Action error:`, error);
    return json({ error: "Server error occurred" }, { status: 500 });
  }
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
          background: isPopular
            ? 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
            : isFree
              ? 'linear-gradient(135deg, #fefefe 0%, #f9fafb 100%)'
              : undefined,
          borderRadius: '12px',
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
                  {isPopular && (
                    <Badge tone="magic" size="small">
                      Most Popular
                    </Badge>
                  )}
                  {isFree && (
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

export default function Pricing() {
  const { user, currentSubscription, billingSuccess } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showToast, setShowToast] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  // Import plan constants for consistency
  const IMPORTED_STARTER_PLAN = "Starter Plan";
  const IMPORTED_PRO_PLAN = "Pro Plan";
  const IMPORTED_ENTERPRISE_PLAN = "Enterprise Plan";

  const isLoading = navigation.state === "submitting";

  const faqData = [
    {
      question: "How do optimization credits work?",
      answer: "Each product optimization uses 1 credit. Credits reset monthly on your billing date. The Free plan includes 5 credits per month to get you started."
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
      answer: "You're billed monthly on the date you subscribe. The Free plan is always free with no hidden costs. You can cancel or change plans at any time."
    },
    {
      question: "Is the Free plan really free forever?",
      answer: "Yes! The Free plan includes 5 optimization credits per month forever, with access to basic SEO features. No credit card required."
    }
  ];

  const handleSubscribe = async (planName: string) => {
    // Skip form submission for free plan since it doesn't require billing
    if (planName === FREE_PLAN) {
      return;
    }

    const form = document.createElement("form");
    form.method = "POST";
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

    document.body.appendChild(form);
    form.submit();
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

  return (
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
                </Text>

                {billingSuccess && currentSubscription && (
                  <Box paddingBlockStart="400">
                    <Banner
                      title="Subscription activated successfully!"
                      tone="success"
                    >
                      <Text as="p">
                        Welcome to {currentSubscription.planName}! You now have access to all premium features.
                      </Text>
                    </Banner>
                  </Box>
                )}

                {currentSubscription && !billingSuccess && (
                  <Box paddingBlockStart="400">
                    <Banner
                      title={`Currently on ${currentSubscription.planName}`}
                      tone="info"
                      action={{
                        content: "Cancel Subscription",
                        onAction: handleCancel,
                      }}
                    >
                      <Text as="p">
                        You have {user.credits} optimization credits remaining this month.
                      </Text>
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
                  buttonText="Get Started Free"
                  buttonVariant="secondary"
                  isFree={true}
                  isCurrentPlan={currentSubscription?.planName === FREE_PLAN}
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
                  buttonText="Get Started"
                  buttonVariant="secondary"
                  isCurrentPlan={currentSubscription?.planName === IMPORTED_STARTER_PLAN}
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
                  buttonText="Get Started"
                  buttonVariant="primary"
                  isPopular={true}
                  isCurrentPlan={currentSubscription?.planName === IMPORTED_PRO_PLAN}
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
                  buttonText="Contact Sales"
                  buttonVariant="secondary"
                  isCurrentPlan={currentSubscription?.planName === IMPORTED_ENTERPRISE_PLAN}
                  onSubscribe={() => handleSubscribe(IMPORTED_ENTERPRISE_PLAN)}
                  loading={isLoading}
                />
              </Grid.Cell>
            </Grid>
          </Box>

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
        </Page>
      </Frame>
  );
}