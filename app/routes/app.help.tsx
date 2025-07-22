import React, { useState } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Box,
  TextField,
  Select,
  FormLayout,
  Badge,
  Collapsible,
  Banner,
  Toast,
  Frame,
  Grid,
  Icon,
  List,
  Divider,
  EmptyState,
} from "@shopify/polaris";
import { 
  QuestionCircleIcon, 
  EmailIcon, 
  ChatIcon, 
  PlayIcon,
  NoteIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SearchIcon,
  ChatIcon as SupportIcon
} from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { ensureUserExists } from "../utils/db.server";
import { sendContactFormEmail } from "../utils/email.server";

interface LoaderData {
  user: {
    id: string;
    shop: string;
    plan: string;
    credits: number;
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (!session || !session.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const user = await ensureUserExists(session.shop);

  return json<LoaderData>({ user });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (!session || !session.shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "contact") {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const subject = formData.get("subject") as string;
    const category = formData.get("category") as string;
    const message = formData.get("message") as string;
    const priority = formData.get("priority") as string;

    // Validate required fields
    if (!name || !email || !subject || !message || !category) {
      return json({ 
        error: "Please fill in all required fields",
        success: false 
      }, { status: 400 });
    }

    // Send email using the email utility
    const emailData = {
      shop: session.shop,
      name,
      email,
      subject,
      category,
      message,
      priority,
      timestamp: new Date().toISOString()
    };

    const emailSent = await sendContactFormEmail(emailData);

    if (!emailSent) {
      return json({ 
        error: "Failed to send your message. Please try again later.",
        success: false 
      }, { status: 500 });
    }

    return json({ 
      success: true, 
      message: "Your support request has been submitted successfully! We'll get back to you within 24 hours." 
    });
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

// FAQ Data
const faqData = [
  {
    category: "Getting Started",
    icon: PlayIcon,
    items: [
      {
        question: "How do I start optimizing my products?",
        answer: "Navigate to the 'SEO Optimization' page from the main menu, select the products you want to optimize, and click the 'Optimize Selected' button. The AI will enhance your product titles, descriptions, and SEO metadata using 2025 best practices."
      },
      {
        question: "What are optimization credits and how do they work?",
        answer: "Credits are used to power the AI optimization process. Each product optimization consumes 1 credit. Free plans include 10 credits, while paid plans offer more credits and unlimited optimizations. Credits reset monthly on paid plans."
      },
      {
        question: "How long does the optimization process take?",
        answer: "Most optimizations complete within 30-60 seconds per product. Bulk optimizations may take longer depending on the number of products selected. We recommend optimizing 5-10 products at a time for best results."
      }
    ]
  },
  {
    category: "Features & Functionality",
    icon: SupportIcon,
    items: [
      {
        question: "What SEO elements does the app optimize?",
        answer: "The app optimizes product titles, descriptions, meta descriptions, and handles using 2025 SEO best practices. It also suggests relevant keywords, improves content readability, and ensures mobile-friendly formatting."
      },
      {
        question: "Can I customize the optimization instructions?",
        answer: "Yes! You can add special instructions that will be applied to all optimizations. This helps maintain your brand voice and specific requirements. Access this through the 'Special Instructions' button on the products page."
      },
      {
        question: "How do I add target keywords?",
        answer: "Go to your dashboard and use the 'SEO Keywords' section to add relevant keywords. The AI will use these to better optimize your products. We recommend adding at least 3-5 keywords for best results."
      }
    ]
  },
  {
    category: "Billing & Plans",
    icon: EmailIcon,
    items: [
      {
        question: "What's included in the free plan?",
        answer: "The free plan includes 10 optimization credits, basic SEO optimization, and access to all core features. Perfect for trying out the app and optimizing a few key products."
      },
      {
        question: "How do I upgrade my plan?",
        answer: "Visit the 'Pricing' page to view and select a plan that fits your needs. Upgrades are processed instantly through Shopify's secure billing system."
      },
      {
        question: "Can I cancel my subscription anytime?",
        answer: "Yes, you can cancel your subscription at any time through the Pricing page. You'll retain access to paid features until the end of your current billing period."
      }
    ]
  },
  {
    category: "Troubleshooting",
    icon: QuestionCircleIcon,
    items: [
      {
        question: "Why isn't my optimization working?",
        answer: "Check that you have sufficient credits and that your products are published. If issues persist, try optimizing one product at a time, clear your browser cache, or contact our support team."
      },
      {
        question: "My products aren't showing up, what should I do?",
        answer: "Ensure your products are published and not in draft status. The app only displays published products that are available for optimization. Also check your store's product permissions."
      },
      {
        question: "How do I report a bug or issue?",
        answer: "Use the contact form below to report any bugs or issues. Please include detailed steps to reproduce the problem, any error messages, and your browser information."
      }
    ]
  }
];

const contactCategories = [
  { label: "General Question", value: "general" },
  { label: "Technical Issue", value: "technical" },
  { label: "Billing Support", value: "billing" },
  { label: "Feature Request", value: "feature" },
  { label: "Bug Report", value: "bug" },
  { label: "Account Issue", value: "account" },
];

const priorityOptions = [
  { label: "Low - General inquiry", value: "low" },
  { label: "Medium - Standard support", value: "medium" },
  { label: "High - Urgent issue", value: "high" },
];

export default function Help() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const fetcher = useFetcher();

  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    category: "general",
    message: "",
    priority: "medium"
  });

  const [openFaqItems, setOpenFaqItems] = useState<Record<string, boolean>>({});
  const [openFaqCategories, setOpenFaqCategories] = useState<Record<string, boolean>>({
    "Getting Started": true
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showToast, setShowToast] = useState(false);

  const isSubmitting = fetcher.state === "submitting";

  const handleContactFormChange = (field: string, value: string) => {
    setContactForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("intent", "contact");
    Object.entries(contactForm).forEach(([key, value]) => {
      formData.append(key, value);
    });

    fetcher.submit(formData, { method: "post" });
  };

  const toggleFaqItem = (category: string, index: number) => {
    const key = `${category}-${index}`;
    setOpenFaqItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFaqCategory = (category: string) => {
    setOpenFaqCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  // Filter FAQ items based on search
  const filteredFaqData = faqData.map(category => ({
    ...category,
    items: category.items.filter(item =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.items.length > 0);

  // Show success toast
  React.useEffect(() => {
    if (actionData && 'success' in actionData && actionData.success) {
      setShowToast(true);
      setContactForm({
        name: "",
        email: "",
        subject: "",
        category: "general",
        message: "",
        priority: "medium"
      });
    }
  }, [actionData]);

  const toastMarkup = showToast ? (
    <Toast
      content={(actionData && 'message' in actionData) ? actionData.message : "Success!"}
      onDismiss={() => setShowToast(false)}
    />
  ) : null;

  return (
    <Frame>
      <Page>
        <TitleBar title="Help & Support" />

        {toastMarkup}

        <Box paddingBlockEnd="800">
          <BlockStack gap="800">
            {/* Modern Hero Section */}
            <Card>
              <Box padding="800">
                <BlockStack gap="600" align="center">
                  <Box
                    background="bg-surface-brand"
                    padding="400"
                    borderRadius="full"
                  >
                    <Icon source={QuestionCircleIcon} tone="base" />
                  </Box>
                  <BlockStack gap="300" align="center">
                    <Text variant="heading2xl" as="h1" alignment="center">
                      How can we help you today?
                    </Text>
                    <Text variant="bodyLg" tone="subdued" as="p" alignment="center" breakWord>
                      Get instant answers from our knowledge base or reach out to our support team
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Box>
            </Card>

            {/* Quick Action Cards */}
            <Grid columns={{ xs: 1, sm: 2, md: 3 }} gap={{ xs: "500", sm: "500", md: "500" }}>
              <Grid.Cell>
                <Card>
                  <Box padding="500">
                    <BlockStack gap="400">
                      <Box
                        background="bg-surface-success"
                        padding="300"
                        borderRadius="200"
                        width="fit-content"
                      >
                        <Icon source={SearchIcon} tone="success" />
                      </Box>
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">
                          Search FAQ
                        </Text>
                        <Text variant="bodyMd" tone="subdued" as="p">
                          Find instant answers to common questions
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Box>
                </Card>
              </Grid.Cell>

              <Grid.Cell>
                <Card>
                  <Box padding="500">
                    <BlockStack gap="400">
                      <Box
                        background="bg-surface-info"
                        padding="300"
                        borderRadius="200"
                        width="fit-content"
                      >
                        <Icon source={EmailIcon} tone="info" />
                      </Box>
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">
                          Email Support
                        </Text>
                        <Text variant="bodyMd" tone="subdued" as="p">
                          Get help from our support team
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Box>
                </Card>
              </Grid.Cell>

              <Grid.Cell>
                <Card>
                  <Box padding="500">
                    <BlockStack gap="400">
                      <Box
                        background="bg-surface-warning"
                        padding="300"
                        borderRadius="200"
                        width="fit-content"
                      >
                        <Icon source={NoteIcon} tone="warning" />
                      </Box>
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">
                          Documentation
                        </Text>
                        <Text variant="bodyMd" tone="subdued" as="p">
                          Browse comprehensive guides below
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Box>
                </Card>
              </Grid.Cell>
            </Grid>

            {/* Account Information Card */}
            <Card>
              <Box padding="600">
                <BlockStack gap="500">
                  <Text variant="headingLg" as="h2">
                    Your Account
                  </Text>
                                     <Grid columns={{ xs: 1, sm: 2, md: 4 }} gap={{ xs: "400", sm: "400", md: "400" }}>
                    <Grid.Cell>
                      <BlockStack gap="200">
                        <Text variant="bodySm" tone="subdued" as="p">
                          Shop Domain
                        </Text>
                        <Text variant="bodyMd" fontWeight="semibold" as="p" breakWord>
                          {user.shop}
                        </Text>
                      </BlockStack>
                    </Grid.Cell>
                    <Grid.Cell>
                      <BlockStack gap="200">
                        <Text variant="bodySm" tone="subdued" as="p">
                          Current Plan
                        </Text>
                        <Badge tone={user.plan === "free" ? "attention" : "success"}>
                          {user.plan === "free" ? "Free Plan" : user.plan}
                        </Badge>
                      </BlockStack>
                    </Grid.Cell>
                    <Grid.Cell>
                      <BlockStack gap="200">
                        <Text variant="bodySm" tone="subdued" as="p">
                          Credits Remaining
                        </Text>
                        <Text variant="bodyMd" fontWeight="semibold" as="p">
                          {user.credits}
                        </Text>
                      </BlockStack>
                    </Grid.Cell>
                    <Grid.Cell>
                      <BlockStack gap="200">
                        <Text variant="bodySm" tone="subdued" as="p">
                          Account Status
                        </Text>
                        <Badge tone="success">Active</Badge>
                      </BlockStack>
                    </Grid.Cell>
                  </Grid>
                </BlockStack>
              </Box>
            </Card>

            {/* FAQ Section with Search */}
            <Card>
              <Box padding="600">
                <BlockStack gap="600">
                  <BlockStack gap="400">
                    <Text variant="headingLg" as="h2">
                      Frequently Asked Questions
                    </Text>
                    <Text variant="bodyMd" tone="subdued" as="p">
                      Search through our knowledge base to find quick answers
                    </Text>
                    
                    {/* Search Bar */}
                    <Box maxWidth="500px">
                      <TextField
                        label="Search FAQ"
                        labelHidden
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search for answers..."
                        autoComplete="off"
                        clearButton
                        onClearButtonClick={() => setSearchQuery("")}
                      />
                    </Box>
                  </BlockStack>

                  {searchQuery && filteredFaqData.length === 0 ? (
                    <EmptyState
                      heading="No results found"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      Try searching with different keywords or browse the categories below.
                    </EmptyState>
                  ) : (
                    <BlockStack gap="500">
                      {(searchQuery ? filteredFaqData : faqData).map((category) => (
                        <Card key={category.category} background="bg-surface-secondary">
                          <Box padding="500">
                            <BlockStack gap="400">
                              <div
                                onClick={() => toggleFaqCategory(category.category)}
                                style={{ cursor: "pointer", width: "100%" }}
                              >
                                <InlineStack align="space-between" blockAlign="center">
                                  <InlineStack gap="300" blockAlign="center">
                                    <Icon source={category.icon} tone="subdued" />
                                    <Text variant="headingMd" as="h3">
                                      {category.category}
                                    </Text>
                                  </InlineStack>
                                  <Icon
                                    source={openFaqCategories[category.category] ? ChevronUpIcon : ChevronDownIcon}
                                    tone="subdued"
                                  />
                                                                  </InlineStack>
                              </div>

                              <Collapsible
                                open={openFaqCategories[category.category] || !!searchQuery}
                                id={`faq-category-${category.category}`}
                              >
                                <BlockStack gap="300">
                                  {category.items.map((item, index) => {
                                    const isOpen = openFaqItems[`${category.category}-${index}`];
                                    return (
                                      <Card key={index} background="bg-surface">
                                        <Box padding="400">
                                          <BlockStack gap="300">
                                            <div
                                              onClick={() => toggleFaqItem(category.category, index)}
                                              style={{ cursor: "pointer", width: "100%" }}
                                            >
                                              <InlineStack align="space-between" blockAlign="center">
                                                <Text variant="bodyMd" fontWeight="semibold" as="p">
                                                  {item.question}
                                                </Text>
                                                <Icon
                                                  source={isOpen ? ChevronUpIcon : ChevronDownIcon}
                                                  tone="subdued"
                                                />
                                              </InlineStack>
                                            </div>

                                            <Collapsible
                                              open={isOpen || false}
                                              id={`faq-item-${category.category}-${index}`}
                                            >
                                              <Box paddingInlineStart="400" paddingBlockStart="200">
                                                <Text variant="bodyMd" tone="subdued" as="p">
                                                  {item.answer}
                                                </Text>
                                              </Box>
                                            </Collapsible>
                                          </BlockStack>
                                        </Box>
                                      </Card>
                                    );
                                  })}
                                </BlockStack>
                              </Collapsible>
                            </BlockStack>
                          </Box>
                        </Card>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Box>
            </Card>

            {/* Contact Form */}
            <Card>
              <Box padding="600">
                <BlockStack gap="600">
                  <BlockStack gap="300">
                    <Text variant="headingLg" as="h2">
                      Contact Support
                    </Text>
                    <Text variant="bodyMd" tone="subdued" as="p">
                      Can't find what you're looking for? Send us a message and we'll get back to you within 24 hours.
                    </Text>
                  </BlockStack>

                  {actionData && 'error' in actionData && (
                    <Banner title="Error" tone="critical">
                      <Text as="p">{actionData.error}</Text>
                    </Banner>
                  )}

                  <FormLayout>
                    <FormLayout.Group>
                      <TextField
                        label="Name"
                        value={contactForm.name}
                        onChange={(value) => handleContactFormChange("name", value)}
                        placeholder="Enter your full name"
                        requiredIndicator
                        autoComplete="name"
                      />
                      <TextField
                        label="Email"
                        type="email"
                        value={contactForm.email}
                        onChange={(value) => handleContactFormChange("email", value)}
                        placeholder="Enter your email address"
                        requiredIndicator
                        autoComplete="email"
                      />
                    </FormLayout.Group>

                    <FormLayout.Group>
                      <Select
                        label="Category"
                        options={contactCategories}
                        value={contactForm.category}
                        onChange={(value) => handleContactFormChange("category", value)}
                      />
                      <Select
                        label="Priority"
                        options={priorityOptions}
                        value={contactForm.priority}
                        onChange={(value) => handleContactFormChange("priority", value)}
                      />
                    </FormLayout.Group>

                    <TextField
                      label="Subject"
                      value={contactForm.subject}
                      onChange={(value) => handleContactFormChange("subject", value)}
                      placeholder="Brief description of your issue"
                      requiredIndicator
                      autoComplete="off"
                    />

                    <TextField
                      label="Message"
                      value={contactForm.message}
                      onChange={(value) => handleContactFormChange("message", value)}
                      placeholder="Please describe your question or issue in detail..."
                      multiline={6}
                      requiredIndicator
                      autoComplete="off"
                    />

                    <InlineStack align="end">
                      <Button
                        variant="primary"
                        onClick={handleSubmit}
                        loading={isSubmitting}
                        disabled={!contactForm.name || !contactForm.email || !contactForm.subject || !contactForm.message}
                      >
                        Send Message
                      </Button>
                    </InlineStack>
                  </FormLayout>
                </BlockStack>
              </Box>
            </Card>

            {/* Quick Links & Resources */}
            <Grid columns={{ xs: 1, md: 2 }} gap={{ xs: "600", md: "600" }}>
              <Grid.Cell>
                <Card>
                  <Box padding="600">
                    <BlockStack gap="500">
                      <Text variant="headingMd" as="h3">
                        Best Practices
                      </Text>
                      <List type="bullet">
                        <List.Item>Optimize 5-10 products at a time for best performance</List.Item>
                        <List.Item>Add relevant keywords to improve AI optimization accuracy</List.Item>
                        <List.Item>Use special instructions to maintain brand consistency</List.Item>
                        <List.Item>Review optimized content before publishing changes</List.Item>
                        <List.Item>Monitor your SEO performance after optimization</List.Item>
                      </List>
                    </BlockStack>
                  </Box>
                </Card>
              </Grid.Cell>

              <Grid.Cell>
                <Card>
                  <Box padding="600">
                    <BlockStack gap="500">
                      <Text variant="headingMd" as="h3">
                        Quick Links
                      </Text>
                      <BlockStack gap="300">
                        <Button variant="plain" url="/app/products" fullWidth textAlign="start">
                          🚀 Optimize Products
                        </Button>
                        <Button variant="plain" url="/app/pricing" fullWidth textAlign="start">
                          💳 View Pricing Plans
                        </Button>
                        <Button variant="plain" url="/app/dashboard" fullWidth textAlign="start">
                          📊 Account Dashboard
                        </Button>
                        <Divider />
                        <Text variant="bodySm" tone="subdued" as="p">
                          Need immediate help? Check our FAQ section above for instant answers.
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Box>
                </Card>
              </Grid.Cell>
            </Grid>
          </BlockStack>
        </Box>
      </Page>
    </Frame>
  );
} 