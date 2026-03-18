/**
 * Vitals Summary Module
 * Aggregates and summarizes recent vital readings for analysis
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "../../observability/logger";

/**
 * Vital summary for recent readings
 */
export type VitalsSummary = {
  heartRate?: {
    current: number;
    avg: number;
    trend: "stable" | "increasing" | "decreasing";
  };
  bloodPressure?: {
    systolic: { current: number; avg: number };
    diastolic: { current: number; avg: number };
    trend: "stable" | "increasing" | "decreasing";
  };
  oxygenSaturation?: {
    current: number;
    avg: number;
    trend: "stable" | "increasing" | "decreasing";
  };
  bodyTemperature?: {
    current: number;
    avg: number;
    trend: "stable" | "increasing" | "decreasing";
  };
  weight?: {
    current: number;
    change: number;
    trend: "stable" | "increasing" | "decreasing";
  };
  respiratoryRate?: {
    current: number;
    avg: number;
    trend: "stable" | "increasing" | "decreasing";
  };
  [key: string]: unknown;
};

/**
 * Get recent vitals summary for a patient
 * Fetches and aggregates recent vital readings for analysis
 *
 * @param patientId - Patient user ID
 * @param hours - Number of hours to look back (default: 24)
 * @param traceId - Optional trace ID for logging
 * @returns Vitals summary with trends and averages
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: summary aggregation handles multiple vital-specific branches in one pass.
export async function getRecentVitalsSummary(
  patientId: string,
  hours = 24,
  traceId?: string
): Promise<VitalsSummary> {
  logger.debug("Fetching recent vitals summary", {
    traceId,
    patientId,
    hours,
    fn: "getRecentVitalsSummary",
  });

  try {
    const db = getFirestore();
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const vitalsSnapshot = await db
      .collection("vitals")
      .where("userId", "==", patientId)
      .where("timestamp", ">", Timestamp.fromDate(cutoffTime))
      .orderBy("timestamp", "desc")
      .limit(100)
      .get();

    const summary: VitalsSummary = {};

    // Group by vital type
    type VitalRecord = {
      type: string;
      value: number;
      systolic?: number;
      diastolic?: number;
    };
    const vitalsByType: Record<string, VitalRecord[]> = {};
    for (const doc of vitalsSnapshot.docs) {
      const data = doc.data();
      const type = data.type as string | undefined;
      const value = data.value as number | undefined;
      if (!(type && typeof value === "number")) {
        continue;
      }
      if (!vitalsByType[type]) {
        vitalsByType[type] = [];
      }
      vitalsByType[type].push({
        type,
        value,
        systolic:
          typeof data.systolic === "number"
            ? (data.systolic as number)
            : undefined,
        diastolic:
          typeof data.diastolic === "number"
            ? (data.diastolic as number)
            : undefined,
      });
    }

    // Calculate summaries for each type
    for (const [type, readings] of Object.entries(vitalsByType)) {
      if (readings.length === 0) {
        continue;
      }

      const values = readings.map((r) => r.value);
      const current = values[0];
      const avg = values.reduce((a, b) => a + b, 0) / values.length;

      // Calculate trend (simple: compare first half to second half)
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      let trend: "stable" | "increasing" | "decreasing" = "stable";
      const difference = Math.abs(secondAvg - firstAvg);
      const threshold = avg * 0.1; // 10% change threshold

      if (difference > threshold) {
        trend = secondAvg > firstAvg ? "increasing" : "decreasing";
      }

      summary[type] = {
        current: Math.round(current * 100) / 100,
        avg: Math.round(avg * 100) / 100,
        trend,
      };

      // Special handling for blood pressure
      const firstReading = readings[0];
      if (
        type === "bloodPressure" &&
        firstReading &&
        firstReading.systolic !== undefined &&
        firstReading.diastolic !== undefined
      ) {
        const systolicValues = readings
          .map((r) => r.systolic)
          .filter((value): value is number => value !== undefined);
        const diastolicValues = readings
          .map((r) => r.diastolic)
          .filter((value): value is number => value !== undefined);

        if (systolicValues.length === 0 || diastolicValues.length === 0) {
          continue;
        }

        summary[type] = {
          systolic: {
            current: systolicValues[0],
            avg: Math.round(
              systolicValues.reduce((a, b) => a + b, 0) / systolicValues.length
            ),
          },
          diastolic: {
            current: diastolicValues[0],
            avg: Math.round(
              diastolicValues.reduce((a, b) => a + b, 0) /
                diastolicValues.length
            ),
          },
          trend,
        };
      }
    }

    logger.debug("Recent vitals summary computed", {
      traceId,
      patientId,
      vitalTypesCount: Object.keys(summary).length,
      fn: "getRecentVitalsSummary",
    });

    return summary;
  } catch (error) {
    logger.error("Error fetching recent vitals summary", error as Error, {
      traceId,
      patientId,
      fn: "getRecentVitalsSummary",
    });
    // Return empty summary on error to allow analysis to continue
    return {};
  }
}
