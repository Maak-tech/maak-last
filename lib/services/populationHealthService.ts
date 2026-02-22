import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PatientHealthSnapshot = {
  userId: string;
  riskScore: number; // 0–100 composite risk
  riskLevel: "normal" | "elevated" | "high" | "critical";
  lastVitalSyncAt: Date | null;
  recentAnomalies: {
    critical: number;
    warning: number;
    total: number;
  };
  missedMedicationsToday: number;
  activeAlerts: number;
  lastUpdatedAt: Date;
};

export type PopulationSummary = {
  total: number;
  criticalCount: number;
  highCount: number;
  elevatedCount: number;
  normalCount: number;
  unacknowledgedAnomalies: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return null;
}

function riskLevelFromScore(
  score: number
): PatientHealthSnapshot["riskLevel"] {
  if (score >= 70) return "critical";
  if (score >= 45) return "high";
  if (score >= 20) return "elevated";
  return "normal";
}

// ─── Service ──────────────────────────────────────────────────────────────────

class PopulationHealthService {
  /**
   * Fetch health snapshots for a list of patient user IDs.
   * Runs per-patient queries in parallel.
   */
  async getSnapshots(userIds: string[]): Promise<PatientHealthSnapshot[]> {
    if (userIds.length === 0) return [];

    const snapshots = await Promise.allSettled(
      userIds.map((uid) => this.getPatientSnapshot(uid))
    );

    return snapshots
      .filter(
        (r): r is PromiseFulfilledResult<PatientHealthSnapshot> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value);
  }

  /**
   * Build a health snapshot for a single patient.
   */
  async getPatientSnapshot(userId: string): Promise<PatientHealthSnapshot> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);

    const [anomaliesResult, vitalsResult, alertsResult, medsResult] =
      await Promise.allSettled([
        this.getRecentAnomalies(userId, twentyFourHoursAgo),
        this.getLastVitalSync(userId, fortyEightHoursAgo),
        this.getActiveAlertCount(userId, twentyFourHoursAgo),
        this.getMissedMedicationsToday(userId, todayMidnight),
      ]);

    const anomalies =
      anomaliesResult.status === "fulfilled" ? anomaliesResult.value : null;
    const lastVital =
      vitalsResult.status === "fulfilled" ? vitalsResult.value : null;
    const alertCount =
      alertsResult.status === "fulfilled" ? alertsResult.value : 0;
    const missedMeds =
      medsResult.status === "fulfilled" ? medsResult.value : 0;

    // ─── Composite Risk Score ─────────────────────────────────────────────────
    let riskScore = 0;

    // Anomalies (max 50 points)
    if (anomalies) {
      riskScore += Math.min(anomalies.critical * 25, 40);
      riskScore += Math.min(anomalies.warning * 10, 10);
    }

    // Vital sync recency (max 20 points)
    if (!lastVital) {
      riskScore += 20; // No vitals in 48h
    } else if (
      lastVital.getTime() <
      now.getTime() - 24 * 60 * 60 * 1000
    ) {
      riskScore += 10; // No vitals in 24h
    }

    // Missed medications (max 20 points)
    riskScore += Math.min(missedMeds * 7, 20);

    // Active alerts (max 10 points)
    riskScore += Math.min(alertCount * 5, 10);

    riskScore = Math.min(Math.round(riskScore), 100);

    return {
      userId,
      riskScore,
      riskLevel: riskLevelFromScore(riskScore),
      lastVitalSyncAt: lastVital,
      recentAnomalies: {
        critical: anomalies?.critical ?? 0,
        warning: anomalies?.warning ?? 0,
        total: (anomalies?.critical ?? 0) + (anomalies?.warning ?? 0),
      },
      missedMedicationsToday: missedMeds,
      activeAlerts: alertCount,
      lastUpdatedAt: now,
    };
  }

  private async getRecentAnomalies(
    userId: string,
    since: Date
  ): Promise<{ critical: number; warning: number }> {
    const q = query(
      collection(db, "users", userId, "anomalies"),
      where("acknowledged", "==", false),
      where("timestamp", ">=", Timestamp.fromDate(since)),
      limit(50)
    );
    const snap = await getDocs(q);
    let critical = 0;
    let warning = 0;
    for (const doc of snap.docs) {
      const severity = doc.data().severity;
      if (severity === "critical") critical++;
      else warning++;
    }
    return { critical, warning };
  }

  private async getLastVitalSync(
    userId: string,
    since: Date
  ): Promise<Date | null> {
    const q = query(
      collection(db, "vitals"),
      where("userId", "==", userId),
      where("timestamp", ">=", Timestamp.fromDate(since)),
      orderBy("timestamp", "desc"),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return toDate(snap.docs[0].data().timestamp);
  }

  private async getActiveAlertCount(
    userId: string,
    since: Date
  ): Promise<number> {
    const q = query(
      collection(db, "alerts"),
      where("userId", "==", userId),
      where("resolved", "==", false),
      where("timestamp", ">=", Timestamp.fromDate(since)),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.size;
  }

  private async getMissedMedicationsToday(
    userId: string,
    todayMidnight: Date
  ): Promise<number> {
    const q = query(
      collection(db, "medications"),
      where("userId", "==", userId),
      where("isActive", "==", true),
      limit(20)
    );
    const snap = await getDocs(q);

    let missedCount = 0;
    const nowMs = Date.now();
    const midnightMs = todayMidnight.getTime();

    for (const doc of snap.docs) {
      const med = doc.data();
      const reminders: Array<{
        taken: boolean;
        takenAt?: unknown;
        time: string;
      }> = med.reminders ?? [];

      for (const reminder of reminders) {
        if (reminder.taken) continue;

        // Parse reminder time (HH:MM) and check if it was due today and now past
        const [hours, minutes] = (reminder.time ?? "00:00")
          .split(":")
          .map(Number);
        const dueMs = midnightMs + (hours * 60 + minutes) * 60 * 1000;

        if (dueMs < nowMs) {
          missedCount++;
        }
      }
    }

    return missedCount;
  }

  /**
   * Compute a population-level summary from an array of snapshots.
   */
  summarize(snapshots: PatientHealthSnapshot[]): PopulationSummary {
    const summary: PopulationSummary = {
      total: snapshots.length,
      criticalCount: 0,
      highCount: 0,
      elevatedCount: 0,
      normalCount: 0,
      unacknowledgedAnomalies: 0,
    };

    for (const s of snapshots) {
      switch (s.riskLevel) {
        case "critical":
          summary.criticalCount++;
          break;
        case "high":
          summary.highCount++;
          break;
        case "elevated":
          summary.elevatedCount++;
          break;
        default:
          summary.normalCount++;
      }
      summary.unacknowledgedAnomalies += s.recentAnomalies.total;
    }

    return summary;
  }
}

export const populationHealthService = new PopulationHealthService();
