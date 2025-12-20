/**
 * Apple Health Service
 * iOS HealthKit integration using react-native-health
 */

import { Platform } from "react-native";
import type {
  NormalizedMetricPayload,
  MetricSample,
  ProviderAvailability,
} from "../health/healthTypes";
import {
  getMetricByKey,
  type HealthMetric,
} from "../health/healthMetricsCatalog";

// Import react-native-health
let AppleHealthKit: any = null;
if (Platform.OS === "ios") {
  try {
    AppleHealthKit = require("react-native-health").default;
  } catch (error) {
    // Silently handle error
  }
}

/**
 * Check if Apple Health is available
 */
const isAvailable = async (): Promise<ProviderAvailability> => {
  if (Platform.OS !== "ios") {
    return {
      available: false,
      reason: "Apple Health is only available on iOS",
    };
  }

  if (!AppleHealthKit) {
    return {
      available: false,
      reason: "HealthKit library not available",
    };
  }

  try {
    const available = await AppleHealthKit.isAvailable();
    return {
      available,
      reason: available ? undefined : "HealthKit is not available on this device",
    };
  } catch (error: any) {
    return {
      available: false,
      reason: error.message || "Failed to check HealthKit availability",
    };
  }
};

/**
 * Request authorization for selected metrics
 */
const requestAuthorization = async (
  selectedMetrics: string[]
): Promise<{ granted: string[]; denied: string[] }> => {
  if (!AppleHealthKit) {
    throw new Error("HealthKit library not available");
  }

  // Map metric keys to HealthKit types
  const readPermissions = selectedMetrics
    .map((key) => {
      const metric = getMetricByKey(key);
      return metric?.appleHealth?.type;
    })
    .filter(Boolean) as string[];

  try {
    // Request permissions (read-only, we never write)
    await AppleHealthKit.initHealthKit(
      {
        permissions: {
          read: readPermissions,
          write: [], // We only read, never write
        },
      },
        (error: any) => {
          if (error) {
            throw error;
          }
      }
    );

    // Check which permissions were actually granted
    const granted: string[] = [];
    const denied: string[] = [];

    // Note: iOS doesn't provide a direct way to check read permissions
    // We'll assume all requested permissions were granted if initHealthKit succeeded
    // The user can deny individual metrics in iOS Settings
    for (const metricKey of selectedMetrics) {
      // Try to fetch a sample to verify access
      const metric = getMetricByKey(metricKey);
      if (metric?.appleHealth?.type) {
        // For now, assume granted if initHealthKit succeeded
        // In production, you might want to try fetching a sample to verify
        granted.push(metricKey);
      }
    }

    return { granted, denied };
  } catch (error: any) {
    // Silently handle error
    throw error;
  }
};

/**
 * Check authorization status for a metric (best effort)
 */
const getAuthorizationStatus = async (
  metricKey: string
): Promise<"authorized" | "denied" | "undetermined"> => {
  const metric = getMetricByKey(metricKey);
  if (!metric?.appleHealth?.type) {
    return "undetermined";
  }

  // TODO: Check actual authorization status
  // Note: iOS doesn't provide a way to check read authorization status
  // We can only check write status
  // const status = await AppleHealthKit.getAuthStatus(metric.appleHealth.type);

  // For now, return undetermined
  return "undetermined";
};

/**
 * Fetch metrics from Apple Health
 */
const fetchMetrics = async (
  selectedMetrics: string[],
  startDate: Date,
  endDate: Date
): Promise<NormalizedMetricPayload[]> => {
  const results: NormalizedMetricPayload[] = [];

  for (const metricKey of selectedMetrics) {
    const metric = getMetricByKey(metricKey);
    if (!metric || !metric.appleHealth?.available) {
      continue;
    }

    try {
      const samples = await fetchMetricSamples(
        metric,
        startDate,
        endDate
      );

      if (samples.length > 0) {
        results.push({
          provider: "apple_health",
          metricKey,
          displayName: metric.displayName,
          unit: metric.unit,
          samples,
        });
      }
    } catch (error) {
      // Silently handle error
    }
  }

  return results;
};

/**
 * Fetch samples for a specific metric
 */
const fetchMetricSamples = async (
  metric: HealthMetric,
  startDate: Date,
  endDate: Date
): Promise<MetricSample[]> => {
  const type = metric.appleHealth?.type;
  if (!type || !AppleHealthKit) {
    return [];
  }

  try {
    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ascending: false,
      limit: 1000,
    };

    let data: any[] = [];

    // Handle different HealthKit data types
    if (type.includes("QuantityType")) {
      // Quantity samples (most metrics)
      data = await new Promise((resolve, reject) => {
        AppleHealthKit.getSamples(
          options,
          (error: any, results: any[]) => {
            if (error) {
              reject(error);
            } else {
              resolve(results || []);
            }
          }
        );
      });
    } else if (type.includes("CategoryType")) {
      // Category samples (e.g., sleep)
      data = await new Promise((resolve, reject) => {
        AppleHealthKit.getCategorySamples(
          options,
          (error: any, results: any[]) => {
            if (error) {
              reject(error);
            } else {
              resolve(results || []);
            }
          }
        );
      });
    } else if (type.includes("Workout")) {
      // Workout samples
      data = await new Promise((resolve, reject) => {
        AppleHealthKit.getWorkouts(
          options,
          (error: any, results: any[]) => {
            if (error) {
              reject(error);
            } else {
              resolve(results || []);
            }
          }
        );
      });
    }

    // Normalize samples to our schema
    return data.map((sample) => ({
      value: sample.value ?? sample.quantity ?? sample.workoutActivityType ?? "",
      unit: sample.unit || metric.unit,
      startDate: sample.startDate || sample.date,
      endDate: sample.endDate || sample.date,
      source: sample.sourceName || sample.sourceId || "Apple Health",
    }));
  } catch (error) {
    // Silently handle error
    return [];
  }
};

export const appleHealthService = {
  isAvailable,
  requestAuthorization,
  getAuthorizationStatus,
  fetchMetrics,
};

