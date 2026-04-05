import { api } from "@/lib/apiClient";

export type SortField =
  | "riskScore"
  | "name"
  | "lastActivity"
  | "adherence"
  | "vhiScore"
  | "lastVitalSync"
  | "anomalies"
  | "missedMeds";

export interface CohortPatient {
  id: string;
  name: string;
  riskScore: number;
  vhiScore?: number;
  adherence?: number;
  lastActivity?: Date;
  riskLevel: "critical" | "high" | "elevated" | "normal";
}

function riskLevelFromScore(score: number): CohortPatient["riskLevel"] {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "elevated";
  return "normal";
}

export const cohortRiskService = {
  async getCohortPatients(
    orgId: string,
    cohortId?: string,
    sortField: SortField = "riskScore"
  ): Promise<CohortPatient[]> {
    try {
      const rows = await api.get<
        Array<{
          userId: string;
          displayName?: string;
          riskScore?: number;
          cohortIds?: string[];
          lastContact?: string;
        }>
      >(`/api/org/${orgId}/roster?status=active`);

      if (!Array.isArray(rows)) return [];

      let patients: CohortPatient[] = rows
        // Filter by cohortId when provided
        .filter((r) => !cohortId || (Array.isArray(r.cohortIds) && r.cohortIds.includes(cohortId)))
        .map((r) => {
          const score = r.riskScore ?? 0;
          return {
            id: r.userId,
            name: r.displayName ?? r.userId,
            riskScore: score,
            lastActivity: r.lastContact ? new Date(r.lastContact) : undefined,
            riskLevel: riskLevelFromScore(score),
          };
        });

      // Sort by the requested field
      patients.sort((a, b) => {
        switch (sortField) {
          case "name":
            return a.name.localeCompare(b.name);
          case "lastActivity":
            return (b.lastActivity?.getTime() ?? 0) - (a.lastActivity?.getTime() ?? 0);
          case "riskScore":
          default:
            return b.riskScore - a.riskScore;
        }
      });

      return patients;
    } catch (err: unknown) {
      console.warn(
        "[cohortRiskService] getCohortPatients failed:",
        err instanceof Error ? err.message : String(err)
      );
      return [];
    }
  },
};
