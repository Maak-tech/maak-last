export type DiscoveryCategory =
  | "symptom_vital"
  | "temporal_pattern"
  | "medication_vital"
  | "lifestyle_vital"
  | "genetic_risk";

export type DiscoveryStatus =
  | "new"
  | "seen"
  | "viewed"
  | "dismissed"
  | "actioned";

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
  /** Arabic localisation fields */
  titleAr?: string;
  descriptionAr?: string;
  recommendationAr?: string;
  /** Timestamp of the last push/in-app notification sent for this discovery */
  notifiedAt?: Date;
}

/** Filter options accepted by getDiscoveries() */
export interface DiscoveryFilter {
  category?: DiscoveryCategory;
  status?: DiscoveryStatus;
  minConfidence?: number;
  actionableOnly?: boolean;
}

/** Return value from refreshDiscoveries() */
export interface DiscoveryRefreshResult {
  discoveries: HealthDiscovery[];
  newCount: number;
  updatedCount: number;
  hasNewActionable: boolean;
}

/** Severity levels for anomalies */
export type AnomalySeverity = "warning" | "critical";

/** A detected vital sign anomaly (z-score based) */
export interface VitalAnomaly {
  id: string;
  userId?: string;
  /** Vital type identifier (e.g. "heart_rate") */
  vitalType?: string;
  /** Legacy alias for vitalType */
  type?: string;
  value?: number;
  unit?: string;
  zScore?: number;
  severity?: AnomalySeverity;
  isAcknowledged?: boolean;
  /** Whether this anomaly was detected as part of a multivariate check */
  isMultivariate?: boolean;
  acknowledged?: boolean;
  recommendation?: string;
  recommendationAr?: string;
  /** Vital types that contributed to a multivariate anomaly */
  contributingFactors?: string[];
  /** Contextual enrichment data */
  context?: AnomalyContext;
  timestamp: Date;
  detectedAt?: Date;
  [key: string]: unknown;
}

/** A single vital that was anomalous in a multivariate check */
export interface AnomalousVital {
  type: string;
  value: number;
  unit: string;
  zScore: number;
  baseline: {
    mean: number;
    stddev: number;
  };
}

/** A dangerous combination of two vitals */
export interface DangerousCombination {
  vitals: [string, string];
  severity: AnomalySeverity;
  message: string;
  messageAr: string;
}

/** Result of a multivariate anomaly check across several vitals */
export interface MultivariateAnomalyResult {
  isAnomaly: boolean;
  compositeRiskScore: number;
  severity: "normal" | AnomalySeverity;
  anomalousVitals: AnomalousVital[];
  dangerousCombination?: DangerousCombination;
  recommendation: string;
  recommendationAr: string;
}

/** Status of a personalized baseline for a vital type */
export interface BaselineStatus {
  vitalType: string;
  hasBaseline: boolean;
  sampleCount: number;
  lastUpdated?: Date;
}

/** Contextual information enriching an anomaly */
export interface AnomalyContext {
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  isTypicalForTime: boolean;
  recentMedications?: string[];
  historicalFrequency: number;
}

/** Aggregate statistics for anomalies over a time period */
export interface AnomalyStats {
  total: number;
  byVitalType: Record<string, number>;
  bySeverity: Record<AnomalySeverity, number>;
  last24h: number;
  last7d: number;
}
