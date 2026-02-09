/**
 * Apple Health Service
 * iOS HealthKit integration using @kingstinct/react-native-healthkit
 */

import {
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

type QuantityTypeIdentifier = Parameters<typeof queryQuantitySamples>[0];
type RequestAuthorizationInput = Parameters<typeof requestAuthorization>[0];
type AuthorizationDeniedError = Error & {
  isAuthorizationDenied?: boolean;
  healthKitType?: string;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unknown error";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const resolveReadPermissions = (selectedMetricKeys?: string[]): string[] => {
  if (!selectedMetricKeys || selectedMetricKeys.length === 0) {
    return getAllHealthKitReadTypes();
  }

  if (selectedMetricKeys.includes("all")) {
    return getAllHealthKitReadTypes();
  }

  return selectedMetricKeys
    .map((key) => {
      const metric = getMetricByKey(key);
      return metric?.appleHealth?.available ? metric.appleHealth.type : null;
    })
    .filter((value): value is string => Boolean(value));
};

const resolveMetricsToFetch = (
  selectedMetricKeys: string[]
): HealthMetric[] => {
  if (selectedMetricKeys.includes("all")) {
    return getAvailableMetricsForProvider("apple_health");
  }

  return selectedMetricKeys
    .map((key) => getMetricByKey(key))
    .filter(
      (metric): metric is HealthMetric =>
        metric !== undefined && metric.appleHealth?.available === true
    );
};

const hasAuthorizationDeniedMarker = (
  error: unknown
): error is AuthorizationDeniedError => {
  if (!isRecord(error)) {
    return false;
  }

  return Boolean(error.isAuthorizationDenied);
};

/**
 * Check if HealthKit is available on this device
 */
const checkAvailability = (): ProviderAvailability => {
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
  } catch (error: unknown) {
    return {
      available: false,
      reason: getErrorMessage(error),
    };
  }
};

/**
 * Check if an error is an authorization-denied or not-determined error (HealthKit error code 5)
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: HealthKit errors arrive in multiple native shapes and require explicit matching.
const isAuthorizationDeniedError = (error: unknown): boolean => {
  if (!isRecord(error)) {
    return false;
  }

  const errorString = String(error);
  const errorMessage =
    typeof error.message === "string" ? error.message : errorString;
  const errorCode = typeof error.code === "number" ? error.code : undefined;
  const errorDomain =
    typeof error.domain === "string" ? error.domain : undefined;

  let userInfo: Record<string, unknown> | undefined;
  if (isRecord(error.userInfo)) {
    userInfo = error.userInfo;
  } else if (isRecord(error.UserInfo)) {
    userInfo = error.UserInfo;
  }
  const localizedDescription =
    userInfo && typeof userInfo.NSLocalizedDescription === "string"
      ? userInfo.NSLocalizedDescription
      : "";

  const allErrorText =
    `${errorString} ${errorMessage} ${localizedDescription}`.toLowerCase();

  // HealthKit error code 5 means authorization denied or not determined.
  if (errorCode === 5) {
    return true;
  }

  if (errorDomain === "com.apple.healthkit" && errorCode === 5) {
    return true;
  }

  if (
    allErrorText.includes("com.apple.healthkit") &&
    (allErrorText.includes("code=5") ||
      allErrorText.includes("code 5") ||
      allErrorText.includes("code:5"))
  ) {
    return true;
  }

  if (
    allErrorText.includes("authorization denied") ||
    allErrorText.includes("not authorized") ||
    allErrorText.includes("authorization was denied")
  ) {
    return true;
  }

  if (
    allErrorText.includes("authorization status is not determined") ||
    allErrorText.includes("not determined") ||
    allErrorText.includes(
      "authorization status is not determined for all types"
    )
  ) {
    return true;
  }

  return false;
};

const hasExistingAuthorization = async (testType: string): Promise<boolean> => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  if (testType.includes("Category")) {
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
    return true;
  }

  if (testType !== "HKWorkoutTypeIdentifier") {
    await queryQuantitySamples(testType as QuantityTypeIdentifier, {
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

  return true;
};

/**
 * Request authorization for HealthKit data types
 */
const authorize = async (selectedMetricKeys?: string[]): Promise<boolean> => {
  const availability = checkAvailability();
  if (!availability.available) {
    throw new Error(availability.reason || "HealthKit not available");
  }

  const readPermissions = resolveReadPermissions(selectedMetricKeys);
  if (readPermissions.length === 0) {
    throw new Error("No HealthKit permissions to request");
  }

  const commonQuantityTypes = [
    "HKQuantityTypeIdentifierStepCount",
    "HKQuantityTypeIdentifierHeartRate",
    "HKQuantityTypeIdentifierBodyMass",
    "HKQuantityTypeIdentifierHeight",
  ];
  const commonCategoryTypes = ["HKCategoryTypeIdentifierSleepAnalysis"];

  const testQuantityType = commonQuantityTypes.find((type) =>
    readPermissions.includes(type)
  );
  const testCategoryType = commonCategoryTypes.find((type) =>
    readPermissions.includes(type)
  );
  const testType = testQuantityType || testCategoryType || readPermissions[0];

  if (testType) {
    try {
      const alreadyAuthorized = await hasExistingAuthorization(testType);
      if (alreadyAuthorized) {
        authorizationRequested = true;
        return true;
      }
    } catch (queryError: unknown) {
      if (!isAuthorizationDeniedError(queryError)) {
        // Not an authorization-denied signal; continue with explicit authorization request.
      }
    }
  }

  const requestInput: RequestAuthorizationInput = {
    toRead: readPermissions as unknown as RequestAuthorizationInput["toRead"],
  };
  const granted = await requestAuthorization(requestInput);
  authorizationRequested = true;
  return granted;
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
    if (!isHealthDataAvailable()) {
      throw new Error("HealthKit is not available on this device");
    }

    if (healthKitType === "HKWorkoutTypeIdentifier") {
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
        value: workout.duration.quantity,
        unit: workout.duration.unit,
        startDate: workout.startDate.toISOString(),
        endDate: workout.endDate.toISOString(),
        metadata: {
          workoutActivityType: workout.workoutActivityType,
        },
      }));
    }

    if (healthKitType.includes("Category")) {
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

      return samples.map((sample) => ({
        value: sample.value,
        unit: "",
        startDate: sample.startDate.toISOString(),
        endDate: sample.endDate.toISOString(),
        metadata: sample.metadata,
      }));
    }

    const samples = await queryQuantitySamples(
      healthKitType as QuantityTypeIdentifier,
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

    return samples.map((sample: QuantitySample) => ({
      value: sample.quantity,
      unit: sample.unit,
      startDate: sample.startDate.toISOString(),
      endDate: sample.endDate.toISOString(),
      metadata: sample.metadata,
    }));
  } catch (error: unknown) {
    if (isAuthorizationDeniedError(error)) {
      const authError: AuthorizationDeniedError = new Error(
        `Authorization not determined or denied for ${healthKitType}`
      );
      authError.isAuthorizationDenied = true;
      authError.healthKitType = healthKitType;
      throw authError;
    }

    throw error;
  }
};

const fetchMetricPayload = async (
  metric: HealthMetric,
  startDate: Date,
  endDate: Date
): Promise<NormalizedMetricPayload | null> => {
  if (!metric.appleHealth?.type) {
    return null;
  }

  const samples = await fetchMetricSamples(
    metric.appleHealth.type,
    startDate,
    endDate
  );
  if (samples.length === 0) {
    return null;
  }

  return {
    metricKey: metric.key,
    displayName: metric.displayName,
    unit: metric.unit,
    samples,
    provider: "apple_health",
  };
};

/**
 * Fetch health data for selected metrics
 */
const fetchMetrics = async (
  selectedMetricKeys: string[],
  startDate: Date,
  endDate: Date
): Promise<NormalizedMetricPayload[]> => {
  if (!isHealthDataAvailable()) {
    throw new Error("HealthKit is not available on this device");
  }

  const metricsToFetch = resolveMetricsToFetch(selectedMetricKeys);
  const results: NormalizedMetricPayload[] = [];

  for (const metric of metricsToFetch) {
    try {
      const payload = await fetchMetricPayload(metric, startDate, endDate);
      if (payload) {
        results.push(payload);
      }
    } catch (error: unknown) {
      if (
        isAuthorizationDeniedError(error) ||
        hasAuthorizationDeniedMarker(error)
      ) {
        // Authorization-denied and metric-level read failures are intentionally ignored.
      }
    }
  }

  return results;
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
