import { useEffect, useState } from "react";
import { revenueCatService, type SubscriptionStatus } from "@/lib/services/revenueCatService";

type SubscriptionState = "active" | "expired" | "none" | "loading";

interface UseSubscriptionResult {
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionState: SubscriptionState;
  isSubscribed: boolean;
  isPremium: boolean;
  isFamilyPlan: boolean;
  isIndividualPlan: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionResult {
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>("loading");
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const info = await revenueCatService.getCustomerInfo();
      const status = await revenueCatService.getSubscriptionStatus();
      setSubscriptionStatus(status);
      const active = revenueCatService.isSubscribed(info);
      setSubscriptionState(active ? "active" : "none");
    } catch {
      setSubscriptionState("none");
      setSubscriptionStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const isSubscribed = subscriptionState === "active";

  // Derive plan type from the active product identifier
  const productId = subscriptionStatus?.productIdentifier?.toLowerCase() ?? "";
  const isFamilyPlan = isSubscribed && (
    productId.includes("family") || productId.includes("fam")
  );
  const isIndividualPlan = isSubscribed && !isFamilyPlan;
  const isPremium = isSubscribed;

  return {
    subscriptionStatus,
    subscriptionState,
    isSubscribed,
    isPremium,
    isFamilyPlan,
    isIndividualPlan,
    isLoading,
    refresh,
  };
}
