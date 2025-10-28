# Discount Code System - Quick Start

## What Was Implemented

A secure, one-time-use discount code system that allows users to redeem promotional codes for free credits on the dashboard.

## Key Features

- **Secure**: One-time use per shop, enforced by database constraints
- **Flexible**: Configurable credit amounts, usage limits, and expiration dates
- **User-Friendly**: Simple card UI on dashboard right sidebar
- **Admin Tools**: CLI script for creating and managing codes

## Quick Start

### 1. Create a Discount Code

```bash
npx tsx scripts/manage-discount-codes.ts create WELCOME50 50 --maxUses 100 --description "Welcome bonus"
```

This creates a code "WELCOME50" that grants 50 credits and can be used 100 times total.

### 2. Test It

1. Start your dev server
2. Log in to your Shopify app
3. Look for the "Have a Discount Code?" card on the right sidebar
4. Enter: **WELCOME50**
5. Click "Apply Code"
6. See your credits increase by 50!

### 3. View Your Codes

```bash
npx tsx scripts/manage-discount-codes.ts list
```

## Example Codes Created

Three test codes are already in your database:

| Code | Credits | Max Uses | Description |
|------|---------|----------|-------------|
| WELCOME50 | 50 | 100 | Welcome bonus |
| TRYIT25 | 25 | 200 | Try it promotion |
| EXCLUSIVE100 | 100 | 1 | Exclusive one-time bonus |

## Files Changed

### Database
- `prisma/schema.prisma` - Added DiscountCode and DiscountCodeRedemption models
- Migration applied successfully ✅

### Backend
- `app/models/user.server.ts` - Added discount code functions (lines 273-497)
- `app/routes/app.redeem-discount.tsx` - New API endpoint (created)

### Frontend
- `app/routes/app._index.tsx` - Added discount code card UI (lines 532-566)

### Admin Tools
- `scripts/manage-discount-codes.ts` - CLI management tool (created)

### Documentation
- `DISCOUNT_CODES.md` - Full documentation (created)

## Security Features

1. ✅ **One-time use per shop**: Database unique constraint
2. ✅ **Usage limits**: Max redemptions configurable
3. ✅ **Expiration dates**: Time-limited promotions
4. ✅ **Server-side validation**: All checks on backend
5. ✅ **Atomic transactions**: Safe credit updates
6. ✅ **Case-insensitive**: Codes normalized to uppercase

## Common Commands

```bash
# Create code
npx tsx scripts/manage-discount-codes.ts create CODE 50

# View code details
npx tsx scripts/manage-discount-codes.ts view CODE

# List all codes
npx tsx scripts/manage-discount-codes.ts list

# Deactivate code
npx tsx scripts/manage-discount-codes.ts deactivate CODE
```

## UI Location

The discount code card appears on the **dashboard** (after login):
- **Position**: Right sidebar, below "Account Overview"
- **Behavior**: Disappears after first successful redemption
- **Mobile**: Stacks below main content on mobile devices

## Testing Checklist

- [ ] Code appears in right sidebar
- [ ] Valid code adds credits successfully
- [ ] Credits balance updates immediately
- [ ] Success toast notification shows
- [ ] Card disappears after redemption
- [ ] Same code cannot be used twice
- [ ] Invalid code shows error
- [ ] Expired/inactive codes rejected
- [ ] Max uses limit enforced

## Next Steps

1. Create your promotional codes using the script
2. Test redemption flow in dev environment
3. Share codes with your users
4. Monitor usage with `list` command
5. Deactivate codes when promotion ends

For detailed documentation, see `DISCOUNT_CODES.md`.
