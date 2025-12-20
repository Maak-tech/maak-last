/**
 * Google Health Connect Service
 * Android Health Connect integration
 */

import { Platform, Linking } from "react-native";
import Constants from "expo-constants";
import * as HealthConnect from "../../modules/expo-health-connect";
import type {
  NormalizedMetricPayload,
  MetricSample,
  ProviderAvailability,
} from "../health/healthTypes";
import {
  getMetricByKey,
  type HealthMetric,
  getHealthConnectPermissionsForMetrics,
} from "../health/healthMetricsCatalog";

// Health Connect package name
const HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata";

// Check if running in Expo Go
const isExpoGo = () => {
  return (
    Constants.executionEnvironment === "storeClient" ||
    !Constants.appOwnership ||
    Constants.appOwnership === "expo"
  );
};

/**
 * Check if Health Connect is available
 */
const isAvailable = async (): Promise<ProviderAvailability> => {
  if (Platform.OS !== "android") {
    return {
      available: false,
      reason: "Health Connect is only available on Android",
    };
  }

  // Check if running in Expo Go
  if (isExpoGo()) {
    return {
      available: false,
      reason: "Health Connect requires a development build or standalone app. Health Connect is not available in Expo Go. Please build a development build using 'expo run:android' or create a standalone build.",
    };
  }

  try {
    // Check if Health Connect app is installed
    const canOpen = await Linking.canOpenURL(`package:${HEALTH_CONNECT_PACKAGE}`);
    
    if (!canOpen) {
      return {
        available: false,
        reason: "Health Connect app is not installed. Please install Health Connect from the Google Play Store.",
        requiresInstall: true,
        installUrl: `https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PACKAGE}`,
      };
    }

    // Check if Health Connect SDK is available via native module
    try {
      const availability = await HealthConnect.isAvailable();
      return availability;
    } catch (error: any) {
      // If native module is not available, assume available if app is installed
      return {
        available: true,
      };
    }
  } catch (error: any) {
    return {
      available: false,
      reason: error.message || "Failed to check Health Connect availability",
    };
  }
};

/**
 * Open Health Connect app or Play Store
 */
const openHealthConnect = async () => {
  try {
    const canOpen = await Linking.canOpenURL(`package:${HEALTH_CONNECT_PACKAGE}`);
    if (canOpen) {
      await Linking.openURL(`package:${HEALTH_CONNECT_PACKAGE}`);
    } else {
      // Open Play Store
      await Linking.openURL(
        `https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PACKAGE}`
      );
    }
  } catch (error) {
    // Silently handle error
  }
};

/**
 * Request authorization for selected metrics
 */
const requestAuthorization = async (
  selectedMetrics: string[]
): Promise<{ granted: string[]; denied: string[] }> => {
  // Check availability first
  const availability = await isAvailable();
  if (!availability.available) {
    throw new Error(availability.reason || "Health Connect is not available");
  }

  try {
    // Get permissions for selected metrics
    const permissions = getHealthConnectPermissionsForMetrics(selectedMetrics);

    if (permissions.length === 0) {
      return {
        granted: [],
        denied: selectedMetrics,
      };
    }

    // Check availability first
    const availability = await isAvailable();
    if (!availability.available) {
      throw new Error(availability.reason || "Health Connect is not available");
    }

    // Request permissions via native module
    // The native module handles Activity context and result handling
    try {
      const result = await HealthConnect.requestPermissions(permissions);
      
      // Map permission strings back to metric keys
      const granted: string[] = [];
      const denied: string[] = [];
      
      selectedMetrics.forEach((metricKey) => {
        const metric = getMetricByKey(metricKey);
        if (metric?.healthConnect?.permission) {
          if (result.granted.includes(metric.healthConnect.permission)) {
            granted.push(metricKey);
          } else {
            denied.push(metricKey);
          }
        } else {
          denied.push(metricKey);
        }
      });
      
      return { granted, denied };
    } catch (error: any) {
      // If permission request fails, return all as denied
      return {
        granted: [],
        denied: selectedMetrics,
      };
    }
  } catch (error: any) {
    throw new Error(
      error.message || "Failed to request Health Connect permissions"
    );
  }
};

/**
 * Check authorization status for a metric
 */
const getAuthorizationStatus = async (
  metricKey: string
): Promise<"authorized" | "denied" | "undetermined"> => {
  const metric = getMetricByKey(metricKey);
  if (!metric?.healthConnect?.permission) {
    return "undetermined";
  }

  try {
    // Check authorization status using Health Connect SDK
    const status = await HealthConnect.getPermissionStatus(metric.healthConnect.permission);
    return status === "granted" ? "authorized" : status === "denied" ? "denied" : "undetermined";
  } catch (error) {
    // If native module is not available, return undetermined
    return "undetermined";
  }
};

/**
 * Fetch metrics from Health Connect
 */
const fetchMetrics = async (
  selectedMetrics: string[],
  startDate: Date,
  endDate: Date
): Promise<NormalizedMetricPayload[]> => {
  const results: NormalizedMetricPayload[] = [];

  for (const metricKey of selectedMetrics) {
    const metric = getMetricByKey(metricKey);
    if (!metric || !metric.healthConnect?.available) {
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
          provider: "health_connect",
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
  const recordType = metric.healthConnect?.recordType;
  if (!recordType) {
    return [];
  }

  try {
    // Use Health Connect SDK to fetch data via native module
    const records = await HealthConnect.readRecords(
      recordType,
      startDate.toISOString(),
      endDate.toISOString()
    );

    // Convert Health Connect records to our MetricSample format
    return records.map((record: any) => ({
      value: record.value,
      unit: record.unit || metric.unit,
      startDate: record.startDate,
      endDate: record.endDate || record.startDate,
      source: record.source || "Health Connect",
    }));
  } catch (error) {
    // Silently handle error
    return [];
  }
};

export const googleHealthService = {
  isAvailable,
  requestAuthorization,
  getAuthorizationStatus,
  fetchMetrics,
  openHealthConnect,
};

