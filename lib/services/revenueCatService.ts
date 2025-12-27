import Purchases, {
  CustomerInfo,
  PurchasesError,
  PurchasesOffering,
  PurchasesPackage,
  PurchasesStoreProduct,
} from "react-native-purchases";
import { Platform } from "react-native";
import { logger } from "@/lib/utils/logger";
import { ensureRevenueCatDirectory } from "@/modules/expo-revenuecat-directory";

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
        // Ensure RevenueCat cache directory exists before initialization
        // This prevents NSCocoaErrorDomain Code=4 errors on iOS
        if (Platform.OS === "ios") {
          try {
            // Call the native module synchronously to ensure directory exists before configure
            const directoryCreated = await ensureRevenueCatDirectory();
            if (!directoryCreated) {
              logger.warn(
                "Failed to ensure RevenueCat directory exists before initialization. " +
                "RevenueCat may attempt to create it automatically.",
                undefined,
                "RevenueCatService"
              );
            } else {
              logger.info(
                "RevenueCat cache directory ensured successfully",
                undefined,
                "RevenueCatService"
              );
            }
            // Add a small delay to ensure directory is fully created and writable
            // This prevents race conditions where RevenueCat tries to cache immediately after configure
            await new Promise((resolve) => setTimeout(resolve, 200));
          } catch (dirError) {
            // Log but don't fail initialization - RevenueCat SDK will handle retry
            logger.warn(
              "Error ensuring RevenueCat directory exists",
              dirError,
              "RevenueCatService"
            );
            // Add a delay before proceeding to allow any native operations to complete
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }

        // Configure RevenueCat with API key
        await Purchases.configure({
          apiKey: REVENUECAT_API_KEY,
        });

        // Set log level to suppress non-critical cache errors
        // The cache error (NSCocoaErrorDomain Code=4) is a known non-critical SDK issue
        // where RevenueCat tries to cache data but the directory doesn't exist yet.
        // The SDK handles this internally and will create the directory automatically.
        // This error appears in native iOS logs but doesn't affect functionality.
        // Using WARN level suppresses INFO/DEBUG noise while still showing important errors.
        // Note: The native iOS SDK may still log this error directly, but it's harmless.
        Purchases.setLogLevel(Purchases.LOG_LEVEL.WARN);

        this.isInitialized = true;
      } catch (error) {
        logger.error("RevenueCat initialization failed", error, "RevenueCatService");
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
    try {
      // Wait for initialization to complete (either already done or in progress)
      await this.initialize();
    } catch (initError) {
      // If initialization fails, log but don't throw - allow app to continue
      logger.error("RevenueCat initialization failed in setUserId", initError, "RevenueCatService");
      // Don't throw - allow the app to continue without RevenueCat
      return;
    }

    try {
      // Check if the user is already logged in with the same ID to avoid redundant logIn calls
      // This prevents the warning: "The appUserID passed to logIn is the same as the one already cached"
      try {
        // Only check if SDK is initialized
        if (!this.isInitialized) {
          // SDK not initialized, proceed with login attempt
          await Purchases.logIn(userId);
          await this.refreshCustomerInfo();
          return;
        }

        const customerInfo = await Purchases.getCustomerInfo();
        const currentAppUserId = customerInfo.originalAppUserId;
        if (currentAppUserId === userId) {
          // User is already logged in with this ID, just refresh customer info
          await this.refreshCustomerInfo();
          return;
        }
      } catch (checkError: any) {
        // If we can't get customer info (e.g., first time user, network error, etc.), proceed with login
        // This is not critical, so we continue with the login attempt
        logger.error("Failed to check current RevenueCat user ID", checkError, "RevenueCatService");
      }

      // User ID is different or couldn't be determined, proceed with login
      await Purchases.logIn(userId);
      // Refresh customer info after setting user ID
      await this.refreshCustomerInfo();
    } catch (error) {
      // Don't throw RevenueCat errors - they shouldn't block authentication
      // Log the error but allow the app to continue
      logger.error("Failed to set RevenueCat user ID", error, "RevenueCatService");
      // Don't throw - RevenueCat errors shouldn't prevent user from signing in
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
      logger.error("Failed to log out from RevenueCat", error, "RevenueCatService");
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
      logger.error("Failed to get customer info", error, "RevenueCatService");
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
      logger.error("Failed to refresh customer info", error, "RevenueCatService");
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
      logger.error("Failed to get offerings", error, "RevenueCatService");
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
    } catch (error: unknown) {
      // Safe type checking before accessing PurchasesError properties
      if (error && typeof error === 'object' && 'userCancelled' in error) {
        const purchasesError = error as PurchasesError;
        if (purchasesError.userCancelled) {
          throw new Error("Purchase was cancelled");
        }
      }

      // Handle other errors
      logger.error("Purchase failed", error, "RevenueCatService");
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
      logger.error("Failed to restore purchases", error, "RevenueCatService");
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
      logger.error("Failed to check subscription status", error, "RevenueCatService");
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
      logger.error("Failed to check Family Plan entitlement", error, "RevenueCatService");
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
      logger.error("Failed to check Individual Plan entitlement", error, "RevenueCatService");
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
      logger.error("Failed to get subscription status", error, "RevenueCatService");
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
      logger.error("Failed to get product", error, "RevenueCatService");
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
      logger.error("Failed to get package", error, "RevenueCatService");
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
      logger.error("Failed to get plan limits", error, "RevenueCatService");
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
      logger.error("Failed to get max family members", error, "RevenueCatService");
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
      logger.error("Failed to get max total members", error, "RevenueCatService");
      return 0;
    }
  }
}

export const revenueCatService = new RevenueCatService();

