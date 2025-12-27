import { useEffect, useState } from "react";
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import {
  revenueCatService,
  type SubscriptionStatus,
} from "@/lib/services/revenueCatService";

export interface UseRevenueCatReturn {
  isLoading: boolean;
  error: Error | null;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOffering | null;
  subscriptionStatus: SubscriptionStatus;
  hasActiveSubscription: boolean;
  hasFamilyPlan: boolean;
  hasIndividualPlan: boolean;
  refreshCustomerInfo: () => Promise<void>;
  refreshOfferings: () => Promise<void>;
  purchasePackage: (packageToPurchase: PurchasesPackage) => Promise<CustomerInfo>;
  restorePurchases: () => Promise<CustomerInfo>;
}

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

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Initialize RevenueCat (will wait if initialization is in progress)
      await revenueCatService.initialize();

      // Load customer info and offerings in parallel
      const [customerInfoData, offeringsData] = await Promise.all([
        revenueCatService.getCustomerInfo(),
        revenueCatService.getOfferings(),
      ]);

      setCustomerInfo(customerInfoData);
      setOfferings(offeringsData);

      // Get subscription status
      const status = await revenueCatService.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshCustomerInfo = async () => {
    try {
      setError(null);
      const customerInfoData = await revenueCatService.refreshCustomerInfo();
      setCustomerInfo(customerInfoData);

      // Update subscription status
      const status = await revenueCatService.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      throw error;
    }
  };

  const refreshOfferings = async () => {
    try {
      setError(null);
      const offeringsData = await revenueCatService.getOfferings();
      setOfferings(offeringsData);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      throw error;
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
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      throw error;
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
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      throw error;
    }
  };

  const hasActiveSubscription = subscriptionStatus.isActive;
  const hasFamilyPlan = subscriptionStatus.isFamilyPlan;
  const hasIndividualPlan =
    subscriptionStatus.isActive && !subscriptionStatus.isFamilyPlan;

  return {
    isLoading,
    error,
    customerInfo,
    offerings,
    subscriptionStatus,
    hasActiveSubscription,
    hasFamilyPlan,
    hasIndividualPlan,
    refreshCustomerInfo,
    refreshOfferings,
    purchasePackage,
    restorePurchases,
  };
}

