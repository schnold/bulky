## Billing Errors

- Aug 3, 2025: Billing request failed for sitezone-test-02.myshopify.com due to missing plan configuration. Error suggests that the "Pro Plan" could not be found in billing settings. Action needed: Add the required plans to the billing configuration.
- Aug 4, 2025: **REVERTED** - Switched back to API-based billing using `createAppSubscription()` instead of managed pricing. App now uses the Billing API (appSubscriptionCreate) for direct subscription control.