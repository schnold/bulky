import React, { useState } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useFetcher, Link } from "@remix-run/react";
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
  Banner,
  Toast,
  Frame,
  Icon,
  List,
  Divider,
} from "@shopify/polaris";
import { 
  QuestionCircleIcon, 
  EmailIcon
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


  // Show success toast and handle form reset
  React.useEffect(() => {
    if (actionData && 'success' in actionData && actionData.success) {
      setShowToast(true);
      // Reset form after successful submission
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

  // Helper function to safely get message from data
  const getMessage = (data: any): string => {
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
      return data.message;
    }
    return "Your message has been sent successfully!";
  };

  // Helper function to safely check success
  const checkSuccess = (data: any): boolean => {
    return data && typeof data === 'object' && 'success' in data && data.success === true;
  };

  // Helper function to safely get error message
  const getErrorMessage = (data: any): string => {
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      return data.error;
    }
    return "An error occurred. Please try again.";
  };

  // Also show success toast for fetcher submissions
  React.useEffect(() => {
    if (checkSuccess(fetcher.data)) {
      setShowToast(true);
      // Reset form after successful submission
      setContactForm({
        name: "",
        email: "",
        subject: "",
        category: "general",
        message: "",
        priority: "medium"
      });
    }
  }, [fetcher.data]);

  const isSuccessState = checkSuccess(actionData) || checkSuccess(fetcher.data);
  const hasError = (actionData && typeof actionData === 'object' && 'error' in actionData) || 
                  (fetcher.data && typeof fetcher.data === 'object' && 'error' in fetcher.data);

  const toastMarkup = showToast ? (
    <Toast
      content={getMessage(actionData) || getMessage(fetcher.data)}
      onDismiss={() => setShowToast(false)}
      duration={5000}
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
            <BlockStack gap="500">
              <Card>
                <Box padding="500">
                  <InlineStack gap="600" align="center">
                    <Box
                      background="bg-surface-info"
                      padding="300"
                      borderRadius="200"
                    >
                      <Icon source={EmailIcon} tone="info" />
                    </Box>
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Email Support
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        Get help from our support team using the contact form below
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Box>
              </Card>
            </BlockStack>


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

                 
                  {Boolean(hasError) && (
                    <Banner title="Error" tone="critical">
                      <Text as="p">
                        {getErrorMessage(actionData) || getErrorMessage(fetcher.data)}
                      </Text>
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
                          tone={isSuccessState ? "success" : undefined}
                        >
                          {isSuccessState ? "✓ Message Sent!" : "Send Message"}
                        </Button>
                      </InlineStack>
                  </FormLayout>
                </BlockStack>
              </Box>
            </Card>

            {/* Quick Links & Resources */}
            <BlockStack gap="600">
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

              <Card>
                <Box padding="600">
                  <BlockStack gap="500">
                    <Text variant="headingMd" as="h3">
                      Quick Links
                    </Text>
                    <BlockStack gap="300">
                      <Link to="/app/products" style={{ textDecoration: 'none' }}>
                        <Button variant="plain" fullWidth textAlign="start">
                          🚀 Optimize Products
                        </Button>
                      </Link>
                      <Link to="/app/pricing" style={{ textDecoration: 'none' }}>
                        <Button variant="plain" fullWidth textAlign="start">
                          💳 View Pricing Plans
                        </Button>
                      </Link>
                      <Link to="/app" style={{ textDecoration: 'none' }}>
                        <Button variant="plain" fullWidth textAlign="start">
                          📊 Account Dashboard
                        </Button>
                      </Link>
                      <Divider />
                      <Text variant="bodySm" tone="subdued" as="p">
                        Need immediate help? Use the contact form above to reach our support team.
                      </Text>
                    </BlockStack>
                  </BlockStack>
                </Box>
              </Card>
            </BlockStack>
          </BlockStack>
        </Box>
      </Page>
    </Frame>
  );
} 