# RevenueCat Metadata Setup Guide

This guide helps you resolve "missing metadata" errors in RevenueCat.

## Understanding "Missing Metadata"

RevenueCat may show "missing metadata" warnings for several reasons:

1. **App Store Connect Metadata** - Required for App Store submission
2. **RevenueCat Dashboard Configuration** - App details, products, and offerings
3. **Product/Offering Metadata** - Custom metadata for paywall customization

## Required App Information

Based on your `app.config.js`, here's what needs to be configured in RevenueCat:

### App Details
- **App Name**: `Maak Health`
- **Bundle Identifier (iOS)**: `com.maaktech.maak`
- **Package Name (Android)**: `com.maaktech.maak`
- **App ID**: `app7fb7d2f755`

## Step 1: Configure App in RevenueCat Dashboard

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Select your app (App ID: `app7fb7d2f755`)
3. Navigate to **App Settings** or **Project Settings**

### Required Fields:
- **App Name**: `Maak Health`
- **Bundle ID (iOS)**: `com.maaktech.maak`
- **Package Name (Android)**: `com.maaktech.maak`
- **App Store Connect App ID**: (if available)
- **Google Play App ID**: (if available)

## Step 2: Configure Products

Ensure these products are created in RevenueCat with matching identifiers:

### Product Identifiers (from your code):
- `Family_Monthly_Premium` - Family Plan Monthly Premium
- `Family_Yearly_Premium` - Family Plan Yearly Premium

### For each product, configure:
1. **Product ID**: Must match exactly (case-sensitive)
2. **Store Product IDs**: 
   - iOS: Create in App Store Connect and link here
   - Android: Create in Google Play Console and link here
3. **Display Name**: User-friendly name
4. **Description**: Product description

## Step 3: Configure Entitlements

Create these entitlements in RevenueCat:

### Entitlement Identifiers:
- `Family Plan` - For Family Plan access
- `Individual Plan` - For Individual Plan access

### For each entitlement:
1. **Identifier**: Must match exactly (case-sensitive)
2. **Attach Products**: Link the appropriate products
   - `Family Plan` → `Family_Monthly_Premium`, `Family_Yearly_Premium`
   - `Individual Plan` → `Individual_Monthly_Premium`, `Individual_Yearly_Premium`

## Step 4: Configure Offerings

1. Go to **Offerings** in RevenueCat dashboard
2. Create or edit your default offering
3. Add packages for each product
4. Ensure the offering is marked as "Current"

## Step 5: App Store Connect Metadata (iOS)

If the error is about App Store Connect metadata, see the detailed guide: [App Store Connect Subscription Setup](./APP_STORE_CONNECT_SUBSCRIPTION_SETUP.md)

**Quick Summary:**
1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Navigate to your app → **Subscriptions**
3. Create subscription group with localization
4. Create 4 subscriptions with Product IDs matching your code
5. For each subscription:
   - Add at least one **Localization** (e.g., English) ← **Most common missing item!**
   - Add **Subscription Name** and **Description** in localization
   - Add **Pricing** information
   - Add a **Screenshot** (6.5" display, 1290 x 2796 pixels) ← **Often missing!**

### Required Metadata:
- **Subscription Group**: Must have at least one localization
- **Individual Subscription Name**: Localized name (in localization section)
- **Description**: Localized description (in localization section)
- **Pricing**: Set price for at least one territory
- **Screenshot**: 6.5" display screenshot (1290 x 2796 pixels) - **REQUIRED**

## Step 6: Google Play Console Metadata (Android)

1. Go to [Google Play Console](https://play.google.com/console/)
2. Navigate to your app → **Monetize** → **Subscriptions**
3. For each subscription:
   - Add **Name** and **Description**
   - Set **Pricing**
   - Add **Graphics** (icon, feature graphic)

## Step 7: Verify Configuration

After configuring everything:

1. **Check RevenueCat Dashboard**:
   - App details are complete
   - Products are created and linked to store products
   - Entitlements are created and linked to products
   - Offerings are configured with packages

2. **Test in App**:
   - Initialize RevenueCat SDK
   - Fetch offerings: `await Purchases.getOfferings()`
   - Verify products are available

3. **Check for Warnings**:
   - RevenueCat dashboard should show no "missing metadata" warnings
   - All products should have green checkmarks

## Common Issues

### Issue: "Missing metadata" for products
**Solution**: Ensure products are linked to actual App Store/Play Store products

### Issue: "Missing metadata" for entitlements
**Solution**: Ensure entitlements have at least one product attached

### Issue: "Missing metadata" in App Store Connect
**Solution**: Add required localizations, pricing, and screenshots in App Store Connect

### Issue: Products not showing in app
**Solution**: 
- Verify product identifiers match exactly (case-sensitive)
- Ensure offerings are configured and marked as "Current"
- Check that store products are approved in App Store Connect/Play Console

## Quick Checklist

- [ ] App name configured in RevenueCat
- [ ] Bundle ID/Package name configured
- [ ] All 4 products created with correct identifiers
- [ ] Products linked to App Store Connect/Play Console products
- [ ] 2 entitlements created (`Family Plan`, `Individual Plan`)
- [ ] Entitlements linked to correct products
- [ ] Offerings configured with packages
- [ ] App Store Connect metadata complete (iOS)
- [ ] Google Play Console metadata complete (Android)

## Need Help?

- [RevenueCat Documentation](https://www.revenuecat.com/docs)
- [RevenueCat Community](https://community.revenuecat.com/)
- Check RevenueCat dashboard for specific error messages
