import { vitePlugin as remix } from "@remix-run/dev";
import { installGlobals } from "@remix-run/node";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { netlifyPlugin } from "@netlify/remix-adapter/plugin";
import path from "path";

installGlobals({ nativeFetch: true });

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the HOST env var with SHOPIFY_APP_URL so that it doesn't break the remix server. The CLI will eventually
// stop passing in HOST, so we can remove this workaround after the next major release.
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

// Ensure SHOPIFY_APP_URL is always set to prevent undefined URL issues
if (!process.env.SHOPIFY_APP_URL || process.env.SHOPIFY_APP_URL === 'undefined') {
  process.env.SHOPIFY_APP_URL = "https://b1-bulk-product-seo-enhancer.netlify.app";
  console.warn('SHOPIFY_APP_URL not set or undefined, using fallback:', process.env.SHOPIFY_APP_URL);
}

let host: string;
try {
  host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost:3000").hostname;
} catch (error) {
  console.error('Invalid SHOPIFY_APP_URL, using localhost:', error);
  host = "localhost";
  process.env.SHOPIFY_APP_URL = "http://localhost:3000";
}

let hmrConfig;
if (host === "localhost") {
  hmrConfig = {
    protocol: "ws",
    host: "localhost",
    port: 64999,
    clientPort: 64999,
  };
} else {
  hmrConfig = {
    protocol: "wss",
    host: host,
    port: parseInt(process.env.FRONTEND_PORT!) || 8002,
    clientPort: 443,
  };
}

export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "app"),
    },
  },
  server: {
    allowedHosts: [host],
    cors: {
      preflightContinue: true,
    },
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
      allow: ["app", "node_modules"],
    },
  },
  plugins: [
    remix({
      ignoredRouteFiles: ["**/.*"],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: false,
        v3_singleFetch: false,
        v3_routeConfig: false,
      },
      serverBuildFile: "server.js",
      buildDirectory: "build",
      ssr: true,
      serverModuleFormat: "esm",
    }),
    tsconfigPaths(),
    netlifyPlugin(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    include: [
      "@shopify/app-bridge-react", 
      "@shopify/polaris",
      "@shopify/shopify-api",
      "@shopify/storefront-api-client"
    ],
  },
  ssr: {
    noExternal: [
      "@shopify/app-bridge-react", 
      "@shopify/polaris", 
      "@shopify/shopify-app-remix",
      "@shopify/shopify-api",
      "@shopify/shopify-app-session-storage-prisma",
      "@shopify/storefront-api-client"
    ],
    external: ["react", "react-dom"],
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  define: {
    // Ensure environment variables are available at build time
    'process.env.SHOPIFY_APP_URL': JSON.stringify(process.env.SHOPIFY_APP_URL),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
}) satisfies UserConfig;
