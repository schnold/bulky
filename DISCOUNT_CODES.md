# Discount Code System

This document explains the discount code feature that allows users to redeem promotional codes for free credits.

## Overview

The discount code system provides a secure way to distribute free credits to users. Key features include:

- **One-time use per user**: Each shop can only redeem a specific discount code once
- **Usage limits**: Set maximum total redemptions across all users
- **Expiration dates**: Optional expiration for time-limited promotions
- **Security**: All validations are server-side with database constraints
- **Atomic transactions**: Credits are added safely using database transactions

## Architecture

### Database Schema

Two new tables were added:

1. **DiscountCode**: Stores the discount codes and their properties
   - `code`: Unique discount code (normalized to uppercase)
   - `creditsToGrant`: Number of credits to give
   - `maxUses`: Maximum total redemptions (optional)
   - `currentUses`: Track current usage count
   - `isActive`: Can be deactivated without deleting
   - `expiresAt`: Optional expiration date
   - `description`: Admin notes

2. **DiscountCodeRedemption**: Tracks who has used which codes
   - Unique constraint on `(discountCodeId, shop)` prevents duplicate redemptions
   - Records credits granted and redemption timestamp

### Backend Implementation

**Files Modified/Created:**

1. `prisma/schema.prisma` - Added discount code models
2. `app/models/user.server.ts` - Added discount code functions:
   - `createDiscountCode()` - Create new codes
   - `validateDiscountCode()` - Validate before redemption
   - `redeemDiscountCode()` - Redeem and add credits (transactional)
   - `getDiscountCodeInfo()` - Get code details
   - `hasRedeemedCode()` - Check if shop has used a code
   - `deactivateDiscountCode()` - Deactivate a code

3. `app/routes/app.redeem-discount.tsx` - API endpoint for redemption
   - POST request handler
   - Input validation
   - Error handling

4. `app/routes/app._index.tsx` - Dashboard UI
   - Discount code input card (right sidebar)
   - State management for code redemption
   - Success/error toast notifications
   - Auto-hides after successful redemption

### Security Features

1. **One-time use per shop**: Database unique constraint ensures each shop can only redeem a code once
2. **Atomic transactions**: Prisma transactions ensure credits are added safely
3. **Server-side validation**: All checks happen on the backend
4. **Rate limiting**: Built into Shopify's authentication layer
5. **Input sanitization**: Codes are trimmed and normalized to uppercase
6. **Error handling**: Detailed error messages without exposing sensitive data

## Usage

### For Administrators

#### Create a Discount Code

```bash
# Basic code: 50 credits, unlimited uses
npx tsx scripts/manage-discount-codes.ts create WELCOME50 50

# With max uses limit
npx tsx scripts/manage-discount-codes.ts create WELCOME50 50 --maxUses 100

# With expiration date
npx tsx scripts/manage-discount-codes.ts create SUMMER2024 100 --expiresAt 2024-08-31

# With description
npx tsx scripts/manage-discount-codes.ts create WELCOME50 50 --maxUses 100 --description "Welcome bonus"

# All options combined
npx tsx scripts/manage-discount-codes.ts create PROMO25 25 --maxUses 500 --expiresAt 2024-12-31 --description "Holiday promotion"
```

#### View a Discount Code

```bash
npx tsx scripts/manage-discount-codes.ts view WELCOME50
```

This shows:
- Code details (credits, usage, status)
- All redemptions (shop, credits granted, timestamp)

#### Deactivate a Code

```bash
npx tsx scripts/manage-discount-codes.ts deactivate WELCOME50
```

Deactivated codes cannot be redeemed but data is preserved.

#### List All Codes

```bash
npx tsx scripts/manage-discount-codes.ts list
```

Shows overview of all discount codes with status.

### For Users

1. **Navigate to Dashboard**: After logging in, users see the main dashboard
2. **Locate Discount Card**: On the right sidebar, below "Account Overview"
3. **Enter Code**: Type the discount code in the input field
4. **Apply**: Click "Apply Code" button or press Enter
5. **Success**: Credits are instantly added and balance updates
6. **Card Disappears**: After successful redemption, the card is hidden

### Example Codes Created

Three test codes were created for testing:

1. **WELCOME50** - 50 credits, max 100 uses
2. **TRYIT25** - 25 credits, max 200 uses
3. **EXCLUSIVE100** - 100 credits, single use only

## UI Location

The discount code card appears on the dashboard at:
- **Location**: app/_index.tsx:532-566
- **Sidebar**: Right side (one-third layout)
- **Position**: Between "Account Overview" and "Quick Stats" cards
- **Visibility**: Shows only before first successful redemption

## API Endpoint

**Endpoint**: `POST /app/redeem-discount`

**Request Body**:
```
FormData {
  code: string
}
```

**Response** (Success):
```json
{
  "success": true,
  "creditsGranted": 50,
  "newBalance": 60
}
```

**Response** (Error):
```json
{
  "success": false,
  "error": "Invalid discount code"
}
```

**Possible Error Messages**:
- "Discount code is required"
- "Discount code cannot be empty"
- "Discount code is too long"
- "Invalid discount code"
- "This discount code is no longer active"
- "This discount code has expired"
- "This discount code has reached its usage limit"
- "You have already used this discount code"
- "User not found"
- "Failed to redeem discount code"

## Testing

### Manual Testing Steps

1. Start the development server
2. Log in to the Shopify app
3. Navigate to the dashboard
4. Verify discount code card appears in right sidebar
5. Try redeeming "WELCOME50" - should add 50 credits
6. Try redeeming "WELCOME50" again - should show error "already used"
7. Try invalid code "INVALID123" - should show error
8. Try "EXCLUSIVE100" - should work once
9. Verify card disappears after successful redemption
10. Check credits balance updated in Account Overview

### Automated Testing

You can test the backend functions directly:

```typescript
// Test validation
const result = await validateDiscountCode("WELCOME50", "test-shop.myshopify.com");
console.log(result); // { valid: true, discountCode: {...} }

// Test redemption
const redemption = await redeemDiscountCode("WELCOME50", "test-shop.myshopify.com");
console.log(redemption); // { success: true, creditsGranted: 50, newBalance: 60 }

// Check if already redeemed
const hasRedeemed = await hasRedeemedCode("WELCOME50", "test-shop.myshopify.com");
console.log(hasRedeemed); // true
```

## Monitoring & Analytics

To track discount code performance:

```bash
# View specific code redemptions
npx tsx scripts/manage-discount-codes.ts view WELCOME50

# List all codes with usage stats
npx tsx scripts/manage-discount-codes.ts list
```

You can also query the database directly:

```sql
-- Top performing codes
SELECT code, creditsToGrant, currentUses, maxUses
FROM "DiscountCode"
WHERE isActive = true
ORDER BY currentUses DESC;

-- Recent redemptions
SELECT dc.code, dcr.shop, dcr.creditsGranted, dcr.redeemedAt
FROM "DiscountCodeRedemption" dcr
JOIN "DiscountCode" dc ON dcr.discountCodeId = dc.id
ORDER BY dcr.redeemedAt DESC
LIMIT 10;
```

## Best Practices

1. **Code Naming**: Use clear, memorable codes (WELCOME50, SUMMER2024)
2. **Usage Limits**: Set reasonable maxUses to prevent abuse
3. **Expiration**: Use expiresAt for time-limited promotions
4. **Descriptions**: Always add descriptions for admin reference
5. **Monitoring**: Regularly check usage with `list` command
6. **Deactivation**: Deactivate instead of deleting for audit trail
7. **Credit Amounts**: Balance generosity with business goals

## Troubleshooting

### Code not working
- Check if code is active: `npx tsx scripts/manage-discount-codes.ts view CODE`
- Verify not expired
- Confirm maxUses not reached
- Check if user already redeemed

### Credits not added
- Check server logs for [DISCOUNT] entries
- Verify database transaction completed
- Check user credits balance in database
- Review error messages in toast notifications

### Card not showing
- Verify user is logged in
- Check if already redeemed a code (card hides after first use)
- Ensure account data loaded successfully
- Check browser console for React errors

## Future Enhancements

Possible improvements:
- Admin dashboard for code management
- Bulk code creation
- Usage analytics dashboard
- Code generation API
- Referral codes linked to users
- Tiered credits based on plan
- Code categories/campaigns
- A/B testing for different credit amounts
