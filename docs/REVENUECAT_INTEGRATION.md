# RevenueCat Integration Guide

This document provides a comprehensive guide for using RevenueCat in the Maak Health app.

## Overview

RevenueCat has been integrated into the Maak Health app to handle subscription management. The integration includes:

- **Service Layer**: `lib/services/revenueCatService.ts` - Core RevenueCat functionality
- **Hooks**: `hooks/useRevenueCat.ts` and `hooks/useSubscription.ts` - React hooks for subscription state
- **Components**: `components/RevenueCatPaywall.tsx` and `components/CustomerCenter.tsx` - UI components
- **Translations**: Added to `lib/i18n.ts` for English and Arabic

## Configuration

### App ID
- **Production App ID**: `app7fb7d2f755`
- This is your RevenueCat app identifier in the dashboard

### API Key
The RevenueCat API key is loaded from environment variables via `app.config.js`:
- **Development**: Uses test key automatically if `REVENUECAT_API_KEY` is not set
- **Production**: **REQUIRED** - Must be set in EAS secrets as `REVENUECAT_API_KEY`

**To get your production API key:**
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Select your app (App ID: `app7fb7d2f755`)
3. Navigate to **Project Settings** → **API Keys**
4. Copy the **Public API Key** (starts with `appl_` for iOS or `goog_` for Android)
5. For React Native, you can use either the iOS or Android key (they work cross-platform)

**To set up production API key in EAS:**
```bash
eas secret:create --scope project --name REVENUECAT_API_KEY --value "YOUR_PRODUCTION_API_KEY" --type string --visibility secret --environment production
```

**Note**: The test key (`test_vluBajsHEoAjMjzoArPVpklOCRc`) is only used in development builds when no API key is configured.

### Product Identifiers
The following products are configured:
- `Individual_Monthly_Premium` - Individual Monthly Premium
- `Family_Monthly_Premium` - Family Monthly Premium
- `Individual_Yearly_Premium` - Individual Yearly Premium
- `Family_Yearly_Premium` - Family Yearly Premium

### Entitlement Identifiers
- `Family Plan` - Used to check if user has Family Plan access
  - **Plan Limits**: 1 admin member + 3 family members (total 4 members)
- `Individual Plan` - Used to check if user has Individual Plan access
  - **Plan Limits**: 1 admin member + 1 family member (total 2 members)

## Initialization

RevenueCat is automatically initialized when the app starts in `app/_layout.tsx`. The SDK is also synced with Firebase Auth user IDs in `contexts/AuthContext.tsx`.

## Usage Examples

### 1. Check Subscription Status

```typescript
import { useSubscription } from "@/hooks/useSubscription";

function MyComponent() {
  const { isPremium, isFamilyPlan, subscriptionStatus, isLoading } = useSubscription();

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  if (isPremium) {
    return <Text>You have an active subscription!</Text>;
  }

  return <Text>No active subscription</Text>;
}
```

### 2. Display Paywall

```typescript
import { RevenueCatPaywall } from "@/components/RevenueCatPaywall";
import { useState } from "react";

function PremiumScreen() {
  const [showPaywall, setShowPaywall] = useState(false);

  if (showPaywall) {
    return (
      <RevenueCatPaywall
        onPurchaseComplete={() => {
          setShowPaywall(false);
          // Handle successful purchase
        }}
        onDismiss={() => setShowPaywall(false)}
      />
    );
  }

  return (
    <Button
      title="Subscribe"
      onPress={() => setShowPaywall(true)}
    />
  );
}
```

### 3. Display Customer Center

```typescript
import { CustomerCenter } from "@/components/CustomerCenter";
import { useState } from "react";

function SettingsScreen() {
  const [showCustomerCenter, setShowCustomerCenter] = useState(false);

  if (showCustomerCenter) {
    return (
      <CustomerCenter
        onDismiss={() => setShowCustomerCenter(false)}
      />
    );
  }

  return (
    <Button
      title="Manage Subscription"
      onPress={() => setShowCustomerCenter(true)}
    />
  );
}
```

### 4. Manual Purchase Flow

```typescript
import { useRevenueCat } from "@/hooks/useRevenueCat";
import { revenueCatService, PRODUCT_IDENTIFIERS } from "@/lib/services/revenueCatService";

function CustomPurchaseButton() {
  const { purchasePackage, offerings } = useRevenueCat();

  const handlePurchase = async () => {
    try {
      // Get the package for the product you want to sell
      const packageToPurchase = await revenueCatService.getPackage(
        PRODUCT_IDENTIFIERS.INDIVIDUAL_MONTHLY
      );

      if (!packageToPurchase) {
        Alert.alert("Error", "Product not available");
        return;
      }

      // Purchase the package
      await purchasePackage(packageToPurchase);
      Alert.alert("Success", "Purchase completed!");
    } catch (error: any) {
      if (error.message === "Purchase was cancelled") {
        // User cancelled, don't show error
        return;
      }
      Alert.alert("Error", error.message);
    }
  };

  return <Button title="Buy Monthly" onPress={handlePurchase} />;
}
```

### 5. Restore Purchases

```typescript
import { useRevenueCat } from "@/hooks/useRevenueCat";

function RestoreButton() {
  const { restorePurchases, isLoading } = useRevenueCat();

  const handleRestore = async () => {
    try {
      await restorePurchases();
      Alert.alert("Success", "Purchases restored!");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <Button
      title="Restore Purchases"
      onPress={handleRestore}
      disabled={isLoading}
    />
  );
}
```

### 6. Check Plan Entitlements

```typescript
import { useSubscription } from "@/hooks/useSubscription";

function PremiumFeature() {
  const { isPremium, isFamilyPlan, isIndividualPlan } = useSubscription();

  if (!isPremium) {
    return (
      <View>
        <Text>This feature requires a premium subscription</Text>
        <Button title="Subscribe" onPress={() => {/* Show paywall */}} />
      </View>
    );
  }

  return (
    <View>
      <Text>Premium feature content</Text>
      {isFamilyPlan && <Text>Family Plan features enabled</Text>}
      {isIndividualPlan && <Text>Individual Plan features enabled</Text>}
    </View>
  );
}
```

### 7. Check Specific Plan Type

```typescript
import { useSubscription } from "@/hooks/useSubscription";

function FamilyOnlyFeature() {
  const { isFamilyPlan } = useSubscription();

  if (!isFamilyPlan) {
    return (
      <View>
        <Text>This feature requires Family Plan</Text>
        <Button title="Upgrade to Family Plan" onPress={() => {/* Show paywall */}} />
      </View>
    );
  }

  return <Text>Family-only feature content</Text>;
}
```

### 8. Check Plan Limits

```typescript
import { useSubscription } from "@/hooks/useSubscription";

function FamilyManagement() {
  const { 
    planLimits, 
    maxFamilyMembers, 
    maxTotalMembers,
    isFamilyPlan,
    isIndividualPlan 
  } = useSubscription();

  return (
    <View>
      <Text>Plan: {isFamilyPlan ? "Family Plan" : isIndividualPlan ? "Individual Plan" : "Free"}</Text>
      {planLimits && (
        <>
          <Text>Max Family Members: {maxFamilyMembers}</Text>
          <Text>Max Total Members: {maxTotalMembers}</Text>
          <Text>
            Limits: {planLimits.adminMembers} admin + {planLimits.familyMembers} family members
          </Text>
        </>
      )}
    </View>
  );
}
```

### 9. Enforce Plan Limits

```typescript
import { useSubscription } from "@/hooks/useSubscription";
import { revenueCatService } from "@/lib/services/revenueCatService";

function AddFamilyMemberButton({ currentFamilyCount }: { currentFamilyCount: number }) {
  const { maxFamilyMembers, isPremium } = useSubscription();

  const canAddMember = isPremium && currentFamilyCount < maxFamilyMembers;

  if (!isPremium) {
    return (
      <Button 
        title="Upgrade to Premium" 
        onPress={() => {/* Show paywall */}} 
      />
    );
  }

  if (!canAddMember) {
    return (
      <View>
        <Text>You've reached your plan limit ({maxFamilyMembers} family members)</Text>
        <Button 
          title="Upgrade to Family Plan" 
          onPress={() => {/* Show paywall */}} 
        />
      </View>
    );
  }

  return (
    <Button 
      title="Add Family Member" 
      onPress={() => {/* Add member */}} 
    />
  );
}
```

## Service API Reference

### `revenueCatService`

#### Methods

- `initialize()`: Initialize RevenueCat SDK (called automatically)
- `setUserId(userId: string)`: Set RevenueCat user ID (synced with Firebase Auth)
- `logOut()`: Log out from RevenueCat (called automatically on logout)
- `getCustomerInfo()`: Get current customer info
- `refreshCustomerInfo()`: Refresh customer info from servers
- `getOfferings()`: Get available subscription offerings
- `purchasePackage(package: PurchasesPackage)`: Purchase a package
- `restorePurchases()`: Restore previous purchases
- `hasActiveSubscription()`: Check if user has active subscription (either Individual or Family Plan)
- `hasFamilyPlanEntitlement()`: Check if user has Family Plan entitlement
- `hasIndividualPlanEntitlement()`: Check if user has Individual Plan entitlement
- `getSubscriptionStatus()`: Get detailed subscription status
- `getPlanLimits()`: Get plan limits (admin + family member counts) for current subscription
- `getMaxFamilyMembers()`: Get maximum family members allowed for current subscription
- `getMaxTotalMembers()`: Get maximum total members allowed for current subscription
- `getProduct(productIdentifier: string)`: Get product by identifier
- `getPackage(productIdentifier: string)`: Get package by identifier

## Hooks API Reference

### `useRevenueCat()`

Returns:
- `isLoading`: Loading state
- `error`: Error object if any
- `customerInfo`: Current customer info
- `offerings`: Available offerings
- `subscriptionStatus`: Detailed subscription status
- `hasActiveSubscription`: Boolean indicating active subscription (either Individual or Family Plan)
- `hasFamilyPlan`: Boolean indicating Family Plan entitlement
- `hasIndividualPlan`: Boolean indicating Individual Plan entitlement
- `refreshCustomerInfo()`: Function to refresh customer info
- `refreshOfferings()`: Function to refresh offerings
- `purchasePackage()`: Function to purchase a package
- `restorePurchases()`: Function to restore purchases

### `useSubscription()`

Returns:
- `isPremium`: Boolean indicating active subscription (either Individual or Family Plan)
- `isFamilyPlan`: Boolean indicating Family Plan entitlement
- `isIndividualPlan`: Boolean indicating Individual Plan entitlement
- `subscriptionStatus`: Detailed subscription status
- `planLimits`: Plan limits object with `adminMembers`, `familyMembers`, and `totalMembers` (or null if no subscription)
- `maxFamilyMembers`: Maximum family members allowed (0 if no subscription)
- `maxTotalMembers`: Maximum total members allowed (0 if no subscription)
- `isLoading`: Loading state

## Components API Reference

### `<RevenueCatPaywall />`

Props:
- `onPurchaseComplete?: () => void`: Callback when purchase completes
- `onDismiss?: () => void`: Callback when paywall is dismissed

### `<CustomerCenter />`

Props:
- `onDismiss?: () => void`: Callback when customer center is dismissed

## Best Practices

1. **Always check subscription status before showing premium features**
   ```typescript
   const { isPremium } = useSubscription();
   if (!isPremium) {
     // Show paywall or upgrade prompt
   }
   ```

2. **Handle loading states**
   ```typescript
   const { isLoading } = useRevenueCat();
   if (isLoading) {
     return <LoadingSpinner />;
   }
   ```

3. **Handle errors gracefully**
   ```typescript
   const { error } = useRevenueCat();
   useEffect(() => {
     if (error) {
       // Show error message to user
     }
   }, [error]);
   ```

4. **Don't block app functionality if RevenueCat fails**
   RevenueCat initialization and sync are designed to fail gracefully, so the app continues to work even if RevenueCat is unavailable.

5. **Use the Paywall component for purchases**
   The `RevenueCatPaywall` component handles all purchase flows automatically and provides the best user experience.

6. **Provide restore purchases option**
   Always provide a way for users to restore their purchases, especially on new devices.

## Testing

### Sandbox Testing
1. Use test accounts in App Store Connect / Google Play Console
2. Test purchases will be in sandbox mode
3. Test restores to ensure purchases are properly restored

### Production Testing
1. Replace test API key with production key
2. Test with real purchases (can be refunded within 48 hours)
3. Verify entitlement checking works correctly

## Troubleshooting

### Purchases not working
1. Check that RevenueCat is initialized
2. Verify API key is correct
3. Check that products are configured in RevenueCat dashboard
4. Ensure user ID is set correctly

### Entitlements not updating
1. Call `refreshCustomerInfo()` after purchase
2. Check RevenueCat dashboard for purchase status
3. Verify entitlement identifier matches dashboard configuration

### Paywall not showing
1. Check that offerings are available
2. Verify products are configured in RevenueCat dashboard
3. Check network connectivity

## Next Steps

1. **Configure products in RevenueCat dashboard**
   - Create products with the identifiers listed above
   - Set up entitlements (especially "Family Plan")
   - Configure offerings

2. **Set up webhooks** (optional)
   - Configure webhooks in RevenueCat dashboard
   - Handle subscription events server-side if needed

3. **Set up production API key**
   - Get your production API key from RevenueCat dashboard (App ID: `app7fb7d2f755`)
   - Set it in EAS secrets: `eas secret:create --scope project --name REVENUECAT_API_KEY --value "YOUR_KEY" --type string --visibility secret --environment production`
   - The key will automatically be used in production builds

4. **Test thoroughly**
   - Test all purchase flows
   - Test restore purchases
   - Test entitlement checking
   - Test on both iOS and Android

5. **Add analytics** (optional)
   - Track subscription events
   - Monitor conversion rates
   - Analyze subscription metrics

