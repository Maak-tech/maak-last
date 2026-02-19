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

type LogHandler = Parameters<typeof Purchases.setLogHandler>[0];

// RevenueCat API Key - Load from environment variables
// Use production key in production builds, test key in development
const getRevenueCatApiKey = (): string => {
  // Check app config first (from environment variables)
  const config = Constants.expoConfig?.extra;

  // Prefer platform-specific keys when available to avoid using an iOS key on Android (or vice versa).
  const envKey =
    Platform.OS === "ios"
      ? (config?.revenueCatApiKeyIos as unknown)
      : Platform.OS === "android"
        ? (config?.revenueCatApiKeyAndroid as unknown)
        : (config?.revenueCatApiKey as unknown);

  // If environment variable is set and not empty, use it
  if (envKey && typeof envKey === "string" && envKey.trim() !== "") {
    const trimmedKey = envKey.trim();

    // Hard fail on secret keys passed to the client SDK.
    // Purchases.configure expects the *public* SDK key (appl_ for iOS, goog_ for Android).
    if (trimmedKey.startsWith("sk_")) {
      const msg =
        "CRITICAL: RevenueCat secret key (sk_) detected in the client bundle. " +
        "Use the public SDK API key instead (appl_ for iOS, goog_ for Android).";

      if (IS_DEV) {
        logger.error(msg, undefined, "RevenueCatService");
        // In dev, fall back so local builds don't hard crash.
        return "test_vluBajsHEoAjMjzoArPVpklOCRc";
      }

      // In production, do not attempt initialization with an invalid key.
      return "";
    }

    // Warn if using test key in production build
    if (!IS_DEV && trimmedKey.startsWith("test_")) {
      logger.error(
        "CRITICAL: Test RevenueCat API key detected in production build! " +
          "This will cause App Store rejection. Please set PUBLIC_REVENUECAT_IOS_API_KEY / PUBLIC_REVENUECAT_ANDROID_API_KEY (or PUBLIC_REVENUECAT_API_KEY) with a production key.",
        undefined,
        "RevenueCatService"
      );
    }

    // Guard against wrong-store key on each platform (common production failure).
    if (Platform.OS === "android" && trimmedKey.startsWith("appl_")) {
      logger.error(
        "CRITICAL: iOS RevenueCat public key (appl_) detected on Android build. " +
          "Set PUBLIC_REVENUECAT_ANDROID_API_KEY (goog_) for Android production builds.",
        undefined,
        "RevenueCatService"
      );
      return "";
    }

    if (Platform.OS === "ios" && trimmedKey.startsWith("goog_")) {
      logger.error(
        "CRITICAL: Android RevenueCat public key (goog_) detected on iOS build. " +
          "Set PUBLIC_REVENUECAT_IOS_API_KEY (appl_) for iOS production builds.",
        undefined,
        "RevenueCatService"
      );
      return "";
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

const describeRevenueCatKey = (key: string): string => {
  if (!key) {
    return "missing";
  }
  if (key.startsWith("appl_")) {
    return "appl_ (iOS public)";
  }
  if (key.startsWith("goog_")) {
    return "goog_ (Android public)";
  }
  if (key.startsWith("test_")) {
    return "test_ (dev)";
  }
  if (key.startsWith("sk_")) {
    return "sk_ (secret - invalid for client SDK)";
  }
  return "unknown";
};

// Product identifiers
// Only Family Plan is available (monthly and yearly)
export const PRODUCT_IDENTIFIERS = {
  FAMILY_MONTHLY: "Family_Monthly_Premium",
  FAMILY_YEARLY: "Family_Yearly_Premium",
} as const;

const getRevenueCatEntitlementId = (): string => {
  const configured = Constants.expoConfig?.extra?.revenueCatEntitlementId;
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim();
  }
  return "Family Plan of 4";
};

const getRevenueCatOfferingId = (): string => {
  const configured = Constants.expoConfig?.extra?.revenueCatOfferingId;
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim();
  }
  return "ofrng88ce8c174f";
};

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
        // Set custom log handler before configure to suppress known config errors
        // (offerings empty when products aren't in App Store Connect / StoreKit config)
        const customLogHandler: LogHandler = (level, message) => {
          const isOfferingsConfigError =
            typeof message === "string" &&
            (message.includes("None of the products registered") ||
              message.includes("why-are-offerings-empty") ||
              message.includes("There's a problem with your configuration") ||
              (message.includes("Error fetching offerings") &&
                message.includes("OfferingsManager")));
          if (isOfferingsConfigError) {
            // Downgrade to debug - we handle this gracefully in getOfferings()
            return;
          }
          switch (level) {
            case Purchases.LOG_LEVEL.DEBUG:
              logger.debug(message, undefined, "RevenueCat");
              break;
            case Purchases.LOG_LEVEL.INFO:
              logger.info(message, undefined, "RevenueCat");
              break;
            case Purchases.LOG_LEVEL.WARN:
              logger.warn(message, undefined, "RevenueCat");
              break;
            case Purchases.LOG_LEVEL.ERROR:
              logger.error(message, undefined, "RevenueCat");
              break;
            default:
              logger.info(message, undefined, "RevenueCat");
          }
        };
        Purchases.setLogHandler(customLogHandler);

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
              "Please set PUBLIC_REVENUECAT_IOS_API_KEY / PUBLIC_REVENUECAT_ANDROID_API_KEY (or PUBLIC_REVENUECAT_API_KEY) in your environment variables or EAS secrets.";

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
          logger.info(
            "Configuring RevenueCat",
            {
              platform: Platform.OS,
              isDev: IS_DEV,
              keyType: describeRevenueCatKey(REVENUECAT_API_KEY),
            },
            "RevenueCatService"
          );
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
        Purchases.setLogLevel(
          IS_DEV ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN
        );

        this.isInitialized = true;
      } catch (error) {
        logger.error(
          "RevenueCat initialization failed",
          error,
          "RevenueCatService"
        );
        // Clear the promise on error so it can be retried
        this.initializationPromise = null;
        // Preserve the original error message for debugging without leaking secrets.
        const safeMessage =
          error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to initialize RevenueCat SDK: ${safeMessage}`);
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
        // Create a timeout promise and clear it when race settles to avoid
        // unhandled rejection from the losing timeout branch.
        let offeringsTimeout: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          offeringsTimeout = setTimeout(
            () => reject(new Error("Offerings fetch timeout")),
            this.OFFERINGS_TIMEOUT
          );
        });

        // Race between the actual fetch and timeout
        const offerings = await Promise.race([
          Purchases.getOfferings(),
          timeoutPromise,
        ]).finally(() => {
          if (offeringsTimeout) {
            clearTimeout(offeringsTimeout);
          }
        });

        // Try to get the specific offering by ID, fall back to current offering
        const offeringId = getRevenueCatOfferingId();
        const currentOfferings = offerings.all[offeringId] || offerings.current;

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

        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Treat empty/offering-config issues as non-fatal to avoid spamming hard errors.
        if (
          errorMessage.includes("None of the products registered") ||
          errorMessage.includes("why-are-offerings-empty") ||
          errorMessage.includes("There is an issue with your configuration")
        ) {
          logger.warn(
            "RevenueCat offerings unavailable due to dashboard/App Store configuration",
            { errorMessage },
            "RevenueCatService"
          );
          return null;
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
      const entitlementId = getRevenueCatEntitlementId();
      return activeEntitlements[entitlementId] !== undefined;
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
      const entitlementId = getRevenueCatEntitlementId();
      const entitlement = customerInfo.entitlements.active[entitlementId];
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
      const entitlementId = getRevenueCatEntitlementId();
      const entitlement = activeEntitlements[entitlementId];

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
