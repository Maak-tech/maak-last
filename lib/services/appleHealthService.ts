/**
 * Apple Health Service
 * iOS HealthKit integration using @kingstinct/react-native-healthkit
 */

import {
  type CategorySampleTyped,
  type CategoryTypeIdentifier,
  isHealthDataAvailable,
  type QuantitySample,
  queryCategorySamples,
  queryQuantitySamples,
  queryWorkoutSamples,
  requestAuthorization,
} from "@kingstinct/react-native-healthkit";
import { Platform } from "react-native";
import { getAllHealthKitReadTypes } from "../health/allHealthKitTypes";
import {
  getAvailableMetricsForProvider,
  getMetricByKey,
  type HealthMetric,
} from "../health/healthMetricsCatalog";
import type {
  MetricSample,
  NormalizedMetricPayload,
  ProviderAvailability,
} from "../health/healthTypes";

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
            return metric?.appleHealth?.available
              ? metric.appleHealth.type
              : null;
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

    // Check if we already have authorization by attempting a simple query
    // This prevents showing the permission dialog if authorization was already granted
    // Try common types first, then fall back to the first requested type
    const commonQuantityTypes = [
      "HKQuantityTypeIdentifierStepCount",
      "HKQuantityTypeIdentifierHeartRate",
      "HKQuantityTypeIdentifierBodyMass",
      "HKQuantityTypeIdentifierHeight",
    ];
    
    const commonCategoryTypes = [
      "HKCategoryTypeIdentifierSleepAnalysis",
    ];
    
    // Find a test type from the requested permissions
    const testQuantityType = commonQuantityTypes.find((type) => readPermissions.includes(type));
    const testCategoryType = commonCategoryTypes.find((type) => readPermissions.includes(type));
    const testType = testQuantityType || testCategoryType || readPermissions[0];
    
    if (testType) {
      try {
        // Try to query a recent sample to check if we already have authorization
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        if (testType.includes("Category")) {
          // Test with category type
          await queryCategorySamples(testType as CategoryTypeIdentifier, {
            filter: {
              date: {
                startDate: yesterday,
                endDate: now,
              },
            },
            limit: 1,
            ascending: false,
          });
        } else if (testType !== "HKWorkoutTypeIdentifier") {
          // Test with quantity type
          await queryQuantitySamples(testType as any, {
            filter: {
              date: {
                startDate: yesterday,
                endDate: now,
              },
            },
            limit: 1,
            ascending: false,
          });
        }
        
        // If query succeeds, we already have authorization
        // No need to request again - this prevents showing the permission dialog unnecessarily
        authorizationRequested = true;
        return true;
      } catch (queryError: any) {
        // If query fails with authorization error, we need to request authorization
        // Otherwise, it might be a different error (no data, etc.), so we'll still request
        const isAuthError = isAuthorizationDeniedError(queryError);
        if (!isAuthError) {
          // Not an authorization error - might be no data available, which is fine
          // We can assume we have authorization if it's not an auth error
          authorizationRequested = true;
          return true;
        }
        // Authorization denied - proceed to request authorization
      }
    }

    // Request authorization (only if we don't already have it)
    const granted = await requestAuthorization({
      toRead: readPermissions as any,
    });

    authorizationRequested = true;

    return granted;
  } catch (error: any) {
    throw error;
  }
};

/**
 * Check if an error is an authorization-denied or not-determined error (HealthKit error code 5)
 */
const isAuthorizationDeniedError = (error: any): boolean => {
  if (!error) return false;
  
  // Check for HealthKit error code 5 (Authorization Denied or Not Determined)
  const errorString = String(error);
  const errorMessage = error?.message || errorString;
  const errorCode = error?.code;
  const errorDomain = error?.domain;
  
  // Also check UserInfo/NSLocalizedDescription for native iOS errors
  const userInfo = error?.userInfo || error?.UserInfo || {};
  const localizedDescription = userInfo?.NSLocalizedDescription || userInfo?.NSLocalizedDescription || "";
  
  // Combine all error text for case-insensitive matching
  const allErrorText = `${errorString} ${errorMessage} ${localizedDescription}`.toLowerCase();
  
  // HealthKit error code 5 means authorization denied or not determined
  if (errorCode === 5) return true;
  
  // Check if domain is HealthKit and code is 5
  if (errorDomain === "com.apple.healthkit" && errorCode === 5) {
    return true;
  }
  
  // Check error domain and code in error message/string (handles formats like "error domain=com.apple.healthkit code=5")
  if (
    allErrorText.includes("com.apple.healthkit") &&
    (allErrorText.includes("code=5") || allErrorText.includes("code 5") || allErrorText.includes("code:5"))
  ) {
    return true;
  }
  
  // Check error message for authorization denied patterns (case-insensitive)
  if (
    allErrorText.includes("authorization denied") ||
    allErrorText.includes("not authorized") ||
    allErrorText.includes("authorization was denied")
  ) {
    return true;
  }
  
  // Check for "not determined" errors (also HealthKit error code 5)
  // This happens when authorization hasn't been requested for a specific type
  if (
    allErrorText.includes("authorization status is not determined") ||
    allErrorText.includes("not determined") ||
    allErrorText.includes("authorization status is not determined for all types")
  ) {
    return true;
  }
  
  return false;
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
    // Check if HealthKit is available
    if (!isHealthDataAvailable()) {
      throw new Error("HealthKit is not available on this device");
    }

    // Note: We don't check authorizationRequested here because it's a module-level variable
    // that resets on app restart/module reload. The caller already verifies that a connection
    // exists. If authorization wasn't granted, HealthKit queries will fail gracefully with
    // appropriate error messages.

    // Determine if this is a quantity, category, or workout type
    if (healthKitType === "HKWorkoutTypeIdentifier") {
      // Handle workouts
      const workouts = await queryWorkoutSamples({
        filter: {
          date: {
            startDate,
            endDate,
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
    }
    if (healthKitType.includes("Category")) {
      // Handle category types
      const samples = await queryCategorySamples(
        healthKitType as CategoryTypeIdentifier,
        {
          filter: {
            date: {
              startDate,
              endDate,
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
    }
    // Handle quantity types
    const samples = await queryQuantitySamples(healthKitType as any, {
      filter: {
        date: {
          startDate,
          endDate,
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
  } catch (error: any) {
    // Check if this is an authorization-denied or not-determined error
    if (isAuthorizationDeniedError(error)) {
      // Don't log authorization errors - they're expected and handled gracefully
      // This includes both "denied" and "not determined" cases (both are HealthKit error code 5)
      // Throw a custom error so it can be caught and tracked in fetchMetrics
      // This allows us to track which metrics failed due to authorization
      const authError = new Error(`Authorization not determined or denied for ${healthKitType}`);
      (authError as any).isAuthorizationDenied = true;
      (authError as any).healthKitType = healthKitType;
      throw authError;
    }
    
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
        .filter(
          (metric): metric is HealthMetric =>
            metric !== undefined && metric.appleHealth?.available === true
        );
    }

    // Track metrics that failed due to authorization
    const authorizationDeniedMetrics: string[] = [];

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
            samples,
            provider: "apple_health",
          });
        }
      } catch (error: any) {
        // Check if this is an authorization-denied or not-determined error
        if (isAuthorizationDeniedError(error) || (error as any).isAuthorizationDenied) {
          authorizationDeniedMetrics.push(metric.displayName || metric.key);
          // Silently skip metrics that require authorization - this is expected behavior
          // Authorization may not have been requested for all types, or user may have denied specific types
          continue;
        }
        
        // Continue with other metrics even if one fails
      }
    }

    return results;
  } catch (error: any) {
    throw error;
  }
};

/**
 * Get available metrics for Apple Health
 */
const getAvailableMetrics = (): HealthMetric[] =>
  getAvailableMetricsForProvider("apple_health");

/**
 * Check if the service is connected (authorized)
 */
const isConnected = (): boolean => authorizationRequested;

export const appleHealthService = {
  checkAvailability,
  authorize,
  fetchMetrics,
  getAvailableMetrics,
  isConnected,
  fetchMetricSamples,
};
