import React, { useState } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useFetcher, Link } from "@remix-run/react";
import { useTranslation } from "../i18n-shim";
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
import i18nextServer from "../i18next.server";
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
  const t = await i18nextServer.getFixedT(request);
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
      message: t("help.toast_contact_success")
    });
  }

  return json({ error: "Invalid action" }, { status: 400 });
};


export default function Help() {
  const { t } = useTranslation();
  const contactCategories = [
    { label: t("help.cat_general"), value: "general" },
    { label: t("help.cat_technical"), value: "technical" },
    { label: t("help.cat_billing"), value: "billing" },
    { label: t("help.cat_feature"), value: "feature" },
    { label: t("help.cat_bug"), value: "bug" },
    { label: t("help.cat_account"), value: "account" },
  ];

  const priorityOptions = [
    { label: t("help.pri_low"), value: "low" },
    { label: t("help.pri_medium"), value: "medium" },
    { label: t("help.pri_high"), value: "high" },
  ];
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
    return t("help.toast_contact_success");
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
        <TitleBar title={t("help.title")} />

        {toastMarkup}

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
              <div
                style={{
                  padding: '16px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Icon source={QuestionCircleIcon} tone="base" />
              </div>
              <Text variant="heading2xl" as="h1" alignment="center" tone="text-inverse">
                {t("help.hero_title")}
              </Text>
              <Text variant="bodyLg" alignment="center" tone="text-inverse" as="p">
                {t("help.hero_subtitle")}
              </Text>
            </BlockStack>
          </Box>
        </div>

        <Box paddingBlockEnd="800">
          <BlockStack gap="800">

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
                        {t("help.email_support_title")}
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        {t("help.email_support_desc")}
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
                      {t("help.contact_title")}
                    </Text>
                    <Text variant="bodyMd" tone="subdued" as="p">
                      {t("help.contact_subtitle")}
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
                        label={t("help.form_name")}
                        value={contactForm.name}
                        onChange={(value) => handleContactFormChange("name", value)}
                        placeholder={t("help.form_name_placeholder")}
                        requiredIndicator
                        autoComplete="name"
                      />
                      <TextField
                        label={t("help.form_email")}
                        type="email"
                        value={contactForm.email}
                        onChange={(value) => handleContactFormChange("email", value)}
                        placeholder={t("help.form_email_placeholder")}
                        requiredIndicator
                        autoComplete="email"
                      />
                    </FormLayout.Group>

                    <FormLayout.Group>
                      <Select
                        label={t("help.form_category")}
                        options={contactCategories}
                        value={contactForm.category}
                        onChange={(value) => handleContactFormChange("category", value)}
                      />
                      <Select
                        label={t("help.form_priority")}
                        options={priorityOptions}
                        value={contactForm.priority}
                        onChange={(value) => handleContactFormChange("priority", value)}
                      />
                    </FormLayout.Group>

                    <TextField
                      label={t("help.form_subject")}
                      value={contactForm.subject}
                      onChange={(value) => handleContactFormChange("subject", value)}
                      placeholder={t("help.form_subject_placeholder")}
                      requiredIndicator
                      autoComplete="off"
                    />

                    <TextField
                      label={t("help.form_message")}
                      value={contactForm.message}
                      onChange={(value) => handleContactFormChange("message", value)}
                      placeholder={t("help.form_message_placeholder")}
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
                        {isSuccessState ? t("help.form_sent") : t("help.form_send")}
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
                      {t("help.best_practices_title")}
                    </Text>
                    <List type="bullet">
                      <List.Item>{t("help.bp_item1")}</List.Item>
                      <List.Item>{t("help.bp_item2")}</List.Item>
                      <List.Item>{t("help.bp_item3")}</List.Item>
                      <List.Item>{t("help.bp_item4")}</List.Item>
                      <List.Item>{t("help.bp_item5")}</List.Item>
                    </List>
                  </BlockStack>
                </Box>
              </Card>

              <Card>
                <Box padding="600">
                  <BlockStack gap="500">
                    <Text variant="headingMd" as="h3">
                      {t("help.quick_links_title")}
                    </Text>
                    <BlockStack gap="300">
                      <Link to="/app/products" style={{ textDecoration: 'none' }}>
                        <Button variant="plain" fullWidth textAlign="start">
                          🚀 {t("help.ql_optimize")}
                        </Button>
                      </Link>
                      <Link to="/app/pricing" style={{ textDecoration: 'none' }}>
                        <Button variant="plain" fullWidth textAlign="start">
                          💳 {t("help.ql_pricing")}
                        </Button>
                      </Link>
                      <Link to="/app" style={{ textDecoration: 'none' }}>
                        <Button variant="plain" fullWidth textAlign="start">
                          📊 {t("help.ql_dashboard")}
                        </Button>
                      </Link>
                      <Divider />
                      <Text variant="bodySm" tone="subdued" as="p">
                        {t("help.ql_footer")}
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