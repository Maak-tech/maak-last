/**
 * Motion Permission Service
 * Handles checking and requesting motion/fitness permissions for fall detection
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Alert, Linking, Platform } from "react-native";

const MOTION_PERMISSION_STORAGE_KEY = "motion_permission_granted";

export interface MotionPermissionStatus {
  available: boolean;
  granted: boolean;
  reason?: string;
}

/**
 * Check if motion sensors are available
 */
export const checkMotionAvailability =
  async (): Promise<MotionPermissionStatus> => {
    console.log("[MotionPermissionService] 🔍 Checking motion availability...");
    console.log("[MotionPermissionService] 📱 Platform:", Platform.OS);

    if (Platform.OS === "web") {
      console.log(
        "[MotionPermissionService] ⚠️ Web platform - motion sensors not available"
      );
      return {
        available: false,
        granted: false,
        reason: "Motion sensors are not available on web",
      };
    }

    try {
      console.log("[MotionPermissionService] 📦 Importing expo-sensors...");
      const { DeviceMotion } = await import("expo-sensors");
      console.log("[MotionPermissionService] ✅ expo-sensors imported");

      // Check if DeviceMotion is available
      console.log(
        "[MotionPermissionService] 🔍 Checking DeviceMotion.isAvailableAsync()..."
      );
      const availabilityPromise = DeviceMotion.isAvailableAsync();
      const timeoutPromise = new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 3000)
      );

      const isAvailable = (await Promise.race([
        availabilityPromise,
        timeoutPromise,
      ])) as boolean;

      console.log(
        "[MotionPermissionService] 📊 DeviceMotion available:",
        isAvailable
      );

      if (!isAvailable) {
        console.error(
          "[MotionPermissionService] ❌ Motion sensors not available on this device"
        );
        return {
          available: false,
          granted: false,
          reason: "Motion sensors are not available on this device",
        };
      }

      // Check if we've previously stored permission status
      console.log(
        "[MotionPermissionService] 📂 Checking stored permission status..."
      );
      const storedPermission = await AsyncStorage.getItem(
        MOTION_PERMISSION_STORAGE_KEY
      );
      const hasStoredPermission = storedPermission === "true";
      console.log(
        "[MotionPermissionService] 📂 Stored permission:",
        hasStoredPermission
      );

      // On iOS, permissions are requested automatically when accessing DeviceMotion
      // We can't directly check permission status, so we'll try to access it
      // On Android, activity recognition permissions are needed

      const result = {
        available: true,
        granted: hasStoredPermission, // We'll update this when permission is actually granted
      };

      console.log(
        "[MotionPermissionService] ✅ Motion availability check complete:",
        result
      );
      return result;
    } catch (error: any) {
      console.error(
        "[MotionPermissionService] ❌ Error checking motion availability:",
        error
      );
      return {
        available: false,
        granted: false,
        reason: error.message || "Failed to check motion sensor availability",
      };
    }
  };

/**
 * Request motion permissions by attempting to initialize DeviceMotion
 * This will trigger the iOS permission dialog if not already granted
 */
export const requestMotionPermission = async (): Promise<boolean> => {
  console.log("[MotionPermissionService] 🔐 Requesting motion permission...");

  if (Platform.OS === "web") {
    console.log("[MotionPermissionService] ⚠️ Cannot request permission on web");
    return false;
  }

  try {
    console.log("[MotionPermissionService] 📦 Importing expo-sensors...");
    const { DeviceMotion } = await import("expo-sensors");

    // Check availability first
    console.log("[MotionPermissionService] 🔍 Checking availability...");
    const isAvailable = await DeviceMotion.isAvailableAsync();
    console.log("[MotionPermissionService] 📊 Available:", isAvailable);

    if (!isAvailable) {
      console.error("[MotionPermissionService] ❌ DeviceMotion not available");
      return false;
    }

    // Set update interval (this may trigger permission request on iOS)
    console.log("[MotionPermissionService] ⚙️ Setting update interval...");
    DeviceMotion.setUpdateInterval(1000);

    // Try to add a listener briefly to trigger permission request
    // On iOS, this will show the permission dialog if not already granted
    console.log(
      "[MotionPermissionService] 👂 Adding listener to trigger permission dialog..."
    );
    const subscription = DeviceMotion.addListener(() => {
      // Just listening to trigger permission
      console.log(
        "[MotionPermissionService] 📊 Sensor data received - permission likely granted"
      );
    });

    // Wait a moment to ensure permission dialog appears
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Remove listener immediately
    console.log("[MotionPermissionService] 🛑 Removing listener...");
    subscription.remove();

    // Store that we've attempted to request permission
    console.log("[MotionPermissionService] 💾 Saving permission status...");
    await AsyncStorage.setItem(MOTION_PERMISSION_STORAGE_KEY, "true");

    console.log("[MotionPermissionService] ✅ Permission request completed");
    return true;
  } catch (error: any) {
    console.error(
      "[MotionPermissionService] ❌ Error requesting permission:",
      error
    );
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
    const url = `package:${Constants.expoConfig?.android?.package || "com.maak.health"}`;
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
    console.log("[MotionPermissionService] 🔍 Checking stored permission...");
    const storedPermission = await AsyncStorage.getItem(
      MOTION_PERMISSION_STORAGE_KEY
    );
    const hasPermission = storedPermission === "true";
    console.log(
      "[MotionPermissionService] 📂 Stored permission:",
      hasPermission
    );
    return hasPermission;
  } catch (error) {
    console.error(
      "[MotionPermissionService] ❌ Error checking permission:",
      error
    );
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
