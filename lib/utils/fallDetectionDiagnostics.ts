/**
 * Fall detection diagnostics — logs sensor availability and detection
 * configuration for debugging purposes.
 */

import { Platform } from "react-native";
import { Accelerometer } from "expo-sensors";
import { logger } from "./logger";

export interface FallDetectionDiagnostics {
  platform: string;
  accelerometerAvailable: boolean;
  isRunning: boolean;
  sampleIntervalMs: number;
  listenerCount: number;
}

/**
 * Logs fall detection configuration and sensor status to the console.
 * Useful for debugging on-device fall detection issues.
 */
export async function logFallDetectionDiagnostics(
  isRunning: boolean,
  listenerCount: number
): Promise<FallDetectionDiagnostics> {
  let accelerometerAvailable = false;
  try {
    accelerometerAvailable = await Accelerometer.isAvailableAsync();
  } catch {
    // Not available in web or simulator
  }

  const diag: FallDetectionDiagnostics = {
    platform: Platform.OS,
    accelerometerAvailable,
    isRunning,
    sampleIntervalMs: 100,
    listenerCount,
  };

  logger.debug(
    "FallDetection diagnostics",
    diag,
    "fallDetectionDiagnostics"
  );

  if (!accelerometerAvailable) {
    logger.warn(
      "Accelerometer not available — fall detection disabled",
      { platform: Platform.OS },
      "fallDetectionDiagnostics"
    );
  }

  return diag;
}
