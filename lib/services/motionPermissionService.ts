/**
 * Motion Permission Service
 * Handles checking and requesting motion/fitness permissions for fall detection
 */

import { Platform, Linking, Alert } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MOTION_PERMISSION_STORAGE_KEY = "motion_permission_granted";

export interface MotionPermissionStatus {
  available: boolean;
  granted: boolean;
  reason?: string;
}

/**
 * Check if motion sensors are available
 */
export const checkMotionAvailability = async (): Promise<MotionPermissionStatus> => {
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
    const storedPermission = await AsyncStorage.getItem(MOTION_PERMISSION_STORAGE_KEY);
    const hasStoredPermission = storedPermission === "true";

    // On iOS, permissions are requested automatically when accessing DeviceMotion
    // We can't directly check permission status, so we'll try to access it
    // On Android, activity recognition permissions are needed
    
    return {
      available: true,
      granted: hasStoredPermission, // We'll update this when permission is actually granted
    };
  } catch (error: any) {
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

    // Remove listener immediately
    subscription.remove();

    // Store that we've attempted to request permission
    await AsyncStorage.setItem(MOTION_PERMISSION_STORAGE_KEY, "true");

    return true;
  } catch (error) {
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
    const storedPermission = await AsyncStorage.getItem(MOTION_PERMISSION_STORAGE_KEY);
    return storedPermission === "true";
  } catch {
    return false;
  }
};

/**
 * Save motion permission status
 */
export const saveMotionPermissionStatus = async (granted: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(MOTION_PERMISSION_STORAGE_KEY, granted.toString());
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

