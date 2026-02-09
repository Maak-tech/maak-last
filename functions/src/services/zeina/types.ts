/**
 * Zeina Service Type Definitions
 * Core types for HIPAA-safe AI analysis
 *
 * PHI BOUNDARY: This file defines data structures.
 * - AlertContext: May contain PHI (raw backend data)
 * - ZeinaInput: NO PHI (sanitized, normalized)
 * - ZeinaOutput: NO PHI (structured actions only)
 */

/**
 * Raw alert context from backend (MAY CONTAIN PHI)
 * This is the input boundary - PHI must be stripped before AI processing
 */
export type AlertContext = {
  alertId: string;
  patientId: string;
  alertType: "vital" | "symptom" | "fall" | "trend" | "medication";
  severity: "info" | "warning" | "critical";
  vitalType?:
    | "heartRate"
    | "bloodPressure"
    | "respiratoryRate"
    | "oxygenSaturation"
    | "bodyTemperature"
    | "weight";
  vitalValue?: number;
  vitalUnit?: string;
  trend?: "increasing" | "decreasing" | "stable";
  timestamp?: Date;
  // Additional context (all stripped before AI)
  patientAge?: number;
  patientGender?: "male" | "female" | "other";
  medicationCount?: number;
  conditionCount?: number;
};

/**
 * Sanitized input for AI (NO PHI)
 * This is what gets sent to the LLM
 */
export type ZeinaInput = {
  alertType: string;
  severity: string;
  vitalType?: string;
  vitalLevel?: "very_low" | "low" | "normal" | "high" | "very_high"; // Bucketed value
  trend?: "increasing" | "decreasing" | "stable";
  ageGroup?: "child" | "adult" | "senior"; // Bucketed age
  gender?: "male" | "female" | "other";
  hasMedications?: boolean;
  hasConditions?: boolean;
  context?: string; // Generic contextual info, no identifying details
};

/**
 * Recommended action codes (enum for deterministic mapping)
 */
export const RecommendedActionCode = {
  // Monitoring actions
  MONITOR: "MONITOR",
  CHECK_VITALS: "CHECK_VITALS",
  RECHECK_IN_1H: "RECHECK_IN_1H",
  RECHECK_IN_24H: "RECHECK_IN_24H",

  // Communication actions
  CONTACT_PATIENT: "CONTACT_PATIENT",
  UPDATE_FAMILY: "UPDATE_FAMILY",
  NOTIFY_CAREGIVER: "NOTIFY_CAREGIVER",

  // Clinical actions
  REVIEW_MEDICATIONS: "REVIEW_MEDICATIONS",
  REVIEW_HISTORY: "REVIEW_HISTORY",
  ASSESS_SYMPTOMS: "ASSESS_SYMPTOMS",

  // Escalation actions
  SCHEDULE_CONSULTATION: "SCHEDULE_CONSULTATION",
  CONSIDER_EMERGENCY: "CONSIDER_EMERGENCY",
  IMMEDIATE_ATTENTION: "IMMEDIATE_ATTENTION",
} as const;
export type RecommendedActionCode =
  (typeof RecommendedActionCode)[keyof typeof RecommendedActionCode];

/**
 * Escalation levels
 */
export const EscalationLevel = {
  NONE: "none", // Informational only
  CAREGIVER: "caregiver", // Notify caregiver
  EMERGENCY: "emergency", // Immediate medical attention
} as const;
export type EscalationLevel =
  (typeof EscalationLevel)[keyof typeof EscalationLevel];

/**
 * Raw AI response (before validation)
 */
export type RawAIResponse = {
  riskScore?: number;
  summary?: string;
  recommendedActionCode?: string;
  escalationLevel?: string;
  reasoning?: string;
  confidence?: number;
  [key: string]: unknown;
};

/**
 * Validated Zeina output (NO PHI)
 * This is the structured result after guardrail validation
 */
export type ZeinaOutput = {
  riskScore: number; // 0-100
  summary: string; // Short, non-diagnostic
  recommendedActionCode: RecommendedActionCode;
  escalationLevel: EscalationLevel;
  metadata: {
    analysisType: "ai" | "deterministic";
    model?: string;
    timestamp: Date;
    version: string;
  };
};

/**
 * Zeina analysis request
 */
export type ZeinaAnalysisRequest = {
  traceId: string;
  alertContext: AlertContext;
};

/**
 * Zeina analysis result (public API response)
 */
export type ZeinaAnalysisResult = {
  success: boolean;
  output?: ZeinaOutput;
  error?: string;
  traceId: string;
};

/**
 * Guardrail validation result
 */
export type GuardrailResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Backend actions (deterministic mapping from ZeinaOutput)
 */
export type BackendActions = {
  sendAlert: boolean;
  alertRecipients: ("caregiver" | "family" | "emergency")[];
  appCTA?: {
    action: string;
    label: string;
    priority: "low" | "medium" | "high" | "critical";
  };
  autoActions: string[]; // List of automated actions to trigger
};

/**
 * Observability metrics
 */
export type ZeinaMetrics = {
  traceId: string;
  durationMs: number;
  success: boolean;
  analysisType: "ai" | "deterministic";
  guardrailBlocked: boolean;
  errorType?: string;
};
