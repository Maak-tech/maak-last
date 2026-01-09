/**
 * Service to save vitals from integrations to Firestore
 * This enables benchmark checking and admin alerts
 */

import { addDoc, collection, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { MetricSample } from "@/lib/health/healthTypes";

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
  } catch (error) {
    console.error(`Error saving vital ${vitalType}:`, error);
    throw error;
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
          console.error(
            `Error saving sample for ${vitalType}:`,
            error
          );
          // Continue with next sample
        }
      }
    }

    return savedCount;
  } catch (error) {
    console.error("Error saving integration vitals to Firestore:", error);
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

