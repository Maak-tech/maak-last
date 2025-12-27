import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  PurchasesStoreProduct,
} from "react-native-purchases";
import { Platform } from "react-native";

// RevenueCat API Key
const REVENUECAT_API_KEY = "test_vluBajsHEoAjMjzoArPVpklOCRc";

// Product identifiers
export const PRODUCT_IDENTIFIERS = {
  INDIVIDUAL_MONTHLY: "Individual_Monthly_Premium",
  FAMILY_MONTHLY: "Family_Monthly_Premium",
  INDIVIDUAL_YEARLY: "Individual_Yearly_Premium",
  FAMILY_YEARLY: "Family_Yearly_Premium",
} as const;

// Entitlement identifiers
export const ENTITLEMENT_IDENTIFIERS = {
  FAMILY_PLAN: "Family Plan",
  INDIVIDUAL_PLAN: "Individual Plan",
} as const;

// Plan limits
export const PLAN_LIMITS = {
  INDIVIDUAL: {
    adminMembers: 1,
    familyMembers: 1,
    totalMembers: 2,
  },
  FAMILY: {
    adminMembers: 1,
    familyMembers: 3,
    totalMembers: 4,
  },
} as const;

// Subscription types
export type SubscriptionType = "individual" | "family";
export type SubscriptionPeriod = "monthly" | "yearly";

export interface SubscriptionStatus {
  isActive: boolean;
  isFamilyPlan: boolean;
  subscriptionType: SubscriptionType | null;
  subscriptionPeriod: SubscriptionPeriod | null;
  expirationDate: Date | null;
  productIdentifier: string | null;
}

class RevenueCatService {
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private currentCustomerInfo: CustomerInfo | null = null;

  /**
   * Initialize RevenueCat SDK
   * Should be called once when the app starts
   * Returns the same promise if initialization is already in progress
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // If initialization is already in progress, return the existing promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Create and store the initialization promise
    this.initializationPromise = (async () => {
      try {
        // Configure RevenueCat with API key
        await Purchases.configure({
          apiKey: REVENUECAT_API_KEY,
        });

        // Enable debug logs in development
        if (__DEV__) {
          Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
        }

        this.isInitialized = true;
      } catch (error) {
        console.error("RevenueCat initialization failed:", error);
        // Clear the promise on error so it can be retried
        this.initializationPromise = null;
        throw new Error("Failed to initialize RevenueCat SDK");
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Set the user ID for RevenueCat
   * Should be called when user logs in or when user ID changes
   * Waits for initialization to complete if it's in progress
   */
  async setUserId(userId: string): Promise<void> {
    // Wait for initialization to complete (either already done or in progress)
    await this.initialize();

    try {
      await Purchases.logIn(userId);
      // Refresh customer info after setting user ID
      await this.refreshCustomerInfo();
    } catch (error) {
      console.error("Failed to set RevenueCat user ID:", error);
      throw error;
    }
  }

  /**
   * Log out the current user from RevenueCat
   * Should be called when user logs out
   * Waits for initialization to complete if it's in progress to ensure proper cleanup
   */
  async logOut(): Promise<void> {
    // Wait for initialization to complete if it's in progress
    // This ensures we can properly log out even if logout happens during initialization
    if (this.initializationPromise) {
      try {
        await this.initializationPromise;
      } catch (error) {
        // If initialization failed, we can still attempt logout
        // RevenueCat may have been partially initialized
      }
    }

    // Only attempt logout if SDK is initialized
    // If initialization never completed, there's no session to clear
    if (!this.isInitialized) {
      return;
    }

    try {
      await Purchases.logOut();
      this.currentCustomerInfo = null;
    } catch (error) {
      console.error("Failed to log out from RevenueCat:", error);
      throw error;
    }
  }

  /**
   * Get current customer info
   */
  async getCustomerInfo(): Promise<CustomerInfo> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      this.currentCustomerInfo = customerInfo;
      return customerInfo;
    } catch (error) {
      console.error("Failed to get customer info:", error);
      throw error;
    }
  }

  /**
   * Refresh customer info from RevenueCat servers
   */
  async refreshCustomerInfo(): Promise<CustomerInfo> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      this.currentCustomerInfo = customerInfo;
      return customerInfo;
    } catch (error) {
      console.error("Failed to refresh customer info:", error);
      throw error;
    }
  }

  /**
   * Get available offerings (products)
   */
  async getOfferings(): Promise<PurchasesOffering | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error) {
      console.error("Failed to get offerings:", error);
      throw error;
    }
  }

  /**
   * Purchase a package
   */
  async purchasePackage(
    packageToPurchase: PurchasesPackage
  ): Promise<CustomerInfo> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(
        packageToPurchase
      );
      this.currentCustomerInfo = customerInfo;
      return customerInfo;
    } catch (error: any) {
      // Handle user cancellation
      if (error.userCancelled) {
        throw new Error("Purchase was cancelled");
      }

      // Handle other errors
      console.error("Purchase failed:", error);
      throw error;
    }
  }

  /**
   * Restore purchases
   */
  async restorePurchases(): Promise<CustomerInfo> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const customerInfo = await Purchases.restorePurchases();
      this.currentCustomerInfo = customerInfo;
      return customerInfo;
    } catch (error) {
      console.error("Failed to restore purchases:", error);
      throw error;
    }
  }

  /**
   * Check if user has active subscription (either Individual or Family Plan)
   */
  async hasActiveSubscription(): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      const activeEntitlements = customerInfo.entitlements.active;
      return (
        activeEntitlements[ENTITLEMENT_IDENTIFIERS.FAMILY_PLAN] !== undefined ||
        activeEntitlements[ENTITLEMENT_IDENTIFIERS.INDIVIDUAL_PLAN] !== undefined
      );
    } catch (error) {
      console.error("Failed to check subscription status:", error);
      return false;
    }
  }

  /**
   * Check if user has Family Plan entitlement
   */
  async hasFamilyPlanEntitlement(): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      const entitlement =
        customerInfo.entitlements.active[ENTITLEMENT_IDENTIFIERS.FAMILY_PLAN];
      return entitlement !== undefined;
    } catch (error) {
      console.error("Failed to check Family Plan entitlement:", error);
      return false;
    }
  }

  /**
   * Check if user has Individual Plan entitlement
   */
  async hasIndividualPlanEntitlement(): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      const entitlement =
        customerInfo.entitlements.active[ENTITLEMENT_IDENTIFIERS.INDIVIDUAL_PLAN];
      return entitlement !== undefined;
    } catch (error) {
      console.error("Failed to check Individual Plan entitlement:", error);
      return false;
    }
  }

  /**
   * Get detailed subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      const customerInfo = await this.getCustomerInfo();
      const activeEntitlements = customerInfo.entitlements.active;
      
      // Check for Family Plan first (higher priority)
      let entitlement = activeEntitlements[ENTITLEMENT_IDENTIFIERS.FAMILY_PLAN];
      let isFamilyPlan = true;
      
      // If no Family Plan, check for Individual Plan
      if (!entitlement) {
        entitlement = activeEntitlements[ENTITLEMENT_IDENTIFIERS.INDIVIDUAL_PLAN];
        isFamilyPlan = false;
      }

      if (!entitlement) {
        return {
          isActive: false,
          isFamilyPlan: false,
          subscriptionType: null,
          subscriptionPeriod: null,
          expirationDate: null,
          productIdentifier: null,
        };
      }

      const productIdentifier = entitlement.productIdentifier;
      const subscriptionType: SubscriptionType = isFamilyPlan
        ? "family"
        : "individual";
      const subscriptionPeriod: SubscriptionPeriod =
        productIdentifier.includes("Yearly") ? "yearly" : "monthly";

      return {
        isActive: true,
        isFamilyPlan,
        subscriptionType,
        subscriptionPeriod,
        expirationDate: entitlement.expirationDate
          ? new Date(entitlement.expirationDate)
          : null,
        productIdentifier,
      };
    } catch (error) {
      console.error("Failed to get subscription status:", error);
      return {
        isActive: false,
        isFamilyPlan: false,
        subscriptionType: null,
        subscriptionPeriod: null,
        expirationDate: null,
        productIdentifier: null,
      };
    }
  }

  /**
   * Get product by identifier
   */
  async getProduct(
    productIdentifier: string
  ): Promise<PurchasesStoreProduct | null> {
    try {
      const offerings = await this.getOfferings();
      if (!offerings) {
        return null;
      }

      // Search in available packages
      for (const packageItem of offerings.availablePackages) {
        if (packageItem.product.identifier === productIdentifier) {
          return packageItem.product;
        }
      }

      return null;
    } catch (error) {
      console.error("Failed to get product:", error);
      return null;
    }
  }

  /**
   * Get package by identifier
   */
  async getPackage(
    productIdentifier: string
  ): Promise<PurchasesPackage | null> {
    try {
      const offerings = await this.getOfferings();
      if (!offerings) {
        return null;
      }

      // Search in available packages
      for (const packageItem of offerings.availablePackages) {
        if (packageItem.product.identifier === productIdentifier) {
          return packageItem;
        }
      }

      return null;
    } catch (error) {
      console.error("Failed to get package:", error);
      return null;
    }
  }

  /**
   * Get current customer info (cached)
   */
  getCachedCustomerInfo(): CustomerInfo | null {
    return this.currentCustomerInfo;
  }

  /**
   * Check if SDK is initialized
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get plan limits for the current subscription
   */
  async getPlanLimits(): Promise<typeof PLAN_LIMITS.INDIVIDUAL | typeof PLAN_LIMITS.FAMILY | null> {
    try {
      const status = await this.getSubscriptionStatus();
      if (!status.isActive) {
        return null;
      }
      return status.isFamilyPlan ? PLAN_LIMITS.FAMILY : PLAN_LIMITS.INDIVIDUAL;
    } catch (error) {
      console.error("Failed to get plan limits:", error);
      return null;
    }
  }

  /**
   * Get maximum family members allowed for current subscription
   */
  async getMaxFamilyMembers(): Promise<number> {
    try {
      const limits = await this.getPlanLimits();
      return limits?.familyMembers ?? 0;
    } catch (error) {
      console.error("Failed to get max family members:", error);
      return 0;
    }
  }

  /**
   * Get maximum total members allowed for current subscription
   */
  async getMaxTotalMembers(): Promise<number> {
    try {
      const limits = await this.getPlanLimits();
      return limits?.totalMembers ?? 0;
    } catch (error) {
      console.error("Failed to get max total members:", error);
      return 0;
    }
  }
}

export const revenueCatService = new RevenueCatService();

