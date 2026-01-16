/**
 * Service to save vitals from integrations to Firestore
 * This enables benchmark checking and admin alerts
 */

import { addDoc, collection, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { MetricSample } from "@/lib/health/healthTypes";
import { dexcomService } from "./dexcomService";
import { freestyleLibreService } from "./freestyleLibreService";
import {
  healthRulesEngine,
  observabilityEmitter,
  healthTimelineService,
  escalationService,
  type VitalReading,
} from "@/lib/observability";
import { alertService } from "./alertService";
import { userService } from "./userService";

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
 * Map internal vital types to rules engine format
 */
const VITAL_TYPE_TO_RULES_FORMAT: Record<string, string> = {
  heartRate: "heart_rate",
  restingHeartRate: "heart_rate",
  oxygenSaturation: "blood_oxygen",
  bloodPressure: "systolic_bp",
  bodyTemperature: "temperature",
  bloodGlucose: "blood_glucose",
  respiratoryRate: "respiratory_rate",
};

/**
 * Evaluate collected vitals using the health rules engine
 * Creates alerts and timeline events when thresholds are breached
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
    const rulesVitalType = VITAL_TYPE_TO_RULES_FORMAT[vitalType];
    if (!rulesVitalType) {
      return;
    }

    const reading: VitalReading = {
      type: rulesVitalType,
      value,
      unit: getVitalUnit(vitalType),
      timestamp,
      userId,
    };

    const evaluation = healthRulesEngine.evaluateVital(reading);

    await healthTimelineService.addEvent({
      userId,
      eventType: evaluation.triggered ? "vital_abnormal" : "vital_recorded",
      title: evaluation.triggered 
        ? evaluation.message || `Abnormal ${vitalType} detected`
        : `${vitalType} recorded`,
      description: evaluation.triggered
        ? evaluation.recommendedAction
        : `${value} ${reading.unit} from ${source}`,
      timestamp,
      severity: evaluation.triggered 
        ? (evaluation.severity === "critical" ? "critical" : evaluation.severity === "error" ? "error" : "warn")
        : "info",
      icon: evaluation.triggered ? "alert-circle" : "heart-pulse",
      metadata: {
        vitalType,
        value,
        unit: reading.unit,
        source,
        thresholdBreached: evaluation.thresholdBreached,
      },
      actorType: "system",
    });

    if (evaluation.triggered && (evaluation.severity === "error" || evaluation.severity === "critical")) {
      await observabilityEmitter.emitHealthEvent(
        "vital_threshold_breach",
        evaluation.message || `${vitalType} out of range`,
        {
          userId,
          vitalType: rulesVitalType,
          value,
          unit: reading.unit,
          isAbnormal: true,
          thresholdBreached: evaluation.thresholdBreached,
        }
      );

      const alertType = evaluation.severity === "critical" ? "vital_critical" : "vital_error";
      
      const alertId = await alertService.createAlert({
        userId,
        type: alertType as any,
        severity: evaluation.severity === "critical" ? "critical" : "high",
        message: evaluation.message || `Abnormal ${vitalType} detected: ${value} ${reading.unit}`,
        timestamp: new Date(),
        resolved: false,
        responders: [],
        metadata: {
          vitalType,
          value,
          unit: reading.unit,
          source,
          thresholdBreached: evaluation.thresholdBreached,
          recommendedAction: evaluation.recommendedAction,
        },
      });

      const user = await userService.getUser(userId);
      await escalationService.startEscalation(
        alertId,
        alertType,
        userId,
        user?.familyId
      );
    }

    if (evaluation.triggered && evaluation.severity === "warn") {
      await observabilityEmitter.emitHealthEvent(
        "vital_warning",
        evaluation.message || `${vitalType} slightly abnormal`,
        {
          userId,
          vitalType: rulesVitalType,
          value,
          unit: reading.unit,
          isAbnormal: true,
          thresholdBreached: evaluation.thresholdBreached,
        }
      );
    }
  } catch (error) {
    observabilityEmitter.emit({
      domain: "health_data",
      source: "vitalSyncService",
      message: "Failed to evaluate vital for health event",
      severity: "error",
      status: "failure",
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
      metadata: { userId, vitalType, value },
    });
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
