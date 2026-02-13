import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { Platform } from "react-native";
import { auth, db } from "@/lib/firebase";
import { safeFormatNumber } from "@/utils/dateFormat";
import { appleHealthService } from "./appleHealthService";

// iOS HealthKit permissions - legacy format (not used with @kingstinct/react-native-healthkit)
const _HealthKitPermissions = {
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
const _AndroidHealthPermissions = [
  "android.permission.health.READ_HEART_RATE",
  "android.permission.health.READ_STEPS",
  "android.permission.health.READ_SLEEP",
  "android.permission.health.READ_BODY_TEMPERATURE",
  "android.permission.health.READ_BLOOD_PRESSURE",
  "android.permission.health.READ_WEIGHT",
  "android.permission.activity_recognition",
];

export type VitalSigns = {
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
};

export type HealthDataSummary = {
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
};

const HEALTH_DATA_STORAGE_KEY = "@maak_health_data";
const PERMISSIONS_STORAGE_KEY = "@maak_health_permissions";
const isDevEnvironment = (): boolean =>
  (globalThis as { __DEV__?: boolean }).__DEV__ === true;

type VitalSample = {
  value: number;
  timestamp: Date;
  source?: string;
  metadata?: Record<string, unknown>;
};

const getLatestBloodPressure = (
  vitalsByType: Record<string, VitalSample[]>
): { systolic: number; diastolic: number } | undefined => {
  const samples = vitalsByType.bloodPressure;
  if (!samples || samples.length === 0) {
    return;
  }

  const sorted = [...samples].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
  const latest = sorted[0];
  const systolic = Number(latest.metadata?.systolic);
  const diastolic = Number(latest.metadata?.diastolic);
  if (!(Number.isNaN(systolic) || Number.isNaN(diastolic))) {
    return {
      systolic,
      diastolic,
    };
  }

  return;
};

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
        } catch {
          await this.savePermissionStatus(false);
          return false;
        }
      } else if (Platform.OS === "android") {
        // For Android, use Health Connect
        try {
          const { healthConnectService } = await import(
            "./healthConnectService"
          );

          // Check if Health Connect is available
          const availability = await healthConnectService.checkAvailability();
          if (!availability.available) {
            await this.savePermissionStatus(false);
            return false;
          }

          // Request authorization (will be done with specific metrics in settings)
          // For now, just check availability
          await this.savePermissionStatus(true);
          return true;
        } catch {
          await this.savePermissionStatus(false);
          return false;
        }
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
  /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Permission validation intentionally handles platform/provider-specific authorization and revocation flows in one gatekeeper function. */
  async hasHealthPermissions(): Promise<boolean> {
    try {
      // Check stored connection status (more reliable than AsyncStorage flag)
      const { getProviderConnection, disconnectProvider } = await import(
        "../health/healthSync"
      );

      // Check Fitbit connection first (works on both iOS and Android)
      const fitbitConnection = await getProviderConnection("fitbit");
      if (fitbitConnection?.connected) {
        return true;
      }

      if (Platform.OS === "ios") {
        const connection = await getProviderConnection("apple_health");
        if (connection?.connected) {
          const availability = await appleHealthService.checkAvailability();
          if (!availability.available) {
            await disconnectProvider("apple_health");
            await this.savePermissionStatus(false);
            return false;
          }

          return true;
        }
      } else if (Platform.OS === "android") {
        const connection = await getProviderConnection("health_connect");
        if (connection?.connected) {
          try {
            const { healthConnectService } = await import(
              "./healthConnectService"
            );
            const availability = await healthConnectService.checkAvailability();
            if (!availability.available) {
              await disconnectProvider("health_connect");
              await this.savePermissionStatus(false);
              return false;
            }
          } catch {
            // Keep stored connection if availability check fails unexpectedly.
          }
          return true;
        }
      }

      // Backward compatibility fallback: only trust the legacy flag in dev.
      const status = await AsyncStorage.getItem(PERMISSIONS_STORAGE_KEY);
      if (status !== "true") {
        return false;
      }

      if (isDevEnvironment()) {
        return true;
      }

      // In production builds, require a real provider connection to avoid stale states.
      await this.savePermissionStatus(false);
      return false;
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

  // Get latest vital signs - prefers provider (Apple Health/Health Connect) for
  // real-time values that match the Health app; falls back to Firestore when
  // no provider or sync hasn't run. Sparklines/trends use Firestore separately.
  async getLatestVitals(): Promise<VitalSigns | null> {
    try {
      const userId = auth.currentUser?.uid;

      // Prefer direct provider first - matches Health app in real time
      const providerVitals = await this.getLatestVitalsFromProviders();
      if (providerVitals) {
        return providerVitals;
      }

      // Fall back to Firestore (synced data) when no provider connected
      if (userId) {
        return await this.getLatestVitalsFromFirestore(userId);
      }
      return null;
    } catch (_error) {
      const userId = auth.currentUser?.uid;
      if (userId) {
        return await this.getLatestVitalsFromFirestore(userId);
      }
      return await this.getLatestVitalsFromProviders();
    }
  },

  // Get latest vitals from Firestore (aggregated from all sources)
  async getLatestVitalsFromFirestore(
    userId: string
  ): Promise<VitalSigns | null> {
    try {
      // Get recent vitals from all sources (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const vitalsQuery = query(
        collection(db, "vitals"),
        where("userId", "==", userId),
        where("timestamp", ">=", Timestamp.fromDate(sevenDaysAgo)),
        orderBy("timestamp", "desc"),
        limit(500)
      );

      const snapshot = await getDocs(vitalsQuery);
      if (snapshot.empty) {
        return null;
      }

      // Group vitals by type
      const vitalsByType: Record<string, VitalSample[]> = {};

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const vitalType = data.type;
        const timestamp = data.timestamp?.toDate?.() || new Date();

        if (!vitalsByType[vitalType]) {
          vitalsByType[vitalType] = [];
        }
        vitalsByType[vitalType].push({
          value: data.value,
          timestamp,
          source: data.source,
          metadata: data.metadata,
        });
      }

      // Metrics that should use latest value (not summed)
      const _latestValueMetrics = [
        "heartRate",
        "restingHeartRate",
        "walkingHeartRateAverage",
        "heartRateVariability",
        "bloodPressure",
        "respiratoryRate",
        "bodyTemperature",
        "oxygenSaturation",
        "bloodGlucose",
        "weight",
        "height",
        "bodyMassIndex",
        "bodyFatPercentage",
      ];

      // Metrics that should be summed for today's total
      const _sumMetrics = [
        "steps",
        "activeEnergy",
        "basalEnergy",
        "distanceWalkingRunning",
        "flightsClimbed",
        "exerciseMinutes",
        "standTime",
        "sleepHours",
        "waterIntake",
      ];

      // Helper to get latest value for a metric type
      const getLatestValue = (type: string): number | undefined => {
        const samples = vitalsByType[type];
        if (!samples || samples.length === 0) {
          return;
        }
        // Sort by timestamp descending and get the most recent
        const sorted = [...samples].sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );
        return sorted[0].value;
      };

      // Helper to get today's sum for a metric type
      const getTodaySum = (type: string): number | undefined => {
        const samples = vitalsByType[type];
        if (!samples || samples.length === 0) {
          return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Filter samples from today and sum them
        const todaySamples = samples.filter(
          (s) => s.timestamp >= today && s.timestamp < tomorrow
        );
        if (todaySamples.length === 0) {
          // If no data today, return the most recent value (might be from yesterday)
          const sorted = [...samples].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );
          return sorted[0]?.value;
        }
        return todaySamples.reduce((acc, s) => acc + s.value, 0);
      };

      // Helper to get sleep hours (sum of all sleep periods)
      const getSleepHours = (): number | undefined => {
        const samples = vitalsByType.sleepHours;
        if (!samples || samples.length === 0) {
          return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Filter samples from today and sum them
        const todaySamples = samples.filter(
          (s) => s.timestamp >= today && s.timestamp < tomorrow
        );
        if (todaySamples.length === 0) {
          // If no data today, get the most recent sleep reading
          const sorted = [...samples].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );
          return sorted[0]?.value;
        }
        return todaySamples.reduce((acc, s) => acc + s.value, 0);
      };

      // Build VitalSigns object
      const vitals: VitalSigns = {
        // Heart & Cardiovascular - use latest value
        heartRate: getLatestValue("heartRate"),
        restingHeartRate: getLatestValue("restingHeartRate"),
        heartRateVariability: getLatestValue("heartRateVariability"),
        walkingHeartRateAverage: getLatestValue("walkingHeartRateAverage"),
        bloodPressure: getLatestBloodPressure(vitalsByType),

        // Respiratory - use latest value
        respiratoryRate: getLatestValue("respiratoryRate"),
        oxygenSaturation: getLatestValue("oxygenSaturation"),

        // Temperature - use latest value
        bodyTemperature: getLatestValue("bodyTemperature"),

        // Body Measurements - use latest value
        weight: getLatestValue("weight"),
        height: getLatestValue("height"),
        bodyMassIndex: getLatestValue("bodyMassIndex"),
        bodyFatPercentage: getLatestValue("bodyFatPercentage"),

        // Activity & Fitness - sum today's values
        steps: getTodaySum("steps"),
        activeEnergy: getTodaySum("activeEnergy"),
        basalEnergy: getTodaySum("basalEnergy"),
        distanceWalkingRunning: getTodaySum("distanceWalkingRunning"),
        flightsClimbed: getTodaySum("flightsClimbed"),
        exerciseMinutes: getTodaySum("exerciseMinutes"),
        standTime: getTodaySum("standTime"),
        workouts: (() => {
          // Count unique workout sessions (could be tracked separately)
          const samples = vitalsByType.workouts;
          return samples ? samples.length : undefined;
        })(),

        // Sleep - sum today's sleep periods
        sleepHours: getSleepHours(),

        // Nutrition - sum today's values
        waterIntake: getTodaySum("waterIntake"),

        // Glucose - use latest value
        bloodGlucose: getLatestValue("bloodGlucose"),

        timestamp: new Date(),
      };

      return vitals;
    } catch (_error) {
      return null;
    }
  },

  // Get latest vitals from direct provider - Apple Health (iOS) or Health Connect (Android) first
  // so displayed values match the Health app; Fitbit/Withings as fallback
  async getLatestVitalsFromProviders(): Promise<VitalSigns | null> {
    try {
      const { getProviderConnection } = await import("../health/healthSync");

      // Prefer platform-native health app (matches Health app on device)
      if (Platform.OS === "ios") {
        const appleHealthConnection =
          await getProviderConnection("apple_health");
        if (appleHealthConnection?.connected) {
          return await this.getIOSVitals();
        }
      }
      if (Platform.OS === "android") {
        const healthConnectConnection =
          await getProviderConnection("health_connect");
        if (healthConnectConnection?.connected) {
          return await this.getAndroidVitals();
        }
      }

      // Fallback to Fitbit (works on both platforms)
      const fitbitConnection = await getProviderConnection("fitbit");
      if (fitbitConnection?.connected) {
        return await this.getFitbitVitals();
      }

      // Fallback to Withings
      const withingsConnection = await getProviderConnection("withings");
      if (withingsConnection?.connected) {
        // Withings vitals would need to be fetched similarly
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
        // In production, return null instead of simulated data
        return null;
      }

      // Check if a connection exists (authorization was granted)
      // Note: We check the stored connection instead of isConnected() because
      // the module-level authorizationRequested flag resets on app restart
      const { getProviderConnection } = await import("../health/healthSync");
      const connection = await getProviderConnection("apple_health");
      if (!connection?.connected) {
        // In production, return null instead of simulated data
        // User needs to authorize in settings first
        return null;
      }

      // Get health metrics using appleHealthService
      try {
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

        const metrics = await appleHealthService.fetchMetrics(
          ["all"],
          yesterday,
          today
        );

        // Helper to get latest value from samples with unit conversion
        const getLatestValue = (
          metricKey: string,
          convertToKg = false
        ): number | undefined => {
          const metric = metrics.find((m) => m.metricKey === metricKey);
          if (!metric || metric.samples.length === 0) {
            return;
          }
          // Get the most recent sample value (samples are sorted by date)
          const latestSample = metric.samples.at(-1);
          if (!latestSample || typeof latestSample.value !== "number") {
            return;
          }

          let value = latestSample.value;

          // Convert weight from pounds to kilograms if needed
          if (convertToKg && latestSample.unit) {
            const unit = latestSample.unit.toLowerCase();
            // Check if unit is in pounds (lb, lbs, pound, pounds, or imperial units)
            if (
              unit.includes("lb") ||
              unit.includes("pound") ||
              unit === "lb" ||
              unit === "lbs"
            ) {
              value /= 2.204_62; // Convert pounds to kg
            }
            // If already in kg, use as-is
          }

          return value;
        };

        // Helper to get today's sum for daily metrics (steps, activeEnergy, etc.)
        // Filters samples to local today only - fixes bug where yesterday+today were summed
        const getTodaySumValue = (metricKey: string): number | undefined => {
          const metric = metrics.find((m) => m.metricKey === metricKey);
          if (!metric || metric.samples.length === 0) {
            return;
          }
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date(todayStart);
          todayEnd.setDate(todayEnd.getDate() + 1);
          const todaySamples = metric.samples.filter((sample) => {
            const sampleDate = new Date(sample.startDate);
            return sampleDate >= todayStart && sampleDate < todayEnd;
          });
          if (todaySamples.length === 0) {
            return;
          }
          const sum = todaySamples.reduce((acc, sample) => {
            const value = typeof sample.value === "number" ? sample.value : 0;
            return acc + value;
          }, 0);
          return sum;
        };

        // Helper to calculate sleep hours from sleep analysis category samples
        const getSleepHours = (): number | undefined => {
          const metric = metrics.find((m) => m.metricKey === "sleep_analysis");
          if (!metric || metric.samples.length === 0) {
            return;
          }

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
            return;
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

          // Activity & Fitness - use today's sum only (not yesterday+today)
          steps: getTodaySumValue("steps"),
          activeEnergy: getTodaySumValue("active_energy"),
          basalEnergy: getTodaySumValue("basal_energy"),
          distanceWalkingRunning: getTodaySumValue("distance_walking_running"),
          flightsClimbed: getTodaySumValue("flights_climbed"),
          exerciseMinutes: getTodaySumValue("exercise_minutes"),
          standTime: getTodaySumValue("stand_time"),
          workouts: (() => {
            const metric = metrics.find((m) => m.metricKey === "workouts");
            if (!metric || metric.samples.length === 0) {
              return;
            }
            return metric.samples.length;
          })(),

          // Sleep
          sleepHours: getSleepHours(), // Calculate from sleep analysis samples

          // Nutrition
          waterIntake: getTodaySumValue("water_intake"),

          // Glucose
          bloodGlucose: getLatestValue("blood_glucose"),

          timestamp: new Date(),
        };

        return vitals;
      } catch {
        // In production, return null instead of simulated data
        return null;
      }
    } catch {
      // In production, return null instead of simulated data
      return null;
    }
  },

  // Generate simulated vitals for demo/development (dev only)
  getSimulatedVitals(): VitalSigns {
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

  // Android Health Connect data retrieval (with fallback to simulated data)
  async getAndroidVitals(): Promise<VitalSigns | null> {
    try {
      // Check if Health Connect connection exists
      const { getProviderConnection } = await import("../health/healthSync");
      const connection = await getProviderConnection("health_connect");

      if (!connection?.connected) {
        // In production, return null instead of simulated data
        return null;
      }

      // Import healthConnectService dynamically
      const { healthConnectService } = await import("./healthConnectService");

      // Get health metrics using healthConnectService
      try {
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

        const metrics = await healthConnectService.fetchMetrics(
          connection.selectedMetrics.length > 0
            ? connection.selectedMetrics
            : [
                "heart_rate",
                "steps",
                "active_energy",
                "sleep_analysis",
                "weight",
              ],
          yesterday,
          today
        );

        // Helper to get latest value from samples
        const getLatestValue = (metricKey: string): number | undefined => {
          const metric = metrics.find((m) => m.metricKey === metricKey);
          if (!metric || metric.samples.length === 0) {
            return;
          }
          // Get the most recent sample value
          const latestSample = metric.samples.at(-1);
          if (!latestSample || typeof latestSample.value !== "number") {
            return;
          }
          return latestSample.value;
        };

        // Helper to get today's sum for daily metrics (steps, activeEnergy, etc.)
        const getTodaySumValue = (metricKey: string): number | undefined => {
          const metric = metrics.find((m) => m.metricKey === metricKey);
          if (!metric || metric.samples.length === 0) {
            return;
          }
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date(todayStart);
          todayEnd.setDate(todayEnd.getDate() + 1);
          const todaySamples = metric.samples.filter((sample) => {
            const sampleDate = new Date(sample.startDate);
            return sampleDate >= todayStart && sampleDate < todayEnd;
          });
          if (todaySamples.length === 0) {
            return;
          }
          const sum = todaySamples.reduce((acc, sample) => {
            const value = typeof sample.value === "number" ? sample.value : 0;
            return acc + value;
          }, 0);
          return sum;
        };

        // Helper to get average heart rate
        const getAverageHeartRate = (): number | undefined => {
          const metric = metrics.find((m) => m.metricKey === "heart_rate");
          if (!metric || metric.samples.length === 0) {
            return;
          }
          const sum = metric.samples.reduce((acc, sample) => {
            const value = typeof sample.value === "number" ? sample.value : 0;
            return acc + value;
          }, 0);
          return sum / metric.samples.length;
        };

        // Helper to get sleep hours from sleep analysis
        const getSleepHours = (): number | undefined => {
          const metric = metrics.find((m) => m.metricKey === "sleep_analysis");
          if (!metric || metric.samples.length === 0) {
            return;
          }
          // Sum all sleep durations (in hours) and convert to hours
          const totalHours = metric.samples.reduce((acc, sample) => {
            const value = typeof sample.value === "number" ? sample.value : 0;
            return acc + value;
          }, 0);
          return totalHours;
        };

        const vitals: VitalSigns = {
          // Heart & Cardiovascular
          heartRate: getAverageHeartRate() || getLatestValue("heart_rate"),
          restingHeartRate: getLatestValue("resting_heart_rate"),
          heartRateVariability: getLatestValue("heart_rate_variability"),
          walkingHeartRateAverage: getLatestValue("walking_heart_rate_average"),
          bloodPressure: (() => {
            const systolic = getLatestValue("blood_pressure_systolic");
            const diastolic = getLatestValue("blood_pressure_diastolic");
            if (systolic && diastolic) {
              return { systolic, diastolic };
            }
            return;
          })(),

          // Respiratory
          respiratoryRate: getLatestValue("respiratory_rate"),
          oxygenSaturation: getLatestValue("blood_oxygen"),

          // Temperature
          bodyTemperature: getLatestValue("body_temperature"),

          // Body Measurements
          weight: getLatestValue("weight"),
          height: getLatestValue("height"),
          bodyMassIndex: getLatestValue("body_mass_index"),
          bodyFatPercentage: getLatestValue("body_fat_percentage"),

          // Activity & Fitness - use today's sum only (not yesterday+today)
          steps: getTodaySumValue("steps"),
          activeEnergy: getTodaySumValue("active_energy"),
          basalEnergy: getLatestValue("basal_energy"),
          distanceWalkingRunning: getTodaySumValue("distance_walking_running"),
          flightsClimbed: getTodaySumValue("flights_climbed"),
          exerciseMinutes: getTodaySumValue("exercise_minutes"),
          workouts: (() => {
            const metric = metrics.find((m) => m.metricKey === "workouts");
            if (!metric || metric.samples.length === 0) {
              return;
            }
            return metric.samples.length;
          })(),

          // Sleep
          sleepHours: getSleepHours(),

          // Nutrition
          waterIntake: getTodaySumValue("water_intake"),

          // Glucose
          bloodGlucose: getLatestValue("blood_glucose"),

          timestamp: new Date(),
        };

        return vitals;
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  },

  // Fitbit vitals data retrieval
  async getFitbitVitals(): Promise<VitalSigns | null> {
    try {
      const { getProviderConnection } = await import("../health/healthSync");
      const connection = await getProviderConnection("fitbit");

      if (!connection?.connected) {
        // In production, return null instead of simulated data
        return null;
      }

      // Import fitbitService dynamically
      const { fitbitService } = await import("./fitbitService");

      // Get health metrics using fitbitService
      try {
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

        const metrics = await fitbitService.fetchMetrics(
          connection.selectedMetrics.length > 0
            ? connection.selectedMetrics
            : [
                "heart_rate",
                "steps",
                "active_energy",
                "sleep_analysis",
                "weight",
              ],
          yesterday,
          today
        );

        // Helper to get latest value from samples
        const getLatestValue = (metricKey: string): number | undefined => {
          const metric = metrics.find((m) => m.metricKey === metricKey);
          if (!metric || metric.samples.length === 0) {
            return;
          }
          // Get the most recent sample value
          const latestSample = metric.samples.at(-1);
          if (!latestSample || typeof latestSample.value !== "number") {
            return;
          }
          return latestSample.value;
        };

        // Helper to get today's sum for daily metrics (steps, activeEnergy, etc.)
        const getTodaySumValue = (metricKey: string): number | undefined => {
          const metric = metrics.find((m) => m.metricKey === metricKey);
          if (!metric || metric.samples.length === 0) {
            return;
          }
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date(todayStart);
          todayEnd.setDate(todayEnd.getDate() + 1);
          const todaySamples = metric.samples.filter((sample) => {
            const sampleDate = new Date(sample.startDate);
            return sampleDate >= todayStart && sampleDate < todayEnd;
          });
          if (todaySamples.length === 0) {
            return;
          }
          const sum = todaySamples.reduce((acc, sample) => {
            const value = typeof sample.value === "number" ? sample.value : 0;
            return acc + value;
          }, 0);
          return sum;
        };

        // Helper to get average heart rate
        const getAverageHeartRate = (): number | undefined => {
          const metric = metrics.find((m) => m.metricKey === "heart_rate");
          if (!metric || metric.samples.length === 0) {
            return;
          }
          const sum = metric.samples.reduce((acc, sample) => {
            const value = typeof sample.value === "number" ? sample.value : 0;
            return acc + value;
          }, 0);
          return sum / metric.samples.length;
        };

        // Helper to get sleep hours from sleep analysis
        const getSleepHours = (): number | undefined => {
          const metric = metrics.find((m) => m.metricKey === "sleep_analysis");
          if (!metric || metric.samples.length === 0) {
            return;
          }
          // Sum all sleep durations (in minutes) and convert to hours
          const totalMinutes = metric.samples.reduce((acc, sample) => {
            const value = typeof sample.value === "number" ? sample.value : 0;
            return acc + value;
          }, 0);
          return totalMinutes / 60;
        };

        const vitals: VitalSigns = {
          // Heart & Cardiovascular
          heartRate: getAverageHeartRate() || getLatestValue("heart_rate"),
          restingHeartRate: getLatestValue("resting_heart_rate"),
          heartRateVariability: getLatestValue("heart_rate_variability"),
          walkingHeartRateAverage: getLatestValue("walking_heart_rate_average"),

          // Blood Pressure (not available from Fitbit)
          // bloodPressure: undefined,

          // Respiratory
          respiratoryRate: getLatestValue("respiratory_rate"),
          oxygenSaturation: getLatestValue("blood_oxygen"),

          // Temperature
          bodyTemperature: getLatestValue("body_temperature"),

          // Body Measurements
          weight: getLatestValue("weight"),
          // height: undefined, // Not available from Fitbit
          bodyMassIndex: getLatestValue("body_mass_index"),
          bodyFatPercentage: getLatestValue("body_fat_percentage"),

          // Activity & Fitness - use today's sum only (not yesterday+today)
          steps: getTodaySumValue("steps"),
          activeEnergy: getTodaySumValue("active_energy"),
          basalEnergy: getLatestValue("basal_energy"),
          distanceWalkingRunning: getTodaySumValue("distance_walking_running"),
          flightsClimbed: getTodaySumValue("flights_climbed"),

          // Sleep
          sleepHours: getSleepHours(),

          // Nutrition
          waterIntake: getTodaySumValue("water_intake"),

          // Glucose (not available from Fitbit)
          // bloodGlucose: undefined,

          timestamp: new Date(),
        };

        return vitals;
      } catch {
        // In production, return null instead of simulated data
        return null;
      }
    } catch {
      // In production, return null instead of simulated data
      return null;
    }
  },

  // Get health data summary for dashboard
  async getHealthSummary(): Promise<HealthDataSummary | null> {
    try {
      const vitals = await this.getLatestVitals();
      if (!vitals) {
        return null;
      }

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
      if (!vitals) {
        return;
      }

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
      if (!stored) {
        return null;
      }

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
      steps: vitals.steps ? safeFormatNumber(vitals.steps) : "N/A",
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
