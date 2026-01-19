import { useState, useCallback, useEffect } from "react";
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
  Icon,
  Thumbnail,
  Box,
  Divider,
} from "@shopify/polaris";
import { MagicIcon, CheckIcon, CreditCardIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { ClientOnly } from "../components/ClientOnly";
import { ErrorBoundary } from "../components/ErrorBoundary";
import prisma from "../db.server";

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
  isOptimized?: boolean;
  optimizedAt?: string;
}

interface OptimizedProductData {
  id: string;
  originalData: {
    title: string;
    descriptionHtml: string;
    handle: string;
    productType: string;
    vendor: string;
    tags: string[];
  };
  optimizedData: {
    title: string;
    description: string;
    handle?: string;
    productType: string;
    vendor: string;
    tags: string[];
  };
  timestamp: number;
  isPublished: boolean;
}

interface StoredOptimizations {
  [productId: string]: OptimizedProductData;
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
  specialInstructions?: string;
}


export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Ensure this only runs on the server
  if (typeof window !== "undefined") {
    throw new Error("This loader should only run on the server");
  }

  try {
    const requestUrl = new URL(request.url);
    console.log(`🔍 Products loader - Request URL: ${request.url}`);
    console.log(`🔍 Products loader - URL Analysis:`, {
      pathname: requestUrl.pathname,
      search: requestUrl.search,
      searchParams: Object.fromEntries(requestUrl.searchParams.entries()),
      isDataRequest: requestUrl.searchParams.has('_data')
    });
    
    console.log(`🔍 Products loader - Request headers:`, {
      'user-agent': request.headers.get('user-agent'),
      'cookie': request.headers.get('cookie') ? 'SET' : 'NOT SET',
      'authorization': request.headers.get('authorization') ? 'SET' : 'NOT SET',
      'x-shopify-shop-domain': request.headers.get('x-shopify-shop-domain'),
      'x-shopify-hmac': request.headers.get('x-shopify-hmac') ? 'SET' : 'NOT SET',
      'referer': request.headers.get('referer'),
    });

    console.log(`🔍 Products loader - Environment check:`, {
      NODE_ENV: process.env.NODE_ENV,
      SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ? 'SET' : 'NOT SET',
      SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ? 'SET' : 'NOT SET',
      SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL ? 'SET' : 'NOT SET',
    });
    
    if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET) {
      console.error("❌ Products loader - Missing required Shopify environment variables");
      throw new Error("Missing required Shopify environment variables");
    }

    // Test database connection before authentication
    console.log(`🔍 Products loader - Testing database connection...`);
    try {
      const sessionCount = await prisma.session.count();
      console.log(`✅ Products loader - Database connected, session count: ${sessionCount}`);
    } catch (dbError) {
      console.error(`❌ Products loader - Database connection failed:`, dbError);
    }

    console.log(`🔍 Products loader - About to authenticate admin request...`);
    let admin, session;
    
    try {
      const authResult = await authenticate.admin(request);
      admin = authResult.admin;
      session = authResult.session;
      console.log(`✅ Products loader - Authentication result:`, {
        hasAdmin: !!admin,
        hasSession: !!session,
        sessionShop: session?.shop,
        sessionId: session?.id
      });
    } catch (authError) {
      console.error(`❌ Products loader - Authentication failed:`, {
        error: authError,
        message: authError instanceof Error ? authError.message : 'Unknown error',
        stack: authError instanceof Error ? authError.stack : 'No stack'
      });
      throw authError;
    }

    if (!session || !session.shop) {
      console.error(`❌ Products loader - Invalid session after authentication:`, {
        session: session ? 'EXISTS_BUT_INVALID' : 'NULL',
        shop: session?.shop || 'NO_SHOP'
      });
      throw new Error("No valid session found");
    }

    console.log(`✅ Products loader - Authentication successful for shop: ${session.shop}`);
    console.log(`🔍 Products loader - Session details:`, {
      id: session.id,
      shop: session.shop,
      state: session.state,
      isOnline: session.isOnline,
      accessToken: session.accessToken ? 'SET' : 'NOT SET',
      scope: session.scope
    });

    // Get user data from database (user is guaranteed to exist from app.tsx loader)
    const { ensureUserExists } = await import("../utils/db.server");
    const user = await ensureUserExists(session.shop);

    console.log(`✅ Products loader - User found:`, { id: user.id, shop: user.shop, plan: user.plan });

    // Get subscription data
    const subscription = user?.subscriptions?.[0] || null;

    const url = new URL(request.url);
    const query = url.searchParams.get("query") || "";
    const status = url.searchParams.get("status") || "";
    const productType = url.searchParams.get("productType") || "";
    const vendor = url.searchParams.get("vendor") || "";
    const cursor = url.searchParams.get("cursor") || "";
    const direction = url.searchParams.get("direction") || "next";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const productsPerPage = parseInt(url.searchParams.get("productsPerPage") || "15", 10);

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
    const first = direction === "next" ? productsPerPage : undefined;
    const last = direction === "previous" ? productsPerPage : undefined;
    const after = direction === "next" && cursor ? cursor : undefined;
    const before = direction === "previous" && cursor ? cursor : undefined;

    console.log(`🔍 Products loader - Making GraphQL query with filters:`, { queryString, first, last, after, before });

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

    if (!response.ok) {
      console.error(`❌ GraphQL response not ok:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      const errorText = await response.text();
      console.error(`❌ GraphQL error response:`, errorText);
      
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const responseJson = await response.json() as any;
    
    if (responseJson.errors) {
      console.error(`❌ GraphQL errors:`, responseJson.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(responseJson.errors)}`);
    }
    const data = responseJson.data?.products;

    const products: Product[] = data?.edges?.map((edge: any) => edge.node) || [];

    console.log(`✅ Products loader - Retrieved ${products.length} products`);

    // Get optimization status for all visible products
    let productsWithOptimizationStatus = products;
    if (products.length > 0) {
      try {
        const { getOptimizationStatusForProducts } = await import("../models/product-optimization.server");
        const productIds = products.map(p => p.id);
        const optimizationStatusMap = await getOptimizationStatusForProducts(productIds, session.shop);
        
        productsWithOptimizationStatus = products.map(product => {
          const status = optimizationStatusMap.get(product.id);
          return {
            ...product,
            isOptimized: status?.isOptimized || false,
            optimizedAt: status?.optimizedAt?.toISOString(),
          };
        });
        
        console.log(`✅ Products loader - Added optimization status for ${productsWithOptimizationStatus.length} products`);
      } catch (error) {
        console.error("❌ Failed to fetch optimization status:", error);
        // Continue without optimization status if there's an error
      }
    }

    return json<LoaderData>({
      products: productsWithOptimizationStatus,
      pageInfo: data?.pageInfo || { hasNextPage: false, hasPreviousPage: false, startCursor: undefined, endCursor: undefined },
      totalCount: products.length,
      currentPage: page,
      productsPerPage: productsPerPage,
      user: {
        id: user.id,
        plan: user.plan,
        credits: user.credits,
      },
      subscription: subscription,
    });
  } catch (error) {
    console.error("❌ Products loader error:", error);
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace");
    
    // Return a proper error response instead of throwing
    return json(
      { 
        error: "Failed to load products",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
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
  const loaderData = useLoaderData<typeof loader>();

  // Set up hooks unconditionally before any early return
  const [searchParams, setSearchParams] = useSearchParams();
  const optimizeFetcher = useFetcher();
  const publishFetcher = useFetcher();

  // Default initial state values (will be updated once loaderData is validated)
  const [selectedProductsPerPage, setSelectedProductsPerPage] = useState("15");
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [productTypeFilter, setProductTypeFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [optimizingProducts, setOptimizingProducts] = useState<Set<string>>(new Set());
  const [completedProducts, setCompletedProducts] = useState<Set<string>>(new Set());
  const [failedProducts, setFailedProducts] = useState<Set<string>>(new Set());
  const [currentOptimizingProduct, setCurrentOptimizingProduct] = useState<string | null>(null);
  const [optimizationQueue, setOptimizationQueue] = useState<string[]>([]);
  const [bulkOptimizationProgress, setBulkOptimizationProgress] = useState<{
    current: number;
    total: number;
    currentProductTitle: string;
    isActive: boolean;
    completed: number;
    failed: number;
  }>({ current: 0, total: 0, currentProductTitle: "", isActive: false, completed: 0, failed: 0 });
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
    specialInstructions: "",
  });
  const [pendingOptimizationIds, setPendingOptimizationIds] = useState<string[]>([]);
  const [showSpecialInstructionsModal, setShowSpecialInstructionsModal] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [optimizedProducts, setOptimizedProducts] = useState<StoredOptimizations>({});
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(new Set());
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [urlUpdateSettings, setUrlUpdateSettings] = useState<{ [productId: string]: boolean }>({});

  // Derive flags AFTER hooks are declared (no conditional hook calls)
  const hasError = loaderData && typeof loaderData === "object" && "error" in loaderData;
  // Treat only missing/invalid loaderData as invalid. Do NOT include hasError here,
  // so hooks below are not considered conditionally called due to early return.
  const isInvalid = !loaderData || typeof loaderData !== "object";

  // Initialize state from loader/search params once we know data is valid
  useEffect(() => {
    // Always run this effect; guard reads with optional chaining/defaults
    const ld = (loaderData as LoaderData | undefined);
    const initialQuery = searchParams.get("query") || "";
    const initialStatus = searchParams.get("status");
    const initialProductType = searchParams.get("productType") || "";
    const initialVendor = searchParams.get("vendor") || "";
    const initialPerPage = searchParams.get("productsPerPage") || (ld?.productsPerPage?.toString() ?? "15");

    setSearchValue(initialQuery);
    setStatusFilter(initialStatus ? [initialStatus] : []);
    setProductTypeFilter(initialProductType);
    setVendorFilter(initialVendor);
    setSelectedProductsPerPage(initialPerPage);
  }, [loaderData, searchParams]);

  // Persist optimized products to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && Object.keys(optimizedProducts).length > 0) {
      localStorage.setItem("bulky-optimized-products", JSON.stringify(optimizedProducts));
    } else if (typeof window !== "undefined" && Object.keys(optimizedProducts).length === 0) {
      localStorage.removeItem("bulky-optimized-products");
    }
  }, [optimizedProducts]);

  // Load optimized products from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("bulky-optimized-products");
      if (stored) {
        try {
          const parsedOptimized = JSON.parse(stored);
          const now = Date.now();
          const oneDayMs = 24 * 60 * 60 * 1000;
          const cleanedOptimized = Object.fromEntries(
            Object.entries(parsedOptimized).filter(([_, data]: [string, any]) => {
              if (data.isPublished) return false;
              return now - data.timestamp < oneDayMs;
            })
          ) as StoredOptimizations;
          setOptimizedProducts(cleanedOptimized);
          if (Object.keys(cleanedOptimized).length !== Object.keys(parsedOptimized).length) {
            localStorage.setItem("bulky-optimized-products", JSON.stringify(cleanedOptimized));
          }
        } catch (error) {
          console.error("Failed to parse stored optimizations:", error);
          localStorage.removeItem("bulky-optimized-products");
        }
      }
    }
  }, []);

  // Debounced apply of search params
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const newSearchParams = new URLSearchParams();
      if (searchValue) newSearchParams.set("query", searchValue);
      if (statusFilter.length > 0) newSearchParams.set("status", statusFilter[0]);
      if (productTypeFilter) newSearchParams.set("productType", productTypeFilter);
      if (vendorFilter) newSearchParams.set("vendor", vendorFilter);
      setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchValue, statusFilter, productTypeFilter, vendorFilter, setSearchParams]);

  // Stable callbacks (unconditional). Define with function declarations to avoid lint false-positives.
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

  const handleProductsPerPageChange = useCallback((value: string) => {
    setSelectedProductsPerPage(value);
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("productsPerPage", value);
    newSearchParams.delete("page"); // Reset to page 1
    newSearchParams.delete("cursor"); // Reset cursor
    setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
  }, [searchParams, setSearchParams]);

  const handleFiltersClearAll = useCallback(() => {
    setSearchValue("");
    setStatusFilter([]);
    setProductTypeFilter("");
    setVendorFilter("");
    setSearchParams(new URLSearchParams(), { replace: true, preventScrollReset: true });
  }, [setSearchParams]);

  // Do NOT early-return before all hooks; render a loading state instead to keep hooks order stable

  const { products, pageInfo, currentPage, productsPerPage, user, subscription } = loaderData as LoaderData;

  // Sync per-page state with validated loader data
  useEffect(() => {
    setSelectedProductsPerPage(productsPerPage.toString());
  }, [productsPerPage]);



  const handleOptimizeSelected = useCallback(() => {
    if (selectedItems.length === 0) return;

    // Initialize bulk optimization state
    setOptimizationQueue([...selectedItems]);
    setOptimizingProducts(new Set());
    setCompletedProducts(new Set());
    setFailedProducts(new Set());
    setBulkOptimizationProgress({
      current: 0,
      total: selectedItems.length,
      currentProductTitle: "Starting bulk optimization...",
      isActive: true,
      completed: 0,
      failed: 0
    });
  }, [selectedItems]);

  const handleOptimizeSingle = useCallback((productId: string) => {
    // Initialize single product optimization using the same queue system
    setOptimizationQueue([productId]);
    setOptimizingProducts(new Set());
    setCompletedProducts(new Set());
    setFailedProducts(new Set());
    const productTitle = products.find(p => p.id === productId)?.title || "Unknown Product";
    setBulkOptimizationProgress({
      current: 0,
      total: 1,
      currentProductTitle: productTitle,
      isActive: true,
      completed: 0,
      failed: 0
    });
  }, [products]);

  const handleAdvancedOptimize = useCallback((productIds: string[]) => {
    setPendingOptimizationIds(productIds);
    setShowAdvancedModal(true);
  }, []);

  const handleAdvancedOptimizeSubmit = useCallback(() => {
    // Initialize bulk optimization state for advanced optimization
    setOptimizationQueue([...pendingOptimizationIds]);
    setOptimizingProducts(new Set());
    setCompletedProducts(new Set());
    setFailedProducts(new Set());
    setBulkOptimizationProgress({
      current: 0,
      total: pendingOptimizationIds.length,
      currentProductTitle: "Starting advanced optimization...",
      isActive: true,
      completed: 0,
      failed: 0
    });
    setShowAdvancedModal(false);
    setPendingOptimizationIds([]);
  }, [pendingOptimizationIds]);

  const handleAdvancedContextChange = useCallback((field: keyof OptimizationContext, value: any) => {
    setAdvancedContext(prev => ({ ...prev, [field]: value }));
  }, []);

  // Add cancel optimization function
  const handleCancelOptimization = useCallback(() => {
    // Reset all optimization states
    setOptimizationQueue([]);
    setCurrentOptimizingProduct(null);
    setOptimizingProducts(new Set());
    setCompletedProducts(new Set());
    setFailedProducts(new Set());
    setBulkOptimizationProgress({
      current: 0,
      total: 0,
      currentProductTitle: "",
      isActive: false,
      completed: 0,
      failed: 0
    });
    setSelectedItems([]);
    
    // Show cancellation message
    setToastMessage("Optimization cancelled");
    setToastError(false);
    setShowToast(true);
  }, []);

  // Handle publishing optimized data
  const handlePublishProduct = useCallback((productId: string) => {
    const optimizedData = optimizedProducts[productId];
    if (!optimizedData) return;

    // Create formatted data for API (expects tags as string, not array)
    const optimized = optimizedData.optimizedData;
    const dataToPublish = {
      title: optimized.title,
      description: optimized.description,
      handle: urlUpdateSettings[productId] !== false ? optimized.handle : optimizedData.originalData.handle,
      productType: optimized.productType || "",
      vendor: optimized.vendor || "",
      // API expects tags as string, not array
      tags: Array.isArray(optimized.tags) ? optimized.tags.join(", ") : (optimized.tags || ""),
    };

    publishFetcher.submit(
      {
        intent: "publish",
        productId,
        optimizedData: JSON.stringify(dataToPublish),
      },
      {
        method: "POST",
        action: "/api/publish"
      }
    );
  }, [optimizedProducts, publishFetcher, urlUpdateSettings]);

  // Handle bulk publishing all optimized products
  const handleBulkPublish = useCallback(() => {
    const productIds = Object.keys(optimizedProducts).filter(
      id => !optimizedProducts[id].isPublished
    );

    if (productIds.length === 0) return;

    // Build bulk publish data with URL update settings applied
    // Format must match API's BulkPublishSchema: { id, optimizedData: { title, description, handle, tags (string) } }
    const productsData = productIds.map(productId => {
      const optimized = optimizedProducts[productId].optimizedData;
      const dataToPublish = {
        title: optimized.title,
        description: optimized.description,
        handle: urlUpdateSettings[productId] !== false ? optimized.handle : optimizedProducts[productId].originalData.handle,
        productType: optimized.productType || "",
        vendor: optimized.vendor || "",
        // API expects tags as string, not array
        tags: Array.isArray(optimized.tags) ? optimized.tags.join(", ") : (optimized.tags || ""),
      };
      return {
        id: productId,
        optimizedData: dataToPublish,
      };
    });

    publishFetcher.submit(
      {
        intent: "publishBulk",
        productsData: JSON.stringify(productsData),
      },
      {
        method: "POST",
        action: "/api/publish"
      }
    );
  }, [optimizedProducts, publishFetcher, urlUpdateSettings]);

  // Handle discarding all optimized products
  const handleDiscardAll = useCallback(() => {
    setOptimizedProducts({});
    setToastMessage("All optimizations discarded");
    setToastError(false);
    setShowToast(true);
  }, []);

  // Handle denying/discarding optimized data
  const handleDenyProduct = useCallback((productId: string) => {
    setOptimizedProducts(prev => {
      const updated = { ...prev };
      delete updated[productId];
      return updated;
    });
    
    setToastMessage("Optimization discarded");
    setToastError(false);
    setShowToast(true);
  }, []);

  // Toggle preview expansion
  const togglePreview = useCallback((productId: string) => {
    setExpandedPreviews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  }, []);

  // Toggle description expansion
  const toggleDescription = useCallback((productId: string) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  }, []);

  // Handle optimization results
  const { data: fetcherData, state: fetcherState } = optimizeFetcher;

  // Queue processing effect - processes one product at a time
  useEffect(() => {
    if (optimizationQueue.length > 0 && fetcherState === "idle" && !currentOptimizingProduct) {
      const nextProductId = optimizationQueue[0];
      const nextProduct = products.find(p => p.id === nextProductId);

      if (nextProduct) {
        // Remove from queue and start optimizing
        setOptimizationQueue(prev => prev.slice(1));
        setCurrentOptimizingProduct(nextProductId);
        setOptimizingProducts(prev => new Set([...prev, nextProductId]));

        // Update progress
        setBulkOptimizationProgress(prev => ({
          ...prev,
          current: prev.total - optimizationQueue.length + 1,
          currentProductTitle: nextProduct.title
        }));

        // Submit optimization request for single product with special instructions
        const contextWithInstructions = {
          ...advancedContext,
          specialInstructions: specialInstructions || undefined
        };
        
        optimizeFetcher.submit(
          {
            intent: "optimize",
            productIds: JSON.stringify([nextProductId]), // Send only one product at a time
            context: JSON.stringify(contextWithInstructions),
          },
          {
            method: "POST",
            action: "/api/optimize"
          }
        );
      }
    }
  }, [optimizationQueue, fetcherState, currentOptimizingProduct, products, optimizeFetcher, advancedContext, specialInstructions]);



  // Handle optimization completion for individual products
  useEffect(() => {
    if (fetcherData && currentOptimizingProduct && fetcherState === "idle") {
      const results = (fetcherData as any)?.results;

      if (results && results.length > 0) {
        const result = results[0]; // Single product result
        const currentProduct = products.find(p => p.id === currentOptimizingProduct);

        // Remove from optimizing and add to appropriate set
        setOptimizingProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(currentOptimizingProduct);
          return newSet;
        });

        if (result.success && currentProduct && result.optimizedData) {
          // Store optimized data in localStorage for review instead of auto-publishing
          const optimizedProductData: OptimizedProductData = {
            id: currentOptimizingProduct,
            originalData: {
              title: currentProduct.title,
              descriptionHtml: currentProduct.descriptionHtml,
              handle: currentProduct.handle,
              productType: currentProduct.productType,
              vendor: currentProduct.vendor,
              tags: currentProduct.tags
            },
            optimizedData: result.optimizedData,
            timestamp: Date.now(),
            isPublished: false
          };

          setOptimizedProducts(prev => ({
            ...prev,
            [currentOptimizingProduct]: optimizedProductData
          }));

          setCompletedProducts(prev => new Set([...prev, currentOptimizingProduct]));
          setBulkOptimizationProgress(prev => ({
            ...prev,
            completed: prev.completed + 1
          }));
        } else {
          setFailedProducts(prev => new Set([...prev, currentOptimizingProduct]));
          setBulkOptimizationProgress(prev => ({
            ...prev,
            failed: prev.failed + 1
          }));
        }

        // Clear current optimizing product to allow next in queue
        setCurrentOptimizingProduct(null);

        // Check if this was the last product in the queue
        if (optimizationQueue.length === 0) {
          const totalCompleted = completedProducts.size + (result.success ? 1 : 0);
          const totalFailed = failedProducts.size + (!result.success ? 1 : 0);

          // Show completion message
          if (totalCompleted > 0) {
            setToastMessage(`Successfully optimized ${totalCompleted} product(s) for review${totalFailed > 0 ? `, ${totalFailed} failed` : ''}`);
            setToastError(totalFailed > 0);
            setShowToast(true);
          }

          // Reset states after completion
          setTimeout(() => {
            setBulkOptimizationProgress({
              current: 0,
              total: 0,
              currentProductTitle: "",
              isActive: false,
              completed: 0,
              failed: 0
            });
            setOptimizingProducts(new Set());
            setCompletedProducts(new Set());
            setFailedProducts(new Set());
            setSelectedItems([]);
          }, 3000);
        }
      }
    }
  }, [fetcherData, fetcherState, currentOptimizingProduct, optimizationQueue.length, completedProducts.size, failedProducts.size, products]);

  // Handle fetch state changes and errors
  useEffect(() => {
    if (fetcherState === "idle" && bulkOptimizationProgress.isActive && currentOptimizingProduct) {
      const fetcherError = (optimizeFetcher as any)?.data?.error;
      const results = (fetcherData as any)?.results;
      
      // Check for specific error conditions including network errors
      const hasNetworkError = optimizeFetcher.state === "idle" && !fetcherData;
      const hasApiError = fetcherError || (!results && fetcherData && typeof fetcherData === 'object' && 'error' in fetcherData);
      
      if (hasNetworkError || hasApiError) {
        console.warn(`⚠️ Optimization failed for product: ${currentOptimizingProduct}`, {
          hasNetworkError,
          fetcherError,
          fetcherData
        });
        
        // Handle the failed product
        setFailedProducts(prev => new Set([...prev, currentOptimizingProduct]));
        setBulkOptimizationProgress(prev => ({
          ...prev,
          failed: prev.failed + 1
        }));
        setOptimizingProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(currentOptimizingProduct);
          return newSet;
        });
        setCurrentOptimizingProduct(null);

        // Show error toast if this was the last product
        if (optimizationQueue.length === 0) {
          let errorMessage = 'Optimization failed. Please try again.';
          
          if (hasNetworkError) {
            errorMessage = 'Network timeout occurred. The AI service may be busy. Please try again in a moment.';
          } else if (fetcherError?.includes('timeout') || fetcherError?.includes('504')) {
            errorMessage = 'Optimization timed out. This can happen with complex products. Try again or use simpler descriptions.';
          } else if (fetcherError?.includes('credits') || fetcherError?.includes('insufficient')) {
            errorMessage = 'Insufficient credits. Please check your plan or wait for credits to reset.';
          }
          
          setToastMessage(errorMessage);
          setToastError(true);
          setShowToast(true);

          setTimeout(() => {
            setBulkOptimizationProgress({
              current: 0,
              total: 0,
              currentProductTitle: "",
              isActive: false,
              completed: 0,
              failed: 0
            });
            setOptimizingProducts(new Set());
            setCompletedProducts(new Set());
            setFailedProducts(new Set());
            setSelectedItems([]);
          }, 3000);
        }
        return; // Exit early for error case
      }
      
      // Handle successful case (existing logic)
      if (!results) {
        return; // Still processing or no data yet
      }
    }
  }, [fetcherState, bulkOptimizationProgress.isActive, fetcherData, currentOptimizingProduct, optimizationQueue.length, optimizeFetcher.state]);

  // Add timeout protection for stuck optimizations
  useEffect(() => {
    if (currentOptimizingProduct && fetcherState === "submitting") {
      const timeout = setTimeout(() => {
        if (fetcherState === "submitting") {
          console.warn(`⚠️ Optimization timeout for product: ${currentOptimizingProduct}`);
          // Force reset the fetcher state by triggering an error handling
          setFailedProducts(prev => new Set([...prev, currentOptimizingProduct]));
          setBulkOptimizationProgress(prev => ({
            ...prev,
            failed: prev.failed + 1
          }));
          setOptimizingProducts(prev => {
            const newSet = new Set(prev);
            newSet.delete(currentOptimizingProduct);
            return newSet;
          });
          setCurrentOptimizingProduct(null);
          
          // Show timeout error with helpful message
          setToastMessage(`Optimization timed out. Complex products may take longer - try reducing the number of products being optimized simultaneously.`);
          setToastError(true);
          setShowToast(true);
        }
      }, 60000); // 60 second timeout to match API limits

      return () => clearTimeout(timeout);
    }
  }, [currentOptimizingProduct, fetcherState]);

  // Handle publish fetch results
  useEffect(() => {
    if (publishFetcher.state === "idle" && publishFetcher.data) {
      const data = publishFetcher.data as any;
      if (data.success) {
        // Update published status for the products
        if (data.productId) {
          // Single product publish - remove from localStorage since it's published
          setOptimizedProducts(prev => {
            const updated = { ...prev };
            delete updated[data.productId];
            return updated;
          });
          setToastMessage(`Successfully published ${data.productTitle || 'product'}`);
        } else if (data.publishedCount) {
          // Bulk publish - remove all published items from localStorage
          setOptimizedProducts({});
          setToastMessage(`Successfully published ${data.publishedCount} product(s)`);
        }
        setToastError(false);
        setShowToast(true);
      } else {
        setToastMessage(data.error || 'Publishing failed');
        setToastError(true);
        setShowToast(true);
      }
    }
  }, [publishFetcher.state, publishFetcher.data]);

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
    setSearchParams(newSearchParams, { preventScrollReset: true });
  };

  const handleNext = () => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("direction", "next");
    newSearchParams.set("page", (currentPage + 1).toString());
    if (pageInfo.hasNextPage) {
      // Use the end cursor from pageInfo for proper pagination
      newSearchParams.set("cursor", pageInfo.endCursor || "");
    }
    setSearchParams(newSearchParams, { preventScrollReset: true });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { status: "success" as const, children: "Active" },
      draft: { status: "info" as const, children: "Draft" },
      archived: { status: "warning" as const, children: "Archived" },
    };

    return statusConfig[status as keyof typeof statusConfig] || { status: "info" as const, children: status };
  };

  // Remove unused variable lint for subscription by referencing it in UI when present
  const subscriptionPlan = subscription?.planName;

  const toastMarkup = showToast ? (
    <Toast
      content={toastMessage}
      error={toastError}
      onDismiss={() => setShowToast(false)}
    />
  ) : null;

  // Derive a loading flag instead of returning early
  const isLoading = isInvalid;

  return (
    <ClientOnly fallback={
      <Page>
        <TitleBar title="Products" />
        <div>Loading...</div>
      </Page>
    }>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
      <ErrorBoundary>
        <Frame>
          <Page>
            <TitleBar title="Products" />

        {/* Error Banner (rendered via content, not early-return) */}
        {hasError && (
          <Card>
            <Box padding="600">
              <Text variant="headingMd" as="h2" tone="critical">
                Error Loading Products
              </Text>
              <Text variant="bodyMd" tone="subdued" as="p">
                {(loaderData as any)?.details}
              </Text>
            </Box>
          </Card>
        )}

        {/* Loading State (no early return, keeps hooks order consistent) */}
        {isLoading && !hasError && (
          <Card>
            <Box padding="600">
              <Text variant="headingMd" as="h2">
                Loading Products...
              </Text>
            </Box>
          </Card>
        )}

        {/* Action Bar */}
        <Card>
          <Box padding="500">
            <InlineStack gap="400" align="space-between">
              <BlockStack gap="100">
                <Text variant="headingLg" as="h2">
                  AI Product Optimization
                </Text>
                <Text variant="bodyMd" tone="subdued" as="p">
                  Enhance your products with 2026 SEO best practices using AI
                </Text>
              </BlockStack>

              <BlockStack gap="200" align="end">
                <InlineStack gap="300" align="center">
                  <Button
                    variant="tertiary"
                    size="slim"
                    onClick={() => setShowSpecialInstructionsModal(true)}
                  >
                    Special Instructions
                  </Button>
                  
                  {/* Enhanced Credits and Plan Display */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "8px 12px",
                    backgroundColor: "var(--p-color-bg-surface-secondary)",
                    borderRadius: "8px",
                    border: "1px solid var(--p-color-border)",
                  }}>
                    <Icon source={CreditCardIcon} tone="base" />
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: "2px"
                    }}>
                      <Text variant="bodyMd" fontWeight="semibold" as="span">
                        {user.credits} credits
                      </Text>
                      {subscriptionPlan && (
                        <Text variant="bodySm" tone="subdued" as="span">
                          {subscriptionPlan} 
                        </Text>
                      )}
                    </div>
                  </div>
                </InlineStack>
                <Text variant="bodySm" tone="subdued" as="p">
                  Select products using checkboxes to enable bulk optimization
                </Text>
                {selectedItems.length > 10 && (
                  <Text variant="bodySm" tone="caution" as="p">
                    💡 Tip: For best results, optimize 5-10 products at a time to avoid timeouts
                  </Text>
                )}
              </BlockStack>
            </InlineStack>
          </Box>
        </Card>

        {/* Bulk Publish Ready Banner */}
        {Object.keys(optimizedProducts).filter(id => !optimizedProducts[id].isPublished).length > 0 && !bulkOptimizationProgress.isActive && (
          <Card>
            <Box padding="400">
              <BlockStack gap="300">
                <InlineStack gap="400" align="space-between">
                  <BlockStack gap="100">
                    <InlineStack gap="200" align="center">
                      <div style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        backgroundColor: "var(--p-color-bg-success)"
                      }} />
                      <Text variant="headingMd" as="h3">
                        {Object.keys(optimizedProducts).filter(id => !optimizedProducts[id].isPublished).length} Optimized Product{Object.keys(optimizedProducts).filter(id => !optimizedProducts[id].isPublished).length !== 1 ? 's' : ''} Ready to Publish
                      </Text>
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued" as="p">
                      Review changes below and publish all at once, or manage individually
                    </Text>
                  </BlockStack>

                  <InlineStack gap="200">
                    <Button
                      variant="primary"
                      onClick={handleBulkPublish}
                      loading={publishFetcher.state === "submitting"}
                      icon={CheckIcon}
                    >
                      {`Publish All (${Object.keys(optimizedProducts).filter(id => !optimizedProducts[id].isPublished).length})`}
                    </Button>
                    <Button
                      variant="tertiary"
                      tone="critical"
                      onClick={handleDiscardAll}
                    >
                      Discard All
                    </Button>
                  </InlineStack>
                </InlineStack>

                {/* Quick summary of optimized products */}
                <div style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  paddingTop: "8px",
                  borderTop: "1px solid var(--p-color-border)"
                }}>
                  {Object.keys(optimizedProducts)
                    .filter(id => !optimizedProducts[id].isPublished)
                    .slice(0, 5)
                    .map(productId => {
                      const product = products.find(p => p.id === productId);
                      return (
                        <Badge key={productId} tone="success" size="small">
                          {product?.title || optimizedProducts[productId].originalData.title}
                        </Badge>
                      );
                    })}
                  {Object.keys(optimizedProducts).filter(id => !optimizedProducts[id].isPublished).length > 5 && (
                    <Badge tone="info" size="small">
                      {`+${Object.keys(optimizedProducts).filter(id => !optimizedProducts[id].isPublished).length - 5} more`}
                    </Badge>
                  )}
                </div>
              </BlockStack>
            </Box>
          </Card>
        )}

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
                        ? `All ${bulkOptimizationProgress.total} products processed!`
                        : `Processing ${bulkOptimizationProgress.current} of ${bulkOptimizationProgress.total} products`
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

                <InlineStack gap="400" align="space-between">
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

                  {/* Queue Status and Cancel Button */}
                  <InlineStack gap="300">
                    {bulkOptimizationProgress.completed > 0 && (
                      <InlineStack gap="100" align="center">
                        <div style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: "var(--p-color-bg-success)"
                        }} />
                        <Text variant="bodySm" tone="success" as="span">
                          {bulkOptimizationProgress.completed} completed
                        </Text>
                      </InlineStack>
                    )}
                    {bulkOptimizationProgress.failed > 0 && (
                      <InlineStack gap="100" align="center">
                        <div style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: "var(--p-color-bg-critical)"
                        }} />
                        <Text variant="bodySm" tone="critical" as="span">
                          {bulkOptimizationProgress.failed} failed
                        </Text>
                      </InlineStack>
                    )}
                    {optimizationQueue.length > 0 && (
                      <InlineStack gap="100" align="center">
                        <div style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: "var(--p-color-bg-info)"
                        }} />
                        <Text variant="bodySm" tone="subdued" as="span">
                          {optimizationQueue.length} in queue
                        </Text>
                      </InlineStack>
                    )}
                    
                    {/* Cancel Button */}
                    {bulkOptimizationProgress.current < bulkOptimizationProgress.total && (
                      <Button
                        variant="tertiary"
                        tone="critical"
                        size="slim"
                        onClick={handleCancelOptimization}
                      >
                        Cancel
                      </Button>
                    )}
                  </InlineStack>
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
            {!isLoading && (
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
            )}

            {/* Products List */}
            {!isLoading && (
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
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            minHeight: "120px",
                            gap: "16px",
                            width: "100%",
                            position: "relative",
                            scrollBehavior: "smooth"
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
                                    {product.isOptimized ? (
                                      <Badge tone="success" size="small">
                                        ✨ Optimized
                                      </Badge>
                                    ) : (
                                      <Badge {...getStatusBadge(product.status)} />
                                    )}
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
                                      {product.tags.map((tag, index) => (
                                        <Badge key={index} tone="info" size="small">{tag}</Badge>
                                      ))}
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

                                {/* Optimized Data Preview */}
                                {optimizedProducts[product.id] && !optimizedProducts[product.id].isPublished && (
                                  <div style={{
                                    marginTop: "12px",
                                    padding: "12px",
                                    backgroundColor: "var(--p-color-bg-success-subdued)",
                                    borderRadius: "8px",
                                    border: "1px solid var(--p-color-border-success)",
                                    transition: "all 0.2s ease-in-out"
                                  }}>
                                    <BlockStack gap="300">
                                      <InlineStack gap="200" align="space-between">
                                        <Text variant="bodyMd" tone="success" fontWeight="semibold" as="span">
                                          ✨ Optimized Version Ready
                                        </Text>
                                        <Button
                                          size="micro"
                                          variant="tertiary"
                                          onClick={() => togglePreview(product.id)}
                                        >
                                          {expandedPreviews.has(product.id) ? "Hide" : "Preview"}
                                        </Button>
                                      </InlineStack>
                                      
                                      {expandedPreviews.has(product.id) && (
                                        <div style={{
                                          backgroundColor: "var(--p-color-bg-surface)",
                                          padding: "12px",
                                          borderRadius: "6px",
                                          border: "1px solid var(--p-color-border)",
                                          animation: "fadeIn 0.2s ease-in-out"
                                        }}>
                                          <BlockStack gap="200">
                                            {/* Optimized Title and Status Row */}
                                            <div style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "12px",
                                              flexWrap: "nowrap"
                                            }}>
                                              <Text variant="headingMd" tone="success" as="h3" truncate>
                                                {optimizedProducts[product.id].optimizedData.title}
                                              </Text>
                                              <div style={{ flexShrink: 0 }}>
                                                <Badge tone="success" size="small">Optimized</Badge>
                                              </div>
                                            </div>

                                            {/* Optimized Meta Info Row */}
                                            <div style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "8px",
                                              flexWrap: "wrap"
                                            }}>
                                              <Text variant="bodySm" tone="subdued" as="span">
                                                {optimizedProducts[product.id].optimizedData.productType} • {optimizedProducts[product.id].optimizedData.vendor || product.vendor}
                                              </Text>
                                            </div>

                                            {/* Optimized Handle with checkbox */}
                                            <div style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "8px",
                                              justifyContent: "space-between"
                                            }}>
                                              <Text variant="bodySm" tone="subdued" as="span">
                                                URL: /{optimizedProducts[product.id].optimizedData.handle}
                                              </Text>
                                              <Checkbox
                                                label="Update URL"
                                                checked={urlUpdateSettings[product.id] ?? true}
                                                onChange={(checked) => {
                                                  setUrlUpdateSettings(prev => ({
                                                    ...prev,
                                                    [product.id]: checked
                                                  }));
                                                }}
                                              />
                                            </div>

                                            {/* Optimized Description Dropdown */}
                                            <div>
                                              <InlineStack gap="200" align="space-between">
                                                <Text variant="bodySm" tone="subdued" as="span">
                                                  Optimized Description:
                                                </Text>
                                                <Button
                                                  size="micro"
                                                  variant="tertiary"
                                                  onClick={() => toggleDescription(product.id)}
                                                >
                                                  {expandedDescriptions.has(product.id) ? "Hide" : "Show"}
                                                </Button>
                                              </InlineStack>
                                              
                                              {expandedDescriptions.has(product.id) && (
                                                <div style={{
                                                  marginTop: "8px",
                                                  padding: "12px",
                                                  backgroundColor: "var(--p-color-bg-surface-secondary)",
                                                  borderRadius: "6px",
                                                  border: "1px solid var(--p-color-border)",
                                                  maxHeight: "200px",
                                                  overflowY: "auto"
                                                }}>
                                                  <div 
                                                    style={{
                                                      fontSize: "14px",
                                                      lineHeight: "1.4",
                                                      wordBreak: "break-word"
                                                    }}
                                                    dangerouslySetInnerHTML={{ 
                                                      __html: optimizedProducts[product.id].optimizedData.description 
                                                    }}
                                                  />
                                                </div>
                                              )}
                                            </div>

                                            {/* Optimized Tags */}
                                            {optimizedProducts[product.id].optimizedData.tags && optimizedProducts[product.id].optimizedData.tags.length > 0 && (
                                              <div>
                                                <div style={{ marginBottom: "4px", display: "block" }}>
                                                  <Text variant="bodySm" tone="subdued" as="span">
                                                    Tags:
                                                  </Text>
                                                </div>
                                                <div style={{
                                                  display: "flex",
                                                  gap: "4px",
                                                  alignItems: "center",
                                                  flexWrap: "wrap"
                                                }}>
                                                  {optimizedProducts[product.id].optimizedData.tags.map((tag: string, index: number) => (
                                                    <Badge key={index} tone="success" size="small">{tag}</Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </BlockStack>
                                        </div>
                                      )}

                                      <InlineStack gap="200">
                                        <Button
                                          variant="primary"
                                          size="slim"
                                          onClick={() => handlePublishProduct(product.id)}
                                          loading={publishFetcher.state === "submitting"}
                                        >
                                          Publish Changes
                                        </Button>
                                        <Button
                                          variant="tertiary"
                                          tone="critical"
                                          size="slim"
                                          onClick={() => handleDenyProduct(product.id)}
                                        >
                                          Discard
                                        </Button>
                                      </InlineStack>
                                    </BlockStack>
                                  </div>
                                )}

                                {/* Published Status */}
                                {optimizedProducts[product.id] && optimizedProducts[product.id].isPublished && (
                                  <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "8px 12px",
                                    backgroundColor: "var(--p-color-bg-success-subdued)",
                                    borderRadius: "8px"
                                  }}>
                                    <Text variant="bodySm" tone="success" fontWeight="semibold" as="span">
                                      ✅ Published Successfully!
                                    </Text>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right Section: Action Buttons and Status Badge */}
                            <div style={{
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "8px",
                              position: "relative"
                            }}>
                              {!isOptimizing && !optimizedProducts[product.id] && (
                                <div style={{
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
            )}

            {/* Pagination */}
            {!isLoading && (pageInfo.hasNextPage || pageInfo.hasPreviousPage || products.length > 0) && (
              <Card>
                <Box padding="400">
                  <InlineStack align="space-between">
                    <InlineStack gap="300" align="center">
                      <Text variant="bodySm" tone="subdued" as="span">
                        Showing {((currentPage - 1) * productsPerPage) + 1}-{Math.min(currentPage * productsPerPage, ((currentPage - 1) * productsPerPage) + products.length)} of {products.length} products
                      </Text>
                      <Select
                        label="Products per page"
                        labelHidden
                        options={[
                          { label: "10 per page", value: "10" },
                          { label: "25 per page", value: "25" },
                          { label: "50 per page", value: "50" },
                        ]}
                        value={selectedProductsPerPage}
                        onChange={handleProductsPerPageChange}
                      />
                    </InlineStack>
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

        {/* Special Instructions Modal */}
        <Modal
          open={showSpecialInstructionsModal}
          onClose={() => setShowSpecialInstructionsModal(false)}
          title="Special Optimization Instructions"
          primaryAction={{
            content: "Save Instructions",
            onAction: () => setShowSpecialInstructionsModal(false),
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setShowSpecialInstructionsModal(false),
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Text variant="bodyMd" as="p">
                Add custom instructions that will be included in every product optimization. These instructions will guide the AI to follow your specific requirements and brand guidelines.
              </Text>

              <TextField
                label="Special Instructions"
                value={specialInstructions}
                onChange={setSpecialInstructions}
                placeholder="e.g., Always emphasize eco-friendly materials, use casual tone, include size guide mentions, focus on durability..."
                multiline={6}
                helpText="These instructions will be applied to all optimizations (both quick and advanced)"
                autoComplete="off"
              />

              {specialInstructions && (
                <Card>
                  <Box padding="300">
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h4">Preview</Text>
                      <Text variant="bodySm" tone="subdued" as="p">
                        Your special instructions: "{specialInstructions}"
                      </Text>
                    </BlockStack>
                  </Box>
                </Card>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
        </Page>
      </Frame>
      </ErrorBoundary>
    </ClientOnly>
  );
}
