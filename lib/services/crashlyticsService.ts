import { Platform } from "react-native";

// Crashlytics defaults to enabled in production builds unless explicitly disabled.
// Set EXPO_PUBLIC_ENABLE_CRASHLYTICS=false to force-disable.
function isCrashlyticsEnabled(): boolean {
  const envToggle = process.env.EXPO_PUBLIC_ENABLE_CRASHLYTICS;
  if (envToggle === "true") {
    return true;
  }
  if (envToggle === "false") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

type CrashlyticsLike = {
  setCrashlyticsCollectionEnabled: (enabled: boolean) => Promise<void> | void;
  log: (message: string) => void;
  recordError: (error: Error, jsErrorName?: string) => void;
};

/**
 * Checks if React Native Firebase app is ready by verifying the default app exists.
 * This prevents the race condition where Crashlytics tries to access Firebase before initialization.
 */
function isRNFirebaseReady(): boolean {
  if (Platform.OS === "web") {
    return false;
  }

  try {
    // Try to access the React Native Firebase app module
    const rnFirebaseApp = require("@react-native-firebase/app");

    // Check if the default Firebase app exists
    if (typeof rnFirebaseApp === "function") {
      const app = rnFirebaseApp();
      return app != null;
    }

    if (typeof rnFirebaseApp?.default === "function") {
      const app = rnFirebaseApp.default();
      return app != null;
    }

    // If we can require the module, assume it's initialized
    return true;
  } catch {
    // Firebase app module not available or not initialized
    return false;
  }
}

function getCrashlytics(): CrashlyticsLike | null {
  if (Platform.OS === "web" || !isCrashlyticsEnabled()) {
    return null;
  }

  // Ensure Firebase is ready before attempting to load Crashlytics
  // This prevents the "No Firebase App '[DEFAULT]' has been created" error
  if (!isRNFirebaseReady()) {
    return null;
  }

  try {
    const moduleRef = require("@react-native-firebase/crashlytics");
    if (typeof moduleRef === "function") {
      return moduleRef() as CrashlyticsLike;
    }
    if (typeof moduleRef?.default === "function") {
      return moduleRef.default() as CrashlyticsLike;
    }
  } catch {
    // Crashlytics not available in this runtime.
  }

  return null;
}

export async function initializeCrashlytics(): Promise<boolean> {
  try {
    const crashlytics = getCrashlytics();
    if (!crashlytics) {
      return false;
    }

    await crashlytics.setCrashlyticsCollectionEnabled(true);
    crashlytics.log("Crashlytics initialized");
    return true;
  } catch (error) {
    // Silently handle initialization errors - Crashlytics should never crash the app
    // This includes Firebase app not being ready or other initialization issues
    return false;
  }
}

export function recordCrashlyticsError(error: unknown, source = "js_error") {
  try {
    const crashlytics = getCrashlytics();
    if (!crashlytics) {
      return;
    }

    const normalizedError =
      error instanceof Error ? error : new Error(String(error));
    crashlytics.recordError(normalizedError, source);
  } catch {
    // Never throw from error reporter.
    // This includes cases where Firebase is not ready or Crashlytics fails to record
  }
}
