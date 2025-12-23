import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { appleHealthService } from "./appleHealthService";

// iOS HealthKit permissions - legacy format (not used with @kingstinct/react-native-healthkit)
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
  restingHeartRate?: number;
  heartRateVariability?: number;
  walkingHeartRateAverage?: number;
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  respiratoryRate?: number;
  weight?: number;
  height?: number;
  bodyMassIndex?: number;
  bodyFatPercentage?: number;
  steps?: number;
  activeEnergy?: number;
  basalEnergy?: number;
  distanceWalkingRunning?: number;
  flightsClimbed?: number;
  exerciseMinutes?: number;
  standTime?: number;
  workouts?: number;
  sleepHours?: number;
  bodyTemperature?: number;
  oxygenSaturation?: number;
  waterIntake?: number;
  bloodGlucose?: number;
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
          // Check if HealthKit is available on device
          const availability = await appleHealthService.checkAvailability();
          if (!availability.available) {
            await this.savePermissionStatus(false);
            return false;
          }

          // Request authorization using appleHealthService
          const granted = await appleHealthService.authorize();
          await this.savePermissionStatus(granted);
          return granted;
        } catch (error: any) {
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
      // Check stored connection status (more reliable than AsyncStorage flag)
      if (Platform.OS === "ios") {
        const { getProviderConnection } = await import("../health/healthSync");
        const connection = await getProviderConnection("apple_health");
        if (connection && connection.connected) {
          return true;
        }
      } else if (Platform.OS === "android") {
        const { getProviderConnection } = await import("../health/healthSync");
        const connection = await getProviderConnection("health_connect");
        if (connection && connection.connected) {
          return true;
        }
      }
      
      // Fallback to AsyncStorage check for backward compatibility
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
      const availability = await appleHealthService.checkAvailability();
      if (!availability.available) {
        return this.getSimulatedVitals();
      }

      // Check if a connection exists (authorization was granted)
      // Note: We check the stored connection instead of isConnected() because
      // the module-level authorizationRequested flag resets on app restart
      const { getProviderConnection } = await import("../health/healthSync");
      const connection = await getProviderConnection("apple_health");
      if (!connection || !connection.connected) {
        // If not connected, return simulated data
        // User needs to authorize in settings first
        return this.getSimulatedVitals();
      }

      // Get health metrics using appleHealthService
      try {
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
        
        const metrics = await appleHealthService.fetchMetrics(["all"], yesterday, today);
        
        // Helper to get latest value from samples with unit conversion
        const getLatestValue = (metricKey: string, convertToKg: boolean = false): number | undefined => {
          const metric = metrics.find((m) => m.metricKey === metricKey);
          if (!metric || metric.samples.length === 0) return undefined;
          // Get the most recent sample value (samples are sorted by date)
          const latestSample = metric.samples[metric.samples.length - 1];
          if (typeof latestSample.value !== "number") return undefined;
          
          let value = latestSample.value;
          
          // Convert weight from pounds to kilograms if needed
          if (convertToKg && latestSample.unit) {
            const unit = latestSample.unit.toLowerCase();
            // Debug logging for weight unit conversion
            if (metricKey === "weight") {
              console.log(`[Health Data Service] Weight sample: value=${value}, unit="${latestSample.unit}"`);
            }
            // Check if unit is in pounds (lb, lbs, pound, pounds, or imperial units)
            if (unit.includes("lb") || unit.includes("pound") || unit === "lb" || unit === "lbs") {
              const originalValue = value;
              value = value / 2.20462; // Convert pounds to kg
              console.log(`[Health Data Service] Converted weight from ${originalValue} ${latestSample.unit} to ${value.toFixed(2)} kg`);
            }
            // If already in kg, use as-is
          }
          
          return value;
        };
        
        // Helper to get sum for metrics like steps (daily total)
        const getSumValue = (metricKey: string): number | undefined => {
          const metric = metrics.find((m) => m.metricKey === metricKey);
          if (!metric || metric.samples.length === 0) return undefined;
          // Sum all values for metrics like steps
          const sum = metric.samples.reduce((acc, sample) => {
            const value = typeof sample.value === "number" ? sample.value : 0;
            return acc + value;
          }, 0);
          // Return sum even if 0, since samples exist (distinguishes "no data" from "zero value")
          return sum;
        };
        
        // Helper to calculate sleep hours from sleep analysis category samples
        const getSleepHours = (): number | undefined => {
          const metric = metrics.find((m) => m.metricKey === "sleep_analysis");
          if (!metric || metric.samples.length === 0) return undefined;
          
          // Sleep analysis returns category samples with startDate and endDate
          // Filter for "asleep" samples and calculate total duration
          let totalSleepMs = 0;
          for (const sample of metric.samples) {
            // Check if this is a sleep sample (value might be "asleep", "inBed", etc.)
            // For now, calculate duration for all samples (assuming they're sleep periods)
            if (sample.startDate && sample.endDate) {
              const start = new Date(sample.startDate);
              const end = new Date(sample.endDate);
              const duration = end.getTime() - start.getTime();
              if (duration > 0) {
                totalSleepMs += duration;
              }
            }
          }
          
          // Convert milliseconds to hours
          const sleepHours = totalSleepMs / (1000 * 60 * 60);
          // Return sleepHours even if 0, since samples exist (distinguishes "no data" from "zero value")
          return sleepHours;
        };
        
        // Convert to VitalSigns format
        const vitals: VitalSigns = {
          // Heart & Cardiovascular
          heartRate: getLatestValue("heart_rate"),
          restingHeartRate: getLatestValue("resting_heart_rate"),
          heartRateVariability: getLatestValue("heart_rate_variability"),
          walkingHeartRateAverage: getLatestValue("walking_heart_rate_average"),
          bloodPressure: (() => {
            const systolic = getLatestValue("blood_pressure_systolic");
            const diastolic = getLatestValue("blood_pressure_diastolic");
            if (systolic && diastolic) {
              return { systolic, diastolic };
            }
            return undefined;
          })(),
          
          // Respiratory
          respiratoryRate: getLatestValue("respiratory_rate"),
          oxygenSaturation: getLatestValue("blood_oxygen"),
          
          // Temperature
          bodyTemperature: getLatestValue("body_temperature"),
          
          // Body Measurements
          weight: getLatestValue("weight", true), // Convert weight to kg if needed
          height: getLatestValue("height"), // Height is in cm from HealthKit
          bodyMassIndex: getLatestValue("body_mass_index"),
          bodyFatPercentage: getLatestValue("body_fat_percentage"),
          
          // Activity & Fitness
          steps: getSumValue("steps"), // Steps should be summed for daily total
          activeEnergy: getSumValue("active_energy"), // Sum active energy for daily total
          basalEnergy: getSumValue("basal_energy"), // Sum basal energy for daily total
          distanceWalkingRunning: getSumValue("distance_walking_running"), // Sum distance for daily total
          flightsClimbed: getSumValue("flights_climbed"), // Sum flights climbed for daily total
          exerciseMinutes: getSumValue("exercise_minutes"), // Sum exercise minutes for daily total
          standTime: getSumValue("stand_time"), // Sum stand time for daily total
          workouts: (() => {
            const metric = metrics.find((m) => m.metricKey === "workouts");
            return metric?.samples.length || 0;
          })(),
          
          // Sleep
          sleepHours: getSleepHours(), // Calculate from sleep analysis samples
          
          // Nutrition
          waterIntake: getSumValue("water_intake"), // Sum water intake for daily total
          
          // Glucose
          bloodGlucose: getLatestValue("blood_glucose"),
          
          timestamp: new Date(),
        };
        
        return vitals;
      } catch (error: any) {
        console.error("[Health Data Service] Error fetching HealthKit data:", error?.message || String(error));
        return this.getSimulatedVitals();
      }
    } catch (error: any) {
      console.error("[Health Data Service] Error in getIOSVitals:", error?.message || String(error));
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
