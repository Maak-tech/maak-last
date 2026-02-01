# RevenueCat Offering Metadata Guide

This guide explains how to configure offering metadata in RevenueCat to remotely configure variables when presenting the paywall.

## Overview

Offering metadata allows you to attach a custom JSON object to your Offering (the paywall entity in RevenueCat) that can be used to:
- Remotely configure paywall strings and image URLs without code deployment or app review
- Change button colors, descriptions, and other UI elements dynamically
- Support localization for different languages
- A/B test different paywall variations
- Display special offers and discounts

## How to Add Metadata

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Select your app (App ID: `app7fb7d2f755`)
3. Navigate to **Project Settings** → **Product catalog** → **Offerings**
4. Click **Edit** or **Configure metadata** on your offering
5. Add valid JSON in the **Metadata** field
6. Click **Save**

**Note**: Metadata has a limit of **4000 characters** for the JSON object.

## Example Metadata JSON for Maak Health

Here are example JSON structures you can use for your Family Plan offerings:

### Basic Example - Simple Configuration

```json
{
  "paywall_title": "Unlock Premium Features",
  "paywall_description": "Get access to all premium health tracking features for your family",
  "button_color": "#2563EB",
  "button_text": "Subscribe Now",
  "show_family_benefits": true,
  "highlight_feature": "Zeina AI Assistant"
}
```

### Advanced Example - With Localization

```json
{
  "paywall_title": {
    "en": "Unlock Premium Features",
    "ar": "افتح الميزات المميزة"
  },
  "paywall_description": {
    "en": "Get access to all premium health tracking features for your family",
    "ar": "احصل على الوصول إلى جميع ميزات تتبع الصحة المميزة لعائلتك"
  },
  "button_text": {
    "en": "Subscribe Now",
    "ar": "اشترك الآن"
  },
  "button_color": "#2563EB",
  "show_family_benefits": true,
  "benefits": [
    "Monitor up to 4 family members",
    "Access Zeina AI Assistant",
    "Advanced health insights",
    "Priority support"
  ],
  "highlight_feature": "Zeina AI Assistant",
  "trial_period_days": 7,
  "show_trial_badge": true
}
```

### Complete Example - Full Configuration

```json
{
  "paywall_title": {
    "en": "Family Health Plan",
    "ar": "خطة صحة العائلة"
  },
  "paywall_subtitle": {
    "en": "Protect your family's health together",
    "ar": "احمِ صحة عائلتك معًا"
  },
  "paywall_description": {
    "en": "Monitor up to 4 family members' health data, get AI-powered insights, and access premium features for everyone.",
    "ar": "راقب بيانات صحة ما يصل إلى 4 أفراد من العائلة، واحصل على رؤى مدعومة بالذكاء الاصطناعي، وتمتع بالوصول إلى الميزات المميزة للجميع."
  },
  "button_text": {
    "en": "Start Free Trial",
    "ar": "ابدأ التجربة المجانية"
  },
  "button_color": "#2563EB",
  "button_text_color": "#FFFFFF",
  "background_color": "#F8FAFC",
  "accent_color": "#10B981",
  "show_family_benefits": true,
  "show_trial_badge": true,
  "trial_period_days": 7,
  "benefits": [
    {
      "icon": "👥",
      "title": {
        "en": "Up to 4 Family Members",
        "ar": "حتى 4 أفراد من العائلة"
      },
      "description": {
        "en": "Monitor health for you and 3 family members",
        "ar": "راقب الصحة لك ولـ 3 أفراد من العائلة"
      }
    },
    {
      "icon": "🤖",
      "title": {
        "en": "Zeina AI Assistant",
        "ar": "مساعد زينة الذكي"
      },
      "description": {
        "en": "AI-powered health insights for all family members",
        "ar": "رؤى صحية مدعومة بالذكاء الاصطناعي لجميع أفراد العائلة"
      }
    },
    {
      "icon": "📊",
      "title": {
        "en": "Advanced Analytics",
        "ar": "تحليلات متقدمة"
      },
      "description": {
        "en": "Detailed health trends and insights",
        "ar": "اتجاهات ورؤى صحية مفصلة"
      }
    },
    {
      "icon": "⚡",
      "title": {
        "en": "Priority Support",
        "ar": "دعم ذو أولوية"
      },
      "description": {
        "en": "Get help when you need it most",
        "ar": "احصل على المساعدة عندما تحتاجها أكثر"
      }
    }
  ],
  "highlight_feature": "Zeina AI Assistant",
  "monthly_price_display": {
    "en": "$9.99/month",
    "ar": "٩.٩٩ دولار/شهر"
  },
  "yearly_price_display": {
    "en": "$99.99/year",
    "ar": "٩٩.٩٩ دولار/سنة"
  },
  "yearly_savings": {
    "en": "Save 17%",
    "ar": "وفر 17%"
  },
  "testimonial": {
    "en": "\"Best health app for families!\"",
    "ar": "\"أفضل تطبيق صحي للعائلات!\""
  },
  "trust_badges": [
    "HIPAA Compliant",
    "Secure & Private",
    "4.8★ Rating"
  ]
}
```

### Minimal Example - For Testing

```json
{
  "paywall_title": "Upgrade to Premium",
  "button_color": "#2563EB"
}
```

## Current Pricing Configuration

The metadata includes the following pricing structure for the Family Plan:

### Monthly Plan
- **First Month (Promotional)**: $1.99
- **Regular Monthly Price**: $14.99/month
- **Family Structure**: 1 admin + 3 family members (4 total)

### Yearly Plan
- **Yearly Price**: $149.99/year
- **Savings**: 2 months free ($29.98 savings)
- **Equivalent Monthly**: $12.50/month (when paid yearly)
- **Savings Percentage**: 17% off monthly pricing

### Key Metadata Fields for Pricing

The metadata includes these pricing-related fields:

```json
{
  "promotional_first_month": true,
  "first_month_price": { "en": "$1.99", "ar": "١.٩٩ دولار" },
  "first_month_price_display": { 
    "en": "First month $1.99, then $14.99/month",
    "ar": "الشهر الأول ١.٩٩ دولار، ثم ١٤.٩٩ دولار/شهر"
  },
  "monthly_price": { "en": "$14.99", "ar": "١٤.٩٩ دولار" },
  "monthly_price_display": { "en": "$14.99/month", "ar": "١٤.٩٩ دولار/شهر" },
  "yearly_price": { "en": "$149.99", "ar": "١٤٩.٩٩ دولار" },
  "yearly_price_display": { "en": "$149.99/year", "ar": "١٤٩.٩٩ دولار/سنة" },
  "yearly_savings": { "en": "Save 2 months free", "ar": "وفر شهرين مجانًا" },
  "yearly_savings_amount": { "en": "$29.98", "ar": "٢٩.٩٨ دولار" },
  "yearly_savings_percentage": { "en": "17%", "ar": "17%" },
  "family_structure": {
    "admin_members": 1,
    "family_members": 3,
    "total_members": 4
  }
}
```

## Accessing Metadata in Your App

### React Native Example

Here's how to access the metadata in your React Native app:

```typescript
import { useRevenueCat } from "@/hooks/useRevenueCat";

function MyPaywallComponent() {
  const { offerings } = useRevenueCat();
  
  if (!offerings?.current) {
    return null;
  }

  // Access metadata
  const metadata = offerings.current.metadata || {};
  
  // Get simple string values
  const title = metadata.paywall_title || "Upgrade to Premium";
  const buttonColor = metadata.button_color || "#2563EB";
  
  // Get localized values
  const deviceLanguage = "en"; // Get from device settings
  const localizedTitle = typeof metadata.paywall_title === "object" 
    ? metadata.paywall_title[deviceLanguage] || metadata.paywall_title.en || "Upgrade to Premium"
    : metadata.paywall_title || "Upgrade to Premium";
  
  // Get boolean values
  const showBenefits = metadata.show_family_benefits === true;
  
  // Get array values
  const benefits = metadata.benefits || [];
  
  return (
    <View>
      <Text>{localizedTitle}</Text>
      <Button 
        title={metadata.button_text || "Subscribe"}
        backgroundColor={buttonColor}
      />
      {showBenefits && (
        <BenefitsList benefits={benefits} />
      )}
    </View>
  );
}
```

### Enhanced RevenueCatPaywall Component

You can enhance your existing `RevenueCatPaywall.tsx` component to use metadata:

```typescript
import { useRevenueCat } from "@/hooks/useRevenueCat";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";

function RevenueCatPaywall({ onPurchaseComplete, onDismiss }: RevenueCatPaywallProps) {
  const { t, i18n } = useTranslation();
  const { offerings } = useRevenueCat();
  
  // Get device language
  const deviceLanguage = i18n.language.split('-')[0] || 'en';
  
  // Extract metadata with fallbacks
  const metadata = offerings?.current?.metadata || {};
  
  const getLocalizedValue = (key: string, fallback: string): string => {
    const value = metadata[key];
    if (typeof value === 'object' && value !== null) {
      return value[deviceLanguage] || value.en || fallback;
    }
    return typeof value === 'string' ? value : fallback;
  };
  
  const title = getLocalizedValue('paywall_title', t('subscription.upgradeTitle'));
  const description = getLocalizedValue('paywall_description', t('subscription.upgradeDescription'));
  const buttonColor = metadata.button_color || '#2563EB';
  const showBenefits = metadata.show_family_benefits === true;
  
  // Use metadata to customize the paywall appearance
  // Note: RevenueCatUI.Paywall may not support all customizations
  // You may need to build a custom paywall component to use all metadata
  
  return (
    <RevenueCatUI.Paywall
      onDismiss={onDismiss}
      options={{ offering: offerings }}
      // Additional customization options if supported
    />
  );
}
```

## Use Cases

### 1. A/B Testing Different Copy

Create two offerings with different metadata:

**Offering A (Control):**
```json
{
  "paywall_title": "Upgrade to Premium",
  "button_text": "Subscribe Now"
}
```

**Offering B (Variant):**
```json
{
  "paywall_title": "Unlock All Features",
  "button_text": "Get Started"
}
```

Use RevenueCat Experiments to test which performs better.

### 2. Special Promotional Offers

Create a special offering for a promotion:

```json
{
  "paywall_title": "Limited Time: 50% Off",
  "paywall_description": "Get premium features at half price this week only!",
  "button_color": "#10B981",
  "show_discount_badge": true,
  "discount_percentage": 50,
  "promo_code": "SUMMER2024"
}
```

### 3. Localization

Support multiple languages:

```json
{
  "paywall_title": {
    "en": "Upgrade to Premium",
    "ar": "ترقية إلى المميز",
    "fr": "Passer à Premium"
  },
  "button_text": {
    "en": "Subscribe",
    "ar": "اشترك",
    "fr": "S'abonner"
  }
}
```

### 4. Dynamic Feature Highlighting

Highlight different features based on user behavior:

```json
{
  "highlight_feature": "Zeina AI Assistant",
  "feature_description": "Get personalized health insights powered by AI",
  "show_feature_demo": true,
  "feature_demo_url": "https://example.com/demo-video.mp4"
}
```

## Best Practices

1. **Always provide fallback values** - Don't assume metadata keys exist
2. **Keep it under 4000 characters** - There's a limit on metadata size
3. **Use nested objects for organization** - Group related keys together
4. **Validate JSON syntax** - Use a JSON validator before saving
5. **Test thoroughly** - Test with and without metadata to ensure fallbacks work
6. **Version your metadata** - Consider adding a version field for tracking
7. **Use consistent naming** - Follow a naming convention (e.g., `paywall_*` for paywall-specific keys)

## Metadata Structure Recommendations

For Maak Health, consider organizing metadata like this:

```json
{
  "version": "1.0",
  "paywall": {
    "title": { "en": "...", "ar": "..." },
    "description": { "en": "...", "ar": "..." },
    "button": {
      "text": { "en": "...", "ar": "..." },
      "color": "#2563EB"
    }
  },
  "features": {
    "highlight": "Zeina AI Assistant",
    "benefits": [...]
  },
  "pricing": {
    "show_trial": true,
    "trial_days": 7
  }
}
```

## Troubleshooting

### Metadata not appearing
- Verify the offering is marked as "Current" in RevenueCat dashboard
- Check that you're accessing `offerings.current.metadata`
- Ensure JSON is valid (no trailing commas, proper quotes)

### Localization not working
- Verify device language is detected correctly
- Check that language codes match (e.g., "en" vs "en-US")
- Always provide fallback values

### Changes not reflecting
- Metadata changes may take a few minutes to propagate
- Try refreshing offerings: `await revenueCatService.getOfferings(true)`
- Clear app cache if needed

## Next Steps

1. **Add metadata to your offering** in RevenueCat dashboard using one of the examples above
2. **Update your paywall component** to read and use metadata values
3. **Test thoroughly** with different metadata configurations
4. **Set up A/B tests** using RevenueCat Experiments with different metadata
5. **Monitor performance** and iterate on your metadata based on conversion data

## References

- [RevenueCat Offering Metadata Documentation](https://production-docs.revenuecat.com/docs/tools/offering-metadata)
- [Offering Metadata Examples](https://production-docs.revenuecat.com/docs/tools/offering-metadata/offering-metadata-examples)
- [RevenueCat Experiments](https://production-docs.revenuecat.com/docs/tools/experiments-v1)
