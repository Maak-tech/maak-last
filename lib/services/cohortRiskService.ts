export type SortField =
  | "riskScore"
  | "name"
  | "lastActivity"
  | "adherence"
  | "vhiScore";

export interface CohortPatient {
  id: string;
  name: string;
  riskScore: number;
  vhiScore?: number;
  adherence?: number;
  lastActivity?: Date;
  riskLevel: "critical" | "high" | "elevated" | "normal";
}

export const cohortRiskService = {
  async getCohortPatients(
    orgId: string,
    cohortId?: string,
    sortField: SortField = "riskScore"
  ): Promise<CohortPatient[]> {
    return [];
  },
};
