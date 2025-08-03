// Remove Node.js adapter for serverless compatibility
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  BillingInterval,
  DeliveryMethod,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// Create a logging wrapper for session storage to debug issues
class LoggingPrismaSessionStorage extends PrismaSessionStorage<typeof prisma> {
  async storeSession(session: any): Promise<boolean> {
    console.log(`🔐 Storing session for shop: ${session.shop}`, {
      id: session.id,
      shop: session.shop,
      accessToken: session.accessToken ? 'SET' : 'NOT SET',
      isOnline: session.isOnline
    });
    return super.storeSession(session);
  }

  async loadSession(id: string): Promise<any> {
    console.log(`🔍 Loading session with ID: ${id}`);
    try {
      const session = await super.loadSession(id);
      console.log(`🔍 Loaded session:`, session ? {
        id: session.id,
        shop: session.shop,
        accessToken: session.accessToken ? `SET (${session.accessToken?.substring(0, 8)}...)` : 'NOT SET',
        isOnline: session.isOnline,
        expires: session.expires,
        state: session.state
      } : 'NOT FOUND');
      return session;
    } catch (error) {
      console.error(`❌ Error loading session ${id}:`, error);
      return null;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    console.log(`🗑️ Deleting session with ID: ${id}`);
    return super.deleteSession(id);
  }
}

// Ensure we have a valid app URL
const getAppUrl = () => {
  const url = process.env.SHOPIFY_APP_URL;
  if (!url || url === 'undefined') {
    console.warn('SHOPIFY_APP_URL is not properly set, using fallback');
    return 'https://b1-bulk-product-seo-enhancer.netlify.app';
  }
  return url;
};

// Define billing plans
export const STARTER_PLAN = "starter_plan";
export const PRO_PLAN = "pro_plan";
export const ENTERPRISE_PLAN = "enterprise_plan";

// Plan configurations for GraphQL API
export const PLAN_CONFIGS = {
  [STARTER_PLAN]: {
    name: "Starter Plan",
    description: "Perfect for small stores getting started with SEO optimization",
    amount: 9.99,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS" as const,
  },
  [PRO_PLAN]: {
    name: "Pro Plan", 
    description: "For growing stores that need advanced SEO features and bulk optimization",
    amount: 29.99,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS" as const,
  },
  [ENTERPRISE_PLAN]: {
    name: "Enterprise Plan",
    description: "For large stores with unlimited optimization needs and priority support", 
    amount: 59.99,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS" as const,
  },
};

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: getAppUrl(),
  authPathPrefix: "/auth",
  sessionStorage: new LoggingPrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  // Billing handled manually via GraphQL mutations to avoid restricted scopes
  webhooks: {
    APP_SUBSCRIPTIONS_UPDATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/app-subscriptions/update",
    },
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
