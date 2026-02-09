/**
 * Trend Alert Service
 * Automatically checks for concerning trends when new health data is added
 * and creates alerts that are picked up by the real-time WebSocket service
 */

import {
  Timestamp,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  analyzeSymptomTrend,
  analyzeVitalTrend,
  createTrendAlert,
  isTrendConcerning,
} from "./trendDetectionService";

/**
 * Check for concerning trends when a new vital is added
 * This should be called after a vital is saved to Firestore
 */
export async function checkTrendsForNewVital(
  userId: string,
  vitalType: string,
  unit: string
): Promise<void> {
  try {
    // Get recent vitals of this type (last 7 days, need at least 3 readings)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const vitalsQuery = query(
      collection(db, "vitals"),
      where("userId", "==", userId),
      where("type", "==", vitalType),
      where("timestamp", ">=", Timestamp.fromDate(sevenDaysAgo)),
      orderBy("timestamp", "asc"),
      limit(50) // Get up to 50 readings for trend analysis
    );

    const snapshot = await getDocs(vitalsQuery);

    if (snapshot.empty || snapshot.size < 3) {
      return; // Not enough data for trend analysis
    }

    const vitalReadings = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        value: data.value as number,
        timestamp: (data.timestamp as Timestamp)?.toDate() || new Date(),
      };
    });

    // Analyze trend
    const trendAnalysis = analyzeVitalTrend(vitalReadings, vitalType, unit, 7);

    // Create alert if concerning
    if (trendAnalysis && isTrendConcerning(trendAnalysis)) {
      await createTrendAlert(userId, trendAnalysis, "vital_trend");
    }
  } catch (_error) {
    // Don't throw - trend checking is non-critical
  }
}

/**
 * Check for concerning trends when a new symptom is added
 * This should be called after a symptom is saved to Firestore
 */
export async function checkTrendsForNewSymptom(
  userId: string,
  symptomType: string
): Promise<void> {
  try {
    // Get recent symptoms of this type (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const symptomsQuery = query(
      collection(db, "symptoms"),
      where("userId", "==", userId),
      where("type", "==", symptomType),
      where("timestamp", ">=", Timestamp.fromDate(sevenDaysAgo)),
      orderBy("timestamp", "asc"),
      limit(50)
    );

    const snapshot = await getDocs(symptomsQuery);

    if (snapshot.empty) {
      return; // No data for trend analysis
    }

    const symptomReadings = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        type: data.type as string,
        severity: data.severity as number,
        timestamp: (data.timestamp as Timestamp)?.toDate() || new Date(),
      };
    });

    // Analyze trend
    const trendAnalysis = analyzeSymptomTrend(symptomReadings, symptomType, 7);

    // Create alert if concerning
    if (trendAnalysis && isTrendConcerning(trendAnalysis)) {
      await createTrendAlert(userId, trendAnalysis, "symptom_trend");
    }
  } catch (_error) {
    // Don't throw - trend checking is non-critical
  }
}

/**
 * Batch check trends for all vital types for a user
 * Useful for periodic checks or after bulk data imports
 */
export async function checkAllTrendsForUser(userId: string): Promise<void> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get all vitals from last 7 days
    const vitalsQuery = query(
      collection(db, "vitals"),
      where("userId", "==", userId),
      where("timestamp", ">=", Timestamp.fromDate(sevenDaysAgo)),
      orderBy("timestamp", "asc"),
      limit(200)
    );

    const vitalsSnapshot = await getDocs(vitalsQuery);

    if (vitalsSnapshot.empty) {
      return;
    }

    // Group vitals by type
    const vitalsByType: Record<
      string,
      Array<{ value: number; timestamp: Date; unit: string }>
    > = {};

    vitalsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const type = data.type as string;
      const value = data.value as number;
      const unit = (data.unit as string) || "";
      const timestamp = (data.timestamp as Timestamp)?.toDate() || new Date();

      if (typeof value === "number" && type) {
        if (!vitalsByType[type]) {
          vitalsByType[type] = [];
        }
        vitalsByType[type].push({ value, timestamp, unit });
      }
    });

    // Check trends for each vital type
    for (const [type, readings] of Object.entries(vitalsByType)) {
      if (readings.length < 3) continue;

      const trendAnalysis = analyzeVitalTrend(
        readings.map((r) => ({ value: r.value, timestamp: r.timestamp })),
        type,
        readings[0]?.unit || "",
        7
      );

      if (trendAnalysis && isTrendConcerning(trendAnalysis)) {
        await createTrendAlert(userId, trendAnalysis, "vital_trend");
      }
    }

    // Check symptom trends
    const symptomsQuery = query(
      collection(db, "symptoms"),
      where("userId", "==", userId),
      where("timestamp", ">=", Timestamp.fromDate(sevenDaysAgo)),
      orderBy("timestamp", "asc"),
      limit(200)
    );

    const symptomsSnapshot = await getDocs(symptomsQuery);

    if (!symptomsSnapshot.empty) {
      const symptomsByType: Record<
        string,
        Array<{ type: string; severity: number; timestamp: Date }>
      > = {};

      symptomsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const type = data.type as string;
        const severity = data.severity as number;
        const timestamp = (data.timestamp as Timestamp)?.toDate() || new Date();

        if (type && typeof severity === "number") {
          if (!symptomsByType[type]) {
            symptomsByType[type] = [];
          }
          symptomsByType[type].push({ type, severity, timestamp });
        }
      });

      // Check trends for each symptom type
      for (const [type, readings] of Object.entries(symptomsByType)) {
        if (readings.length === 0) continue;

        const trendAnalysis = analyzeSymptomTrend(readings, type, 7);

        if (trendAnalysis && isTrendConcerning(trendAnalysis)) {
          await createTrendAlert(userId, trendAnalysis, "symptom_trend");
        }
      }
    }
  } catch (_error) {
    // Don't throw - trend checking is non-critical
  }
}
