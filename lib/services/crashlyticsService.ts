import { Platform } from "react-native";

// Crashlytics defaults to enabled in production builds unless explicitly disabled.
// Set EXPO_PUBLIC_ENABLE_CRASHLYTICS=false to force-disable.
function isCrashlyticsEnabled(): boolean {
  const envToggle = process.env.EXPO_PUBLIC_ENABLE_CRASHLYTICS;
  return envToggle === "true";
}

type CrashlyticsLike = {
  setCrashlyticsCollectionEnabled: (enabled: boolean) => Promise<void> | void;
  log: (message: string) => void;
  recordError: (error: Error, jsErrorName?: string) => void;
};

// Track Crashlytics initialization state
let crashlyticsInitialized = false;
let crashlyticsInstance: CrashlyticsLike | null = null;

// Cache the Firebase readiness state to avoid repeated checks
let rnFirebaseReadyCache: boolean | null = null;
let lastCheckTime = 0;
const CHECK_CACHE_DURATION = 1000; // Cache for 1 second

/**
 * Checks if React Native Firebase app is ready by verifying the default app exists.
 * This prevents the race condition where Crashlytics tries to access Firebase before initialization.
 *
 * On native platforms, React Native Firebase initializes automatically via native code.
 * This function safely checks if the native Firebase app is ready without throwing errors.
 */
function isRNFirebaseReady(): boolean {
  if (Platform.OS === "web") {
    return false;
  }

  // Use cached result if available and recent
  const now = Date.now();
  if (
    rnFirebaseReadyCache !== null &&
    now - lastCheckTime < CHECK_CACHE_DURATION
  ) {
    return rnFirebaseReadyCache;
  }

  try {
    // Try to access the React Native Firebase app module
    // Only attempt this on native platforms where the module exists
    // Use a lazy require pattern to prevent bundlers from statically analyzing this at build time
    // This is critical for web builds (Firebase App Hosting) where these modules don't exist
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rnFirebaseAppModule = "@react-native-firebase/app";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rnFirebaseApp = require(rnFirebaseAppModule);

    // Check if the default Firebase app exists by safely calling getApp()
    // This will throw if the app isn't initialized, which we catch below
    let app: any = null;

    if (typeof rnFirebaseApp === "function") {
      try {
        app = rnFirebaseApp();
      } catch {
        // App not initialized yet
        rnFirebaseReadyCache = false;
        lastCheckTime = now;
        return false;
      }
    } else if (typeof rnFirebaseApp?.default === "function") {
      try {
        app = rnFirebaseApp.default();
      } catch {
        // App not initialized yet
        rnFirebaseReadyCache = false;
        lastCheckTime = now;
        return false;
      }
    } else if (rnFirebaseApp?.app) {
      // Try accessing via .app() method
      try {
        app = rnFirebaseApp.app();
      } catch {
        rnFirebaseReadyCache = false;
        lastCheckTime = now;
        return false;
      }
    }

    // Verify app exists and has required properties
    const isReady = app != null && typeof app === "object";
    rnFirebaseReadyCache = isReady;
    lastCheckTime = now;
    return isReady;
  } catch (error) {
    // Firebase app module not available, not initialized, or error accessing it
    // This is expected during early startup before native Firebase initializes
    rnFirebaseReadyCache = false;
    lastCheckTime = now;
    return false;
  }
}

function getCrashlytics(): CrashlyticsLike | null {
  // Fast path: if Crashlytics has been successfully initialized, use cached instance
  if (crashlyticsInitialized && crashlyticsInstance) {
    return crashlyticsInstance;
  }

  if (Platform.OS === "web" || !isCrashlyticsEnabled()) {
    return null;
  }

  // Ensure Firebase is ready before attempting to load Crashlytics
  // This prevents the "No Firebase App '[DEFAULT]' has been created" error
  if (!isRNFirebaseReady()) {
    return null;
  }

  try {
    // Use a lazy require pattern to prevent bundlers from statically analyzing this at build time
    // This is critical for web builds (Firebase App Hosting) where these modules don't exist
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crashlyticsModule = "@react-native-firebase/crashlytics";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const moduleRef = require(crashlyticsModule);

    // Safely get Crashlytics instance - wrap in try-catch to handle
    // any errors during module access or initialization
    let crashlytics: CrashlyticsLike | null = null;

    try {
      if (typeof moduleRef === "function") {
        crashlytics = moduleRef() as CrashlyticsLike;
      } else if (typeof moduleRef?.default === "function") {
        crashlytics = moduleRef.default() as CrashlyticsLike;
      } else if (moduleRef?.crashlytics) {
        crashlytics = moduleRef.crashlytics() as CrashlyticsLike;
      }

      // Verify the crashlytics instance is valid
      if (crashlytics && typeof crashlytics.recordError === "function") {
        // Cache the instance for future use
        crashlyticsInstance = crashlytics;
        return crashlytics;
      }
    } catch (error) {
      // Error accessing Crashlytics - likely Firebase not fully initialized
      // Silently return null - this is expected during early startup
      return null;
    }
  } catch {
    // Crashlytics module not available in this runtime or not installed
    return null;
  }

  return null;
}

/**
 * Reset the Firebase readiness cache to force a fresh check.
 * Call this when Firebase initialization completes to ensure Crashlytics
 * can start working immediately.
 */
export function resetFirebaseReadyCache(): void {
  rnFirebaseReadyCache = null;
  lastCheckTime = 0;
}

/**
 * Check if Crashlytics has been successfully initialized.
 * This is a fast check that doesn't require Firebase readiness checks.
 */
export function isCrashlyticsInitialized(): boolean {
  return crashlyticsInitialized && crashlyticsInstance !== null;
}

export async function initializeCrashlytics(): Promise<boolean> {
  // If already initialized, return true
  if (crashlyticsInitialized && crashlyticsInstance) {
    return true;
  }

  try {
    // Reset cache before initialization to ensure we check Firebase readiness fresh
    resetFirebaseReadyCache();

    const crashlytics = getCrashlytics();
    if (!crashlytics) {
      return false;
    }

    // Initialize Crashlytics collection
    await crashlytics.setCrashlyticsCollectionEnabled(true);
    crashlytics.log("Crashlytics initialized");

    // Mark as initialized and cache the instance
    crashlyticsInitialized = true;
    crashlyticsInstance = crashlytics;

    // Mark Firebase as ready in cache after successful initialization
    rnFirebaseReadyCache = true;
    lastCheckTime = Date.now();

    return true;
  } catch (error) {
    // Silently handle initialization errors - Crashlytics should never crash the app
    // This includes Firebase app not being ready or other initialization issues
    crashlyticsInitialized = false;
    crashlyticsInstance = null;
    return false;
  }
}

export function recordCrashlyticsError(error: unknown, source = "js_error") {
  // Never throw from error reporter - this is critical for error handlers
  // that might be called before Firebase is initialized

  // Fast path: if Crashlytics hasn't been initialized yet, skip silently
  // This prevents any Firebase access attempts during early startup
  if (!crashlyticsInitialized) {
    return;
  }

  try {
    // Use cached instance if available (fastest path)
    let crashlytics = crashlyticsInstance;

    // If no cached instance, try to get one (but only if initialized)
    if (!crashlytics) {
      // Double-check Firebase is ready before attempting to record
      // This prevents errors during early startup
      if (!isRNFirebaseReady()) {
        return;
      }

      crashlytics = getCrashlytics();
      if (!crashlytics) {
        return;
      }
    }

    const normalizedError =
      error instanceof Error ? error : new Error(String(error));

    // Wrap recordError in try-catch as it might fail if Firebase
    // becomes unavailable between the check and the call
    try {
      crashlytics.recordError(normalizedError, source);
    } catch (recordError) {
      // Silently handle recording errors - never crash the app
      // This can happen if Firebase becomes unavailable or Crashlytics
      // encounters an internal error
      // Reset initialization state if recording fails consistently
      if (
        recordError instanceof Error &&
        recordError.message?.includes("Firebase App") &&
        recordError.message?.includes("not been created")
      ) {
        // Firebase became unavailable - reset state
        crashlyticsInitialized = false;
        crashlyticsInstance = null;
      }
    }
  } catch {
    // Never throw from error reporter.
    // This includes cases where Firebase is not ready or Crashlytics fails to record
    // This is especially important during early startup before Firebase initializes
  }
}
