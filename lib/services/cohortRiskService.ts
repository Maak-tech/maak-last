import type { PatientRoster } from "@/types";
import {
  type PatientHealthSnapshot,
  populationHealthService,
} from "./populationHealthService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RankedPatient = {
  roster: PatientRoster;
  snapshot: PatientHealthSnapshot;
};

export type SortField =
  | "riskScore"
  | "lastVitalSync"
  | "anomalies"
  | "missedMeds";

// ─── Service ──────────────────────────────────────────────────────────────────

class CohortRiskService {
  /**
   * Given a list of patient roster records, fetch health snapshots for each
   * and return patients ranked by composite risk score (highest first).
   */
  async rankPatients(
    rosterEntries: PatientRoster[],
    sortBy: SortField = "riskScore"
  ): Promise<RankedPatient[]> {
    if (rosterEntries.length === 0) return [];

    const userIds = rosterEntries.map((r) => r.userId);
    const snapshots = await populationHealthService.getSnapshots(userIds);

    const snapshotMap = new Map(snapshots.map((s) => [s.userId, s]));

    const ranked: RankedPatient[] = rosterEntries
      .map((roster) => {
        const snapshot = snapshotMap.get(roster.userId) ?? {
          userId: roster.userId,
          riskScore: 0,
          riskLevel: "normal" as const,
          lastVitalSyncAt: null,
          recentAnomalies: { critical: 0, warning: 0, total: 0 },
          missedMedicationsToday: 0,
          activeAlerts: 0,
          lastUpdatedAt: new Date(),
        };
        return { roster, snapshot };
      })
      .sort((a, b) => this.compare(a.snapshot, b.snapshot, sortBy));

    return ranked;
  }

  /**
   * Filter ranked patients by risk level.
   */
  filterByRisk(
    patients: RankedPatient[],
    level: "all" | "critical" | "high" | "elevated" | "normal"
  ): RankedPatient[] {
    if (level === "all") return patients;
    return patients.filter((p) => p.snapshot.riskLevel === level);
  }

  /**
   * Filter to patients with unacknowledged anomalies.
   */
  filterWithAnomalies(patients: RankedPatient[]): RankedPatient[] {
    return patients.filter((p) => p.snapshot.recentAnomalies.total > 0);
  }

  /**
   * Filter to patients who haven't synced vitals recently.
   */
  filterNoRecentSync(
    patients: RankedPatient[],
    hoursThreshold = 24
  ): RankedPatient[] {
    const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
    return patients.filter(
      (p) => !p.snapshot.lastVitalSyncAt || p.snapshot.lastVitalSyncAt < cutoff
    );
  }

  /**
   * Filter to patients with missed medications today.
   */
  filterMissedMedications(patients: RankedPatient[]): RankedPatient[] {
    return patients.filter((p) => p.snapshot.missedMedicationsToday > 0);
  }

  private compare(
    a: PatientHealthSnapshot,
    b: PatientHealthSnapshot,
    sortBy: SortField
  ): number {
    switch (sortBy) {
      case "riskScore":
        return b.riskScore - a.riskScore;

      case "lastVitalSync": {
        const aMs = a.lastVitalSyncAt?.getTime() ?? 0;
        const bMs = b.lastVitalSyncAt?.getTime() ?? 0;
        return aMs - bMs; // oldest sync first (most concerning)
      }

      case "anomalies":
        return b.recentAnomalies.total - a.recentAnomalies.total;

      case "missedMeds":
        return b.missedMedicationsToday - a.missedMedicationsToday;

      default:
        return b.riskScore - a.riskScore;
    }
  }
}

export const cohortRiskService = new CohortRiskService();
