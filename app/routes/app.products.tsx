import React, { useState, useCallback, useEffect } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  TextField,
  Filters,
  ChoiceList,
  Pagination,
  BlockStack,
  InlineStack,
  Spinner,
  Button,
  Badge,
  Toast,
  Frame,
  Modal,
  FormLayout,
  Select,
  Checkbox,
  ButtonGroup,
  Icon,
  Thumbnail,
  Box,
  Divider,
} from "@shopify/polaris";
import { MagicIcon, CheckIcon, CreditCardIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

interface Product {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  featuredImage?: {
    url: string;
    altText?: string;
  };
  status: string;
  productType: string;
  vendor: string;
  tags: string[];
  createdAt: string;
  isOptimizing?: boolean;
  optimizationProgress?: number;
}

interface LoaderData {
  products: Product[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
  totalCount: number;
  currentPage: number;
  productsPerPage: number;
  user: {
    id: string;
    plan: string;
    credits: number;
  };
  subscription?: { planName: string } | null;
}

interface OptimizationContext {
  targetKeywords?: string;
  brand?: string;
  keyFeatures?: string;
  targetAudience?: string;
  useCase?: string;
  competitorAnalysis?: boolean;
  voiceSearchOptimization?: boolean;
}


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Mock user and subscription data for now
  const user = {
    id: session.shop,
    plan: "basic",
    credits: 100,
  };

  // Explicitly type subscription
  const subscription: { planName: string } | null = null;

  const url = new URL(request.url);
  const query = url.searchParams.get("query") || "";
  const status = url.searchParams.get("status") || "";
  const productType = url.searchParams.get("productType") || "";
  const vendor = url.searchParams.get("vendor") || "";
  const cursor = url.searchParams.get("cursor") || "";
  const direction = url.searchParams.get("direction") || "next";
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  // Build GraphQL query filters
  let queryString = "";
  const filters = [];

  if (query) filters.push(`title:*${query}*`);
  if (status && status !== "any") filters.push(`status:${status}`);
  if (productType) filters.push(`product_type:${productType}`);
  if (vendor) filters.push(`vendor:${vendor}`);

  if (filters.length > 0) {
    queryString = filters.join(" AND ");
  }

  // Pagination parameters
  const first = direction === "next" ? 15 : undefined;
  const last = direction === "previous" ? 15 : undefined;
  const after = direction === "next" && cursor ? cursor : undefined;
  const before = direction === "previous" && cursor ? cursor : undefined;

  const response = await admin.graphql(
    `#graphql
      query getProducts($first: Int, $last: Int, $after: String, $before: String, $query: String) {
        products(first: $first, last: $last, after: $after, before: $before, query: $query) {
          edges {
            node {
              id
              title
              descriptionHtml
              handle
              status
              productType
              vendor
              tags
              createdAt
              featuredImage {
                url
                altText
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }`,
    {
      variables: {
        first,
        last,
        after,
        before,
        query: queryString,
      },
    }
  );

  const responseJson = await response.json();
  const data = responseJson.data?.products;

  const products: Product[] = data?.edges?.map((edge: any) => edge.node) || [];

  return json<LoaderData>({
    products,
    pageInfo: data?.pageInfo || { hasNextPage: false, hasPreviousPage: false, startCursor: undefined, endCursor: undefined },
    totalCount: products.length,
    currentPage: page,
    productsPerPage: 15,
    user: {
      id: user.id,
      plan: user.plan,
      credits: user.credits,
    },
    subscription: subscription,
  });
};

// Sparkle Button Component
function SparkleButton({
  onClick,
  disabled,
  variant = "primary",
  children
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  children: string;
}) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      icon={MagicIcon}
      size="medium"
    >
      {children}
    </Button>
  );
}

export default function Products() {
  const { products, pageInfo, currentPage, productsPerPage, user, subscription } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const optimizeFetcher = useFetcher();

  const [searchValue, setSearchValue] = useState(searchParams.get("query") || "");
  const [statusFilter, setStatusFilter] = useState<string[]>(
    searchParams.get("status") ? [searchParams.get("status")!] : []
  );
  const [productTypeFilter, setProductTypeFilter] = useState(
    searchParams.get("productType") || ""
  );
  const [vendorFilter, setVendorFilter] = useState(
    searchParams.get("vendor") || ""
  );
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [optimizingProducts, setOptimizingProducts] = useState<Set<string>>(new Set());
  const [completedProducts, setCompletedProducts] = useState<Set<string>>(new Set());
  const [currentOptimizingProduct, setCurrentOptimizingProduct] = useState<string | null>(null);
  const [bulkOptimizationProgress, setBulkOptimizationProgress] = useState<{
    current: number;
    total: number;
    currentProductTitle: string;
    isActive: boolean;
  }>({ current: 0, total: 0, currentProductTitle: "", isActive: false });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [advancedContext, setAdvancedContext] = useState<OptimizationContext>({
    targetKeywords: "",
    brand: "",
    keyFeatures: "",
    targetAudience: "General consumers",
    useCase: "",
    competitorAnalysis: false,
    voiceSearchOptimization: true,
  });
  const [pendingOptimizationIds, setPendingOptimizationIds] = useState<string[]>([]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const handleStatusFilterChange = useCallback((value: string[]) => {
    setStatusFilter(value);
  }, []);

  const handleProductTypeFilterChange = useCallback((value: string) => {
    setProductTypeFilter(value);
  }, []);

  const handleVendorFilterChange = useCallback((value: string) => {
    setVendorFilter(value);
  }, []);

  // Auto-apply search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const newSearchParams = new URLSearchParams();
      if (searchValue) newSearchParams.set("query", searchValue);
      if (statusFilter.length > 0) newSearchParams.set("status", statusFilter[0]);
      if (productTypeFilter) newSearchParams.set("productType", productTypeFilter);
      if (vendorFilter) newSearchParams.set("vendor", vendorFilter);
      setSearchParams(newSearchParams);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchValue, statusFilter, productTypeFilter, vendorFilter, setSearchParams]);

  // Auto-apply filters immediately when they change
  useEffect(() => {
    const newSearchParams = new URLSearchParams();
    if (searchValue) newSearchParams.set("query", searchValue);
    if (statusFilter.length > 0) newSearchParams.set("status", statusFilter[0]);
    if (productTypeFilter) newSearchParams.set("productType", productTypeFilter);
    if (vendorFilter) newSearchParams.set("vendor", vendorFilter);
    setSearchParams(newSearchParams);
  }, [statusFilter, productTypeFilter, vendorFilter, setSearchParams]);

  const handleFiltersClearAll = useCallback(() => {
    setSearchValue("");
    setStatusFilter([]);
    setProductTypeFilter("");
    setVendorFilter("");
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);



  const handleOptimizeSelected = useCallback(() => {
    if (selectedItems.length === 0) return;

    setOptimizingProducts(new Set(selectedItems));
    setCompletedProducts(new Set());
    setBulkOptimizationProgress({
      current: 0,
      total: selectedItems.length,
      currentProductTitle: products.find(p => p.id === selectedItems[0])?.title || "Starting...",
      isActive: true
    });
    optimizeFetcher.submit(
      {
        intent: "optimize",
        productIds: JSON.stringify(selectedItems),
      },
      {
        method: "POST",
        action: "/api/optimize"
      }
    );
  }, [selectedItems, optimizeFetcher, products]);

  const handleOptimizeSingle = useCallback((productId: string) => {
    setOptimizingProducts(new Set([productId]));
    setCompletedProducts(new Set());
    setCurrentOptimizingProduct(productId);
    const productTitle = products.find(p => p.id === productId)?.title || "Unknown Product";
    setBulkOptimizationProgress({
      current: 0,
      total: 1,
      currentProductTitle: productTitle,
      isActive: true
    });
    optimizeFetcher.submit(
      {
        intent: "optimize",
        productIds: JSON.stringify([productId]),
      },
      {
        method: "POST",
        action: "/api/optimize"
      }
    );
  }, [optimizeFetcher, products]);

  const handleAdvancedOptimize = useCallback((productIds: string[]) => {
    setPendingOptimizationIds(productIds);
    setShowAdvancedModal(true);
  }, []);

  const handleAdvancedOptimizeSubmit = useCallback(() => {
    setOptimizingProducts(new Set(pendingOptimizationIds));
    setCompletedProducts(new Set());
    setBulkOptimizationProgress({
      current: 0,
      total: pendingOptimizationIds.length,
      currentProductTitle: products.find(p => p.id === pendingOptimizationIds[0])?.title || "Starting...",
      isActive: true
    });
    optimizeFetcher.submit(
      {
        intent: "optimize",
        productIds: JSON.stringify(pendingOptimizationIds),
        context: JSON.stringify(advancedContext),
      },
      {
        method: "POST",
        action: "/api/optimize"
      }
    );
    setShowAdvancedModal(false);
    setPendingOptimizationIds([]);
  }, [pendingOptimizationIds, advancedContext, optimizeFetcher, products]);

  const handleAdvancedContextChange = useCallback((field: keyof OptimizationContext, value: any) => {
    setAdvancedContext(prev => ({ ...prev, [field]: value }));
  }, []);

  // Handle optimization results
  const { data: fetcherData, state: fetcherState } = optimizeFetcher;

  // Real-time progress updates based on actual optimization timing
  useEffect(() => {
    if (fetcherState === "submitting" && bulkOptimizationProgress.isActive) {
      // Simulate progress based on estimated API call timing (3-5 seconds per product)
      const estimatedTimePerProduct = 4000; // 4 seconds average
      const totalProducts = bulkOptimizationProgress.total;

      const interval = setInterval(() => {
        setBulkOptimizationProgress(prev => {
          if (prev.current < prev.total && fetcherState === "submitting") {
            const nextIndex = Math.min(prev.current + 1, prev.total);
            const productIds = Array.from(optimizingProducts);
            const nextProductId = productIds[nextIndex - 1];
            const nextProduct = products.find(p => p.id === nextProductId);

            // Mark previous product as completed if we're moving to next
            if (prev.current > 0 && nextIndex > prev.current) {
              const completedProductId = productIds[prev.current - 1];
              setCompletedProducts(prevCompleted => new Set([...prevCompleted, completedProductId]));
            }

            return {
              ...prev,
              current: nextIndex,
              currentProductTitle: nextProduct?.title || `Product ${nextIndex}`
            };
          }
          return prev;
        });
      }, estimatedTimePerProduct);

      return () => clearInterval(interval);
    }
  }, [fetcherState, bulkOptimizationProgress.isActive, optimizingProducts, products]);

  // Handle optimization completion
  useEffect(() => {
    if ((fetcherData as any)?.results && optimizingProducts.size > 0) {
      const results = (fetcherData as any).results;
      const successCount = results.filter((r: any) => r.success).length;
      const errorCount = results.filter((r: any) => !r.success).length;

      // Immediately update progress to 100% when API completes
      setBulkOptimizationProgress(prev => ({
        ...prev,
        current: prev.total,
        currentProductTitle: "Optimization Complete!"
      }));

      // Mark all optimizing products as completed
      setCompletedProducts(new Set(Array.from(optimizingProducts)));

      if (successCount > 0) {
        setToastMessage(`Successfully optimized ${successCount} product(s)`);
        setToastError(false);
        setShowToast(true);
      }

      if (errorCount > 0) {
        setToastMessage(`Failed to optimize ${errorCount} product(s)`);
        setToastError(true);
        setShowToast(true);
      }

      // Reset all optimization states after showing completion
      setTimeout(() => {
        setOptimizingProducts(new Set());
        setCompletedProducts(new Set());
        setCurrentOptimizingProduct(null);
        setBulkOptimizationProgress({ current: 0, total: 0, currentProductTitle: "", isActive: false });
        setSelectedItems([]);
      }, 3000); // Keep completed state visible for 3 seconds
    }
  }, [fetcherData, optimizingProducts.size]);

  // Handle fetch state changes
  useEffect(() => {
    if (fetcherState === "idle" && bulkOptimizationProgress.isActive && !(fetcherData as any)?.results) {
      // Reset if fetch fails or is cancelled
      setTimeout(() => {
        setBulkOptimizationProgress({ current: 0, total: 0, currentProductTitle: "", isActive: false });
        setOptimizingProducts(new Set());
        setCompletedProducts(new Set());
      }, 1000);
    }
  }, [fetcherState, bulkOptimizationProgress.isActive, fetcherData]);

  const filters = [
    {
      key: "status",
      label: "Status",
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={[
            { label: "Active", value: "active" },
            { label: "Draft", value: "draft" },
            { label: "Archived", value: "archived" },
          ]}
          selected={statusFilter}
          onChange={handleStatusFilterChange}
          allowMultiple={false}
        />
      ),
      shortcut: true,
    },
    {
      key: "productType",
      label: "Product Type",
      filter: (
        <TextField
          label="Product Type"
          labelHidden
          value={productTypeFilter}
          onChange={handleProductTypeFilterChange}
          placeholder="Enter product type"
          autoComplete="off"
        />
      ),
      shortcut: false,
    },
    {
      key: "vendor",
      label: "Vendor",
      filter: (
        <TextField
          label="Vendor"
          labelHidden
          value={vendorFilter}
          onChange={handleVendorFilterChange}
          placeholder="Enter vendor name"
          autoComplete="off"
        />
      ),
      shortcut: false,
    },
  ];

  const appliedFilters = [];
  if (statusFilter.length > 0) {
    appliedFilters.push({
      key: "status",
      label: `Status: ${statusFilter[0]}`,
      onRemove: () => setStatusFilter([]),
    });
  }
  if (productTypeFilter) {
    appliedFilters.push({
      key: "productType",
      label: `Product Type: ${productTypeFilter}`,
      onRemove: () => setProductTypeFilter(""),
    });
  }
  if (vendorFilter) {
    appliedFilters.push({
      key: "vendor",
      label: `Vendor: ${vendorFilter}`,
      onRemove: () => setVendorFilter(""),
    });
  }

  const handlePrevious = () => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("direction", "previous");
    newSearchParams.set("page", (currentPage - 1).toString());
    if (pageInfo.hasPreviousPage) {
      // Use the start cursor from pageInfo for proper pagination
      newSearchParams.set("cursor", pageInfo.startCursor || "");
    }
    setSearchParams(newSearchParams);
  };

  const handleNext = () => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("direction", "next");
    newSearchParams.set("page", (currentPage + 1).toString());
    if (pageInfo.hasNextPage) {
      // Use the end cursor from pageInfo for proper pagination
      newSearchParams.set("cursor", pageInfo.endCursor || "");
    }
    setSearchParams(newSearchParams);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { status: "success" as const, children: "Active" },
      draft: { status: "info" as const, children: "Draft" },
      archived: { status: "warning" as const, children: "Archived" },
    };

    return statusConfig[status as keyof typeof statusConfig] || { status: "info" as const, children: status };
  };

  const toastMarkup = showToast ? (
    <Toast
      content={toastMessage}
      error={toastError}
      onDismiss={() => setShowToast(false)}
    />
  ) : null;

  return (
    <Frame>
      <Page>
        <TitleBar title="Products" />



        {/* Action Bar */}
        <Card>
          <Box padding="500">
            <InlineStack gap="400" align="space-between">
              <BlockStack gap="100">
                <Text variant="headingLg" as="h2">
                  AI Product Optimization
                </Text>
                <Text variant="bodyMd" tone="subdued" as="p">
                  Enhance your products with 2025 SEO best practices using AI
                </Text>
              </BlockStack>

              <Text variant="bodySm" tone="subdued" as="p">
                Select products using checkboxes to enable bulk optimization
              </Text>
            </InlineStack>
          </Box>
        </Card>

        {/* Bulk Optimization Progress Bar */}
        {bulkOptimizationProgress.isActive && (
          <Card>
            <Box padding="400">
              <BlockStack gap="400">
                <InlineStack gap="300" align="space-between">
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h3">
                      🤖 AI Optimization in Progress
                    </Text>
                    <Text variant="bodyMd" tone="subdued" as="p">
                      {bulkOptimizationProgress.current === bulkOptimizationProgress.total
                        ? `All ${bulkOptimizationProgress.total} products optimized!`
                        : `Optimizing ${bulkOptimizationProgress.current} of ${bulkOptimizationProgress.total} products`
                      }
                    </Text>
                  </BlockStack>
                  <Text variant="bodyMd" fontWeight="semibold" as="span">
                    {bulkOptimizationProgress.total > 0
                      ? Math.round((bulkOptimizationProgress.current / bulkOptimizationProgress.total) * 100)
                      : 0
                    }%
                  </Text>
                </InlineStack>

                <div style={{
                  width: "100%",
                  height: "8px",
                  backgroundColor: "var(--p-color-bg-surface-secondary)",
                  borderRadius: "4px",
                  overflow: "hidden"
                }}>
                  <div style={{
                    width: `${bulkOptimizationProgress.total > 0
                      ? (bulkOptimizationProgress.current / bulkOptimizationProgress.total) * 100
                      : 0
                      }%`,
                    height: "100%",
                    backgroundColor: bulkOptimizationProgress.current === bulkOptimizationProgress.total
                      ? "var(--p-color-bg-success)"
                      : "var(--p-color-bg-info)",
                    transition: "width 0.3s ease, background-color 0.3s ease"
                  }} />
                </div>

                <InlineStack gap="200" align="center">
                  {bulkOptimizationProgress.current < bulkOptimizationProgress.total && (
                    <Spinner size="small" />
                  )}
                  <Text variant="bodySm" tone="subdued" as="span">
                    {bulkOptimizationProgress.current === bulkOptimizationProgress.total
                      ? <strong>✅ {bulkOptimizationProgress.currentProductTitle}</strong>
                      : <>Currently optimizing: <strong>{bulkOptimizationProgress.currentProductTitle}</strong></>
                    }
                  </Text>
                </InlineStack>
              </BlockStack>
            </Box>
          </Card>
        )}

        <Layout>
          <Layout.Section>
            {/* Filters Section */}
            <Card>
              <Filters
                queryValue={searchValue}
                queryPlaceholder="Search products"
                onQueryChange={handleSearchChange}
                onQueryClear={() => setSearchValue("")}
                onClearAll={handleFiltersClearAll}
                filters={filters}
                appliedFilters={appliedFilters}
              />
            </Card>

            {/* Selection Controls */}
            <Card>
              <Box padding="400">
                <InlineStack gap="400" align="space-between">
                  <InlineStack gap="300">
                    <Checkbox
                      label="Select all products"
                      checked={selectedItems.length === products.length && products.length > 0}
                      onChange={(checked) => {
                        if (checked) {
                          setSelectedItems(products.map(p => p.id));
                        } else {
                          setSelectedItems([]);
                        }
                      }}
                    />
                    {selectedItems.length > 0 && (
                      <InlineStack gap="200" align="start">
                        <Icon source={CheckIcon} tone="subdued" />
                        <Text variant="bodyMd" fontWeight="semibold" as="span">
                          {selectedItems.length} of {products.length} products selected
                        </Text>
                      </InlineStack>
                    )}
                  </InlineStack>

                  {selectedItems.length > 0 && (
                    <InlineStack gap="200">
                      <SparkleButton
                        onClick={handleOptimizeSelected}
                        disabled={fetcherState === "submitting"}
                        variant="primary"
                      >
                        {`Quick Optimize ${selectedItems.length}`}
                      </SparkleButton>
                      <SparkleButton
                        onClick={() => handleAdvancedOptimize(selectedItems)}
                        disabled={fetcherState === "submitting"}
                        variant="secondary"
                      >
                        {`Advanced Optimize ${selectedItems.length}`}
                      </SparkleButton>
                      <Button
                        size="slim"
                        onClick={() => setSelectedItems([])}
                      >
                        Clear Selection
                      </Button>
                    </InlineStack>
                  )}
                </InlineStack>
              </Box>
            </Card>

            {/* Products List */}
            <Card>
              {products.length === 0 ? (
                <Box padding="800">
                  <BlockStack gap="400" align="center">
                    <Text variant="headingLg" as="h3">No products found</Text>
                    <Text variant="bodyMd" tone="subdued" as="p">
                      Try adjusting your search or filter criteria
                    </Text>
                  </BlockStack>
                </Box>
              ) : (
                <div>
                  {products.map((product, index) => {
                    const isOptimizing = optimizingProducts.has(product.id);
                    const isSelected = selectedItems.includes(product.id);
                    const isLast = index === products.length - 1;

                    return (
                      <div key={product.id}>
                        <Box padding="400">
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            minHeight: "80px",
                            gap: "16px"
                          }}>
                            {/* Left Section: Checkbox + Image + Content */}
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "16px",
                              flex: "1",
                              minWidth: "0"
                            }}>
                              <div style={{ flexShrink: 0 }}>
                                <Checkbox
                                  checked={isSelected}
                                  onChange={(checked) => {
                                    if (checked) {
                                      setSelectedItems([...selectedItems, product.id]);
                                    } else {
                                      setSelectedItems(selectedItems.filter(id => id !== product.id));
                                    }
                                  }}
                                  label=""
                                />
                              </div>

                              <div style={{ flexShrink: 0 }}>
                                <Thumbnail
                                  source={product.featuredImage?.url || ""}
                                  alt={product.title}
                                  size="large"
                                />
                              </div>

                              <div style={{
                                flex: "1",
                                minWidth: "0",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                gap: "8px"
                              }}>
                                {/* Title and Status Row */}
                                <div style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                  flexWrap: "nowrap"
                                }}>
                                  <Text variant="headingMd" as="h3" truncate>
                                    {product.title}
                                  </Text>
                                  <div style={{ flexShrink: 0 }}>
                                    <Badge {...getStatusBadge(product.status)} />
                                  </div>
                                </div>

                                {/* Meta Info Row */}
                                <div style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  flexWrap: "wrap"
                                }}>
                                  <Text variant="bodySm" tone="subdued" as="span">
                                    {product.productType} • {product.vendor}
                                  </Text>

                                  {product.tags && product.tags.length > 0 && (
                                    <div style={{
                                      display: "flex",
                                      gap: "4px",
                                      alignItems: "center",
                                      flexWrap: "wrap"
                                    }}>
                                      {product.tags.slice(0, 3).map((tag, index) => (
                                        <Badge key={index} tone="info" size="small">{tag}</Badge>
                                      ))}
                                      {product.tags.length > 3 && (
                                        <Badge tone="info" size="small">
                                          {`+${product.tags.length - 3}`}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Optimization Status */}
                                {isOptimizing && (
                                  <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "8px 12px",
                                    backgroundColor: "var(--p-color-bg-success-subdued)",
                                    borderRadius: "8px"
                                  }}>
                                    <Spinner size="small" />
                                    <Text variant="bodySm" tone="success" fontWeight="semibold" as="span">
                                      ✨ Optimizing with AI...
                                    </Text>
                                  </div>
                                )}

                                {/* Completed Status */}
                                {completedProducts.has(product.id) && !isOptimizing && (
                                  <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "8px 12px",
                                    backgroundColor: "var(--p-color-bg-success-subdued)",
                                    borderRadius: "8px"
                                  }}>
                                    <Text variant="bodySm" tone="success" fontWeight="semibold" as="span">
                                      ✅ Optimization Complete!
                                    </Text>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right Section: Action Buttons */}
                            {!isOptimizing && !completedProducts.has(product.id) && (
                              <div style={{
                                flexShrink: 0,
                                display: "flex",
                                gap: "8px"
                              }}>
                                <SparkleButton
                                  onClick={() => handleOptimizeSingle(product.id)}
                                  disabled={isOptimizing || bulkOptimizationProgress.isActive}
                                  variant="primary"
                                >
                                  Quick Optimize
                                </SparkleButton>
                                <SparkleButton
                                  onClick={() => handleAdvancedOptimize([product.id])}
                                  disabled={isOptimizing || bulkOptimizationProgress.isActive}
                                  variant="secondary"
                                >
                                  Advanced
                                </SparkleButton>
                              </div>
                            )}
                          </div>
                        </Box>

                        {/* Divider between items (except last) */}
                        {!isLast && (
                          <Divider />
                        )}
                      </div>
                    );
                  })}</div>
              )}
            </Card>

            {/* Pagination */}
            {(pageInfo.hasNextPage || pageInfo.hasPreviousPage || products.length > 0) && (
              <Card>
                <Box padding="400">
                  <InlineStack align="space-between">
                    <Text variant="bodySm" tone="subdued" as="span">
                      Showing {((currentPage - 1) * productsPerPage) + 1}-{Math.min(currentPage * productsPerPage, ((currentPage - 1) * productsPerPage) + products.length)} of {products.length} products
                    </Text>
                    {(pageInfo.hasNextPage || pageInfo.hasPreviousPage) && (
                      <Pagination
                        hasPrevious={pageInfo.hasPreviousPage}
                        onPrevious={handlePrevious}
                        hasNext={pageInfo.hasNextPage}
                        onNext={handleNext}
                      />
                    )}
                  </InlineStack>
                </Box>
              </Card>
            )}
          </Layout.Section>
        </Layout>
        {toastMarkup}

        <Modal
          open={showAdvancedModal}
          onClose={() => setShowAdvancedModal(false)}
          title="Advanced SEO Optimization (2025 Best Practices)"
          primaryAction={{
            content: "Optimize Products",
            onAction: handleAdvancedOptimizeSubmit,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setShowAdvancedModal(false),
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Text variant="bodyMd" as="p">
                Provide additional context to optimize {`${pendingOptimizationIds.length}`} product(s) using 2025 SEO best practices.
              </Text>

              <FormLayout>
                <TextField
                  label="Target Keywords"
                  value={advancedContext.targetKeywords}
                  onChange={(value) => handleAdvancedContextChange("targetKeywords", value)}
                  placeholder="e.g., best running shoes for men 2025"
                  helpText="Primary keywords you want to rank for"
                  autoComplete="off"
                />

                <TextField
                  label="Brand"
                  value={advancedContext.brand}
                  onChange={(value) => handleAdvancedContextChange("brand", value)}
                  placeholder="e.g., Nike, Adidas"
                  helpText="Brand name if not obvious from product title"
                  autoComplete="off"
                />

                <TextField
                  label="Key Features/Benefits"
                  value={advancedContext.keyFeatures}
                  onChange={(value) => handleAdvancedContextChange("keyFeatures", value)}
                  placeholder="e.g., lightweight, cushioned, breathable mesh"
                  helpText="Main selling points and features"
                  multiline={2}
                  autoComplete="off"
                />

                <Select
                  label="Target Audience"
                  options={[
                    { label: "General consumers", value: "General consumers" },
                    { label: "Men", value: "Men" },
                    { label: "Women", value: "Women" },
                    { label: "Athletes/Sports enthusiasts", value: "Athletes" },
                    { label: "Professionals", value: "Professionals" },
                    { label: "Students", value: "Students" },
                    { label: "Seniors", value: "Seniors" },
                  ]}
                  value={advancedContext.targetAudience}
                  onChange={(value) => handleAdvancedContextChange("targetAudience", value)}
                />

                <TextField
                  label="Primary Use Case"
                  value={advancedContext.useCase}
                  onChange={(value) => handleAdvancedContextChange("useCase", value)}
                  placeholder="e.g., running, training, casual wear"
                  helpText="How will customers primarily use this product?"
                  autoComplete="off"
                />

                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3">Advanced Settings</Text>

                  <Checkbox
                    label="Voice Search Optimization"
                    checked={advancedContext.voiceSearchOptimization}
                    onChange={(checked) => handleAdvancedContextChange("voiceSearchOptimization", checked)}
                    helpText="Include natural Q&A patterns for voice search"
                  />

                  <Checkbox
                    label="Competitor Analysis"
                    checked={advancedContext.competitorAnalysis}
                    onChange={(checked) => handleAdvancedContextChange("competitorAnalysis", checked)}
                    helpText="Use competitive keywords and positioning"
                  />
                </BlockStack>
              </FormLayout>
            </BlockStack>
          </Modal.Section>
        </Modal>
      </Page>
    </Frame>
  );
}