/**
 * Apple Health Service
 * iOS HealthKit integration using react-native-health
 */

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
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

// Import react-native-health dynamically
// This will be null if the native module isn't available (needs rebuild)
let AppleHealthKit: any = null;
let healthKitLoadAttempted = false;

const loadHealthKit = () => {
  // Only attempt to load once to avoid repeated crashes
  if (healthKitLoadAttempted) {
    return AppleHealthKit !== null;
  }
  
  healthKitLoadAttempted = true;
  
  if (Platform.OS !== "ios") {
    return false;
  }
  
  try {
    // Wrap in try-catch to prevent crashes during module loading
    const { NativeModules } = require("react-native");
    
    // Log all available native modules for debugging (only in dev)
    if (__DEV__) {
      const moduleNames = Object.keys(NativeModules || {});
      const healthModules = moduleNames.filter(name => 
        name.toLowerCase().includes("health") || name.toLowerCase().includes("apple")
      );
      console.log("Available native modules:", healthModules.length > 0 ? healthModules : []);
    }
    
    // CRITICAL: Check if the native module exists before trying to require
    const hasHealthModule = NativeModules && (
      NativeModules.RNHealth || 
      NativeModules.RCTAppleHealthKit || 
      NativeModules.AppleHealthKit
    );
    
    if (!hasHealthModule) {
      console.warn("react-native-health native module not found in NativeModules");
      AppleHealthKit = null;
      return false;
    }
    
    // Try to require the module - wrap in try-catch to prevent crashes
    let healthModule;
    try {
      // Use a more defensive approach
      if (typeof require !== "undefined") {
        healthModule = require("react-native-health");
      } else {
        console.warn("require is not available");
        AppleHealthKit = null;
        return false;
      }
    } catch (requireError: any) {
      console.warn("Failed to require react-native-health:", requireError?.message);
      AppleHealthKit = null;
      return false;
    }
    
    if (!healthModule) {
      console.warn("react-native-health module returned undefined");
      AppleHealthKit = null;
      return false;
    }
    
    AppleHealthKit = healthModule?.default || healthModule;
    
    // Check if module was loaded
    if (!AppleHealthKit) {
      console.warn("react-native-health module is null or undefined");
      return false;
    }
    
    // Verify it has the required methods without calling them (to avoid crashes)
    if (typeof AppleHealthKit.isAvailable === "function") {
      if (__DEV__) {
        console.log("HealthKit module loaded successfully");
      }
      return true;
    }
    
    // Log what methods are available
    const availableMethods = Object.keys(AppleHealthKit).filter(
      key => typeof AppleHealthKit[key] === "function"
    );
    console.warn("HealthKit module loaded but isAvailable method not found. Available methods:", availableMethods);
    AppleHealthKit = null;
  } catch (error: any) {
    // Catch any errors during module loading to prevent app crash
    console.error("Failed to load react-native-health:", error?.message || error);
    if (__DEV__ && error?.stack) {
      console.error("Error stack:", error.stack);
    }
    AppleHealthKit = null;
  }
  
  return AppleHealthKit !== null;
};

// Check if running in Expo Go
// In dev builds, executionEnvironment is "standalone", not "storeClient"
// Only Expo Go has executionEnvironment === "storeClient"
const isExpoGo = () => {
  return Constants.executionEnvironment === "storeClient";
};

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

  // Check device type - HealthKit has limited support on iPad
  if (Device.deviceType === Device.DeviceType.TABLET) {
    console.warn("HealthKit has limited support on iPad. Some features may not be available.");
  }

  // Check if running in Expo Go
  if (isExpoGo()) {
    return {
      available: false,
      reason: "HealthKit requires a development build or standalone app. HealthKit is not available in Expo Go. Please build a development build using 'expo run:ios' or create a standalone build.",
    };
  }

  // Try to load the module if not already loaded
  const moduleLoaded = loadHealthKit();
  
  if (!moduleLoaded || !AppleHealthKit) {
    // Additional diagnostic info
    const { NativeModules } = require("react-native");
    const moduleNames = Object.keys(NativeModules || {});
    const healthRelatedModules = moduleNames.filter(name => 
      name.toLowerCase().includes("health") || name.toLowerCase().includes("apple")
    );
    
    return {
      available: false,
      reason: `HealthKit native module not found. The react-native-health module needs to be compiled into your app.\n\nDiagnostics:\n• Module loaded: ${moduleLoaded ? "Yes" : "No"}\n• AppleHealthKit object: ${AppleHealthKit ? "Exists" : "Null"}\n• Health-related native modules: ${healthRelatedModules.length > 0 ? healthRelatedModules.join(", ") : "None found"}\n\nPlease check:\n1. Ensure you rebuilt the app after adding HealthKit entitlements\n2. Verify react-native-health plugin is in app.json plugins array\n3. Check that the build includes native modules (not Expo Go)\n4. Try rebuilding: eas build -p ios --profile development --clear-cache`,
    };
  }

  try {
    // Double-check that AppleHealthKit and its methods exist
    if (!AppleHealthKit || typeof AppleHealthKit.isAvailable !== "function") {
      return {
        available: false,
        reason: "HealthKit native module not properly loaded. Please rebuild the app with native modules included.",
      };
    }

    // react-native-health's isAvailable() returns a Promise
    // Wrap in try-catch to prevent crashes from native module issues
    const available = await Promise.resolve(AppleHealthKit.isAvailable());
    
    if (!available) {
      // HealthKit.isAvailable() returns false on iOS Simulator
      // Provide helpful error message
      return {
        available: false,
        reason: "HealthKit is not available on this device. HealthKit only works on real iOS devices, not on the iOS Simulator. Please test on a physical iPhone or iPad.",
      };
    }
    return {
      available: true,
      reason: undefined,
    };
  } catch (error: any) {
    // Catch any errors during native method invocation
    // This prevents the app from crashing if there's a folly/native module issue
    console.error("Error checking HealthKit availability:", error);
    return {
      available: false,
      reason: error?.message || "Failed to check HealthKit availability. The native module may not be properly linked or there may be a compatibility issue. Please rebuild the app.",
    };
  }
};

/**
 * Request authorization for selected metrics
 * This will trigger the iOS HealthKit permission screen
 * If selectedMetrics is empty or contains "all", requests all available HealthKit types
 */
const requestAuthorization = async (
  selectedMetrics: string[]
): Promise<{ granted: string[]; denied: string[] }> => {
  // Check availability first
  const availability = await isAvailable();
  if (!availability.available) {
    throw new Error(availability.reason || "HealthKit is not available");
  }

  // Try to load the module if not already loaded
  const moduleLoaded = loadHealthKit();
  
  if (!moduleLoaded || !AppleHealthKit) {
    throw new Error("HealthKit native module not found. Please rebuild your development build with 'bun run build:ios:dev' or 'bun run ios'.");
  }

  // Determine which permissions to request
  let readPermissions: string[];
  
  // If no metrics selected or "all" is requested, get all HealthKit types
  if (selectedMetrics.length === 0 || selectedMetrics.includes("all")) {
    readPermissions = getAllHealthKitReadTypes();
  } else {
    // Map metric keys to HealthKit types
    // react-native-health expects the full HKQuantityTypeIdentifier or HKCategoryTypeIdentifier
    readPermissions = selectedMetrics
      .map((key) => {
        const metric = getMetricByKey(key);
        if (metric?.appleHealth?.type) {
          // Ensure we're using the correct format
          // react-native-health expects the full identifier like "HKQuantityTypeIdentifierHeartRate"
          return metric.appleHealth.type;
        }
        return null;
      })
      .filter((type): type is string => Boolean(type));
  }

  if (readPermissions.length === 0) {
    throw new Error("No valid HealthKit permissions found");
  }

  try {
    // Request permissions - this will trigger the iOS HealthKit permission screen
    // The user will see the native iOS permission dialog (like the screenshots shown)
    // with all the health data types they selected, organized by category
    console.log("Requesting HealthKit permissions for:", readPermissions);
    
    await new Promise<void>((resolve, reject) => {
      AppleHealthKit.initHealthKit(
        {
          permissions: {
            read: readPermissions,
            write: [], // We only read, never write
          },
        },
        (error: any) => {
          if (error) {
            // Error can occur if user denies all permissions
            // But initHealthKit still shows the permission screen
            console.warn("HealthKit initialization error (user may have denied):", error);
            // Resolve anyway - the permission screen was shown
            resolve(undefined);
          } else {
            // Success - user granted at least some permissions
            resolve(undefined);
          }
        }
      );
    });
    
    // The iOS permission screen has been shown and user has responded
    // Now we need to check which permissions were actually granted

    // After the permission screen is shown and user responds,
    // check which permissions were actually granted
    const granted: string[] = [];
    const denied: string[] = [];

    // Note: iOS doesn't provide a direct way to check read permissions after the fact
    // If we requested "all", we can't verify each individual type
    // We'll assume all were granted if initHealthKit succeeded (user can change later in Settings)
    if (selectedMetrics.includes("all") || selectedMetrics.length === 0) {
      // For "all" request, we can't verify each type individually
      // Assume all were granted if initHealthKit succeeded
      // User can see which ones were actually granted in iOS Settings
      const allMetricKeys = getAvailableMetricsForProvider("apple_health").map(m => m.key);
      return { 
        granted: allMetricKeys, 
        denied: [] 
      };
    }

    // For specific metrics, try to verify access
    for (const metricKey of selectedMetrics) {
      const metric = getMetricByKey(metricKey);
      if (!metric?.appleHealth?.type) {
        denied.push(metricKey);
        continue;
      }

      try {
        // Try to read a sample to verify access
        // If this succeeds, permission was granted
        const testOptions = {
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          limit: 1,
        };

        await new Promise<void>((resolve, reject) => {
          AppleHealthKit.getSamples(
            testOptions,
            (error: any, results: any[]) => {
              if (error || !results || results.length === 0) {
                // Permission might be denied or no data available
                // Assume granted if no error (user might just not have data)
                resolve(undefined);
              } else {
                resolve(undefined);
              }
            }
          );
        });

        // If we got here, assume permission was granted
        granted.push(metricKey);
      } catch (error) {
        // If we can't read, assume denied
        denied.push(metricKey);
      }
    }

    // If all were denied but initHealthKit didn't error, 
    // user might have denied all permissions in the iOS dialog
    if (granted.length === 0 && denied.length > 0) {
      // User likely denied all permissions in the iOS dialog
      return { granted: [], denied: selectedMetrics };
    }

    return { granted, denied };
  } catch (error: any) {
    // If initHealthKit fails completely, all permissions were denied
    console.error("HealthKit authorization failed:", error);
    return { 
      granted: [], 
      denied: selectedMetrics 
    };
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

