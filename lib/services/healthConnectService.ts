/**
 * Health Connect Service (Android)
 * Google Health Connect integration using expo-health-connect module
 */

import { Platform } from "react-native";
import {
  type HealthRecord,
  isAvailable,
  readRecords,
  requestPermissions,
} from "../../modules/expo-health-connect";
import {
  getAvailableMetricsForProvider,
  getHealthConnectPermissionsForMetrics,
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

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unknown error";
};

const resolveMetricsToFetch = (
  selectedMetricKeys: string[]
): HealthMetric[] => {
  if (selectedMetricKeys.includes("all")) {
    return getAvailableMetricsForProvider("health_connect");
  }

  return selectedMetricKeys
    .map((key) => getMetricByKey(key))
    .filter(
      (metric): metric is HealthMetric =>
        metric !== undefined && metric.healthConnect?.available === true
    );
};

/**
 * Check if Health Connect is available on this device
 */
const checkAvailability = async (): Promise<ProviderAvailability> => {
  if (Platform.OS !== "android") {
    return {
      available: false,
      reason: "Android only",
    };
  }

  try {
    const availability = await isAvailable();

    if (!availability.available) {
      return {
        available: false,
        reason:
          availability.reason || "Health Connect not available on this device",
        requiresInstall: true,
        installUrl:
          "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata",
      };
    }

    return {
      available: true,
    };
  } catch (error: unknown) {
    return {
      available: false,
      reason: getErrorMessage(error),
      requiresInstall: true,
      installUrl:
        "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata",
    };
  }
};

/**
 * Request authorization for Health Connect data types
 */
const authorize = async (selectedMetricKeys?: string[]): Promise<boolean> => {
  const availability = await checkAvailability();
  if (!availability.available) {
    throw new Error(availability.reason || "Health Connect not available");
  }

  // Determine which permissions to request
  let permissions: string[];
  if (selectedMetricKeys && selectedMetricKeys.length > 0) {
    if (selectedMetricKeys.includes("all")) {
      permissions = getHealthConnectPermissionsForMetrics(
        getAvailableMetricsForProvider("health_connect").map(
          (metric) => metric.key
        )
      );
    } else {
      permissions = getHealthConnectPermissionsForMetrics(selectedMetricKeys);
    }
  } else {
    permissions = getHealthConnectPermissionsForMetrics(
      getAvailableMetricsForProvider("health_connect").map(
        (metric) => metric.key
      )
    );
  }

  if (permissions.length === 0) {
    throw new Error("No Health Connect permissions to request");
  }

  // Request authorization
  const result = await requestPermissions(permissions);

  authorizationRequested = true;

  // Return true if at least one permission was granted
  return result.granted.length > 0;
};

/**
 * Parse Health Connect record value based on record type
 */
const parseRecordValue = (
  record: HealthRecord,
  recordType: string
): { value: number | string; unit: string } => {
  if (recordType === "BloodPressureRecord") {
    // Keep "systolic/diastolic" as-is so both values can be extracted later.
    const rawValue = String(record.value);
    if (rawValue.includes("/")) {
      return {
        value: rawValue,
        unit: record.unit || "mmHg",
      };
    }
  }

  const numValue =
    typeof record.value === "number"
      ? record.value
      : Number.parseFloat(String(record.value));

  return {
    value: Number.isNaN(numValue) ? String(record.value) : numValue,
    unit: record.unit || "",
  };
};

/**
 * Fetch samples for a single metric
 */
const fetchMetricSamples = async (
  recordType: string,
  startDate: Date,
  endDate: Date
): Promise<MetricSample[]> => {
  const records = await readRecords(
    recordType,
    startDate.toISOString(),
    endDate.toISOString()
  );

  return records.map((record) => {
    const parsed = parseRecordValue(record, recordType);
    return {
      value: parsed.value,
      unit: parsed.unit,
      startDate: record.startDate,
      endDate: record.endDate,
      source: record.source,
    };
  });
};

const extractBloodPressureValue = (
  metricKey: HealthMetric["key"],
  sample: MetricSample
): MetricSample | null => {
  const valueStr = String(sample.value);
  const parts = valueStr.split("/");
  if (parts.length !== 2) {
    return null;
  }

  const systolic = Number.parseFloat(parts[0]);
  const diastolic = Number.parseFloat(parts[1]);
  const parsedValue =
    metricKey === "blood_pressure_systolic" ? systolic : diastolic;

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return {
    value: parsedValue,
    unit: sample.unit || "mmHg",
    startDate: sample.startDate,
    endDate: sample.endDate,
    source: sample.source,
  };
};

const fetchMetricPayload = async (
  metric: HealthMetric,
  startDate: Date,
  endDate: Date
): Promise<NormalizedMetricPayload | null> => {
  if (!metric.healthConnect?.recordType) {
    return null;
  }

  if (
    metric.key === "blood_pressure_systolic" ||
    metric.key === "blood_pressure_diastolic"
  ) {
    const samples = await fetchMetricSamples(
      "BloodPressureRecord",
      startDate,
      endDate
    );
    const bloodPressureSamples = samples
      .map((sample) => extractBloodPressureValue(metric.key, sample))
      .filter((sample): sample is MetricSample => sample !== null);

    if (bloodPressureSamples.length === 0) {
      return null;
    }

    return {
      metricKey: metric.key,
      displayName: metric.displayName,
      unit: metric.unit,
      samples: bloodPressureSamples,
      provider: "health_connect",
    };
  }

  const samples = await fetchMetricSamples(
    metric.healthConnect.recordType,
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
    provider: "health_connect",
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
  const availability = await checkAvailability();
  if (!availability.available) {
    throw new Error(availability.reason || "Health Connect not available");
  }

  const metricsToFetch = resolveMetricsToFetch(selectedMetricKeys);
  const results: NormalizedMetricPayload[] = [];

  for (const metric of metricsToFetch) {
    try {
      const payload = await fetchMetricPayload(metric, startDate, endDate);
      if (payload) {
        results.push(payload);
      }
    } catch {
      // Continue with other metrics even if one fails.
    }
  }

  return results;
};

/**
 * Get available metrics for Health Connect
 */
const getAvailableMetrics = (): HealthMetric[] =>
  getAvailableMetricsForProvider("health_connect");

/**
 * Check if the service is connected (authorized)
 */
const isConnected = (): boolean => authorizationRequested;

export const healthConnectService = {
  checkAvailability,
  authorize,
  fetchMetrics,
  getAvailableMetrics,
  isConnected,
  fetchMetricSamples,
};
