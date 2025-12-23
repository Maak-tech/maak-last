/**
 * Apple Health Service
 * iOS HealthKit integration using @kingstinct/react-native-healthkit
 */

import { Platform } from "react-native";
import {
  isHealthDataAvailable,
  requestAuthorization,
  queryQuantitySamples,
  queryCategorySamples,
  queryWorkoutSamples,
  type QuantitySample,
  type CategorySampleTyped,
  type CategoryTypeIdentifier,
} from "@kingstinct/react-native-healthkit";
import type {
  NormalizedMetricPayload,
  MetricSample,
  ProviderAvailability,
} from "../health/healthTypes";
import {
  getMetricByKey,
  getAvailableMetricsForProvider,
  type HealthMetric,
} from "../health/healthMetricsCatalog";
import { getAllHealthKitReadTypes } from "../health/allHealthKitTypes";

// Track if authorization has been requested
let authorizationRequested = false;

/**
 * Check if HealthKit is available on this device
 */
const checkAvailability = async (): Promise<ProviderAvailability> => {
  try {
  if (Platform.OS !== "ios") {
    return {
      available: false,
      reason: "iOS only",
    };
    }

    const available = isHealthDataAvailable();

    if (!available) {
      return {
        available: false,
        reason: "HealthKit not available on this device",
      };
    }

    return {
      available: true,
    };
  } catch (error: any) {
    console.error("[HealthKit Service] Error checking availability:", error?.message || String(error));
      return {
        available: false,
      reason: error?.message || "Unknown error",
    };
  }
};

/**
 * Request authorization for HealthKit data types
 */
const authorize = async (selectedMetricKeys?: string[]): Promise<boolean> => {
  try {
  // Check availability first
    const availability = await checkAvailability();
  if (!availability.available) {
      throw new Error(availability.reason || "HealthKit not available");
  }

  // Determine which permissions to request
  let readPermissions: string[];
    if (selectedMetricKeys && selectedMetricKeys.length > 0) {
      // Check if "all" is requested
      if (selectedMetricKeys.includes("all")) {
        // Request all HealthKit types
    readPermissions = getAllHealthKitReadTypes();
  } else {
        // Map selected metric keys to HealthKit type identifiers
        readPermissions = selectedMetricKeys
      .map((key) => {
        const metric = getMetricByKey(key);
            return metric?.appleHealth?.available ? metric.appleHealth.type : null;
          })
          .filter(Boolean) as string[];
      }
    } else {
      // Request all HealthKit types
      readPermissions = getAllHealthKitReadTypes();
    }

    if (readPermissions.length === 0) {
      throw new Error("No HealthKit permissions to request");
    }

    // Request authorization
    const granted = await requestAuthorization({
      toRead: readPermissions as any,
    });

    authorizationRequested = true;

    return granted;
  } catch (error: any) {
    console.error("[HealthKit Service] Authorization error:", error?.message || String(error));
    throw error;
  }
};

/**
 * Fetch samples for a single metric
 */
const fetchMetricSamples = async (
  healthKitType: string,
  startDate: Date,
  endDate: Date
): Promise<MetricSample[]> => {
  try {
    if (!authorizationRequested) {
      throw new Error("Authorization not requested. Call authorize() first.");
    }

    // Determine if this is a quantity, category, or workout type
    if (healthKitType === "HKWorkoutTypeIdentifier") {
      // Handle workouts
      const workouts = await queryWorkoutSamples({
        filter: {
          date: {
            startDate: startDate,
            endDate: endDate,
          },
        },
        limit: 1000,
        ascending: false,
      });

      return workouts.map((workout) => ({
        value: workout.duration.quantity, // Duration quantity
        unit: workout.duration.unit,
        startDate: workout.startDate.toISOString(),
        endDate: workout.endDate.toISOString(),
        metadata: {
          workoutActivityType: workout.workoutActivityType,
        },
      }));
    } else if (healthKitType.includes("Category")) {
      // Handle category types
      const samples = await queryCategorySamples(
        healthKitType as CategoryTypeIdentifier,
        {
          filter: {
            date: {
              startDate: startDate,
              endDate: endDate,
            },
          },
          limit: 1000,
          ascending: false,
        }
      );

      return samples.map((sample: CategorySampleTyped<any>) => ({
        value: sample.value,
        unit: "",
        startDate: sample.startDate.toISOString(),
        endDate: sample.endDate.toISOString(),
        metadata: sample.metadata,
      }));
    } else {
      // Handle quantity types
      const samples = await queryQuantitySamples(healthKitType as any, {
        filter: {
          date: {
            startDate: startDate,
            endDate: endDate,
          },
        },
        limit: 1000,
        ascending: false,
      });

      return samples.map((sample: QuantitySample) => ({
        value: sample.quantity,
        unit: sample.unit,
        startDate: sample.startDate.toISOString(),
        endDate: sample.endDate.toISOString(),
        metadata: sample.metadata,
      }));
    }
  } catch (error: any) {
    console.error(`[HealthKit Service] Error fetching ${healthKitType}:`, error?.message || String(error));
    throw error;
  }
};

/**
 * Fetch health data for selected metrics
 */
const fetchMetrics = async (
  selectedMetricKeys: string[],
  startDate: Date,
  endDate: Date
): Promise<NormalizedMetricPayload[]> => {
  try {
    // Check if HealthKit is available
    if (!isHealthDataAvailable()) {
      throw new Error("HealthKit is not available on this device");
    }
    
    // Note: We don't check authorizationRequested here because it's a module-level variable
    // that resets on app restart/module reload. The caller (syncHealthData) already verifies
    // that a connection exists. If authorization wasn't granted, HealthKit queries will fail
    // gracefully with appropriate error messages.

  const results: NormalizedMetricPayload[] = [];

    // Determine which metrics to fetch
    let metricsToFetch: HealthMetric[];
    if (selectedMetricKeys.includes("all")) {
      // Fetch all available metrics
      metricsToFetch = getAvailableMetricsForProvider("apple_health");
    } else {
      // Fetch only selected metrics
      metricsToFetch = selectedMetricKeys
        .map((key) => getMetricByKey(key))
        .filter((metric): metric is HealthMetric => 
          metric !== undefined && metric.appleHealth?.available === true
        );
    }

    // Fetch samples for each metric
    for (const metric of metricsToFetch) {
      try {
        if (!metric.appleHealth?.type) {
          continue;
        }
        
      const samples = await fetchMetricSamples(
          metric.appleHealth.type,
        startDate,
        endDate
      );

      if (samples.length > 0) {
        results.push({
            metricKey: metric.key,
          displayName: metric.displayName,
          unit: metric.unit,
            samples: samples,
            provider: "apple_health",
          });
        }
      } catch (error: any) {
        console.error(`[HealthKit Service] Error fetching metric ${metric.key}:`, error?.message || String(error));
        // Continue with other metrics even if one fails
    }
  }

  return results;
  } catch (error: any) {
    console.error("[HealthKit Service] Error fetching data:", error?.message || String(error));
    throw error;
  }
};

/**
 * Get available metrics for Apple Health
 */
const getAvailableMetrics = (): HealthMetric[] => {
  return getAvailableMetricsForProvider("apple_health");
};

/**
 * Check if the service is connected (authorized)
 */
const isConnected = (): boolean => {
  return authorizationRequested;
};

export const appleHealthService = {
  checkAvailability,
  authorize,
  fetchMetrics,
  getAvailableMetrics,
  isConnected,
  fetchMetricSamples,
};
