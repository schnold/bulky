# Cleanup Old Files

After verifying the migration is successful, you can safely remove these deprecated files:

## Files to Remove

### 1. Old App Bridge Context (Client-side)
```bash
rm app/components/AppBridgeContext.tsx
```

**Why?** This file used the legacy App Bridge v3 `createApp` approach. It has been replaced by `app/components/ModernAppBridge.tsx` which uses the CDN-based global `shopify` variable.

### 2. Old Session Token Utility (Client-side)
```bash
rm app/utils/session-token.ts
```

**Why?** This file implemented custom session token handling using the old App Bridge utilities. Session tokens are now obtained via `shopify.idToken()` from the modern App Bridge.

## Files to KEEP

### ✅ Keep: app/utils/session-token.server.ts
**Do NOT remove this file!** It's still used by your backend API routes to validate session tokens from client requests. This is essential for security.

### ✅ Keep: app/components/SessionContext.tsx
If this file is used for managing session state in React, keep it unless you verify it's not imported anywhere.

### ✅ Keep: app/components/SessionTokenTester.tsx
This might be useful for debugging. You can remove it later if not needed.

## Verification Before Cleanup

Before removing any files, verify they're not imported anywhere:

```bash
# Check if AppBridgeContext is used
grep -r "AppBridgeContext" app/

# Check if session-token.ts is used
grep -r "from.*session-token\"" app/

# Check if session-token.ts is used (without .server)
grep -r "utils/session-token" app/ | grep -v "session-token.server"
```

If the commands return no results (or only results from the files themselves), they're safe to remove.

## After Cleanup

1. Run the build to ensure no errors:
   ```bash
   npm run build
   ```

2. Test the app locally:
   ```bash
   npm run dev
   ```

3. Navigate to `/app/test` and verify all authentication tests pass

4. Commit the cleanup:
   ```bash
   git add .
   git commit -m "Remove deprecated App Bridge and session token files"
   git push origin main
   ```

## Optional Cleanup

You may also want to clean up these files if they're no longer needed:

- `app/components/SessionTokenTester.tsx` - If this was only for testing
- `app/components/PolarisProvider.tsx` - Check if it's being used
- `app/components/ClientOnly.tsx` - Check if it's being used

Always verify with `grep` before removing any file!

