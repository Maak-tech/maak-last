/**
 * Service to save vitals from integrations to Firestore
 * This enables benchmark checking and admin alerts
 */

import { addDoc, collection, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { MetricSample } from "@/lib/health/healthTypes";
// import { evaluateVitals, requiresHealthEvent } from "../../src/health/rules/evaluateVitals";
// import { createVitalAlertEvent } from "../../src/health/events/createHealthEvent";
import { dexcomService } from "./dexcomService";
import { freestyleLibreService } from "./freestyleLibreService";

/**
 * Map metric keys to vital types for Firestore
 */
const METRIC_TO_VITAL_TYPE: Record<string, string> = {
  heart_rate: "heartRate",
  resting_heart_rate: "restingHeartRate",
  heart_rate_variability: "heartRateVariability",
  walking_heart_rate_average: "walkingHeartRateAverage",
  blood_pressure: "bloodPressure",
  respiratory_rate: "respiratoryRate",
  blood_oxygen: "oxygenSaturation",
  body_temperature: "bodyTemperature",
  weight: "weight",
  height: "height",
  body_mass_index: "bodyMassIndex",
  body_fat_percentage: "bodyFatPercentage",
  steps: "steps",
  active_energy: "activeEnergy",
  basal_energy: "basalEnergy",
  distance_walking_running: "distanceWalkingRunning",
  flights_climbed: "flightsClimbed",
  sleep_analysis: "sleepHours",
  water_intake: "waterIntake",
  blood_glucose: "bloodGlucose",
  glucose_trend: "glucoseTrend",
  glucose_trend_arrow: "glucoseTrendArrow",
  time_in_range: "timeInRange",
};

/**
 * Get unit for a vital type
 */
function getVitalUnit(vitalType: string): string {
  const unitMap: Record<string, string> = {
    heartRate: "bpm",
    restingHeartRate: "bpm",
    heartRateVariability: "ms",
    walkingHeartRateAverage: "bpm",
    bloodPressure: "mmHg",
    respiratoryRate: "bpm",
    oxygenSaturation: "%",
    bodyTemperature: "°C",
    weight: "kg",
    height: "cm",
    bodyMassIndex: "kg/m²",
    bodyFatPercentage: "%",
    steps: "count",
    activeEnergy: "kcal",
    basalEnergy: "kcal",
    distanceWalkingRunning: "km",
    flightsClimbed: "count",
    sleepHours: "hours",
    waterIntake: "ml",
    bloodGlucose: "mg/dL",
    glucoseTrend: "trend",
    glucoseTrendArrow: "arrow",
    timeInRange: "boolean",
  };
  return unitMap[vitalType] || "unknown";
}

/**
 * Save a single vital sample to Firestore
 */
async function saveVitalSample(
  userId: string,
  vitalType: string,
  value: number,
  unit: string,
  timestamp: Date,
  source: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const vitalData: any = {
      userId,
      type: vitalType,
      value,
      unit,
      timestamp: Timestamp.fromDate(timestamp),
      source,
    };

    if (metadata) {
      vitalData.metadata = metadata;
    }

    await addDoc(collection(db, "vitals"), vitalData);

    // Evaluate vitals for health events (only for critical vitals)
    // We'll collect vitals and evaluate them in batches to avoid too many evaluations
    await evaluateAndCreateHealthEventIfNeeded(userId, vitalType, value, timestamp, source, metadata);
  } catch (error) {
    throw error;
  }
}

/**
 * Evaluate collected vitals and create health event if needed
 * This is a simplified implementation - in production you'd want more sophisticated batching
 */
async function evaluateAndCreateHealthEventIfNeeded(
  userId: string,
  vitalType: string,
  value: number,
  timestamp: Date,
  source: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    // Map vital types to evaluation format
    const vitalValues: any = {};

    switch (vitalType) {
      case "heartRate":
        vitalValues.heartRate = value;
        break;
      case "oxygenSaturation":
        vitalValues.spo2 = value;
        break;
      case "bloodPressure":
        if (metadata?.systolic && metadata?.diastolic) {
          vitalValues.systolic = metadata.systolic;
          vitalValues.diastolic = metadata.diastolic;
        }
        break;
      case "bodyTemperature":
        vitalValues.temp = value;
        break;
      default:
        // Skip evaluation for non-critical vitals
        return;
    }

    // Only evaluate if we have at least one critical vital
    if (Object.keys(vitalValues).length === 0) {
      return;
    }

    // NOTE: Automatic health event creation disabled to prevent event stimulation
    // evaluateVitals is not available - evaluation functionality has been disabled
    // const evaluation = evaluateVitals({
    //   ...vitalValues,
    //   timestamp,
    // });
    // Events should be manually managed through the family tab interface
    // if (requiresHealthEvent(evaluation)) {
    //   const sourceType = source.includes("apple") || source.includes("fitbit") || source.includes("google")
    //     ? "wearable" as const
    //     : source === "manual" ? "manual" as const : "clinic" as const;
    //
    //   await createVitalAlertEvent(
    //     userId,
    //     evaluation,
    //     vitalValues,
    //     sourceType
    //   );
    // }
  } catch (error) {
    // Silently fail health event creation to avoid breaking vital saving
  }
}

/**
 * Save vitals from health metrics to Firestore
 * Processes samples from integrations (HealthKit, Fitbit, Google Health Connect)
 */
export async function saveIntegrationVitalsToFirestore(
  userId: string,
  metrics: Array<{
    metricKey: string;
    samples: MetricSample[];
  }>,
  provider: string
): Promise<number> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  let savedCount = 0;

  try {
    for (const metric of metrics) {
      const vitalType = METRIC_TO_VITAL_TYPE[metric.metricKey];
      if (!vitalType) {
        // Skip metrics that don't map to vital types
        continue;
      }

      const unit = getVitalUnit(vitalType);

      // Process each sample
      for (const sample of metric.samples) {
        try {
          // Handle different value types
          let value: number;
          if (typeof sample.value === "number") {
            value = sample.value;
          } else if (typeof sample.value === "string") {
            value = parseFloat(sample.value);
            if (isNaN(value)) {
              continue; // Skip invalid values
            }
          } else {
            continue; // Skip non-numeric values
          }

          // Handle blood pressure separately (has systolic/diastolic)
          if (vitalType === "bloodPressure" && (sample as any).metadata) {
            const metadata = (sample as any).metadata;
            const systolic = metadata.systolic || value;
            const diastolic = metadata.diastolic;
            
            if (diastolic !== undefined) {
              // Save systolic value with metadata
              await saveVitalSample(
                userId,
                "bloodPressure",
                systolic,
                unit,
                new Date(sample.startDate),
                provider,
                {
                  systolic,
                  diastolic,
                  ...metadata,
                }
              );
              savedCount++;
            }
          } else {
            // Regular vital sign
            const timestamp = sample.startDate
              ? new Date(sample.startDate)
              : new Date();

            await saveVitalSample(
              userId,
              vitalType,
              value,
              unit,
              timestamp,
              provider,
              (sample as any).metadata
            );
            savedCount++;
          }
        } catch (error) {
          // Continue with next sample
        }
      }
    }

    return savedCount;
  } catch (error) {
    throw error;
  }
}

/**
 * Save vitals from sync payload
 * Called after successful health data sync
 */
export async function saveSyncVitalsToFirestore(
  payload: {
    provider: string;
    metrics: Array<{
      metricKey: string;
      samples: MetricSample[];
    }>;
  }
): Promise<number> {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error("User must be authenticated");
  }

  return await saveIntegrationVitalsToFirestore(
    currentUser.uid,
    payload.metrics,
    payload.provider
  );
}

/**
 * Sync CGM data from Dexcom for real-time glucose monitoring
 */
export async function syncDexcomCGMData(userId: string): Promise<void> {
  try {
    const currentGlucose = await dexcomService.getCurrentGlucose();
    if (currentGlucose) {
      // Save current glucose reading
      await saveVitalSample(
        userId,
        "bloodGlucose",
        currentGlucose.value,
        getVitalUnit("bloodGlucose"),
        new Date(currentGlucose.timestamp),
        "Dexcom CGM",
        {
          trend: currentGlucose.trend,
          trendArrow: currentGlucose.trendArrow,
          unit: currentGlucose.unit,
        }
      );
    }
  } catch (error) {
    // Don't throw error - CGM sync failures shouldn't break other operations
  }
}

/**
 * Sync CGM data from Freestyle Libre for real-time glucose monitoring
 */
export async function syncFreestyleLibreCGMData(userId: string): Promise<void> {
  try {
    const currentGlucose = await freestyleLibreService.getCurrentGlucose();
    if (currentGlucose) {
      // Save current glucose reading
      await saveVitalSample(
        userId,
        "bloodGlucose",
        currentGlucose.value,
        getVitalUnit("bloodGlucose"),
        new Date(currentGlucose.timestamp),
        "Freestyle Libre",
        {
          trend: currentGlucose.trend,
          unit: currentGlucose.unit,
        }
      );
    }
  } catch (error) {
    // Don't throw error - CGM sync failures shouldn't break other operations
  }
}

/**
 * Get latest glucose reading from all connected CGM devices
 */
export async function getLatestGlucoseReading(userId: string): Promise<{
  value: number;
  unit: string;
  timestamp: Date;
  source: string;
  trend?: string;
  trendArrow?: string;
} | null> {
  try {
    // Try Dexcom first
    try {
      const dexcomReading = await dexcomService.getCurrentGlucose();
      if (dexcomReading) {
        return {
          value: dexcomReading.value,
          unit: dexcomReading.unit,
          timestamp: new Date(dexcomReading.timestamp),
          source: "Dexcom CGM",
          trend: dexcomReading.trend,
          trendArrow: dexcomReading.trendArrow,
        };
      }
    } catch (error) {
      // Dexcom not available or failed
    }

    // Try Freestyle Libre as fallback
    try {
      const libreReading = await freestyleLibreService.getCurrentGlucose();
      if (libreReading) {
        return {
          value: libreReading.value,
          unit: libreReading.unit,
          timestamp: new Date(libreReading.timestamp),
          source: "Freestyle Libre",
          trend: libreReading.trend,
        };
      }
    } catch (error) {
      // Freestyle Libre not available or failed
    }

    return null;
  } catch (error) {
    return null;
  }
}
