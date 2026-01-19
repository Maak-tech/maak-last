/**
 * Vitals Summary Module
 * Aggregates and summarizes recent vital readings for analysis
 */

import * as admin from "firebase-admin";
import { logger } from "../../observability/logger";

/**
 * Vital summary for recent readings
 */
export interface VitalsSummary {
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
  [key: string]: any;
}

/**
 * Get recent vitals summary for a patient
 * Fetches and aggregates recent vital readings for analysis
 *
 * @param patientId - Patient user ID
 * @param hours - Number of hours to look back (default: 24)
 * @param traceId - Optional trace ID for logging
 * @returns Vitals summary with trends and averages
 */
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
    const db = admin.firestore();
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const vitalsSnapshot = await db
      .collection("vitals")
      .where("userId", "==", patientId)
      .where("timestamp", ">", admin.firestore.Timestamp.fromDate(cutoffTime))
      .orderBy("timestamp", "desc")
      .limit(100)
      .get();

    const summary: VitalsSummary = {};

    // Group by vital type
    const vitalsByType: Record<string, any[]> = {};
    vitalsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (!vitalsByType[data.type]) {
        vitalsByType[data.type] = [];
      }
      vitalsByType[data.type].push(data);
    });

    // Calculate summaries for each type
    for (const [type, readings] of Object.entries(vitalsByType)) {
      if (readings.length === 0) continue;

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
      if (
        type === "bloodPressure" &&
        readings[0].systolic &&
        readings[0].diastolic
      ) {
        const systolicValues = readings.map((r) => r.systolic);
        const diastolicValues = readings.map((r) => r.diastolic);

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
