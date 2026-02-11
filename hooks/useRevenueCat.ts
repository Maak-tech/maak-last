import { useCallback, useEffect, useState } from "react";
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import {
  revenueCatService,
  type SubscriptionStatus,
} from "@/lib/services/revenueCatService";

export type UseRevenueCatReturn = {
  isLoading: boolean;
  error: Error | null;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOffering | null;
  subscriptionStatus: SubscriptionStatus;
  hasActiveSubscription: boolean;
  hasFamilyPlan: boolean;
  refreshCustomerInfo: () => Promise<void>;
  refreshOfferings: () => Promise<void>;
  purchasePackage: (
    packageToPurchase: PurchasesPackage
  ) => Promise<CustomerInfo>;
  restorePurchases: () => Promise<CustomerInfo>;
};

/**
 * Hook to manage RevenueCat subscriptions
 */
export function useRevenueCat(): UseRevenueCatReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus>({
      isActive: false,
      isFamilyPlan: false,
      subscriptionType: null,
      subscriptionPeriod: null,
      expirationDate: null,
      productIdentifier: null,
    });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Initialize RevenueCat (will wait if initialization is in progress)
      await revenueCatService.initialize();

      // Load customer info and offerings in parallel, but tolerate offerings issues.
      const [customerInfoResult, offeringsResult, statusResult] =
        await Promise.allSettled([
          revenueCatService.getCustomerInfo(),
          revenueCatService.getOfferings(),
          revenueCatService.getSubscriptionStatus(),
        ]);

      if (customerInfoResult.status === "fulfilled") {
        setCustomerInfo(customerInfoResult.value);
      } else {
        throw customerInfoResult.reason;
      }

      if (offeringsResult.status === "fulfilled") {
        setOfferings(offeringsResult.value);
      }

      if (statusResult.status === "fulfilled") {
        setSubscriptionStatus(statusResult.value);
      }
    } catch (err) {
      const caughtError =
        err instanceof Error ? err : new Error("Unknown error");
      setError(caughtError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshCustomerInfo = async () => {
    try {
      setError(null);
      const customerInfoData = await revenueCatService.refreshCustomerInfo();
      setCustomerInfo(customerInfoData);

      // Update subscription status
      const status = await revenueCatService.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (err) {
      const caughtError =
        err instanceof Error ? err : new Error("Unknown error");
      setError(caughtError);
      throw caughtError;
    }
  };

  const refreshOfferings = async () => {
    try {
      setError(null);
      // Force refresh to bypass cache
      const offeringsData = await revenueCatService.getOfferings(true);
      setOfferings(offeringsData);
    } catch (err) {
      const caughtError =
        err instanceof Error ? err : new Error("Unknown error");
      setError(caughtError);
      throw caughtError;
    }
  };

  const purchasePackage = async (
    packageToPurchase: PurchasesPackage
  ): Promise<CustomerInfo> => {
    try {
      setError(null);
      const customerInfoData =
        await revenueCatService.purchasePackage(packageToPurchase);
      setCustomerInfo(customerInfoData);

      // Update subscription status
      const status = await revenueCatService.getSubscriptionStatus();
      setSubscriptionStatus(status);

      return customerInfoData;
    } catch (err) {
      const caughtError =
        err instanceof Error ? err : new Error("Unknown error");
      setError(caughtError);
      throw caughtError;
    }
  };

  const restorePurchases = async (): Promise<CustomerInfo> => {
    try {
      setError(null);
      const customerInfoData = await revenueCatService.restorePurchases();
      setCustomerInfo(customerInfoData);

      // Update subscription status
      const status = await revenueCatService.getSubscriptionStatus();
      setSubscriptionStatus(status);

      return customerInfoData;
    } catch (err) {
      const caughtError =
        err instanceof Error ? err : new Error("Unknown error");
      setError(caughtError);
      throw caughtError;
    }
  };

  const hasActiveSubscription = subscriptionStatus.isActive;
  const hasFamilyPlan = subscriptionStatus.isFamilyPlan;

  return {
    isLoading,
    error,
    customerInfo,
    offerings,
    subscriptionStatus,
    hasActiveSubscription,
    hasFamilyPlan,
    refreshCustomerInfo,
    refreshOfferings,
    purchasePackage,
    restorePurchases,
  };
}
