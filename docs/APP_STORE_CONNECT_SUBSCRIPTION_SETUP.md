# App Store Connect Subscription Metadata Setup

This guide helps you configure subscription metadata in App Store Connect to resolve "missing metadata" errors.

## Prerequisites

- Access to [App Store Connect](https://appstoreconnect.apple.com/)
- Your app must be created in App Store Connect
- Bundle ID: `com.maaktech.maak`
- App Name: `Maak Health`

## Step 1: Create Subscription Groups

1. Log in to [App Store Connect](https://appstoreconnect.apple.com/)
2. Go to **My Apps** → Select **Maak Health**
3. Navigate to **Subscriptions** (in the left sidebar)
4. Click **+** to create a new subscription group
5. Name it: **"Premium Subscriptions"** (or your preferred name)

## Step 2: Add Localization to Subscription Group

**This is often the missing piece!**

1. Click on your subscription group
2. Click **Add Localization**
3. Select **English (U.S.)** (or your primary language)
4. Fill in:
   - **Name**: `Premium Subscriptions` (or your preferred name)
   - **Description**: Brief description of your subscription offerings
5. Click **Save**

## Step 3: Create Subscriptions

Create 2 subscriptions for your Family Plan products:

### Subscription 1: Family Monthly Premium

1. In your subscription group, click **+** to add a subscription
2. **Reference Name**: `Family Monthly Premium`
3. **Product ID**: `Family_Monthly_Premium` (must match your code exactly)
4. Click **Create**

#### Configure Subscription Details:

**Subscription Information:**
- **Display Name**: `Family Monthly Premium`
- **Description**: Describe what users get with this subscription (e.g., "Premium access for up to 4 family members, including health monitoring and Zeina AI assistant")

**Pricing:**
- Click **Add Pricing**
- Select territories (at minimum, select your primary market)
- Set the price (e.g., $14.99/month)
- Click **Next** → **Save**

**Subscription Duration:**
- **Duration**: `1 Month`

**Review Information:**
- Fill in review notes if needed

**Localization (REQUIRED):**
- Click **Add Localization**
- Select **English (U.S.)**
- Fill in:
  - **Name**: `Family Monthly Premium`
  - **Description**: Detailed description of what's included (e.g., "Premium subscription for your family. Add up to 3 family members and monitor their health. All members get access to Zeina AI assistant.")
- Click **Save**

### Subscription 2: Family Yearly Premium

1. Click **+** to add another subscription
2. **Reference Name**: `Family Yearly Premium`
3. **Product ID**: `Family_Yearly_Premium`
4. **Duration**: `1 Year`
5. **Pricing**: Set appropriate price (e.g., $149.99/year)
6. **Add Localization**: English (U.S.) with name and description

## Step 4: Add Screenshots (REQUIRED)

**This is often missing and causes "missing metadata" errors!**

For each subscription:

1. Click on the subscription
2. Scroll to **Subscription Screenshot** section
3. Click **+** to add a screenshot
4. **Required**: 6.5" display screenshot (1290 x 2796 pixels)
5. Upload a screenshot showing:
   - Your app's subscription/paywall screen
   - The subscription benefits
   - Clear pricing information

**Screenshot Requirements:**
- **Size**: 1290 x 2796 pixels (6.5" display)
- **Format**: PNG or JPEG
- **Content**: Must show the in-app purchase/subscription screen

## Step 5: Link to RevenueCat

After creating subscriptions in App Store Connect:

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Select your app (App ID: `app7fb7d2f755`)
3. Navigate to **Products**
4. For each product:
   - Click on the product
   - Under **Store Products**, click **Add Store Product**
   - Select **App Store**
   - Enter the Product ID (e.g., `Individual_Monthly_Premium`)
   - RevenueCat will link it to your App Store Connect subscription

## Step 6: Submit for Review

1. In App Store Connect, go to your app's **App Store** tab
2. Fill in all required app metadata if not already done
3. Create a new version or update
4. Under **In-App Purchases**, you should see your subscriptions listed
5. Submit for review

## Common "Missing Metadata" Issues

### Issue: "Missing localization"
**Solution**: Add at least one localization (English) to both:
- The subscription group
- Each individual subscription

### Issue: "Missing pricing"
**Solution**: Set pricing for at least one territory (your primary market)

### Issue: "Missing screenshot"
**Solution**: Add a 6.5" display screenshot (1290 x 2796 pixels) for each subscription

### Issue: "Missing description"
**Solution**: Add a description in the localization section (not just the main description field)

## Quick Checklist

- [ ] Subscription group created
- [ ] Subscription group has at least one localization (English)
- [ ] All 4 subscriptions created with correct Product IDs:
  - [ ] `Individual_Monthly_Premium`
  - [ ] `Family_Monthly_Premium`
  - [ ] `Individual_Yearly_Premium`
  - [ ] `Family_Yearly_Premium`
- [ ] Each subscription has:
  - [ ] Display name set
  - [ ] Duration configured (1 Month or 1 Year)
  - [ ] Pricing set for at least one territory
  - [ ] At least one localization (English) with name and description
  - [ ] Screenshot uploaded (6.5" display, 1290 x 2796 pixels)
- [ ] Products linked in RevenueCat dashboard
- [ ] Ready to submit for review

## Product IDs Reference

Make sure these match exactly (case-sensitive) in both App Store Connect and your code:

| Product ID | Duration | Type |
|------------|----------|------|
| `Individual_Monthly_Premium` | 1 Month | Individual |
| `Family_Monthly_Premium` | 1 Month | Family |
| `Individual_Yearly_Premium` | 1 Year | Individual |
| `Family_Yearly_Premium` | 1 Year | Family |

## Need Help?

- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [App Store Review Guidelines - Subscriptions](https://developer.apple.com/app-store/review/guidelines/#subscriptions)
- [RevenueCat Documentation](https://www.revenuecat.com/docs)
