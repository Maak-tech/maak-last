# Feature Gating Guide

This guide explains how the app determines which features are free vs premium and how to implement feature gating throughout the application.

## Overview

The app uses a centralized feature gating system that:
- Defines all features and their access requirements
- Provides hooks and components for easy feature gating
- Ensures consistent subscription enforcement across the app

## Feature Access Levels

Features are categorized into four access levels:

1. **FREE** - Available to all users
2. **PREMIUM_INDIVIDUAL** - Requires Individual Plan subscription (or Family Plan)
3. **PREMIUM_FAMILY** - Requires Family Plan subscription
4. **PREMIUM_ANY** - Requires either Individual or Family Plan subscription

## Defining Features

All features are defined in `lib/services/featureGateService.ts`:

```typescript
export const FEATURES = {
  // Free Features
  SYMPTOMS_TRACKING: {
    id: "symptoms_tracking",
    name: "Symptoms Tracking",
    accessLevel: FeatureAccessLevel.FREE,
    description: "Track and log your symptoms",
  },
  
  // Premium Individual Features
  PPG_HEART_RATE: {
    id: "ppg_heart_rate",
    name: "PPG Heart Rate Monitoring",
    accessLevel: FeatureAccessLevel.PREMIUM_INDIVIDUAL,
    description: "Real-time heart rate monitoring using camera",
  },
  
  // Premium Family Features
  FAMILY_MEMBERS: {
    id: "family_members",
    name: "Family Members",
    accessLevel: FeatureAccessLevel.PREMIUM_FAMILY,
    description: "Add family members to your health group",
  },
};
```

## Usage Examples

### 1. Using the FeatureGate Component

Wrap premium features with the `FeatureGate` component:

```tsx
import { FeatureGate } from "@/components/FeatureGate";

function MyScreen() {
  return (
    <View>
      {/* Free feature - always visible */}
      <SymptomsList />
      
      {/* Premium feature - gated */}
      <FeatureGate featureId="PPG_HEART_RATE">
        <PPGVitalMonitor />
      </FeatureGate>
      
      {/* With custom fallback */}
      <FeatureGate 
        featureId="AI_ASSISTANT"
        fallback={<Text>Upgrade to access AI Assistant</Text>}
      >
        <AIAssistant />
      </FeatureGate>
    </View>
  );
}
```

### 2. Using the useFeatureGate Hook

For programmatic checks:

```tsx
import { useFeatureGate } from "@/lib/services/featureGateService";

function MyComponent() {
  const { hasAccess, needsUpgrade, feature } = useFeatureGate("PPG_HEART_RATE");
  
  if (hasAccess) {
    return <PPGVitalMonitor />;
  }
  
  return <UpgradePrompt feature={feature} />;
}
```

### 3. Using useFeatureAccess Hook

For conditional logic and upgrade prompts:

```tsx
import { useFeatureAccess } from "@/components/FeatureGate";

function MyButton() {
  const { hasAccess, showUpgradeAlert } = useFeatureAccess("EXPORT_DATA");
  
  const handlePress = () => {
    if (hasAccess) {
      // Perform export
      exportData();
    } else {
      // Show upgrade prompt
      showUpgradeAlert();
    }
  };
  
  return <Button onPress={handlePress} title="Export Data" />;
}
```

### 4. Checking Multiple Features

```tsx
import { useFeatureGates } from "@/lib/services/featureGateService";

function MyScreen() {
  const { features, isLoading } = useFeatureGates([
    "PPG_HEART_RATE",
    "AI_ASSISTANT",
    "FAMILY_MEMBERS",
  ]);
  
  return (
    <View>
      {features.PPG_HEART_RATE.hasAccess && <PPGVitalMonitor />}
      {features.AI_ASSISTANT.hasAccess && <AIAssistant />}
      {features.FAMILY_MEMBERS.hasAccess && <FamilyMembers />}
    </View>
  );
}
```

### 5. Programmatic Checks in Services

```typescript
import { featureGateService } from "@/lib/services/featureGateService";
import { useSubscription } from "@/hooks/useSubscription";

async function exportHealthData() {
  const subscription = useSubscription();
  
  const hasAccess = featureGateService.checkFeatureAccess(
    "EXPORT_DATA",
    {
      isPremium: subscription.isPremium,
      isFamilyPlan: subscription.isFamilyPlan,
      isIndividualPlan: subscription.isIndividualPlan,
    }
  );
  
  if (!hasAccess) {
    throw new Error("Export requires Premium subscription");
  }
  
  // Perform export
}
```

## Current Feature Definitions

### Free Features
- `SYMPTOMS_TRACKING` - Track and log symptoms
- `MOOD_TRACKING` - Track daily mood
- `MEDICATIONS_TRACKING` - Track medications
- `BASIC_VITALS` - View basic vital signs
- `HEALTH_REPORTS` - Generate basic health reports
- `FALL_DETECTION` - Automatic fall detection

### Premium Individual Features
- `PPG_HEART_RATE` - Real-time heart rate monitoring using camera
- `ADVANCED_VITALS` - Advanced vital signs tracking and analysis
- `AI_ASSISTANT` - AI-powered health assistant (Zeina)
- `EXPORT_DATA` - Export health data to CSV/PDF
- `HEALTH_INSIGHTS` - AI-powered health insights

### Premium Family Features
- `FAMILY_MEMBERS` - Add family members (Individual: 1+1, Family: 1+3)
- `FAMILY_HEALTH_DASHBOARD` - View health data for all family members
- `FAMILY_ALERTS` - Receive alerts about family member health
- `FAMILY_SHARING` - Share health data with family members

### Premium Any Features
- `CLOUD_BACKUP` - Automatic cloud backup
- `PREMIUM_SUPPORT` - Priority customer support

## Adding New Features

1. **Define the feature** in `lib/services/featureGateService.ts`:

```typescript
export const FEATURES = {
  // ... existing features
  NEW_FEATURE: {
    id: "new_feature",
    name: "New Feature",
    accessLevel: FeatureAccessLevel.PREMIUM_INDIVIDUAL, // or appropriate level
    description: "Description of the new feature",
  },
};
```

2. **Use the feature** in your component:

```tsx
<FeatureGate featureId="NEW_FEATURE">
  <NewFeatureComponent />
</FeatureGate>
```

## Best Practices

1. **Always gate premium features** - Don't rely on UI hiding alone
2. **Use conservative defaults** - When subscription status is loading, assume no premium access
3. **Provide clear upgrade prompts** - Show users why they need to upgrade
4. **Test both subscription states** - Test with and without premium subscriptions
5. **Server-side validation** - Always validate premium features on the server side as well

## Server-Side Validation

For critical features, also validate on the server:

```typescript
// In Firebase Cloud Functions or API
async function checkFeatureAccess(userId: string, featureId: string) {
  const user = await getUser(userId);
  const subscription = await getSubscriptionStatus(userId);
  
  return featureGateService.checkFeatureAccess(featureId, {
    isPremium: subscription.isActive,
    isFamilyPlan: subscription.isFamilyPlan,
    isIndividualPlan: subscription.isIndividualPlan,
  });
}
```

## Migration Guide

If you have existing premium checks, migrate them:

**Before:**
```tsx
const { isPremium } = useSubscription();
if (isPremium) {
  return <PremiumFeature />;
}
```

**After:**
```tsx
<FeatureGate featureId="PREMIUM_FEATURE">
  <PremiumFeature />
</FeatureGate>
```

This ensures:
- Consistent access checking
- Proper upgrade prompts
- Easy feature management
- Better user experience

