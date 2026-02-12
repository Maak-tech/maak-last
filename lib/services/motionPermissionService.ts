/**
 * Motion Permission Service
 * Handles checking and requesting motion/fitness permissions for fall detection
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Alert, Linking, Platform } from "react-native";

const MOTION_PERMISSION_STORAGE_KEY = "motion_permission_granted";

export type MotionPermissionStatus = {
  available: boolean;
  granted: boolean;
  reason?: string;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Failed to check motion sensor availability";
};

const verifyMotionAccess = async (): Promise<boolean> => {
  const { DeviceMotion } = await import("expo-sensors");

  DeviceMotion.setUpdateInterval(250);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const complete = (granted: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(granted);
    };

    const timeoutId = setTimeout(() => {
      if (subscription) {
        try {
          subscription.remove();
        } catch {
          // Ignore cleanup errors.
        }
      }
      complete(false);
    }, 1500);

    const subscription = DeviceMotion.addListener(() => {
      // Receiving any DeviceMotion callback means motion access is active.
      clearTimeout(timeoutId);
      try {
        subscription.remove();
      } catch {
        // Ignore cleanup errors.
      }
      complete(true);
    });
  });
};

/**
 * Check if motion sensors are available
 */
export const checkMotionAvailability =
  async (): Promise<MotionPermissionStatus> => {
    if (Platform.OS === "web") {
      return {
        available: false,
        granted: false,
        reason: "Motion sensors are not available on web",
      };
    }

    try {
      const { DeviceMotion } = await import("expo-sensors");

      // Check if DeviceMotion is available
      const availabilityPromise = DeviceMotion.isAvailableAsync();
      const timeoutPromise = new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 3000)
      );

      const isAvailable = (await Promise.race([
        availabilityPromise,
        timeoutPromise,
      ])) as boolean;

      if (!isAvailable) {
        return {
          available: false,
          granted: false,
          reason: "Motion sensors are not available on this device",
        };
      }

      // Check if we've previously stored permission status
      const storedPermission = await AsyncStorage.getItem(
        MOTION_PERMISSION_STORAGE_KEY
      );
      const hasStoredPermission = storedPermission === "true";

      // On iOS, permissions are requested automatically when accessing DeviceMotion
      // We can't directly check permission status, so we'll try to access it
      // On Android, activity recognition permissions are needed

      let granted = hasStoredPermission;
      if (!hasStoredPermission) {
        try {
          granted = await verifyMotionAccess();
          if (granted) {
            await AsyncStorage.setItem(MOTION_PERMISSION_STORAGE_KEY, "true");
          }
        } catch {
          granted = false;
        }
      }

      const result = {
        available: true,
        granted,
      };

      return result;
    } catch (error: unknown) {
      return {
        available: false,
        granted: false,
        reason: getErrorMessage(error),
      };
    }
  };

/**
 * Request motion permissions by attempting to initialize DeviceMotion
 * This will trigger the iOS permission dialog if not already granted
 */
export const requestMotionPermission = async (): Promise<boolean> => {
  if (Platform.OS === "web") {
    return false;
  }

  try {
    const { DeviceMotion } = await import("expo-sensors");

    // Check availability first
    const isAvailable = await DeviceMotion.isAvailableAsync();

    if (!isAvailable) {
      return false;
    }

    // Set update interval (this may trigger permission request on iOS)
    DeviceMotion.setUpdateInterval(1000);

    // Try to add a listener briefly to trigger permission request
    // On iOS, this will show the permission dialog if not already granted
    const subscription = DeviceMotion.addListener(() => {
      // Just listening to trigger permission
    });

    // Wait a moment to ensure permission dialog appears
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Remove listener immediately
    subscription.remove();

    // Verify permission by confirming motion events are actually delivered.
    const granted = await verifyMotionAccess();
    await AsyncStorage.setItem(
      MOTION_PERMISSION_STORAGE_KEY,
      granted ? "true" : "false"
    );

    return granted;
  } catch (_error: unknown) {
    return false;
  }
};

/**
 * Open device settings for motion permissions
 */
export const openMotionSettings = async () => {
  if (Platform.OS === "ios") {
    const url = "app-settings:";
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        "Open Settings",
        "Please go to Settings → Privacy & Security → Motion & Fitness → Maak Health and enable motion access."
      );
    }
  } else {
    // Android - open app settings
    const url = `package:${Constants.expoConfig?.android?.package || "com.maaktech.maak"}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        "Open Settings",
        "Please go to Settings → Apps → Maak Health → Permissions and enable Activity Recognition."
      );
    }
  }
};

/**
 * Check if motion permission has been granted
 */
export const hasMotionPermission = async (): Promise<boolean> => {
  try {
    const storedPermission = await AsyncStorage.getItem(
      MOTION_PERMISSION_STORAGE_KEY
    );
    const hasPermission = storedPermission === "true";
    return hasPermission;
  } catch (_error) {
    return false;
  }
};

/**
 * Save motion permission status
 */
export const saveMotionPermissionStatus = async (
  granted: boolean
): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      MOTION_PERMISSION_STORAGE_KEY,
      granted.toString()
    );
  } catch {
    // Silently handle error
  }
};

export const motionPermissionService = {
  checkMotionAvailability,
  requestMotionPermission,
  openMotionSettings,
  hasMotionPermission,
  saveMotionPermissionStatus,
};
