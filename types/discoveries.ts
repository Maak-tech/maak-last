/**
 * Types for the Health Correlation Discovery & Anomaly Detection features
 */

// ─── Correlation Discovery Types ───────────────────────────────────────────

export type DiscoveryCategory =
  | "symptom_medication"
  | "symptom_mood"
  | "symptom_vital"
  | "medication_vital"
  | "mood_vital"
  | "temporal_pattern"
  | "sleep_vital"
  | "sleep_symptom"
  | "sleep_mood"
  | "activity_vital"
  | "activity_symptom"
  | "activity_mood"
  | "hrv_symptom"
  | "hrv_mood"
  | "hrv_vital";

export type DiscoveryStatus = "new" | "seen" | "dismissed";

export type HealthDiscovery = {
  id: string;
  userId: string;
  category: DiscoveryCategory;
  title: string;
  description: string;
  strength: number; // -1 to 1 (correlation coefficient)
  confidence: number; // 0-100
  actionable: boolean;
  recommendation?: string;
  dataPoints: number;
  periodDays: number;
  factor1: string;
  factor2: string;
  status: DiscoveryStatus;
  discoveredAt: Date;
  lastUpdatedAt: Date;
  notifiedAt?: Date;
  // Bilingual support
  titleAr?: string;
  descriptionAr?: string;
  recommendationAr?: string;
};

export type DiscoveryFilter = {
  category?: DiscoveryCategory;
  minConfidence?: number;
  status?: DiscoveryStatus;
  actionableOnly?: boolean;
};

export type DiscoveryRefreshResult = {
  discoveries: HealthDiscovery[];
  newCount: number;
  updatedCount: number;
  hasNewActionable: boolean;
};

// ─── Vital Anomaly Detection Types ─────────────────────────────────────────

export type AnomalySeverity = "warning" | "critical";

export type VitalAnomaly = {
  id: string;
  userId: string;
  vitalType: string;
  value: number;
  unit: string;
  zScore: number;
  severity: AnomalySeverity;
  isMultivariate: boolean;
  contributingFactors?: string[];
  context?: AnomalyContext;
  recommendation: string;
  recommendationAr?: string;
  timestamp: Date;
  acknowledged: boolean;
};

export type AnomalyContext = {
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  isTypicalForTime: boolean;
  recentMedications?: string[];
  historicalFrequency: number; // occurrences in last 30 days
};

export type MultivariateAnomalyResult = {
  isAnomaly: boolean;
  compositeRiskScore: number; // 0-100
  severity: "normal" | "warning" | "critical";
  anomalousVitals: AnomalousVital[];
  dangerousCombination?: DangerousCombination;
  recommendation: string;
  recommendationAr?: string;
};

export type AnomalousVital = {
  type: string;
  value: number;
  unit: string;
  zScore: number;
  baseline: { mean: number; stddev: number };
};

export type DangerousCombination = {
  vitals: string[];
  severity: AnomalySeverity;
  message: string;
  messageAr: string;
};

export type AnomalyStats = {
  total: number;
  byVitalType: Record<string, number>;
  bySeverity: { warning: number; critical: number };
  last24h: number;
  last7d: number;
};

export type BaselineStatus = {
  vitalType: string;
  hasBaseline: boolean;
  sampleCount: number;
  lastUpdated?: Date;
};
