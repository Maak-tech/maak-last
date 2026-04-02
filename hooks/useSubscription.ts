import { useEffect, useState } from "react";
import { revenueCatService } from "@/lib/services/revenueCatService";

type SubscriptionStatus = "active" | "expired" | "none" | "loading";

interface UseSubscriptionResult {
  subscriptionStatus: SubscriptionStatus;
  isSubscribed: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionResult {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>("loading");
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const info = await revenueCatService.getCustomerInfo();
      const active = revenueCatService.isSubscribed(info);
      setSubscriptionStatus(active ? "active" : "none");
    } catch {
      setSubscriptionStatus("none");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  return {
    subscriptionStatus,
    isSubscribed: subscriptionStatus === "active",
    isLoading,
    refresh,
  };
}
