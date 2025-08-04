## Billing Errors

- Aug 3, 2025: Billing request failed for sitezone-test-02.myshopify.com due to missing plan configuration. Error suggests that the "Pro Plan" could not be found in billing settings. Action needed: Add the required plans to the billing configuration.
- Aug 4, 2025: **FIXED** - Error "Managed Pricing Apps cannot use the Billing API" resolved by switching from `createAppSubscription()` to `createManagedPricingUrl()` in app.pricing.tsx:214. Managed Pricing Apps must use Shopify's hosted pricing pages instead of the Billing API.