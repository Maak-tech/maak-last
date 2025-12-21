import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

// iOS HealthKit permissions - correct format for react-native-health
const HealthKitPermissions = {
  permissions: {
    read: [
      "HeartRate",
      "StepCount",
      "SleepAnalysis",
      "BloodPressure",
      "BodyTemperature",
      "Weight",
      "Height",
      "RespiratoryRate",
      "OxygenSaturation",
      "ActiveEnergyBurned",
      "DistanceWalkingRunning",
    ],
    write: ["StepCount", "Weight", "Height"],
  },
};

// Android Health Connect types
const AndroidHealthPermissions = [
  "android.permission.health.READ_HEART_RATE",
  "android.permission.health.READ_STEPS",
  "android.permission.health.READ_SLEEP",
  "android.permission.health.READ_BODY_TEMPERATURE",
  "android.permission.health.READ_BLOOD_PRESSURE",
  "android.permission.health.READ_WEIGHT",
  "android.permission.activity_recognition",
];

export interface VitalSigns {
  heartRate?: number;
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  weight?: number;
  height?: number;
  steps?: number;
  sleepHours?: number;
  bodyTemperature?: number;
  oxygenSaturation?: number;
  timestamp: Date;
}

export interface HealthDataSummary {
  heartRate: {
    current: number;
    average: number;
    trend: "up" | "down" | "stable";
  };
  steps: {
    today: number;
    average: number;
    goal: number;
  };
  sleep: {
    lastNight: number;
    average: number;
    quality: "good" | "fair" | "poor";
  };
  weight: {
    current: number;
    change: number;
    trend: "up" | "down" | "stable";
  };
  lastSyncTime: Date;
}

const HEALTH_DATA_STORAGE_KEY = "@maak_health_data";
const PERMISSIONS_STORAGE_KEY = "@maak_health_permissions";

export const healthDataService = {
  // Initialize health data access (Expo-compatible)
  async initializeHealthData(): Promise<boolean> {
    try {
      if (Platform.OS === "ios") {
        // For iOS, check if we're in Expo Go or standalone app
        const isExpoGo =
          Constants.executionEnvironment === "storeClient" ||
          !Constants.appOwnership ||
          Constants.appOwnership === "expo";

        if (isExpoGo) {
          // For demo purposes in Expo Go, simulate permission granted
          await this.savePermissionStatus(true);
          return true;
        }
        // Try to initialize HealthKit in standalone app
        try {
          // Import react-native-health correctly
          let AppleHealthKit: any = null;
          try {
            // react-native-health exports directly, not as .default
            const healthModule = require("react-native-health");
            AppleHealthKit = healthModule.default || healthModule;
          } catch (importError) {
            // Module not available - need to rebuild
            console.warn("HealthKit module not found. Please rebuild with: bun run build:ios:dev");
            await this.savePermissionStatus(false);
            return false;
          }

          // Check if the native module is available
          if (!AppleHealthKit || typeof AppleHealthKit.isAvailable !== "function") {
            console.warn("HealthKit module not properly initialized. Please rebuild with: bun run build:ios:dev");
            await this.savePermissionStatus(false);
            return false;
          }

          // Check if HealthKit is available on device - wrap in try-catch to prevent crashes
          let isAvailable = false;
          try {
            isAvailable = await Promise.resolve(AppleHealthKit.isAvailable());
          } catch (availError) {
            console.warn("Error checking HealthKit availability:", availError);
            await this.savePermissionStatus(false);
            return false;
          }

          if (!isAvailable) {
            console.warn("HealthKit is not available on this device");
            await this.savePermissionStatus(false);
            return false;
          }

          // Initialize HealthKit with permissions
          return new Promise((resolve) => {
            try {
              AppleHealthKit.initHealthKit(HealthKitPermissions, (error: any) => {
                if (error) {
                  console.error("HealthKit initialization error:", error);
                  this.savePermissionStatus(false);
                  resolve(false);
                } else {
                  this.savePermissionStatus(true);
                  resolve(true);
                }
              });
            } catch (initError) {
              console.error("HealthKit initialization crashed:", initError);
              this.savePermissionStatus(false);
              resolve(false);
            }
          });
        } catch (error: any) {
          console.error("HealthKit initialization failed:", error);
          await this.savePermissionStatus(false);
          return false;
        }
      } else if (Platform.OS === "android") {
        // For Android, use simulated data for now
        // In production build, you'd implement Google Fit integration
        await this.savePermissionStatus(true);
        return true;
      } else {
        return false;
      }
    } catch {
      // Don't fail completely, provide simulated data
      await this.savePermissionStatus(true);
      return true;
    }
  },

  // Check if health permissions are granted
  async hasHealthPermissions(): Promise<boolean> {
    try {
      const status = await AsyncStorage.getItem(PERMISSIONS_STORAGE_KEY);
      return status === "true";
    } catch {
      return false;
    }
  },

  // Save permission status
  async savePermissionStatus(granted: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(PERMISSIONS_STORAGE_KEY, granted.toString());
    } catch {
      // Silently handle error
    }
  },

  // Get latest vital signs
  async getLatestVitals(): Promise<VitalSigns | null> {
    try {
      const hasPermissions = await this.hasHealthPermissions();
      if (!hasPermissions) {
        return null;
      }

      if (Platform.OS === "ios") {
        return await this.getIOSVitals();
      }
      if (Platform.OS === "android") {
        return await this.getAndroidVitals();
      }

      return null;
    } catch {
      return null;
    }
  },

  // iOS HealthKit data retrieval (with fallback)
  async getIOSVitals(): Promise<VitalSigns | null> {
    try {
      // Check if HealthKit is available
      try {
        let AppleHealthKit: any = null;
        try {
          // react-native-health exports directly, not as .default
          const healthModule = require("react-native-health");
          AppleHealthKit = healthModule.default || healthModule;
        } catch (importError) {
          throw new Error("HealthKit module not found. Please rebuild with: bun run build:ios:dev");
        }

        if (
          !AppleHealthKit ||
          typeof AppleHealthKit.getHeartRateSamples !== "function"
        ) {
          throw new Error("HealthKit not available. Please rebuild with: bun run build:ios:dev");
        }

        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

        const options = {
          startDate: yesterday.toISOString(),
          endDate: today.toISOString(),
        };

        return new Promise((resolve, reject) => {
          // Get multiple health data points
          const promises = [
            // Heart Rate
            new Promise((resolve) => {
              AppleHealthKit.getHeartRateSamples(
                options,
                (error: any, results: any) => {
                  if (error || !results || results.length === 0) {
                    resolve(null);
                  } else {
                    const latest = results[results.length - 1];
                    resolve(latest.value);
                  }
                }
              );
            }),

            // Steps
            new Promise((resolve) => {
              AppleHealthKit.getStepCount(
                options,
                (error: any, results: any) => {
                  if (error || !results) {
                    resolve(null);
                  } else {
                    resolve(results.value);
                  }
                }
              );
            }),

            // Weight
            new Promise((resolve) => {
              AppleHealthKit.getWeightSamples(
                options,
                (error: any, results: any) => {
                  if (error || !results || results.length === 0) {
                    resolve(null);
                  } else {
                    const latest = results[results.length - 1];
                    resolve(latest.value);
                  }
                }
              );
            }),

            // Sleep
            new Promise((resolve) => {
              AppleHealthKit.getSleepSamples(
                options,
                (error: any, results: any) => {
                  if (error || !results || results.length === 0) {
                    resolve(null);
                  } else {
                    // Calculate total sleep time
                    const totalMinutes = results.reduce(
                      (sum: number, sample: any) => {
                        if (sample.value === "ASLEEP") {
                          const start = new Date(sample.startDate);
                          const end = new Date(sample.endDate);
                          return (
                            sum +
                            (end.getTime() - start.getTime()) / (1000 * 60)
                          );
                        }
                        return sum;
                      },
                      0
                    );
                    resolve(totalMinutes / 60); // Convert to hours
                  }
                }
              );
            }),
          ];

          Promise.all(promises)
            .then(([heartRate, steps, weight, sleepHours]) => {
              const vitals: VitalSigns = {
                heartRate: (heartRate as number) || undefined,
                steps: (steps as number) || undefined,
                weight: (weight as number) || undefined,
                sleepHours: (sleepHours as number) || undefined,
                timestamp: new Date(),
              };

              resolve(vitals);
            })
            .catch(reject);
        });
      } catch (error) {
        // Return simulated iOS data
        return this.getSimulatedVitals();
      }
    } catch {
      return this.getSimulatedVitals();
    }
  },

  // Generate simulated vitals for demo/development
  async getSimulatedVitals(): Promise<VitalSigns> {
    // Generate realistic health data for demonstration
    const baseHeartRate = 70;
    const baseSteps = 6000;
    const baseSleep = 7.5;
    const baseWeight = 70;

    return {
      heartRate: baseHeartRate + Math.floor(Math.random() * 20) - 10, // 60-80 BPM
      steps: baseSteps + Math.floor(Math.random() * 4000), // 6000-10000 steps
      sleepHours: baseSleep + Math.random() * 2 - 1, // 6.5-8.5 hours
      weight: baseWeight + Math.random() * 10 - 5, // 65-75 kg
      bodyTemperature: 36.5 + Math.random() * 1, // 36.5-37.5°C
      bloodPressure: {
        systolic: 110 + Math.floor(Math.random() * 30), // 110-140
        diastolic: 70 + Math.floor(Math.random() * 20), // 70-90
      },
      oxygenSaturation: 95 + Math.floor(Math.random() * 5), // 95-100%
      timestamp: new Date(),
    };
  },

  // Android Google Fit data retrieval (with fallback to simulated data)
  async getAndroidVitals(): Promise<VitalSigns | null> {
    try {
      // For Android, we'll use simulated data that looks realistic
      // In a production build, you'd integrate with Google Fit APIs
      return await this.getSimulatedVitals();
    } catch {
      return await this.getSimulatedVitals();
    }
  },

  // Get health data summary for dashboard
  async getHealthSummary(): Promise<HealthDataSummary | null> {
    try {
      const vitals = await this.getLatestVitals();
      if (!vitals) return null;

      // For demo purposes, we'll create a summary from current data
      // In production, you'd calculate averages from historical data
      const summary: HealthDataSummary = {
        heartRate: {
          current: vitals.heartRate || 0,
          average: vitals.heartRate ? vitals.heartRate - 5 : 0,
          trend: "stable",
        },
        steps: {
          today: vitals.steps || 0,
          average: vitals.steps ? Math.floor(vitals.steps * 0.8) : 0,
          goal: 10_000,
        },
        sleep: {
          lastNight: vitals.sleepHours || 0,
          average: 7.5,
          quality:
            vitals.sleepHours && vitals.sleepHours >= 7 ? "good" : "fair",
        },
        weight: {
          current: vitals.weight || 0,
          change: 0,
          trend: "stable",
        },
        lastSyncTime: new Date(),
      };

      return summary;
    } catch {
      return null;
    }
  },

  // Sync health data (store locally and/or send to server)
  async syncHealthData(): Promise<void> {
    try {
      const vitals = await this.getLatestVitals();
      if (!vitals) return;

      // Store locally
      await AsyncStorage.setItem(
        HEALTH_DATA_STORAGE_KEY,
        JSON.stringify(vitals)
      );
    } catch {
      // Silently handle error
    }
  },

  // Get stored health data
  async getStoredHealthData(): Promise<VitalSigns | null> {
    try {
      const stored = await AsyncStorage.getItem(HEALTH_DATA_STORAGE_KEY);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      };
    } catch {
      return null;
    }
  },

  // Request health permissions
  async requestHealthPermissions(): Promise<boolean> {
    try {
      return await this.initializeHealthData();
    } catch {
      return false;
    }
  },

  // Format vital signs for display
  formatVitalSigns(vitals: VitalSigns) {
    return {
      heartRate: vitals.heartRate
        ? `${Math.round(vitals.heartRate)} BPM`
        : "N/A",
      steps: vitals.steps ? vitals.steps.toLocaleString() : "N/A",
      sleep: vitals.sleepHours ? `${vitals.sleepHours.toFixed(1)}h` : "N/A",
      weight: vitals.weight ? `${vitals.weight.toFixed(1)} kg` : "N/A",
      bloodPressure: vitals.bloodPressure
        ? `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}`
        : "N/A",
      temperature: vitals.bodyTemperature
        ? `${vitals.bodyTemperature.toFixed(1)}°C`
        : "N/A",
    };
  },
};
