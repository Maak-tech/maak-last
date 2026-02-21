/**
 * App Tracking Transparency (ATT) Service
 *
 * Handles requesting and checking user permission for tracking
 * as required by Apple's App Tracking Transparency framework.
 *
 * This is required when:
 * - App collects data used for tracking (linking with third-party data for advertising)
 * - App shares data with data brokers
 * - App privacy information indicates tracking
 */

import { Platform } from "react-native";
import { logger } from "@/lib/utils/logger";

// Lazy-load tracking transparency module to handle cases where native module isn't available
let TrackingTransparency: typeof import("expo-tracking-transparency") | null =
  null;
let moduleLoadAttempted = false;

/**
 * Lazy-load the tracking transparency module
 * Returns null if module is not available (e.g., Android, or native module not linked)
 */
function getTrackingTransparencyModule():
  | typeof import("expo-tracking-transparency")
  | null {
  // Only attempt to load on iOS - Android doesn't support ATT
  if (Platform.OS !== "ios") {
    return null;
  }

  // If already attempted and failed, return null
  if (moduleLoadAttempted && !TrackingTransparency) {
    return null;
  }

  // If already loaded, return it
  if (TrackingTransparency) {
    return TrackingTransparency;
  }

  // Attempt to load the module with defensive error handling
  // Wrap in an immediately invoked function to isolate errors
  try {
    moduleLoadAttempted = true;

    // Use a function that isolates the require call
    const loadModuleSafely = ():
      | typeof import("expo-tracking-transparency")
      | null => {
      try {
        // Wrap require in try-catch to catch synchronous errors
        const module = require("expo-tracking-transparency");

        // Verify the module has the expected exports
        if (
          typeof module.getTrackingPermissionsAsync !== "function" ||
          typeof module.requestTrackingPermissionsAsync !== "function"
        ) {
          return null;
        }

        return module;
      } catch (err) {
        // Check if it's a native module error
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (
          errorMessage.includes("Cannot find native module") ||
          errorMessage.includes("ExpoTrackingTransparency") ||
          errorMessage.includes("Native module")
        ) {
          // Native module not linked - expected if app hasn't been rebuilt
          return null;
        }
        // For other errors, return null but don't throw
        return null;
      }
    };

    // Call the safe loader
    const module = loadModuleSafely();

    if (!module) {
      TrackingTransparency = null;
      return null;
    }

    TrackingTransparency = module;
    return TrackingTransparency;
  } catch (error) {
    // Catch any errors that slip through
    // This should rarely happen, but we want to be defensive
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Silently handle native module errors - they're expected until rebuild
    if (
      errorMessage.includes("Cannot find native module") ||
      errorMessage.includes("ExpoTrackingTransparency")
    ) {
      TrackingTransparency = null;
      return null;
    }

    // Log unexpected errors in development only
    if (process.env.NODE_ENV === "development") {
      logger.debug(
        "Tracking transparency module load failed",
        { message: errorMessage },
        "trackingTransparencyService"
      );
    }

    TrackingTransparency = null;
    return null;
  }
}

export type TrackingPermissionStatus =
  | "undetermined"
  | "restricted"
  | "denied"
  | "authorized";

/**
 * Get the current tracking permission status
 * @returns Promise resolving to the current permission status
 */
export async function getTrackingPermissionStatus(): Promise<TrackingPermissionStatus> {
  // Only applicable on iOS
  if (Platform.OS !== "ios") {
    return "authorized"; // Android doesn't use ATT
  }

  // Lazy-load module and check if available
  const module = getTrackingTransparencyModule();
  if (!module) {
    return "authorized"; // Return authorized to not block app functionality
  }

  try {
    const status = await module.getTrackingPermissionsAsync();
    return status.status as TrackingPermissionStatus;
  } catch (error) {
    logger.error(
      "Failed to get tracking permission status",
      error,
      "trackingTransparencyService"
    );
    return "denied"; // Default to denied on error
  }
}

/**
 * Request tracking permission from the user
 * This will show the ATT permission dialog on iOS
 * @returns Promise resolving to the permission status after request
 */
export async function requestTrackingPermission(): Promise<TrackingPermissionStatus> {
  // Only applicable on iOS
  if (Platform.OS !== "ios") {
    return "authorized"; // Android doesn't use ATT
  }

  // Lazy-load module and check if available
  const module = getTrackingTransparencyModule();
  if (!module) {
    return "authorized"; // Return authorized to not block app functionality
  }

  try {
    // Check current status first
    const currentStatus = await getTrackingPermissionStatus();

    // If already determined, return current status
    if (currentStatus !== "undetermined") {
      return currentStatus;
    }

    // Request permission - this will show the system dialog
    const result = await module.requestTrackingPermissionsAsync();
    const status = result.status as TrackingPermissionStatus;

    logger.info(
      "Tracking permission requested",
      { status },
      "trackingTransparencyService"
    );

    return status;
  } catch (error) {
    logger.error(
      "Failed to request tracking permission",
      error,
      "trackingTransparencyService"
    );
    return "denied"; // Default to denied on error
  }
}

/**
 * Check if tracking is currently authorized
 * @returns Promise resolving to true if tracking is authorized
 */
export async function isTrackingAuthorized(): Promise<boolean> {
  const status = await getTrackingPermissionStatus();
  return status === "authorized";
}

/**
 * Initialize tracking transparency
 * Should be called early in the app lifecycle, ideally after user authentication
 * but before any tracking data collection begins
 * @returns Promise resolving to the permission status
 */
export async function initializeTrackingTransparency(): Promise<TrackingPermissionStatus> {
  if (Platform.OS !== "ios") {
    return "authorized";
  }

  // Lazy-load module and check if available
  const module = getTrackingTransparencyModule();
  if (!module) {
    logger.warn(
      "Tracking transparency module not available - skipping initialization",
      undefined,
      "trackingTransparencyService"
    );
    return "authorized";
  }

  try {
    // Request permission if not already determined
    return await requestTrackingPermission();
  } catch (error) {
    logger.error(
      "Failed to initialize tracking transparency",
      error,
      "trackingTransparencyService"
    );
    return "denied";
  }
}

export const trackingTransparencyService = {
  getTrackingPermissionStatus,
  requestTrackingPermission,
  isTrackingAuthorized,
  initializeTrackingTransparency,
};
