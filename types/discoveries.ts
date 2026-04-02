export type DiscoveryCategory =
  | "symptom_vital"
  | "temporal_pattern"
  | "medication_vital"
  | "lifestyle_vital"
  | "genetic_risk";

export type DiscoveryStatus = "new" | "viewed" | "dismissed" | "actioned";

export interface HealthDiscovery {
  id: string;
  userId: string;
  category: DiscoveryCategory;
  title: string;
  description: string;
  strength: number;        // 0–1
  confidence: number;      // 0–100
  actionable: boolean;
  recommendation?: string;
  dataPoints: number;
  periodDays: number;
  factor1: string;
  factor2: string;
  status: DiscoveryStatus;
  discoveredAt: Date;
  lastUpdatedAt: Date;
}
