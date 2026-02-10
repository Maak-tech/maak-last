import { Platform } from "react-native";

// Safety gate: keep Crashlytics disabled unless explicitly enabled via env.
// This prevents startup regressions from native module initialization issues.
const CRASHLYTICS_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_CRASHLYTICS === "true";

type CrashlyticsLike = {
  setCrashlyticsCollectionEnabled: (enabled: boolean) => Promise<void> | void;
  log: (message: string) => void;
  recordError: (error: Error, jsErrorName?: string) => void;
};

function getCrashlytics(): CrashlyticsLike | null {
  if (Platform.OS === "web" || !CRASHLYTICS_ENABLED) {
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
