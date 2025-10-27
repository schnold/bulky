# Authentication Migration Guide

## Modern App Bridge & Session Token Implementation

This document describes the migration from the legacy App Bridge v3 to the modern CDN-based App Bridge with proper session token authentication.

## What Changed

### 1. App Bridge CDN Script

**Before (Legacy):**
```typescript
import createApp from "@shopify/app-bridge";
const app = createApp({ apiKey, host, forceRedirect: true });
```

**After (Modern):**
```html
<!-- In root.tsx -->
<meta name="shopify-api-key" content={apiKey} />
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
```

The modern approach uses a CDN-hosted script that:
- Automatically stays up-to-date
- Exposes a global `shopify` variable
- Handles session tokens automatically
- No need for npm package installation for basic functionality

### 2. Session Token Authentication

**Before (Legacy):**
```typescript
import { getSessionToken, authenticatedFetch } from "@shopify/app-bridge/utilities";
const token = await getSessionToken(app);
const fetch = authenticatedFetch(app);
```

**After (Modern):**
```typescript
// Get session token using the global shopify variable
const token = await window.shopify.idToken();

// For authenticated requests to your backend
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`,
  }
});

// For direct Shopify Admin API access
const response = await fetch('shopify:admin/api/2025-01/graphql.json', {
  method: 'POST',
  body: JSON.stringify({ query, variables }),
});
```

### 3. Direct API Access

Added to `shopify.app.toml`:
```toml
[admin]
# Enables authenticated fetch calls directly from the frontend
direct_api_mode = "online"
```

This allows the app to make authenticated requests to the Shopify Admin API directly from the frontend using the `shopify:` protocol.

## New Components & Hooks

### ModernAppBridgeProvider

Wraps your app to provide access to the modern App Bridge:

```typescript
import { ModernAppBridgeProvider } from "./components/ModernAppBridge";

<ModernAppBridgeProvider>
  <YourApp />
</ModernAppBridgeProvider>
```

### useModernAppBridge Hook

Access the global `shopify` variable in React components:

```typescript
import { useModernAppBridge } from "./components/ModernAppBridge";

function MyComponent() {
  const { shopify, isReady } = useModernAppBridge();
  
  if (!isReady) return <div>Loading...</div>;
  
  // Use shopify.toast, shopify.modal, etc.
}
```

### useAuthenticatedFetch Hook

Updated to use modern session tokens:

```typescript
import { useAuthenticatedFetch } from "./hooks/useAuthenticatedFetch";

function MyComponent() {
  const { get, post, shopifyGraphQL, getSessionToken } = useAuthenticatedFetch();
  
  // For your backend
  const response = await post('/api/optimize', { data });
  
  // For Shopify Admin API (direct access)
  const result = await shopifyGraphQL(`
    query {
      shop {
        name
      }
    }
  `);
}
```

### Additional Hooks

**useToast:**
```typescript
import { useToast } from "./components/ModernAppBridge";

const toast = useToast();
toast.show("Success!", { isError: false });
```

**useResourcePicker:**
```typescript
import { useResourcePicker } from "./components/ModernAppBridge";

const picker = useResourcePicker();
const selected = await picker.open({ type: 'product', multiple: true });
```

## Backend Session Token Validation

The backend already validates session tokens properly using `app/utils/session-token.server.ts`:

```typescript
import { verifySessionToken, extractSessionTokenFromRequest } from "./utils/session-token.server";

// In your API routes
const token = extractSessionTokenFromRequest(request);
const verification = verifySessionToken(token, appSecret, clientId);

if (!verification.isValid) {
  throw new Response("Unauthorized", { status: 401 });
}

// Access shop and user info
const shop = verification.payload.dest;
const userId = verification.payload.sub;
```

## Migration Checklist

- [x] Update `shopify.app.toml` with direct API access configuration
- [x] Update `root.tsx` to include App Bridge CDN script and API key meta tag
- [x] Create `ModernAppBridgeProvider` component
- [x] Update `useAuthenticatedFetch` hook to use modern session tokens
- [x] Update `app.tsx` to use `ModernAppBridgeProvider`
- [x] Keep existing `@shopify/app-bridge-react` v4.1.6 (compatible with modern App Bridge)
- [x] Legacy `@shopify/app-bridge` npm package removed (now using CDN)

## Testing

1. **Session Token Flow:**
   - Open your app in the Shopify admin
   - Check browser console for "[Modern App Bridge] Shopify global variable ready"
   - Verify authenticated API calls include session token in Authorization header

2. **Direct API Access:**
   - Test GraphQL queries using the `shopify:` protocol
   - Verify requests are automatically authenticated

3. **App Distribution Check:**
   - Submit app to Shopify App Store
   - Verify no warnings about session tokens or App Bridge version

## Benefits

1. **Always Up-to-Date:** CDN script automatically updates to latest version
2. **Smaller Bundle:** No need to ship App Bridge in your JavaScript bundle
3. **Better Performance:** Leverages browser caching and CDN distribution
4. **Simpler Code:** Uses native Web Platform APIs
5. **Session Token Compliance:** Properly implements session token authentication required by Shopify

## Resources

- [About Session Tokens](https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens)
- [App Bridge Library](https://shopify.dev/docs/api/app-bridge-library)
- [Direct API Access Configuration](https://shopify.dev/docs/apps/tools/cli/configuration#admin)

