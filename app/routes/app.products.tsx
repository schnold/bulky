import { useState, useCallback, useMemo } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  Button,
  ButtonGroup,
  Select,
  Filters,
  Badge,
  Thumbnail,
  Text,
  InlineStack,
  BlockStack,
  EmptyState,
  DataTable,
  Modal,
  TextField,
  FormLayout,
  Toast,
  Frame,
  Checkbox,
} from "@shopify/polaris";
import {
  EditIcon,
  DeleteIcon,
  ArrowDownIcon,
  WandIcon,
  ExportIcon,
  UploadIcon,
} from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getUserByShop, createUser } from "../models/user.server";
import { hasActiveSubscription } from "../utils/billing.server";

interface Product {
  id: string;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  productType: string;
  createdAt: string;
  updatedAt: string;
  totalInventory: number;
  featuredImage?: {
    url: string;
    altText?: string;
  };
  variants: {
    edges: Array<{
      node: {
        id: string;
        price: string;
        compareAtPrice?: string;
        inventoryQuantory: number;
      };
    }>;
  };
}

interface LoaderData {
  products: Product[];
  shopDomain: string;
  userProfile: any;
  canUseSEOEnhancement: boolean;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(`
    #graphql
    query getProducts($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            title
            handle
            status
            vendor
            productType
            createdAt
            updatedAt
            totalInventory
            featuredImage {
              url
              altText
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  compareAtPrice
                  inventoryQuantity
                }
              }
            }
          }
        }
      }
    }
  `, {
    variables: {
      first: 250,
    },
  });

  const responseJson = await response.json();
  const products = responseJson.data?.products?.edges?.map((edge: any) => edge.node) || [];

  // Get the shop's domain for automatic URL generation
  const shopDomain = session.shop;

  // Get user profile for billing and plan information
  let userProfile = await getUserByShop(session.shop);
  if (!userProfile) {
    userProfile = await createUser(session.shop);
  }

  // Check if user can use SEO enhancement
  const canUseSEOEnhancement = userProfile.planId === 'professional' || userProfile.planId === 'enterprise';

  return { products, shopDomain, userProfile, canUseSEOEnhancement };
};

export default function Products() {
  const { products, shopDomain, userProfile, canUseSEOEnhancement } = useLoaderData<LoaderData>();
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [vendorFilter, setVendorFilter] = useState<string | undefined>(undefined);
  const [sortValue, setSortValue] = useState("title-asc");

  // Pinterest export states
  const [showPinterestModal, setShowPinterestModal] = useState(false);
  const [pinterestBoard, setPinterestBoard] = useState("");
  const [defaultKeywords, setDefaultKeywords] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // SEO enhancement states
  const [isEnhancingSEO, setIsEnhancingSEO] = useState(false);
  const [enhancedProducts, setEnhancedProducts] = useState<any[]>([]);
  const [showSEOEnhancedModal, setShowSEOEnhancedModal] = useState(false);



  // Get unique vendors for filter
  const vendors = useMemo(() => {
    const uniqueVendors = [...new Set(products.map(p => p.vendor).filter(Boolean))];
    return uniqueVendors.map(vendor => ({ label: vendor, value: vendor }));
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = products.filter((product) => {
      const matchesSearch = product.title.toLowerCase().includes(searchValue.toLowerCase()) ||
        product.handle.toLowerCase().includes(searchValue.toLowerCase());
      const matchesStatus = !statusFilter || product.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesVendor = !vendorFilter || product.vendor === vendorFilter;

      return matchesSearch && matchesStatus && matchesVendor;
    });

    // Sort products
    const [sortKey, sortDirection] = sortValue.split("-");
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortKey) {
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "created":
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case "updated":
          aValue = new Date(a.updatedAt);
          bValue = new Date(b.updatedAt);
          break;
        case "inventory":
          aValue = a.totalInventory;
          bValue = b.totalInventory;
          break;
        default:
          return 0;
      }

      if (sortDirection === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [products, searchValue, statusFilter, vendorFilter, sortValue]);

  const handleFiltersQueryChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const handleFiltersClearAll = useCallback(() => {
    setSearchValue("");
    setStatusFilter(undefined);
    setVendorFilter(undefined);
  }, []);



  // Billing helper functions
  const getCreditsNeeded = useMemo(() => {
    return Math.ceil(selectedProducts.length / 100); // 1 credit per 100 products
  }, [selectedProducts.length]);

  // Selection helper function with plan limits
  const handleProductSelection = useCallback((productId: string, checked: boolean) => {
    if (checked) {
      // Check if adding this product would exceed the plan limit
      if (selectedProducts.length >= userProfile.plan.maxProductsPerExport) {
        setToastMessage(`You can only select up to ${userProfile.plan.maxProductsPerExport} products per export with your ${userProfile.plan.displayName} plan`);
        setShowToast(true);
        return;
      }
      setSelectedProducts([...selectedProducts, productId]);
    } else {
      setSelectedProducts(selectedProducts.filter(id => id !== productId));
    }
  }, [selectedProducts, userProfile.plan.maxProductsPerExport, userProfile.plan.displayName]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      // Check if selecting all would exceed the plan limit
      if (filteredProducts.length > userProfile.plan.maxProductsPerExport) {
        // Only select up to the plan limit
        const limitedSelection = filteredProducts.slice(0, userProfile.plan.maxProductsPerExport).map(p => p.id);
        setSelectedProducts(limitedSelection);
        setToastMessage(`Selected ${userProfile.plan.maxProductsPerExport} products (plan limit). ${filteredProducts.length - userProfile.plan.maxProductsPerExport} additional products not selected due to plan restrictions.`);
        setShowToast(true);
      } else {
        setSelectedProducts(filteredProducts.map(p => p.id));
      }
    } else {
      setSelectedProducts([]);
    }
  }, [filteredProducts, userProfile.plan.maxProductsPerExport]);

  // Format price function - moved here to be available for Pinterest export
  const formatPrice = useCallback((price: string) => {
    const numPrice = parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(numPrice);
  }, []);

  // Pinterest export functions
  const getSelectedProductsData = useCallback(() => {
    return products.filter(product => selectedProducts.includes(product.id));
  }, [products, selectedProducts]);

  const generatePinterestCSV = useCallback((productsData: Product[]) => {
    const headers = ['Title', 'Media URL', 'Pinterest board', 'Thumbnail', 'Description', 'Link', 'Publish date', 'Keywords'];

    // Filter out duplicates by title to avoid Pinterest errors
    const uniqueProducts = productsData.filter((product, index, self) =>
      index === self.findIndex(p => p.title === product.title)
    );

    const rows = uniqueProducts.map(product => {
      // Use custom baseUrl if provided, otherwise use the automatic shopDomain
      const productUrl = baseUrl
        ? `${baseUrl.replace(/\/$/, '')}/products/${product.handle}`
        : `https://${shopDomain}/products/${product.handle}`;
      const price = product.variants.edges[0]?.node?.price || "0.00";
      const formattedPrice = formatPrice(price);

      // Clean title - remove special characters and normalize
      const cleanTitle = product.title
        .replace(/â€"/g, '-')
        .replace(/â€œ/g, '"')
        .replace(/â€/g, '"')
        .replace(/Ã¼/g, 'ü')
        .replace(/Ã¶/g, 'ö')
        .replace(/Ã¤/g, 'ä')
        .replace(/Ã/g, 'ß')
        .trim();

      // Create clean description from product details
      const description = `${cleanTitle} - ${formattedPrice}${product.vendor ? ` by ${product.vendor}` : ''}${product.productType ? ` | ${product.productType}` : ''}`.substring(0, 500);

      // Generate keywords from product data - clean and relevant
      const titleWords = cleanTitle.toLowerCase().split(' ').filter(word => word.length > 2).slice(0, 3);
      const keywords = [
        titleWords.join(', '),
        product.vendor?.toLowerCase(),
        product.productType?.toLowerCase().replace(/>/g, ','),
        defaultKeywords
      ].filter(Boolean).join(', ').substring(0, 500);

      // Get the best quality main product image
      let mediaUrl = '';
      if (product.featuredImage?.url) {
        // Use the featured image URL and ensure it's high quality
        mediaUrl = product.featuredImage.url;

        // Remove Shopify's automatic image transformations to get original quality
        // This removes parameters like _960x960q75 to get the full-size image
        mediaUrl = mediaUrl.replace(/_\d+x\d+q\d+/g, '');
        mediaUrl = mediaUrl.replace(/\?v=\d+$/, ''); // Remove version parameter if it's the only one
      }

      // Skip products without images - Pinterest requires media URLs
      if (!mediaUrl) {
        return null;
      }

      return [
        cleanTitle.replace(/"/g, '""'), // Clean title without extra quotes
        mediaUrl,
        pinterestBoard,
        '', // Thumbnail (leave empty for Pinterest to auto-generate)
        description.replace(/"/g, '""'), // Clean description
        productUrl,
        '', // Publish date (empty for immediate publishing)
        keywords.replace(/"/g, '""') // Clean keywords
      ];
    }).filter(Boolean); // Remove null entries (products without images)

    // Create CSV with proper escaping
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }, [shopDomain, pinterestBoard, defaultKeywords, formatPrice]);

  const downloadCSV = useCallback((csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handlePinterestExport = useCallback(() => {
    if (selectedProducts.length === 0) {
      setToastMessage("Please select at least one product to export");
      setShowToast(true);
      return;
    }

    setShowPinterestModal(true);
  }, [selectedProducts.length]);

  const handleExportConfirm = useCallback(async () => {
    if (!pinterestBoard.trim()) {
      setToastMessage("Please enter a Pinterest board name");
      setShowToast(true);
      return;
    }

    try {
      const selectedProductsData = getSelectedProductsData();
      const csvContent = generatePinterestCSV(selectedProductsData);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `pinterest-pins-${timestamp}.csv`;



      downloadCSV(csvContent, filename);

      setShowPinterestModal(false);
      setToastMessage(`Successfully exported ${selectedProducts.length} products to Pinterest CSV (${getCreditsNeeded} credits used)`);
      setShowToast(true);

      // Reset selection after export
      setSelectedProducts([]);
    } catch (error) {
      console.error('Error recording export:', error);
      setToastMessage("Export completed but billing record failed. Please contact support.");
      setShowToast(true);
    }
  }, [pinterestBoard, getSelectedProductsData, generatePinterestCSV, downloadCSV, selectedProducts.length, shopDomain, getCreditsNeeded]);

  const handleModalClose = useCallback(() => {
    setShowPinterestModal(false);
  }, []);

  // SEO Enhancement functions
  const submit = useSubmit();

  const handleSEOEnhancement = useCallback(async () => {
    if (selectedProducts.length === 0) {
      setToastMessage("Please select at least one product to enhance");
      setShowToast(true);
      return;
    }

    // Check if user can use SEO enhancement
    if (!canUseSEOEnhancement) {
      setToastMessage("SEO enhancement is only available for Professional and Enterprise plans");
      setShowToast(true);
      return;
    }



    setIsEnhancingSEO(true);
    setToastMessage("Enhancing products with AI-powered SEO...");
    setShowToast(true);

    try {
      const selectedProductsData = getSelectedProductsData();
      
      const formData = new FormData();
      formData.append("products", JSON.stringify(selectedProductsData));
      formData.append("defaultKeywords", defaultKeywords);

      // Use fetch directly to ensure POST request
      const response = await fetch("/app/products/seo", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      
      if (result.success && result.enhancedProducts) {
        setEnhancedProducts(result.enhancedProducts);
        setShowSEOEnhancedModal(true);
        setToastMessage(result.message || `Successfully enhanced ${result.enhancedProducts.length} products`);
        setShowToast(true);
      } else if (result.error) {
        setToastMessage(`Error: ${result.error}`);
        setShowToast(true);
      }
    } catch (error) {
      console.error('Error enhancing SEO:', error);
      setToastMessage("Failed to enhance products. Please try again.");
      setShowToast(true);
    } finally {
      setIsEnhancingSEO(false);
    }
  }, [selectedProducts.length, getSelectedProductsData, defaultKeywords, canUseSEOEnhancement]);

  const handleSEOEnhancedExport = useCallback(async () => {
    if (enhancedProducts.length === 0) {
      setToastMessage("No enhanced products available");
      setShowToast(true);
      return;
    }

    if (!pinterestBoard.trim()) {
      setToastMessage("Please enter a Pinterest board name");
      setShowToast(true);
      return;
    }

    try {
      // Generate CSV with enhanced products
      const csvContent = generatePinterestCSVWithEnhancedData(enhancedProducts);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `pinterest-seo-enhanced-pins-${timestamp}.csv`;



      downloadCSV(csvContent, filename);

      setShowSEOEnhancedModal(false);
      setToastMessage(`Successfully exported ${enhancedProducts.length} SEO-enhanced products to Pinterest CSV (${getCreditsNeeded} credits used)`);
      setShowToast(true);

      // Reset selection after export
      setSelectedProducts([]);
      setEnhancedProducts([]);
    } catch (error) {
      console.error('Error recording export:', error);
      setToastMessage("Export completed but billing record failed. Please contact support.");
      setShowToast(true);
    }
  }, [enhancedProducts.length, pinterestBoard, downloadCSV, shopDomain, getCreditsNeeded]);

  const generatePinterestCSVWithEnhancedData = useCallback((enhancedProductsData: any[]) => {
    const headers = ['Title', 'Media URL', 'Pinterest board', 'Thumbnail', 'Description', 'Link', 'Publish date', 'Keywords'];

    const rows = enhancedProductsData.map(enhancedProduct => {
      const product = enhancedProduct.originalProduct;
      const productUrl = baseUrl
        ? `${baseUrl.replace(/\/$/, '')}/products/${product.handle}`
        : `https://${shopDomain}/products/${product.handle}`;

      // Get the best quality main product image
      let mediaUrl = '';
      if (product.featuredImage?.url) {
        mediaUrl = product.featuredImage.url;
        mediaUrl = mediaUrl.replace(/_\d+x\d+q\d+/g, '');
        mediaUrl = mediaUrl.replace(/\?v=\d+$/, '');
      }

      if (!mediaUrl) {
        return null;
      }

      return [
        enhancedProduct.enhancedTitle.replace(/"/g, '""'),
        mediaUrl,
        pinterestBoard,
        '',
        enhancedProduct.enhancedDescription.replace(/"/g, '""'),
        productUrl,
        '',
        enhancedProduct.enhancedKeywords.replace(/"/g, '""')
      ];
    }).filter(Boolean);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }, [shopDomain, pinterestBoard, baseUrl]);

  const appliedFilters = [];
  if (statusFilter) {
    appliedFilters.push({
      key: "status",
      label: `Status: ${statusFilter}`,
      onRemove: () => setStatusFilter(undefined),
    });
  }
  if (vendorFilter) {
    appliedFilters.push({
      key: "vendor",
      label: `Vendor: ${vendorFilter}`,
      onRemove: () => setVendorFilter(undefined),
    });
  }

  const filters = [
    {
      key: "status",
      label: "Status",
      filter: (
        <Select
          label="Status"
          labelHidden
          options={[
            { label: "All statuses", value: "" },
            { label: "Active", value: "active" },
            { label: "Draft", value: "draft" },
            { label: "Archived", value: "archived" },
          ]}
          value={statusFilter || ""}
          onChange={(value) => setStatusFilter(value || undefined)}
        />
      ),
      shortcut: true,
    },
    {
      key: "vendor",
      label: "Vendor",
      filter: (
        <Select
          label="Vendor"
          labelHidden
          options={[
            { label: "All vendors", value: "" },
            ...vendors,
          ]}
          value={vendorFilter || ""}
          onChange={(value) => setVendorFilter(value || undefined)}
        />
      ),
      shortcut: true,
    },
  ];

  const sortOptions = [
    { label: "Title A-Z", value: "title-asc" },
    { label: "Title Z-A", value: "title-desc" },
    { label: "Newest first", value: "created-desc" },
    { label: "Oldest first", value: "created-asc" },
    { label: "Recently updated", value: "updated-desc" },
    { label: "Inventory (high to low)", value: "inventory-desc" },
    { label: "Inventory (low to high)", value: "inventory-asc" },
  ];

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { tone: "success" as const },
      draft: { tone: "attention" as const },
      archived: { tone: "critical" as const },
    };

    const config = statusConfig[status.toLowerCase() as keyof typeof statusConfig] ||
      { tone: "info" as const };

    return (
      <Badge tone={config.tone}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };



  // Prepare table rows and row IDs for selection
  const rows = filteredProducts.map((product) => {
    const price = product.variants.edges[0]?.node?.price || "0.00";
    const inventory = product.totalInventory;

    return [
      <InlineStack gap="300" key={product.id}>
        <Thumbnail
          source={product.featuredImage?.url || ""}
          alt={product.featuredImage?.altText || product.title}
          size="small"
        />
        <BlockStack gap="100">
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {product.title}
          </Text>
          <Text variant="bodySm" tone="subdued" as="span">
            {product.handle}
          </Text>
        </BlockStack>
      </InlineStack>,
      getStatusBadge(product.status),
      <Text variant="bodyMd" as="span">
        {product.vendor || "—"}
      </Text>,
      <Text variant="bodyMd" as="span">
        {product.productType || "—"}
      </Text>,
      <Text variant="bodyMd" fontWeight="medium" as="span">
        {formatPrice(price)}
      </Text>,
      <Text variant="bodyMd" as="span" tone={inventory === 0 ? "critical" : undefined}>
        {inventory.toString()}
      </Text>,
      <Text variant="bodySm" tone="subdued" as="span">
        {new Date(product.updatedAt).toLocaleDateString()}
      </Text>,
    ];
  });

  // Create row IDs array for selection
  const rowIds = filteredProducts.map(product => product.id);

  if (products.length === 0) {
    return (
      <Page>
        <TitleBar title="Products" />
        <Card>
          <EmptyState
            heading="No products found"
            action={{
              content: "Create product",
              url: "shopify:admin/products/new",
              external: true,
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <Text as="p">Start by adding products to your store.</Text>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  return (
    <Frame>
      <Page>
        <TitleBar title="Products">
          {selectedProducts.length > 0 && (
            <ButtonGroup>
              <Button
                icon={ArrowDownIcon}
                variant="secondary"
                onClick={handlePinterestExport}
              >
                Export to Pinterest
              </Button>
              <Button icon={EditIcon} variant="secondary">
                Edit
              </Button>
              <Button icon={DeleteIcon} variant="secondary" tone="critical">
                Delete
              </Button>
            </ButtonGroup>
          )}
        </TitleBar>

        <BlockStack gap="500">
          {/* Header */}
          <InlineStack align="space-between">
            <BlockStack gap="100">
              <Text variant="headingLg" as="h1">
                Products
              </Text>
              <Text variant="bodyMd" tone="subdued" as="p">
                {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}
                {selectedProducts.length > 0 && ` • ${selectedProducts.length} selected`}
              </Text>
            </BlockStack>

            <InlineStack gap="400">
              <Button
                icon={ExportIcon}
                onClick={handlePinterestExport}
                disabled={selectedProducts.length === 0}
                variant="primary"
                tone={selectedProducts.length === 0 ? undefined : "critical"}
              >
                Export Pinterest CSV ({selectedProducts.length}) - {getCreditsNeeded} credits
              </Button>
              
              <div style={{ position: 'relative' }}>
                <Button
                  icon={WandIcon}
                  onClick={handleSEOEnhancement}
                  disabled={selectedProducts.length === 0 || isEnhancingSEO || !canUseSEOEnhancement}
                  loading={isEnhancingSEO}
                  variant="primary"
                  tone="success"
                >
                  {isEnhancingSEO ? 'Enhancing...' : `SEO Enhance (${selectedProducts.length})`}
                </Button>
                {canUseSEOEnhancement && (
                  <div style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    backgroundColor: '#E8F5E8',
                    color: '#00A047',
                    border: '1px solid #00A047',
                    padding: '2px 4px',
                    borderRadius: '8px',
                    fontSize: '9px',
                    fontWeight: '600',
                    lineHeight: '1',
                    zIndex: 1
                  }}>
                    AI
                  </div>
                )}
              </div>
              
              <Button
                icon={UploadIcon}
                url="https://pinterest.com/settings/bulk-create-pins"
                target="_blank"
                variant="secondary"
                tone="critical"
              >
                Upload CSV to Pinterest
              </Button>
              
              <Select
                label="Sort by"
                labelInline
                options={sortOptions}
                value={sortValue}
                onChange={setSortValue}
              />
            </InlineStack>
          </InlineStack>

          {/* Billing Information */}
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">
                Plan Information
              </Text>
              <InlineStack gap="400" align="space-between">
                <BlockStack gap="100">
                  <Text variant="bodyMd" as="p">
                    <strong>Current Plan:</strong> {userProfile.plan.displayName}
                  </Text>
                  <Text variant="bodySm" tone="subdued" as="p">
                    Credits: {userProfile.credits} / {userProfile.plan.monthlyCredits}
                  </Text>
                  <Text variant="bodySm" tone="subdued" as="p">
                    Max products per export: {userProfile.plan.maxProductsPerExport}
                  </Text>
                  <Text variant="bodySm" tone="subdued" as="p">
                    Daily exports: {userProfile.dailyExports} / {userProfile.plan.dailyExportLimit}
                  </Text>
                  <Text variant="bodySm" tone="subdued" as="p">
                    Monthly exports: {userProfile.monthlyExports} / {userProfile.plan.monthlyExportLimit}
                  </Text>
                </BlockStack>
                {selectedProducts.length > 0 && (
                  <BlockStack gap="100">
                    <Text variant="bodyMd" as="p">
                      <strong>Selected Products:</strong> {selectedProducts.length}
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Credits needed: {getCreditsNeeded.toString()}
                    </Text>

                  </BlockStack>
                )}
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Filters */}
          <Card>
            <Filters
              queryValue={searchValue}
              filters={filters}
              appliedFilters={appliedFilters}
              onQueryChange={handleFiltersQueryChange}
              onQueryClear={() => setSearchValue("")}
              onClearAll={handleFiltersClearAll}
              queryPlaceholder="Search products..."
            />
          </Card>

          {/* Products Table */}
          <Card>
            <div style={{ width: '100%', minWidth: '800px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '50px' }} />
                  <col style={{ width: '40%' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '100px' }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e1e3e5' }}>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 500 }}>
                      <Checkbox
                        checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                        indeterminate={selectedProducts.length > 0 && selectedProducts.length < filteredProducts.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>Product</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 500 }}>Status</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 500 }}>Vendor</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 500 }}>Type</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>Price</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>Inventory</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 500 }}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product, index) => {
                    const price = product.variants.edges[0]?.node?.price || "0.00";
                    const inventory = product.totalInventory;
                    const isSelected = selectedProducts.includes(product.id);

                    return (
                      <tr
                        key={product.id}
                        style={{
                          borderBottom: '1px solid #f1f2f3',
                          backgroundColor: isSelected ? '#f6f6f7' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '12px 8px' }}>
                          <Checkbox
                            checked={isSelected}
                            onChange={(checked) => handleProductSelection(product.id, checked)}
                          />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <Thumbnail
                              source={product.featuredImage?.url || ""}
                              alt={product.featuredImage?.altText || product.title}
                              size="medium"
                            />
                            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                              <div style={{ marginBottom: '4px' }}>
                                <Text variant="bodyMd" fontWeight="semibold" as="div" truncate>
                                  {product.title}
                                </Text>
                              </div>
                              <Text variant="bodySm" tone="subdued" as="div" truncate>
                                {product.handle}
                              </Text>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          {getStatusBadge(product.status)}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <Text variant="bodySm" as="span" truncate>
                            {product.vendor || "—"}
                          </Text>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <Text variant="bodySm" as="span" truncate>
                            {product.productType || "—"}
                          </Text>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <Text variant="bodyMd" fontWeight="medium" as="span">
                            {formatPrice(price)}
                          </Text>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <Text variant="bodyMd" as="span" tone={inventory === 0 ? "critical" : undefined}>
                            {inventory.toString()}
                          </Text>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <Text variant="bodySm" tone="subdued" as="span">
                            {new Date(product.updatedAt).toLocaleDateString()}
                          </Text>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid #f1f2f3' }}>
              <Text variant="bodySm" tone="subdued" alignment="center" as="p">
                Showing {filteredProducts.length} of {products.length} products
              </Text>
            </div>
          </Card>
        </BlockStack>

        {/* Pinterest Export Modal */}
        <Modal
          open={showPinterestModal}
          onClose={handleModalClose}
          title="Export to Pinterest"
          primaryAction={{
            content: 'Export CSV',
            onAction: handleExportConfirm,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: handleModalClose,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Text variant="bodyMd" as="p">
                Export {selectedProducts.length} selected products to Pinterest CSV format.
              </Text>

              <FormLayout>
                <TextField
                  label="Pinterest Board Name"
                  value={pinterestBoard}
                  onChange={setPinterestBoard}
                  placeholder="e.g., my-products-board"
                  helpText="The name of the Pinterest board where pins will be added"
                  requiredIndicator
                  autoComplete="off"
                />

                <TextField
                  label="Default Keywords"
                  value={defaultKeywords}
                  onChange={setDefaultKeywords}
                  placeholder="e.g., fashion, style, trending"
                  helpText="Additional keywords to add to all pins (optional)"
                  multiline={2}
                  autoComplete="off"
                />
              </FormLayout>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* SEO Enhanced Export Modal */}
        <Modal
          open={showSEOEnhancedModal}
          onClose={() => setShowSEOEnhancedModal(false)}
          title="Export SEO-Enhanced Products"
          primaryAction={{
            content: 'Export Enhanced CSV',
            onAction: handleSEOEnhancedExport,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setShowSEOEnhancedModal(false),
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Text variant="bodyMd" as="p">
                Export {enhancedProducts.length} SEO-enhanced products to Pinterest CSV format.
              </Text>

              <FormLayout>
                <TextField
                  label="Pinterest Board Name"
                  value={pinterestBoard}
                  onChange={setPinterestBoard}
                  placeholder="e.g., my-products-board"
                  helpText="The name of the Pinterest board where pins will be added"
                  requiredIndicator
                  autoComplete="off"
                />
              </FormLayout>

              {enhancedProducts.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <Text variant="headingMd" as="h3">
                    Enhanced Products Preview
                  </Text>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e1e3e5', borderRadius: '8px', padding: '16px' }}>
                    {enhancedProducts.slice(0, 5).map((enhancedProduct, index) => (
                      <div key={index} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: index < 4 ? '1px solid #f1f2f3' : 'none' }}>
                        <Text variant="bodyMd" fontWeight="semibold" as="div">
                          {enhancedProduct.enhancedTitle}
                        </Text>
                        <Text variant="bodySm" tone="subdued" as="div" style={{ marginTop: '4px' }}>
                          {enhancedProduct.enhancedDescription}
                        </Text>
                        <Text variant="bodySm" tone="subdued" as="div" style={{ marginTop: '4px', fontStyle: 'italic' }}>
                          Keywords: {enhancedProduct.enhancedKeywords}
                        </Text>
                      </div>
                    ))}
                    {enhancedProducts.length > 5 && (
                      <Text variant="bodySm" tone="subdued" as="div">
                        ... and {enhancedProducts.length - 5} more products
                      </Text>
                    )}
                  </div>
                </div>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      </Page>

      {/* Toast for notifications */}
      {showToast && (
        <Toast
          content={toastMessage}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </Frame>
  );
}