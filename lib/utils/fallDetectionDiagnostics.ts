/**
 * Fall Detection Diagnostics Utility
 * Provides diagnostic information about fall detection system status
 */

import { Platform } from "react-native";
import i18n from "@/lib/i18n";

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
      const { motionPermissionService } = await import(
        "@/lib/services/motionPermissionService"
      );
      const hasPermission = await motionPermissionService.hasMotionPermission();
      const status = await motionPermissionService.checkMotionAvailability();
      diagnostics.permissionsGranted = hasPermission && status.available;
    } catch (error) {
      diagnostics.permissionsGranted = false;
    }
  }

  // Generate recommendations
  if (Platform.OS === "web") {
    diagnostics.recommendations.push(i18n.t("fallDetectionNotAvailableWeb"));
  } else if (!diagnostics.permissionsGranted) {
    diagnostics.recommendations.push(i18n.t("motionPermissionsNotGranted"));
  } else if (!diagnostics.isEnabled) {
    diagnostics.recommendations.push(i18n.t("fallDetectionDisabled"));
  } else if (!diagnostics.isActive) {
    diagnostics.recommendations.push(
      i18n.t("fallDetectionEnabledButNotActive")
    );
  } else if (diagnostics.isInitialized) {
    diagnostics.recommendations.push(i18n.t("fallDetectionWorkingCorrectly"));
  } else {
    diagnostics.recommendations.push(i18n.t("fallDetectionInitializing"));
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
  // Diagnostics output disabled for production
  await getFallDetectionDiagnostics(
    isEnabled,
    isActive,
    isInitialized,
    lastAlert
  );
};
