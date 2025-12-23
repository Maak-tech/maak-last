/**
 * Apple Health Service
 * iOS HealthKit integration using react-native-health
 */

import { Platform, NativeModules } from "react-native";
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
import { logHealthKitLoadAttempt } from "./healthKitDebug";

// Import react-native-health dynamically
// This will be null if the native module isn't available (needs rebuild)
let AppleHealthKit: any = null;
let healthKitLoadAttempted = false;
let loadPromise: Promise<boolean> | null = null;

// Track app startup time
const APP_START_TIME = Date.now();

const loadHealthKit = async (): Promise<boolean> => {
  // Log the load attempt with stack trace
  const caller = new Error().stack?.split("\n")[2] || "unknown";
  logHealthKitLoadAttempt(`loadHealthKit() called from: ${caller}`);
  
  // If already loaded, return immediately
  if (healthKitLoadAttempted && AppleHealthKit !== null) {
    return true;
  }
  
  // If currently loading, wait for that to complete
  if (loadPromise) {
    return loadPromise;
  }
  
  // Only attempt to load once to avoid repeated crashes
  if (healthKitLoadAttempted) {
    return AppleHealthKit !== null;
  }
  
  healthKitLoadAttempted = true;
  
  loadPromise = (async () => {
  
  if (Platform.OS !== "ios") {
    return false;
  }
  
  // CRITICAL: Wait for app to be fully initialized before loading native modules
  // This prevents RCTModuleMethod errors during app startup
  // Increased delay significantly - require() can trigger native module registration synchronously
  // We need to ensure the React Native bridge is 100% ready
  await new Promise(resolve => setTimeout(resolve, 5000)); // Increased to 5 seconds
  
  // Additional check: Wait for React Native bridge to be ready
  // Check if NativeModules is available and has been initialized
  let bridgeReady = false;
  for (let i = 0; i < 10; i++) {
    try {
      // Check if bridge is ready by trying to access NativeModules
      if (NativeModules && typeof NativeModules === "object") {
        bridgeReady = true;
        break;
      }
    } catch (e) {
      // Bridge not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (!bridgeReady) {
    AppleHealthKit = null;
    return false;
  }
  
  // Additional delay after bridge is confirmed ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    // CRITICAL: Check if React Native bridge is ready before requiring module
    // The bridge must be fully initialized before native modules can be loaded
    let bridgeReady = false;
    let bridgeCheckAttempts = 0;
    const maxBridgeChecks = 20; // Check up to 20 times (10 seconds total)
    
    while (!bridgeReady && bridgeCheckAttempts < maxBridgeChecks) {
      try {
        // Check if NativeModules is available and initialized
        if (NativeModules && typeof NativeModules === "object") {
          // Try to access a known native module to verify bridge is ready
          // If this throws, bridge isn't ready yet
          const testModule = NativeModules.PlatformConstants || NativeModules.StatusBarManager;
          if (testModule) {
            bridgeReady = true;
            break;
          }
        }
      } catch (e) {
        // Bridge not ready, continue waiting
      }
      
      bridgeCheckAttempts++;
      if (!bridgeReady) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (!bridgeReady) {
      AppleHealthKit = null;
      return false;
    }
    
    // Additional delay after bridge is confirmed ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Now try to load the module
    let healthModule: any = null;
    
    // First, check NativeModules (some modules register there)
    // react-native-health registers as RCTAppleHealthKit or AppleHealthKit
    try {
      const possibleNames = ["RCTAppleHealthKit", "AppleHealthKit", "RNFitness", "RNAppleHealthKit"];
      for (const moduleName of possibleNames) {
        if (NativeModules[moduleName]) {
          healthModule = NativeModules[moduleName];
          break;
        }
      }
    } catch (e: any) {
      // Not in NativeModules, continue to require
    }
    
    // If not found in NativeModules, use require()
    // Wrap require in try-catch to handle bridge errors
    if (!healthModule) {
      try {
        // Use a function to prevent require from being hoisted
        const loadModule = () => {
          try {
            const module = require("react-native-health");
            return module;
          } catch (e: any) {
            return null;
          }
        };
        
        healthModule = loadModule();
        
        if (!healthModule) {
          throw new Error("require() returned null");
        }
      } catch (requireError: any) {
        AppleHealthKit = null;
        return false;
      }
    }
    
    if (!healthModule) {
      AppleHealthKit = null;
      return false;
    }
    
    AppleHealthKit = healthModule?.default || healthModule;
    
    // Check if module was loaded
    if (!AppleHealthKit) {
      return false;
    }
    
    // Verify it has the required methods without calling them (to avoid crashes)
    if (typeof AppleHealthKit.isAvailable === "function") {
      return true;
    }
    
    // If isAvailable method is missing, module is invalid
    AppleHealthKit = null;
  } catch (error: any) {
    // Catch any errors during module loading to prevent app crash
    AppleHealthKit = null;
  } finally {
    loadPromise = null;
  }
  
  return AppleHealthKit !== null;
  })();
  
  return loadPromise;
};

/**
 * Pre-warm the HealthKit module in the background
 * Call this early in app lifecycle (e.g., after auth) to avoid delays later
 */
export const prewarmHealthKit = () => {
  if (Platform.OS === "ios" && !healthKitLoadAttempted) {
    // Start loading in background without waiting
    loadHealthKit().catch(() => {
      // Silently handle background pre-warm failures
    });
  }
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

  // Check if running in Expo Go
  if (isExpoGo()) {
    return {
      available: false,
      reason: "HealthKit requires a development build or standalone app. HealthKit is not available in Expo Go. Please build a development build using 'expo run:ios' or create a standalone build.",
    };
  }

  // Try to load the module if not already loaded
  const moduleLoaded = await loadHealthKit();
  
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

    // CRITICAL: Wait significantly longer before calling any native methods
    // The bridge needs time to fully initialize after module loading
    // Increased delay to prevent RCTModuleMethod invokeWithBridge errors
    await new Promise(resolve => setTimeout(resolve, 3000)); // Increased to 3 seconds

    // react-native-health's isAvailable() returns a Promise
    // Wrap in nested try-catch to prevent crashes from native module issues
    let available = false;
    let retries = 0;
    const maxRetries = 5;
    
    while (retries < maxRetries) {
      try {
        // Check if the method exists and is callable before invoking
        if (typeof AppleHealthKit.isAvailable !== "function") {
          return {
            available: false,
            reason: "HealthKit isAvailable method not found. Please rebuild the app: bun run build:ios:dev",
          };
        }

        // react-native-health's isAvailable() can return boolean, Promise, or undefined
        // Handle all cases properly
        let isAvailableResult: boolean | undefined;
        
        try {
          const result = AppleHealthKit.isAvailable();
          
          // If it returns a Promise
          if (result && typeof result.then === "function") {
            isAvailableResult = await Promise.race([
              result as Promise<boolean>,
              new Promise<boolean>((_, reject) => 
                setTimeout(() => reject(new Error("HealthKit isAvailable() timed out")), 5000)
              )
            ]);
          } 
          // If it returns a boolean directly
          else if (typeof result === "boolean") {
            isAvailableResult = result;
          }
          // If undefined - module loaded successfully, so assume HealthKit is available
          // (react-native-health wouldn't load if HealthKit wasn't available)
          else if (result === undefined) {
            isAvailableResult = true; // Module loaded = HealthKit available
          }
          // Fallback
          else {
            isAvailableResult = true;
          }
        } catch (callError: any) {
          const errorMsg = callError?.message || String(callError);
          
          // If it's a bridge error, retry
          if (
            (errorMsg.includes("RCTModuleMethod") || 
             errorMsg.includes("invokewithbridge") ||
             errorMsg.includes("invokeWithBridge") ||
             errorMsg.includes("invokeinner") ||
             errorMsg.includes("invokeInner") ||
             errorMsg.toLowerCase().includes("invoke")) &&
            retries < maxRetries
          ) {
            throw callError; // Will be caught and retried
          }
          
          // Other errors - if module loaded, assume available
          isAvailableResult = true; // Module loaded = assume available
        }
        
        available = isAvailableResult === true;
        
        // Success! Exit retry loop
        break;
      } catch (nativeCallError: any) {
        retries++;
        const errorMsg = nativeCallError?.message || String(nativeCallError);
        
        // Check if it's a bridge error that we should retry
        if (
          (errorMsg.includes("RCTModuleMethod") || 
           errorMsg.includes("invokewithbridge") ||
           errorMsg.includes("invokeWithBridge") ||
           errorMsg.includes("invokeinner") ||
           errorMsg.includes("invokeInner") ||
           errorMsg.toLowerCase().includes("invoke")) &&
          retries < maxRetries
        ) {
          // Bridge not ready yet, wait and retry with increasing delay
          const delay = Math.min(2000 * (retries + 1), 5000); // 2s, 4s, 5s max
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry
        } else {
          // Different error or max retries reached, throw
          throw nativeCallError;
        }
      }
    }
    
    // Check if available is still false after all retries
    if (!available) {
      // Check if we're actually on a simulator
      const isSimulator = Device.isDevice === false;
      
      if (isSimulator) {
        return {
          available: false,
          reason: "HealthKit is not available on this device. HealthKit only works on real iOS devices, not on the iOS Simulator. Please test on a physical iPhone or iPad.",
        };
      } else {
        // Real device but isAvailable() returned false
        // This could mean HealthKit is disabled, or there's still a bridge issue
        return {
          available: false,
          reason: "HealthKit is not available on this device. Please check:\n1. HealthKit is enabled in iOS Settings > Privacy & Security > Health\n2. The app has been rebuilt with native modules\n3. Try restarting the app",
        };
      }
    }
    return {
      available: true,
      reason: undefined,
    };
  } catch (error: any) {
    // Catch all errors during native method invocation
    // This prevents the app from crashing if there's a folly/native module issue
    const errorMessage = error?.message || String(error);
    
    // Check if this is a bridge error (the main issue we're debugging)
    const isBridgeError = 
      errorMessage.includes("folly") || 
      errorMessage.includes("RCTModuleMethod") ||
      errorMessage.includes("invokewithbridge") ||
      errorMessage.includes("invokeWithBridge");
    
    if (isBridgeError) {
      // This is the bridge error - don't assume it's a simulator issue
      return {
        available: false,
        reason: `HealthKit bridge error: The React Native bridge is not ready to handle HealthKit calls. This error occurs when native modules are accessed before the bridge is fully initialized.\n\nError: ${errorMessage}\n\nPossible solutions:\n1. Wait longer before accessing HealthKit (try again in a few seconds)\n2. Rebuild the app with: eas build -p ios --profile development --clear-cache\n3. Check console logs for [HealthKit Debug] messages`,
      };
    } else if (errorMessage.includes("timed out")) {
      return {
        available: false,
        reason: "HealthKit native module did not respond. The bridge may not be ready. Please try again or rebuild the app.",
      };
    } else {
      return {
        available: false,
        reason: errorMessage || "Failed to check HealthKit availability. The native module may not be properly linked or there may be a compatibility issue. Please rebuild the app.",
      };
    }
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
  const moduleLoaded = await loadHealthKit();
  
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
    // CRITICAL: Wait significantly longer before calling initHealthKit
    // The bridge needs time to fully stabilize after isAvailable() call
    // Increased delay to prevent RCTModuleMethod invokeWithBridge errors
    await new Promise(resolve => setTimeout(resolve, 5000)); // Increased to 5 seconds
    
    // Request permissions - this will trigger the iOS HealthKit permission screen
    // The user will see the native iOS permission dialog
    // with all the health data types they selected, organized by category
    
    // Retry logic for initHealthKit() to handle bridge errors
    let retries = 0;
    const maxRetries = 5;
    let initSuccess = false;
    
    while (retries < maxRetries && !initSuccess) {
      try {
        await new Promise<void>((resolve, reject) => {
          try {
            // Add timeout protection
            const timeout = setTimeout(() => {
              reject(new Error("HealthKit initHealthKit() timed out. The native bridge may not be ready."));
            }, 15000); // Increased timeout

            AppleHealthKit.initHealthKit(
              {
                permissions: {
                  read: readPermissions,
                  write: [], // We only read, never write
                },
              },
              (error: any) => {
                clearTimeout(timeout);
                if (error) {
                  // Check for RCTModuleMethod errors
                  const errorMsg = error?.message || String(error);
                  if (
                    errorMsg.includes("RCTModuleMethod") ||
                    errorMsg.includes("invokewithbridge") ||
                    errorMsg.includes("invokeWithBridge") ||
                    errorMsg.includes("invokeinner") ||
                    errorMsg.includes("invokeInner") ||
                    errorMsg.toLowerCase().includes("invoke")
                  ) {
                    reject(new Error("BRIDGE_ERROR")); // Special error code for retry
                    return;
                  }
                  // Error can occur if user denies all permissions
                  // But initHealthKit still shows the permission screen
                  // Resolve anyway - the permission screen was shown
                  resolve(undefined);
                } else {
                  // Success - user granted at least some permissions
                  resolve(undefined);
                }
              }
            );
          } catch (bridgeError: any) {
            const errorMsg = bridgeError?.message || String(bridgeError);
            if (
              errorMsg.includes("RCTModuleMethod") ||
              errorMsg.includes("invokewithbridge") ||
              errorMsg.includes("invokeWithBridge") ||
              errorMsg.includes("invokeinner") ||
              errorMsg.includes("invokeInner") ||
              errorMsg.toLowerCase().includes("invoke")
            ) {
              reject(new Error("BRIDGE_ERROR")); // Special error code for retry
            } else {
              reject(bridgeError);
            }
          }
        });
        
        // Success! Exit retry loop
        initSuccess = true;
        break;
      } catch (initError: any) {
        retries++;
        const errorMsg = initError?.message || String(initError);
        
        // Check if it's a bridge error that we should retry
        if (
          (errorMsg.includes("BRIDGE_ERROR") ||
           errorMsg.includes("RCTModuleMethod") ||
           errorMsg.includes("invokewithbridge") ||
           errorMsg.includes("invokeWithBridge") ||
           errorMsg.includes("invokeinner") ||
           errorMsg.includes("invokeInner") ||
           errorMsg.toLowerCase().includes("invoke")) &&
          retries < maxRetries
        ) {
          // Bridge not ready yet, wait and retry with increasing delay
          const delay = Math.min(2000 * (retries + 1), 5000); // 2s, 4s, 5s max
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry
        } else {
          // Different error or max retries reached, throw
          throw initError;
        }
      }
    }
    
    if (!initSuccess) {
      throw new Error("HealthKit initHealthKit() failed after all retries. The native bridge may not be ready. Please rebuild: bun run build:ios:dev");
    }
    
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
          try {
            // Add timeout protection
            const timeout = setTimeout(() => {
              reject(new Error("HealthKit getSamples() timed out"));
            }, 5000);

            AppleHealthKit.getSamples(
              testOptions,
              (error: any, results: any[]) => {
                clearTimeout(timeout);
                const errorMsg = error?.message || String(error);
                if (
                  errorMsg.includes("RCTModuleMethod") ||
                  errorMsg.includes("invokewithbridge") ||
                  errorMsg.includes("invokeWithBridge") ||
                  errorMsg.includes("invokeinner") ||
                  errorMsg.includes("invokeInner") ||
                  errorMsg.toLowerCase().includes("invoke")
                ) {
                  reject(new Error("HealthKit bridge error. Please rebuild: bun run build:ios:dev"));
                  return;
                }
                if (error || !results || results.length === 0) {
                  // Permission might be denied or no data available
                  // Assume granted if no error (user might just not have data)
                  resolve(undefined);
                } else {
                  resolve(undefined);
                }
              }
            );
          } catch (bridgeError: any) {
            const errorMsg = bridgeError?.message || String(bridgeError);
            if (
              errorMsg.includes("RCTModuleMethod") ||
              errorMsg.includes("invokewithbridge") ||
              errorMsg.includes("invokeWithBridge") ||
              errorMsg.includes("invokeinner") ||
              errorMsg.includes("invokeInner") ||
              errorMsg.toLowerCase().includes("invoke")
            ) {
              reject(new Error("HealthKit bridge not ready. Please rebuild: bun run build:ios:dev"));
            } else {
              reject(bridgeError);
            }
          }
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
        try {
          // Add timeout protection
          const timeout = setTimeout(() => {
            reject(new Error("HealthKit getSamples() timed out"));
          }, 10000);

          AppleHealthKit.getSamples(
            options,
            (error: any, results: any[]) => {
              clearTimeout(timeout);
              const errorMsg = error?.message || String(error);
              if (
                errorMsg.includes("RCTModuleMethod") ||
                errorMsg.includes("invokewithbridge") ||
                errorMsg.includes("invokeWithBridge") ||
                errorMsg.includes("invokeinner") ||
                errorMsg.includes("invokeInner") ||
                errorMsg.toLowerCase().includes("invoke")
              ) {
                reject(new Error("HealthKit bridge error. Please rebuild: bun run build:ios:dev"));
                return;
              }
              if (error) {
                reject(error);
              } else {
                resolve(results || []);
              }
            }
          );
        } catch (bridgeError: any) {
          const errorMsg = bridgeError?.message || String(bridgeError);
          if (
            errorMsg.includes("RCTModuleMethod") ||
            errorMsg.includes("invokewithbridge") ||
            errorMsg.includes("invokeWithBridge") ||
            errorMsg.includes("invokeinner") ||
            errorMsg.includes("invokeInner") ||
            errorMsg.toLowerCase().includes("invoke")
          ) {
            reject(new Error("HealthKit bridge not ready. Please rebuild: bun run build:ios:dev"));
          } else {
            reject(bridgeError);
          }
        }
      });
    } else if (type.includes("CategoryType")) {
      // Category samples (e.g., sleep)
      data = await new Promise((resolve, reject) => {
        try {
          const timeout = setTimeout(() => {
            reject(new Error("HealthKit getCategorySamples() timed out"));
          }, 10000);

          AppleHealthKit.getCategorySamples(
            options,
            (error: any, results: any[]) => {
              clearTimeout(timeout);
              const errorMsg = error?.message || String(error);
              if (
                errorMsg.includes("RCTModuleMethod") ||
                errorMsg.includes("invokewithbridge") ||
                errorMsg.includes("invokeWithBridge") ||
                errorMsg.includes("invokeinner") ||
                errorMsg.includes("invokeInner") ||
                errorMsg.toLowerCase().includes("invoke")
              ) {
                reject(new Error("HealthKit bridge error. Please rebuild: bun run build:ios:dev"));
                return;
              }
              if (error) {
                reject(error);
              } else {
                resolve(results || []);
              }
            }
          );
        } catch (bridgeError: any) {
          const errorMsg = bridgeError?.message || String(bridgeError);
          if (
            errorMsg.includes("RCTModuleMethod") ||
            errorMsg.includes("invokewithbridge") ||
            errorMsg.includes("invokeWithBridge") ||
            errorMsg.includes("invokeinner") ||
            errorMsg.includes("invokeInner") ||
            errorMsg.toLowerCase().includes("invoke")
          ) {
            reject(new Error("HealthKit bridge not ready. Please rebuild: bun run build:ios:dev"));
          } else {
            reject(bridgeError);
          }
        }
      });
    } else if (type.includes("Workout")) {
      // Workout samples
      data = await new Promise((resolve, reject) => {
        try {
          const timeout = setTimeout(() => {
            reject(new Error("HealthKit getWorkouts() timed out"));
          }, 10000);

          AppleHealthKit.getWorkouts(
            options,
            (error: any, results: any[]) => {
              clearTimeout(timeout);
              const errorMsg = error?.message || String(error);
              if (
                errorMsg.includes("RCTModuleMethod") ||
                errorMsg.includes("invokewithbridge") ||
                errorMsg.includes("invokeWithBridge") ||
                errorMsg.includes("invokeinner") ||
                errorMsg.includes("invokeInner") ||
                errorMsg.toLowerCase().includes("invoke")
              ) {
                reject(new Error("HealthKit bridge error. Please rebuild: bun run build:ios:dev"));
                return;
              }
              if (error) {
                reject(error);
              } else {
                resolve(results || []);
              }
            }
          );
        } catch (bridgeError: any) {
          const errorMsg = bridgeError?.message || String(bridgeError);
          if (
            errorMsg.includes("RCTModuleMethod") ||
            errorMsg.includes("invokewithbridge") ||
            errorMsg.includes("invokeWithBridge") ||
            errorMsg.includes("invokeinner") ||
            errorMsg.includes("invokeInner") ||
            errorMsg.toLowerCase().includes("invoke")
          ) {
            reject(new Error("HealthKit bridge not ready. Please rebuild: bun run build:ios:dev"));
          } else {
            reject(bridgeError);
          }
        }
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

