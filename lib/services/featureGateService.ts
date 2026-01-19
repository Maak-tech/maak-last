import { useSubscription } from "@/hooks/useSubscription";

/**
 * Feature Access Levels
 * Defines what subscription level is required to access a feature
 */
export enum FeatureAccessLevel {
  /** Free - Available to all users */
  FREE = "free",
  /** Premium Individual - Requires Individual Plan subscription */
  PREMIUM_INDIVIDUAL = "premium_individual",
  /** Premium Family - Requires Family Plan subscription */
  PREMIUM_FAMILY = "premium_family",
  /** Premium Any - Requires either Individual or Family Plan */
  PREMIUM_ANY = "premium_any",
}

/**
 * Feature Definitions
 * Central registry of all features and their access requirements
 */
export const FEATURES = {
  // Free Features
  SYMPTOMS_TRACKING: {
    id: "symptoms_tracking",
    name: "Symptoms Tracking",
    accessLevel: FeatureAccessLevel.FREE,
    description: "Track and log your symptoms",
  },
  MOOD_TRACKING: {
    id: "mood_tracking",
    name: "Mood Tracking",
    accessLevel: FeatureAccessLevel.FREE,
    description: "Track your daily mood",
  },
  MEDICATIONS_TRACKING: {
    id: "medications_tracking",
    name: "Medications Tracking",
    accessLevel: FeatureAccessLevel.FREE,
    description: "Track your medications",
  },
  BASIC_VITALS: {
    id: "basic_vitals",
    name: "Basic Vitals",
    accessLevel: FeatureAccessLevel.FREE,
    description: "View basic vital signs",
  },
  HEALTH_REPORTS: {
    id: "health_reports",
    name: "Health Reports",
    accessLevel: FeatureAccessLevel.FREE,
    description: "Generate basic health reports",
  },
  FALL_DETECTION: {
    id: "fall_detection",
    name: "Fall Detection",
    accessLevel: FeatureAccessLevel.FREE,
    description: "Automatic fall detection",
  },

  // Premium Individual Features
  PPG_HEART_RATE: {
    id: "ppg_heart_rate",
    name: "PPG Heart Rate Monitoring",
    accessLevel: FeatureAccessLevel.PREMIUM_INDIVIDUAL,
    description: "Real-time heart rate monitoring using camera",
  },
  ADVANCED_VITALS: {
    id: "advanced_vitals",
    name: "Advanced Vitals",
    accessLevel: FeatureAccessLevel.PREMIUM_INDIVIDUAL,
    description: "Advanced vital signs tracking and analysis",
  },
  AI_ASSISTANT: {
    id: "ai_assistant",
    name: "AI Assistant (Zeina)",
    accessLevel: FeatureAccessLevel.PREMIUM_INDIVIDUAL,
    description: "AI-powered health assistant",
  },
  EXPORT_DATA: {
    id: "export_data",
    name: "Data Export",
    accessLevel: FeatureAccessLevel.PREMIUM_INDIVIDUAL,
    description: "Export health data to CSV/PDF",
  },
  HEALTH_INSIGHTS: {
    id: "health_insights",
    name: "Health Insights",
    accessLevel: FeatureAccessLevel.PREMIUM_INDIVIDUAL,
    description: "AI-powered health insights and recommendations",
  },

  // Premium Family Features
  FAMILY_MEMBERS: {
    id: "family_members",
    name: "Family Members",
    accessLevel: FeatureAccessLevel.PREMIUM_FAMILY,
    description: "Add family members to your health group",
    // Individual plan allows 1 admin + 1 family member (total 2)
    // Family plan allows 1 admin + 3 family members (total 4)
  },
  FAMILY_HEALTH_DASHBOARD: {
    id: "family_health_dashboard",
    name: "Family Health Dashboard",
    accessLevel: FeatureAccessLevel.PREMIUM_FAMILY,
    description: "View health data for all family members",
  },
  FAMILY_ALERTS: {
    id: "family_alerts",
    name: "Family Health Alerts",
    accessLevel: FeatureAccessLevel.PREMIUM_FAMILY,
    description: "Receive alerts about family member health",
  },
  FAMILY_SHARING: {
    id: "family_sharing",
    name: "Family Data Sharing",
    accessLevel: FeatureAccessLevel.PREMIUM_FAMILY,
    description: "Share health data with family members",
  },

  // Premium Any (Individual or Family)
  CLOUD_BACKUP: {
    id: "cloud_backup",
    name: "Cloud Backup",
    accessLevel: FeatureAccessLevel.PREMIUM_ANY,
    description: "Automatic cloud backup of health data",
  },
  PREMIUM_SUPPORT: {
    id: "premium_support",
    name: "Premium Support",
    accessLevel: FeatureAccessLevel.PREMIUM_ANY,
    description: "Priority customer support",
  },
} as const;

export type FeatureId = keyof typeof FEATURES;

/**
 * Feature Gate Service
 * Centralized service for checking feature access
 */
class FeatureGateService {
  /**
   * Check if a feature is accessible based on subscription status
   */
  checkFeatureAccess(
    featureId: FeatureId,
    subscriptionStatus: {
      isPremium: boolean;
      isFamilyPlan: boolean;
      isIndividualPlan: boolean;
    }
  ): boolean {
    const feature = FEATURES[featureId];
    if (!feature) {
      // Unknown feature - deny access by default for security
      return false;
    }

    const { accessLevel } = feature;

    switch (accessLevel) {
      case FeatureAccessLevel.FREE:
        return true;

      case FeatureAccessLevel.PREMIUM_INDIVIDUAL:
        return (
          subscriptionStatus.isIndividualPlan || subscriptionStatus.isFamilyPlan
        );

      case FeatureAccessLevel.PREMIUM_FAMILY:
        return subscriptionStatus.isFamilyPlan;

      case FeatureAccessLevel.PREMIUM_ANY:
        return subscriptionStatus.isPremium;

      default:
        return false;
    }
  }

  /**
   * Get the required subscription type for a feature
   */
  getRequiredSubscriptionType(featureId: FeatureId): FeatureAccessLevel | null {
    const feature = FEATURES[featureId];
    if (!feature) {
      return null;
    }
    return feature.accessLevel;
  }

  /**
   * Get feature information
   */
  getFeature(featureId: FeatureId) {
    return FEATURES[featureId];
  }

  /**
   * Get all features that require a specific access level
   */
  getFeaturesByAccessLevel(
    accessLevel: FeatureAccessLevel
  ): Array<(typeof FEATURES)[FeatureId]> {
    return Object.values(FEATURES).filter(
      (feature) => feature.accessLevel === accessLevel
    );
  }

  /**
   * Check if user needs to upgrade for a feature
   */
  needsUpgrade(
    featureId: FeatureId,
    subscriptionStatus: {
      isPremium: boolean;
      isFamilyPlan: boolean;
      isIndividualPlan: boolean;
    }
  ): boolean {
    return !this.checkFeatureAccess(featureId, subscriptionStatus);
  }

  /**
   * Get upgrade message for a feature
   */
  getUpgradeMessage(featureId: FeatureId, isRTL = false): string {
    const feature = FEATURES[featureId];
    if (!feature) {
      return isRTL ? "ميزة غير متاحة" : "Feature not available";
    }

    const { accessLevel, name } = feature;

    switch (accessLevel) {
      case FeatureAccessLevel.PREMIUM_INDIVIDUAL:
        return isRTL
          ? `يتطلب ${name} اشتراك الخطة الفردية`
          : `${name} requires an Individual Plan subscription`;

      case FeatureAccessLevel.PREMIUM_FAMILY:
        return isRTL
          ? `يتطلب ${name} اشتراك خطة العائلة`
          : `${name} requires a Family Plan subscription`;

      case FeatureAccessLevel.PREMIUM_ANY:
        return isRTL
          ? `يتطلب ${name} اشتراك مميز`
          : `${name} requires a Premium subscription`;

      default:
        return isRTL ? "ميزة غير متاحة" : "Feature not available";
    }
  }
}

export const featureGateService = new FeatureGateService();

/**
 * React Hook for Feature Gating
 * Use this hook in components to check feature access
 */
export function useFeatureGate(featureId: FeatureId) {
  const subscription = useSubscription();

  const hasAccess = featureGateService.checkFeatureAccess(featureId, {
    isPremium: subscription.isPremium,
    isFamilyPlan: subscription.isFamilyPlan,
    isIndividualPlan: subscription.isIndividualPlan,
  });

  const needsUpgrade = featureGateService.needsUpgrade(featureId, {
    isPremium: subscription.isPremium,
    isFamilyPlan: subscription.isFamilyPlan,
    isIndividualPlan: subscription.isIndividualPlan,
  });

  const feature = featureGateService.getFeature(featureId);
  const requiredLevel =
    featureGateService.getRequiredSubscriptionType(featureId);

  return {
    hasAccess,
    needsUpgrade,
    feature,
    requiredLevel,
    isLoading: subscription.isLoading,
  };
}

/**
 * Hook to check multiple features at once
 */
export function useFeatureGates(featureIds: FeatureId[]) {
  const subscription = useSubscription();

  const features = featureIds.reduce(
    (acc, featureId) => {
      const hasAccess = featureGateService.checkFeatureAccess(featureId, {
        isPremium: subscription.isPremium,
        isFamilyPlan: subscription.isFamilyPlan,
        isIndividualPlan: subscription.isIndividualPlan,
      });

      acc[featureId] = {
        hasAccess,
        needsUpgrade: !hasAccess,
        feature: featureGateService.getFeature(featureId),
      };

      return acc;
    },
    {} as Record<
      FeatureId,
      {
        hasAccess: boolean;
        needsUpgrade: boolean;
        feature: (typeof FEATURES)[FeatureId] | undefined;
      }
    >
  );

  return {
    features,
    isLoading: subscription.isLoading,
  };
}
