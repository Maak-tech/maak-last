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

function getCrashlytics(): CrashlyticsLike | null {
  if (Platform.OS === "web" || !isCrashlyticsEnabled()) {
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
  const crashlytics = getCrashlytics();
  if (!crashlytics) {
    return false;
  }

  try {
    await crashlytics.setCrashlyticsCollectionEnabled(true);
    crashlytics.log("Crashlytics initialized");
    return true;
  } catch {
    return false;
  }
}

export function recordCrashlyticsError(error: unknown, source = "js_error") {
  const crashlytics = getCrashlytics();
  if (!crashlytics) {
    return;
  }

  try {
    const normalizedError =
      error instanceof Error ? error : new Error(String(error));
    crashlytics.recordError(normalizedError, source);
  } catch {
    // Never throw from error reporter.
  }
}
