import { api } from "@/lib/apiClient";

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

function riskLevelFromScore(score: number): PatientHealthSnapshot["riskLevel"] {
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
    const missedMeds = medsResult.status === "fulfilled" ? medsResult.value : 0;

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
    } else if (lastVital.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
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
    try {
      const docs = await api.get<Array<{ severity?: string }>>(
        `/api/health/anomalies?userId=${userId}&from=${since.toISOString()}&limit=50`
      ) ?? [];
      let critical = 0;
      let warning = 0;
      for (const doc of docs) {
        if (doc.severity === "critical") critical++;
        else warning++;
      }
      return { critical, warning };
    } catch {
      return { critical: 0, warning: 0 };
    }
  }

  private async getLastVitalSync(
    userId: string,
    since: Date
  ): Promise<Date | null> {
    try {
      const docs = await api.get<Array<{ recordedAt?: string }>>(
        `/api/health/vitals?userId=${userId}&from=${since.toISOString()}&limit=1`
      ) ?? [];
      if (docs.length === 0) return null;
      const ts = docs[0].recordedAt;
      return ts ? new Date(ts) : null;
    } catch {
      return null;
    }
  }

  private async getActiveAlertCount(
    userId: string,
    since: Date
  ): Promise<number> {
    try {
      const rows = await api.get<unknown[]>(
        `/api/alerts?userId=${userId}&resolved=false&from=${since.toISOString()}&limit=20`
      ) ?? [];
      return rows.length;
    } catch {
      return 0;
    }
  }

  private async getMissedMedicationsToday(
    userId: string,
    todayMidnight: Date
  ): Promise<number> {
    try {
      const meds = await api.get<Array<{
        isActive?: boolean;
        reminders?: Array<{ taken?: boolean; time?: string }>;
      }>>(
        `/api/health/medications/user/${userId}?limit=20`
      ) ?? [];

      let missedCount = 0;
      const nowMs = Date.now();
      const midnightMs = todayMidnight.getTime();

      for (const med of meds) {
        const reminders = med.reminders ?? [];
        for (const reminder of reminders) {
          if (reminder.taken) continue;
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
    } catch {
      return 0;
    }
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
