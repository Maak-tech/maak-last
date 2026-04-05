import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";
import { Platform } from "react-native";

const RC_IOS_KEY     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY     ?? "";
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

export interface SubscriptionStatus {
  isActive: boolean;
  productIdentifier: string | null;
  expirationDate?: Date | null;
  subscriptionPeriod?: "monthly" | "yearly" | null;
}

export const revenueCatService = {
  initialize(userId?: string): void {
    try {
      const apiKey = Platform.OS === "ios" ? RC_IOS_KEY : RC_ANDROID_KEY;
      if (!apiKey) return;
      Purchases.configure({ apiKey });
      if (userId) Purchases.logIn(userId).catch((err: unknown) => {
        console.warn('[revenueCat] logIn failed:', err);
      });
    } catch {
      // RevenueCat SDK not available in this build
    }
  },

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      return await Purchases.getCustomerInfo();
    } catch (err: unknown) {
      console.warn('[revenueCat] getCustomerInfo failed:', err);
      return null;
    }
  },

  async getOfferings(): Promise<PurchasesOfferings | null> {
    try {
      return await Purchases.getOfferings();
    } catch (err: unknown) {
      console.warn('[revenueCat] getOfferings failed:', err);
      return null;
    }
  },

  isSubscribed(info: CustomerInfo | null): boolean {
    if (!info) return false;
    return Object.keys(info.entitlements.active).length > 0;
  },

  async getSubscriptionStatus(): Promise<SubscriptionStatus | null> {
    try {
      const info = await Purchases.getCustomerInfo();
      if (!info) return null;

      const activeEntitlements = Object.values(info.entitlements.active);
      if (activeEntitlements.length === 0) {
        return { isActive: false, productIdentifier: null };
      }

      const entitlement = activeEntitlements[0];
      const expiresDateStr = entitlement.expirationDate;
      const expirationDate = expiresDateStr ? new Date(expiresDateStr) : null;
      const productId = entitlement.productIdentifier ?? null;

      // Infer billing period from product identifier heuristic
      let subscriptionPeriod: "monthly" | "yearly" | null = null;
      if (productId) {
        const lower = productId.toLowerCase();
        if (lower.includes("annual") || lower.includes("yearly") || lower.includes("year")) {
          subscriptionPeriod = "yearly";
        } else if (lower.includes("monthly") || lower.includes("month")) {
          subscriptionPeriod = "monthly";
        }
      }

      return {
        isActive: true,
        productIdentifier: productId,
        expirationDate,
        subscriptionPeriod,
      };
    } catch (err: unknown) {
      console.warn('[revenueCat] getSubscriptionStatus failed:', err);
      return null;
    }
  },

  async purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
    const result = await Purchases.purchasePackage(pkg);
    return result.customerInfo;
  },

  async restorePurchases(): Promise<CustomerInfo> {
    return await Purchases.restorePurchases();
  },
};
