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
    subscriptionStatus,
    isLoading,
  } = useRevenueCat();

  // Get plan limits - only Family Plan is available
  const planLimits = hasFamilyPlan ? PLAN_LIMITS.FAMILY : null;
  const isIndividualPlan = hasActiveSubscription && !hasFamilyPlan;

  return {
    isPremium: hasActiveSubscription,
    isFamilyPlan: hasFamilyPlan,
    isIndividualPlan,
    subscriptionStatus,
    planLimits,
    maxFamilyMembers: planLimits?.familyMembers ?? 0,
    maxTotalMembers: planLimits?.totalMembers ?? 0,
    isLoading,
  };
}
