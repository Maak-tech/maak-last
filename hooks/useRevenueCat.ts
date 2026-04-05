import { useEffect, useState } from "react";
import type { CustomerInfo, PurchasesOfferings } from "react-native-purchases";
import { revenueCatService } from "@/lib/services/revenueCatService";

interface UseRevenueCatResult {
  isLoading: boolean;
  offerings: PurchasesOfferings | null;
  customerInfo: CustomerInfo | null;
  error: Error | null;
  refreshOfferings: () => Promise<void>;
  refreshCustomerInfo: () => Promise<void>;
}

export function useRevenueCat(): UseRevenueCatResult {
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const refreshOfferings = async () => {
    try {
      const data = await revenueCatService.getOfferings();
      setOfferings(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  };

  const refreshCustomerInfo = async () => {
    try {
      const info = await revenueCatService.getCustomerInfo();
      setCustomerInfo(info);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  };

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await Promise.all([refreshOfferings(), refreshCustomerInfo()]);
      setIsLoading(false);
    })();
  }, []);

  return { isLoading, offerings, customerInfo, error, refreshOfferings, refreshCustomerInfo };
}
