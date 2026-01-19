import { PLAN_LIMITS } from "@/lib/services/revenueCatService";
import { useRevenueCat } from "./useRevenueCat";

/**
 * Simplified hook for checking subscription status
 * Use this hook when you only need to check if user has an active subscription
 */
export function useSubscription() {
  const {
    hasActiveSubscription,
    hasFamilyPlan,
    hasIndividualPlan,
    subscriptionStatus,
    isLoading,
  } = useRevenueCat();

  // Get plan limits based on subscription type
  const planLimits = hasFamilyPlan
    ? PLAN_LIMITS.FAMILY
    : hasIndividualPlan
      ? PLAN_LIMITS.INDIVIDUAL
      : null;

  return {
    isPremium: hasActiveSubscription,
    isFamilyPlan: hasFamilyPlan,
    isIndividualPlan: hasIndividualPlan,
    subscriptionStatus,
    planLimits,
    maxFamilyMembers: planLimits?.familyMembers ?? 0,
    maxTotalMembers: planLimits?.totalMembers ?? 0,
    isLoading,
  };
}
