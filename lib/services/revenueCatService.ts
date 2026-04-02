import Purchases, { type CustomerInfo, type PurchasesOfferings } from "react-native-purchases";
import { Platform } from "react-native";

const RC_IOS_KEY     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY     ?? "";
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

export const revenueCatService = {
  initialize(userId?: string): void {
    try {
      const apiKey = Platform.OS === "ios" ? RC_IOS_KEY : RC_ANDROID_KEY;
      if (!apiKey) return;
      Purchases.configure({ apiKey });
      if (userId) Purchases.logIn(userId).catch(() => {});
    } catch {
      // RevenueCat SDK not available in this build
    }
  },

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      return await Purchases.getCustomerInfo();
    } catch {
      return null;
    }
  },

  async getOfferings(): Promise<PurchasesOfferings | null> {
    try {
      return await Purchases.getOfferings();
    } catch {
      return null;
    }
  },

  isSubscribed(info: CustomerInfo | null): boolean {
    if (!info) return false;
    return Object.keys(info.entitlements.active).length > 0;
  },
};
