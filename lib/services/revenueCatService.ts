/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: RevenueCat initialization path intentionally coordinates platform cache prep, retry handling, and SDK setup in one flow. */
import Constants from "expo-constants";
import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from "react-native-purchases";
import { logger } from "@/lib/utils/logger";
import { ensureRevenueCatDirectory } from "@/modules/expo-revenuecat-directory";

const IS_DEV = process.env.NODE_ENV !== "production";

// RevenueCat API Key - Load from environment variables
// Use production key in production builds, test key in development
const getRevenueCatApiKey = (): string => {
  // Check app config first (from environment variables)
  const config = Constants.expoConfig?.extra;
  const envKey = config?.revenueCatApiKey;

  // If environment variable is set and not empty, use it
  if (envKey && typeof envKey === "string" && envKey.trim() !== "") {
    const trimmedKey = envKey.trim();
    // Warn if using test key in production build
    if (!IS_DEV && trimmedKey.startsWith("test_")) {
      logger.error(
        "CRITICAL: Test RevenueCat API key detected in production build! " +
          "This will cause App Store rejection. Please set REVENUECAT_API_KEY with production key.",
        undefined,
        "RevenueCatService"
      );
    }
    return trimmedKey;
  }

  // Fallback to test key only in development (__DEV__)
  // In production, this should never be reached if env vars are set correctly
  if (IS_DEV) {
    logger.warn(
      "RevenueCat API key not found in environment variables. Using test key for development.",
      undefined,
      "RevenueCatService"
    );
    return "test_vluBajsHEoAjMjzoArPVpklOCRc";
  }

  // Production builds MUST have the API key set
  // Don't throw at module load - throw during initialization instead
  // This allows the app to load but RevenueCat won't initialize
  return ""; // Empty string will cause initialization to fail gracefully
};

const REVENUECAT_API_KEY = getRevenueCatApiKey();

// Product identifiers
// Only Family Plan is available (monthly and yearly)
export const PRODUCT_IDENTIFIERS = {
  FAMILY_MONTHLY: "Family_Monthly_Premium",
  FAMILY_YEARLY: "Family_Yearly_Premium",
} as const;

// Entitlement identifiers
// Only Family Plan entitlement exists
export const ENTITLEMENT_IDENTIFIERS = {
  FAMILY_PLAN: "Family Plan",
} as const;

// Offering identifier
// RevenueCat Offering ID for the Family Plan offering
export const OFFERING_IDENTIFIER = "ofrng88ce8c174f";

// Plan limits
// Family Plan: 1 admin + 3 family members = 4 total users
export const PLAN_LIMITS = {
  FAMILY: {
    adminMembers: 1,
    familyMembers: 3,
    totalMembers: 4,
  },
} as const;

// Subscription types
// Only Family Plan is available
export type SubscriptionType = "family";
export type SubscriptionPeriod = "monthly" | "yearly";

export type SubscriptionStatus = {
  isActive: boolean;
  isFamilyPlan: boolean;
  subscriptionType: SubscriptionType | null;
  subscriptionPeriod: SubscriptionPeriod | null;
  expirationDate: Date | null;
  productIdentifier: string | null;
};

class RevenueCatService {
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private currentCustomerInfo: CustomerInfo | null = null;
  private cachedOfferings: PurchasesOffering | null = null;
  private offeringsCacheTimestamp = 0;
  private offeringsFetchPromise: Promise<PurchasesOffering | null> | null =
    null;
  private readonly OFFERINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly OFFERINGS_TIMEOUT = 10_000; // 10 seconds

  /**
   * Initialize RevenueCat SDK
   * Should be called once when the app starts
   * Returns the same promise if initialization is already in progress
   */
  initialize(): Promise<void> {
    if (this.isInitialized) {
      return Promise.resolve();
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
            // Retry directory creation up to 3 times with delays
            // This handles race conditions where RevenueCat tries to access the directory immediately
            let directoryCreated = false;
            const maxRetries = 3;

            for (let attempt = 0; attempt < maxRetries; attempt++) {
              directoryCreated = await ensureRevenueCatDirectory();

              if (directoryCreated) {
                // Verify directory is actually writable before proceeding
                // Minimal delay to ensure filesystem operations are complete
                await new Promise((resolve) => setTimeout(resolve, 50));
                break;
              }

              // If failed, wait before retrying
              if (attempt < maxRetries - 1) {
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
            }

            if (directoryCreated) {
              logger.info(
                "RevenueCat cache directory ensured successfully",
                undefined,
                "RevenueCatService"
              );
              // Minimal delay after directory creation
              await new Promise((resolve) => setTimeout(resolve, 100));
            } else {
              logger.warn(
                "Failed to ensure RevenueCat directory exists after retries. " +
                  "RevenueCat may log cache errors but will create the directory automatically.",
                undefined,
                "RevenueCatService"
              );
            }
          } catch (dirError) {
            // Log but don't fail initialization - RevenueCat SDK will handle retry
            logger.warn(
              "Error ensuring RevenueCat directory exists",
              dirError,
              "RevenueCatService"
            );
            // Minimal delay before proceeding
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        // Validate API key before configuring
        if (!REVENUECAT_API_KEY || REVENUECAT_API_KEY.trim() === "") {
          const errorMessage = IS_DEV
            ? "RevenueCat API key not configured. Using test key for development."
            : "RevenueCat API key is required for production builds. " +
              "Please set REVENUECAT_API_KEY in your environment variables or EAS secrets.";

          if (IS_DEV) {
            logger.warn(errorMessage, undefined, "RevenueCatService");
            // Use test key in development
            await Purchases.configure({
              apiKey: "test_vluBajsHEoAjMjzoArPVpklOCRc",
            });
          } else {
            // In production, throw error to prevent App Store rejection
            throw new Error(errorMessage);
          }
        } else {
          // Configure RevenueCat with API key from environment
          await Purchases.configure({
            apiKey: REVENUECAT_API_KEY,
          });
        }

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
        logger.error(
          "RevenueCat initialization failed",
          error,
          "RevenueCatService"
        );
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
      logger.error(
        "RevenueCat initialization failed in setUserId",
        initError,
        "RevenueCatService"
      );
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
      } catch (checkError: unknown) {
        // If we can't get customer info (e.g., first time user, network error, etc.), proceed with login
        // This is not critical, so we continue with the login attempt
        logger.error(
          "Failed to check current RevenueCat user ID",
          checkError,
          "RevenueCatService"
        );
      }

      // User ID is different or couldn't be determined, proceed with login
      await Purchases.logIn(userId);
      // Refresh customer info after setting user ID
      await this.refreshCustomerInfo();
    } catch (error) {
      // Don't throw RevenueCat errors - they shouldn't block authentication
      // Log the error but allow the app to continue
      logger.error(
        "Failed to set RevenueCat user ID",
        error,
        "RevenueCatService"
      );
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
      } catch (_error) {
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
      // Check if the current user is anonymous before attempting logout
      // RevenueCat throws an error if logOut is called on an anonymous user
      try {
        const customerInfo = await Purchases.getCustomerInfo();
        const isAnonymous =
          customerInfo.originalAppUserId.startsWith("$RCAnonymousID:");

        if (isAnonymous) {
          // User is already anonymous, no need to log out
          this.currentCustomerInfo = null;
          return;
        }
      } catch (_checkError) {
        // If we can't get customer info, proceed with logout attempt
        // The logout call itself will handle the anonymous check
      }

      await Purchases.logOut();
      this.currentCustomerInfo = null;
      // Clear offerings cache on logout as they may be user-specific
      this.cachedOfferings = null;
      this.offeringsCacheTimestamp = 0;
    } catch (error: unknown) {
      // Check if error is specifically about anonymous user
      // RevenueCat throws this error when logOut is called on an anonymous user
      const errorMessage =
        error instanceof Error ? error.message : String(error) || "";
      const errorString = errorMessage.toLowerCase();

      if (
        errorString.includes("anonymous") ||
        errorString.includes(
          "logout was called but the current user is anonymous"
        )
      ) {
        // User is anonymous, which is fine - just clear the cached info silently
        // This is not an error condition, just a no-op
        this.currentCustomerInfo = null;
        return;
      }

      // Only log actual errors, not the anonymous user case
      logger.error(
        "Failed to log out from RevenueCat",
        error,
        "RevenueCatService"
      );
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
      logger.error(
        "Failed to refresh customer info",
        error,
        "RevenueCatService"
      );
      throw error;
    }
  }

  /**
   * Get available offerings (products)
   * Uses caching to avoid repeated network requests
   */
  async getOfferings(forceRefresh = false): Promise<PurchasesOffering | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check cache first (unless force refresh)
    const now = Date.now();
    if (
      !forceRefresh &&
      this.cachedOfferings !== null &&
      now - this.offeringsCacheTimestamp < this.OFFERINGS_CACHE_TTL
    ) {
      logger.debug(
        "Returning cached offerings",
        { age: now - this.offeringsCacheTimestamp },
        "RevenueCatService"
      );
      return this.cachedOfferings;
    }

    // If a fetch is already in progress, return that promise
    if (this.offeringsFetchPromise) {
      logger.debug(
        "Offerings fetch already in progress, waiting...",
        undefined,
        "RevenueCatService"
      );
      return this.offeringsFetchPromise;
    }

    // Create a new fetch promise with timeout
    this.offeringsFetchPromise = (async () => {
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Offerings fetch timeout")),
            this.OFFERINGS_TIMEOUT
          );
        });

        // Race between the actual fetch and timeout
        const offerings = await Promise.race([
          Purchases.getOfferings(),
          timeoutPromise,
        ]);

        // Try to get the specific offering by ID, fall back to current offering
        const currentOfferings =
          offerings.all[OFFERING_IDENTIFIER] || offerings.current;

        // Update cache
        this.cachedOfferings = currentOfferings;
        this.offeringsCacheTimestamp = Date.now();

        logger.debug(
          "Offerings fetched successfully",
          {
            cached: true,
            offeringId: currentOfferings?.identifier || "current",
          },
          "RevenueCatService"
        );

        return currentOfferings;
      } catch (error) {
        // If timeout or other error, try to return cached data if available
        const cacheAge = Date.now() - this.offeringsCacheTimestamp;
        if (
          this.cachedOfferings !== null &&
          cacheAge < this.OFFERINGS_CACHE_TTL * 2
        ) {
          logger.warn(
            "Offerings fetch failed, returning stale cache",
            { error, cacheAge },
            "RevenueCatService"
          );
          return this.cachedOfferings;
        }

        logger.error("Failed to get offerings", error, "RevenueCatService");
        throw error;
      } finally {
        // Clear the fetch promise so a new fetch can be initiated
        this.offeringsFetchPromise = null;
      }
    })();

    return this.offeringsFetchPromise;
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
      const { customerInfo } =
        await Purchases.purchasePackage(packageToPurchase);
      this.currentCustomerInfo = customerInfo;
      return customerInfo;
    } catch (error: unknown) {
      // Safe type checking before accessing PurchasesError properties
      if (error && typeof error === "object" && "userCancelled" in error) {
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
   * Check if user has active subscription (Family Plan)
   */
  async hasActiveSubscription(): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      const activeEntitlements = customerInfo.entitlements.active;
      return (
        activeEntitlements[ENTITLEMENT_IDENTIFIERS.FAMILY_PLAN] !== undefined
      );
    } catch (error) {
      logger.error(
        "Failed to check subscription status",
        error,
        "RevenueCatService"
      );
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
      logger.error(
        "Failed to check Family Plan entitlement",
        error,
        "RevenueCatService"
      );
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

      // Check for Family Plan entitlement
      const entitlement =
        activeEntitlements[ENTITLEMENT_IDENTIFIERS.FAMILY_PLAN];

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
      const subscriptionPeriod: SubscriptionPeriod = productIdentifier.includes(
        "Yearly"
      )
        ? "yearly"
        : "monthly";

      return {
        isActive: true,
        isFamilyPlan: true,
        subscriptionType: "family",
        subscriptionPeriod,
        expirationDate: entitlement.expirationDate
          ? new Date(entitlement.expirationDate)
          : null,
        productIdentifier,
      };
    } catch (error) {
      logger.error(
        "Failed to get subscription status",
        error,
        "RevenueCatService"
      );
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
   * Clear offerings cache
   * Useful when you want to force a refresh on next getOfferings call
   */
  clearOfferingsCache(): void {
    this.cachedOfferings = null;
    this.offeringsCacheTimestamp = 0;
  }

  /**
   * Check if SDK is initialized
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get plan limits for the current subscription
   * Returns Family Plan limits (1 admin + 3 family members = 4 total)
   */
  async getPlanLimits(): Promise<typeof PLAN_LIMITS.FAMILY | null> {
    try {
      const status = await this.getSubscriptionStatus();
      if (!status.isActive) {
        return null;
      }
      return PLAN_LIMITS.FAMILY;
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
      logger.error(
        "Failed to get max family members",
        error,
        "RevenueCatService"
      );
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
      logger.error(
        "Failed to get max total members",
        error,
        "RevenueCatService"
      );
      return 0;
    }
  }
}

export const revenueCatService = new RevenueCatService();
