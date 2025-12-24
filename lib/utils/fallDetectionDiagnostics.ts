/**
 * Fall Detection Diagnostics Utility
 * Provides diagnostic information about fall detection system status
 */

import { Platform } from "react-native";

export interface FallDetectionDiagnostics {
  platform: string;
  sensorsAvailable: boolean;
  permissionsGranted: boolean | null;
  isEnabled: boolean;
  isActive: boolean;
  isInitialized: boolean;
  lastAlert: Date | null;
  recommendations: string[];
}

/**
 * Get diagnostic information about fall detection
 */
export const getFallDetectionDiagnostics = async (
  isEnabled: boolean,
  isActive: boolean,
  isInitialized: boolean,
  lastAlert: Date | null
): Promise<FallDetectionDiagnostics> => {
  const diagnostics: FallDetectionDiagnostics = {
    platform: Platform.OS,
    sensorsAvailable: Platform.OS !== "web",
    permissionsGranted: null,
    isEnabled,
    isActive,
    isInitialized,
    lastAlert,
    recommendations: [],
  };

  // Check permissions
  if (Platform.OS !== "web") {
    try {
      const { motionPermissionService } = await import("@/lib/services/motionPermissionService");
      const hasPermission = await motionPermissionService.hasMotionPermission();
      const status = await motionPermissionService.checkMotionAvailability();
      diagnostics.permissionsGranted = hasPermission && status.available;
    } catch (error) {
      diagnostics.permissionsGranted = false;
    }
  }

  // Generate recommendations
  if (Platform.OS === "web") {
    diagnostics.recommendations.push("Fall detection is not available on web. Use a mobile device.");
  } else if (!diagnostics.permissionsGranted) {
    diagnostics.recommendations.push("Motion permissions are not granted. Go to Settings → Motion Permissions to enable.");
  } else if (!diagnostics.isEnabled) {
    diagnostics.recommendations.push("Fall detection is disabled. Enable it in Settings.");
  } else if (!diagnostics.isActive) {
    diagnostics.recommendations.push("Fall detection is enabled but not active. Check console logs for initialization errors.");
  } else if (!diagnostics.isInitialized) {
    diagnostics.recommendations.push("Fall detection is initializing. Wait a few seconds and check again.");
  } else {
    diagnostics.recommendations.push("Fall detection is working correctly!");
  }

  return diagnostics;
};

/**
 * Log diagnostic information to console
 */
export const logFallDetectionDiagnostics = async (
  isEnabled: boolean,
  isActive: boolean,
  isInitialized: boolean,
  lastAlert: Date | null
): Promise<void> => {
  console.log("\n[FallDetection] 📊 ===== DIAGNOSTICS =====");
  const diagnostics = await getFallDetectionDiagnostics(
    isEnabled,
    isActive,
    isInitialized,
    lastAlert
  );

  console.log("[FallDetection] Platform:", diagnostics.platform);
  console.log("[FallDetection] Sensors Available:", diagnostics.sensorsAvailable);
  console.log("[FallDetection] Permissions Granted:", diagnostics.permissionsGranted);
  console.log("[FallDetection] Enabled:", diagnostics.isEnabled);
  console.log("[FallDetection] Active:", diagnostics.isActive);
  console.log("[FallDetection] Initialized:", diagnostics.isInitialized);
  console.log("[FallDetection] Last Alert:", diagnostics.lastAlert || "Never");

  if (diagnostics.recommendations.length > 0) {
    console.log("[FallDetection] Recommendations:");
    diagnostics.recommendations.forEach((rec, i) => {
      console.log(`[FallDetection]   ${i + 1}. ${rec}`);
    });
  }

  console.log("[FallDetection] ============================\n");
};

