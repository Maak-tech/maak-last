/**
 * Health Connect Service (Android)
 * Google Health Connect integration using expo-health-connect module
 */

import { Platform } from "react-native";
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
import * as HealthConnect from "../../modules/expo-health-connect";

// Track if authorization has been requested
let authorizationRequested = false;

/**
 * Check if Health Connect is available on this device
 */
const checkAvailability = async (): Promise<ProviderAvailability> => {
  try {
    if (Platform.OS !== "android") {
      return {
        available: false,
        reason: "Android only",
      };
    }

    const availability = await HealthConnect.isAvailable();

    if (!availability.available) {
      return {
        available: false,
        reason: availability.reason || "Health Connect not available on this device",
        requiresInstall: true,
        installUrl: "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata",
      };
    }

    return {
      available: true,
    };
  } catch (error: any) {
    console.error(
      "[Health Connect Service] Error checking availability:",
      error?.message || String(error)
    );
    return {
      available: false,
      reason: error?.message || "Unknown error",
      requiresInstall: true,
      installUrl: "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata",
    };
  }
};

/**
 * Request authorization for Health Connect data types
 */
const authorize = async (selectedMetricKeys?: string[]): Promise<boolean> => {
  try {
    // Check availability first
    const availability = await checkAvailability();
    if (!availability.available) {
      throw new Error(availability.reason || "Health Connect not available");
    }

    // Determine which permissions to request
    let permissions: string[];
    if (selectedMetricKeys && selectedMetricKeys.length > 0) {
      // Check if "all" is requested
      if (selectedMetricKeys.includes("all")) {
        // Request all Health Connect permissions
        permissions = getHealthConnectPermissionsForMetrics(
          getAvailableMetricsForProvider("health_connect").map((m) => m.key)
        );
      } else {
        // Map selected metric keys to Health Connect permissions
        permissions = getHealthConnectPermissionsForMetrics(selectedMetricKeys);
      }
    } else {
      // Request all Health Connect permissions
      permissions = getHealthConnectPermissionsForMetrics(
        getAvailableMetricsForProvider("health_connect").map((m) => m.key)
      );
    }

    if (permissions.length === 0) {
      throw new Error("No Health Connect permissions to request");
    }

    // Request authorization
    const result = await HealthConnect.requestPermissions(permissions);

    authorizationRequested = true;

    // Return true if at least one permission was granted
    return result.granted.length > 0;
  } catch (error: any) {
    console.error(
      "[Health Connect Service] Authorization error:",
      error?.message || String(error)
    );
    throw error;
  }
};

/**
 * Map Health Connect record type to metric key
 */
const recordTypeToMetricKey = (recordType: string): string | null => {
  const metricMap: Record<string, string> = {
    HeartRateRecord: "heart_rate",
    RestingHeartRateRecord: "resting_heart_rate",
    HeartRateVariabilityRmssdRecord: "heart_rate_variability",
    BloodPressureRecord: "blood_pressure", // Special handling needed
    RespiratoryRateRecord: "respiratory_rate",
    OxygenSaturationRecord: "blood_oxygen",
    BodyTemperatureRecord: "body_temperature",
    WeightRecord: "weight",
    HeightRecord: "height",
    BodyMassIndexRecord: "body_mass_index",
    BodyFatRecord: "body_fat_percentage",
    StepsRecord: "steps",
    ActiveCaloriesBurnedRecord: "active_energy",
    BasalMetabolicRateRecord: "basal_energy",
    DistanceRecord: "distance_walking_running",
    FloorsClimbedRecord: "flights_climbed",
    ExerciseSessionRecord: "exercise_minutes", // Also used for workouts
    SleepSessionRecord: "sleep_analysis",
    HydrationRecord: "water_intake",
    BloodGlucoseRecord: "blood_glucose",
  };
  return metricMap[recordType] || null;
};

/**
 * Parse Health Connect record value based on record type
 */
const parseRecordValue = (
  record: HealthConnect.HealthRecord,
  recordType: string
): { value: number | string; unit: string } => {
  // Handle special cases
  if (recordType === "BloodPressureRecord") {
    // Blood pressure is stored as "systolic/diastolic"
    const parts = String(record.value).split("/");
    if (parts.length === 2) {
      return {
        value: parseFloat(parts[0]) || 0,
        unit: record.unit || "mmHg",
      };
    }
  }

  // Handle numeric values
  const numValue = typeof record.value === "number" 
    ? record.value 
    : parseFloat(String(record.value));

  return {
    value: isNaN(numValue) ? String(record.value) : numValue,
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
  try {
    const records = await HealthConnect.readRecords(
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
  } catch (error: any) {
    console.error(
      `[Health Connect Service] Error fetching ${recordType}:`,
      error?.message || String(error)
    );
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
    // Check if Health Connect is available
    const availability = await checkAvailability();
    if (!availability.available) {
      throw new Error(availability.reason || "Health Connect not available");
    }

    const results: NormalizedMetricPayload[] = [];

    // Determine which metrics to fetch
    let metricsToFetch: HealthMetric[];
    if (selectedMetricKeys.includes("all")) {
      // Fetch all available metrics
      metricsToFetch = getAvailableMetricsForProvider("health_connect");
    } else {
      // Fetch only selected metrics
      metricsToFetch = selectedMetricKeys
        .map((key) => getMetricByKey(key))
        .filter(
          (metric): metric is HealthMetric =>
            metric !== undefined && metric.healthConnect?.available === true
        );
    }

    // Fetch samples for each metric
    for (const metric of metricsToFetch) {
      try {
        if (!metric.healthConnect?.recordType) {
          continue;
        }

        const recordType = metric.healthConnect.recordType;

        // Special handling for blood pressure (systolic and diastolic)
        if (metric.key === "blood_pressure_systolic" || metric.key === "blood_pressure_diastolic") {
          // Fetch BloodPressureRecord and extract systolic/diastolic
          const samples = await fetchMetricSamples("BloodPressureRecord", startDate, endDate);
          
          // Parse blood pressure values
          const bpSamples: MetricSample[] = samples.map((sample) => {
            const valueStr = String(sample.value);
            const parts = valueStr.split("/");
            if (parts.length === 2) {
              const systolic = parseFloat(parts[0]);
              const diastolic = parseFloat(parts[1]);
              return {
                value: metric.key === "blood_pressure_systolic" ? systolic : diastolic,
                unit: sample.unit || "mmHg",
                startDate: sample.startDate,
                endDate: sample.endDate,
                source: sample.source,
              };
            }
            return sample;
          });

          if (bpSamples.length > 0) {
            results.push({
              metricKey: metric.key,
              displayName: metric.displayName,
              unit: metric.unit,
              samples: bpSamples,
              provider: "health_connect",
            });
          }
        } else {
          // Regular metric fetching
          const samples = await fetchMetricSamples(recordType, startDate, endDate);

          if (samples.length > 0) {
            results.push({
              metricKey: metric.key,
              displayName: metric.displayName,
              unit: metric.unit,
              samples,
              provider: "health_connect",
            });
          }
        }
      } catch (error: any) {
        console.error(
          `[Health Connect Service] Error fetching metric ${metric.key}:`,
          error?.message || String(error)
        );
        // Continue with other metrics even if one fails
      }
    }

    return results;
  } catch (error: any) {
    console.error(
      "[Health Connect Service] Error fetching data:",
      error?.message || String(error)
    );
    throw error;
  }
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
