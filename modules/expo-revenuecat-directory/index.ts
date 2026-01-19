import { Platform } from "react-native";
import ExpoRevenuecatDirectoryModule from "./ExpoRevenuecatDirectoryModule";

/**
 * Ensures the RevenueCat cache directory exists (iOS only)
 * This prevents the NSCocoaErrorDomain Code=4 error that occurs
 * when RevenueCat tries to cache data before the directory exists
 *
 * On Android and other platforms, this is a no-op and returns false
 */
export async function ensureRevenueCatDirectory(): Promise<boolean> {
  // Only run on iOS - Android doesn't have this issue
  if (Platform.OS !== "ios") {
    return false;
  }

  // Check if native module is available
  if (!ExpoRevenuecatDirectoryModule?.ensureDirectory) {
    console.warn(
      "[ExpoRevenuecatDirectory] Native module not available. " +
        "This may cause RevenueCat cache errors. " +
        "Make sure the module is properly linked."
    );
    return false;
  }

  try {
    // Call the native module synchronously
    // The Swift function is synchronous, so we call it directly
    const result = ExpoRevenuecatDirectoryModule.ensureDirectory();

    if (result) {
      console.log("[ExpoRevenuecatDirectory] Directory ensured successfully");
    } else {
      console.warn(
        "[ExpoRevenuecatDirectory] Failed to ensure directory exists. " +
          "RevenueCat may log cache errors, but functionality should not be affected."
      );
    }

    // Return as resolved promise for async/await compatibility
    return Promise.resolve(result);
  } catch (error) {
    console.error(
      "[ExpoRevenuecatDirectory] Error calling native module:",
      error
    );
    // Silently fail - RevenueCat SDK will handle directory creation on retry
    return Promise.resolve(false);
  }
}

export default {
  ensureRevenueCatDirectory,
};
