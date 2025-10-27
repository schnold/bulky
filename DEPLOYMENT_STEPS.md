# Deployment Steps for Modern App Bridge & Session Token Authentication

## Overview

Your Shopify app has been updated to use:
1. **Modern App Bridge (CDN-based)** - Latest, auto-updating version
2. **Proper Session Token Authentication** - Compliant with Shopify's requirements
3. **Direct API Access** - Enabled for frontend GraphQL queries

## Changes Made

### Configuration Files
- ✅ `shopify.app.toml` - Added direct API access configuration
- ✅ `package.json` - Using latest `@shopify/app-bridge-react` (v4.x.x - CDN-based)

### Core Files Updated
- ✅ `app/root.tsx` - Added App Bridge CDN script and API key meta tag
- ✅ `app/routes/app.tsx` - Integrated ModernAppBridgeProvider
- ✅ `app/hooks/useAuthenticatedFetch.ts` - Updated to use modern session tokens

### New Files Created
- ✅ `app/components/ModernAppBridge.tsx` - Modern App Bridge context and hooks
- ✅ `app/components/AuthenticationTest.tsx` - Testing component
- ✅ `AUTHENTICATION_MIGRATION_GUIDE.md` - Complete migration documentation

## Deployment Steps

### 1. Install Updated Dependencies

```bash
npm install
```

This will install the latest `@shopify/app-bridge-react` package and remove the legacy `@shopify/app-bridge` package.

### 2. Build the Application

```bash
npm run build
```

### 3. Test Locally (Optional but Recommended)

Before deploying, test the authentication flow:

```bash
npm run dev
```

Then navigate to: `https://your-app-url.myshopify.com/admin/apps/your-app/test`

The authentication test page will show:
- ✅ App Bridge Status
- ✅ Session Token Test
- ✅ Direct API Access Test
- ✅ Toast Notification Test

All tests should pass with green checkmarks.

### 4. Deploy to Netlify

Since you're using Netlify, push your changes to your main branch:

```bash
git add .
git commit -m "Migrate to modern App Bridge and session token authentication"
git push origin main
```

Netlify will automatically deploy your changes.

### 5. Verify in Shopify Admin

After deployment:

1. **Open your app** in the Shopify admin
2. **Check the browser console** for:
   ```
   [Modern App Bridge] Shopify global variable ready
   ```
3. **Navigate to the test page**: `/app/test`
4. **Run all authentication tests** - they should all pass
5. **Test your app's core functionality** to ensure everything works

### 6. Check App Distribution Status

Go to **Shopify Partner Dashboard** > **Your App** > **Distribution**

The following issues should now be resolved:
- ❌ ~~Not using session token authentication~~  ✅ Now using session tokens
- ❌ ~~Using outdated App Bridge version~~  ✅ Now using latest CDN version

## What to Expect

### Before (Legacy Approach)
- App Bridge v3.7.10 (outdated)
- Custom session token handling with `createApp`
- Manual `authenticatedFetch` wrapper
- Warnings in Shopify App Distribution

### After (Modern Approach)
- ✅ Latest App Bridge (CDN, auto-updates)
- ✅ Native session token support via `shopify.idToken()`
- ✅ Direct API access with `shopify:` protocol
- ✅ No warnings in Shopify App Distribution
- ✅ Smaller JavaScript bundle
- ✅ Better performance

## Troubleshooting

### Issue: "App Bridge not ready"

**Solution:** Ensure the CDN script loads before your React app:
```html
<!-- In root.tsx -->
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
```

### Issue: "Failed to get session token"

**Possible causes:**
1. App not embedded properly
2. Missing `shopify-api-key` meta tag
3. Direct API mode not enabled in `shopify.app.toml`

**Check:**
```bash
# Verify shopify.app.toml has:
[admin]
direct_api_mode = "online"
```

### Issue: GraphQL queries fail with authentication error

**Solution:** Use the `shopify:` protocol for direct API access:
```typescript
fetch('shopify:admin/api/2025-01/graphql.json', {
  method: 'POST',
  body: JSON.stringify({ query, variables })
})
```

### Issue: Backend session token validation fails

**Check:**
1. Token is sent in `Authorization: Bearer {token}` header
2. Backend uses `verifySessionToken` from `app/utils/session-token.server.ts`
3. `SHOPIFY_API_SECRET` environment variable is set correctly

## Backend API Routes

Your existing backend routes already validate session tokens correctly. No changes needed to:
- `app/routes/api.optimize.tsx`
- `app/routes/api.publish.tsx`
- `app/routes/api.user-data.tsx`

They use `authenticate.admin(request)` which handles session token validation automatically.

## Environment Variables

Ensure these are set in your Netlify environment:

```bash
SHOPIFY_API_KEY=your-api-key
SHOPIFY_API_SECRET=your-api-secret
SHOPIFY_APP_URL=https://b1-bulk-product-seo-enhancer.netlify.app
```

## Testing Checklist

After deployment, verify:

- [ ] App loads in Shopify admin without errors
- [ ] Browser console shows: "Modern App Bridge Shopify global variable ready"
- [ ] Navigate to `/app/test` and run all tests
- [ ] Session token test passes ✅
- [ ] Direct API access test passes ✅
- [ ] Toast notification works ✅
- [ ] All existing app features work (product optimization, etc.)
- [ ] No errors in browser console
- [ ] No warnings in Shopify Partner Dashboard under Distribution

## Support Resources

- [Session Tokens Documentation](https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens)
- [App Bridge Library](https://shopify.dev/docs/api/app-bridge-library)
- [Direct API Access](https://shopify.dev/docs/apps/tools/cli/configuration#admin)
- Migration Guide: See `AUTHENTICATION_MIGRATION_GUIDE.md`

## Rollback Plan

If you need to rollback:

1. Revert the commit:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. Or manually restore these files from git history:
   - `shopify.app.toml`
   - `app/root.tsx`
   - `app/routes/app.tsx`
   - `app/hooks/useAuthenticatedFetch.ts`
   - `package.json`

## Next Steps

Once deployed and verified:

1. ✅ Monitor for any issues in the first 24 hours
2. ✅ Check Shopify App Store submission status (if applicable)
3. ✅ Remove old session token utility file if no longer needed:
   - `app/utils/session-token.ts` (client-side version - now replaced by ModernAppBridge)
   - Keep `app/utils/session-token.server.ts` (still used for backend validation)

## Success Indicators

Your migration is successful when:

1. ✅ All tests on `/app/test` page pass
2. ✅ No console errors related to App Bridge or authentication
3. ✅ Shopify Partner Dashboard shows no distribution warnings
4. ✅ All app functionality works as expected
5. ✅ Session tokens are visible in network requests (Authorization header)

---

**Need Help?** 
- Check the browser console for detailed error messages
- Review `AUTHENTICATION_MIGRATION_GUIDE.md` for implementation details
- Check Shopify's official documentation for latest updates

