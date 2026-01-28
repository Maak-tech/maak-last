/**
 * Zeina Backward Compatibility Adapter
 *
 * Bridges the old Zeina API (from analyze.ts) with the new HIPAA-safe architecture.
 * This allows existing code to continue working while using the new implementation.
 */

import type { VitalsSummary } from "../../modules/vitals/recentSummary";
import { logger } from "../../observability/logger";
import { type AlertContext, runZeinaAnalysis } from "./index";
// Old types for backward compatibility (defined locally to avoid circular dependencies)
export interface AlertInfo {
  type: "vital" | "symptom" | "fall" | "trend" | "medication";
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  data: {
    vitalType?: string;
    value?: number;
    unit?: string;
    direction?: "low" | "high";
    symptomType?: string;
    symptomSeverity?: number;
    trendType?: string;
    [key: string]: any;
  };
}

export interface ZeinaAnalysisInput {
  patientId: string;
  alert: AlertInfo;
  recentVitalsSummary?: VitalsSummary;
  patientContext?: {
    age?: number;
    gender?: string;
    medicalHistory?: string[];
    medications?: string[];
  };
  traceId?: string;
  openaiApiKey?: string; // OpenAI API key for LLM calls
}

export interface RecommendedAction {
  priority: "immediate" | "high" | "moderate" | "low";
  action: string;
  rationale?: string;
}

export interface ZeinaAnalysisResult {
  riskScore: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  summary: string;
  recommendedActions: RecommendedAction[];
  analysisMetadata: {
    analysisType: "deterministic" | "ai";
    version: string;
    timestamp: Date;
  };
}

// Types exported above

/**
 * Legacy analyze function - bridges old API to new implementation
 *
 * @deprecated Use runZeinaAnalysis() from index.ts instead
 * This adapter is for backward compatibility only
 */
export async function analyze(
  input: ZeinaAnalysisInput
): Promise<ZeinaAnalysisResult> {
  const traceId =
    input.traceId ||
    `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  logger.debug("Legacy analyze() called, adapting to new API", {
    traceId,
    patientId: input.patientId,
    alertType: input.alert.type,
    fn: "zeina.adapter.analyze",
  });

  try {
    // Convert old AlertInfo to new AlertContext
    const alertContext: AlertContext = {
      alertId: `alert_${Date.now()}`, // Generate if not provided
      patientId: input.patientId,
      alertType: input.alert.type as any,
      severity: input.alert.severity as any,
      vitalType: input.alert.data.vitalType as any,
      vitalValue: input.alert.data.value,
      vitalUnit: input.alert.data.unit,
      trend: input.recentVitalsSummary
        ? detectTrend(input.recentVitalsSummary)
        : undefined,
      timestamp: new Date(),
      patientAge: input.patientContext?.age,
      patientGender: input.patientContext?.gender as any,
      medicationCount: input.patientContext?.medications?.length || 0,
      conditionCount: input.patientContext?.medicalHistory?.length || 0,
    };

    // Call new Zeina API
    const result = await runZeinaAnalysis({
      traceId,
      alertContext,
      openaiApiKey: input.openaiApiKey,
    });

    if (!(result.success && result.output)) {
      // Return safe fallback in old format
      return createLegacyFallback(input, traceId);
    }

    // Convert new ZeinaOutput to old ZeinaAnalysisResult format
    const legacyResult: ZeinaAnalysisResult = {
      riskScore: result.output.riskScore,
      riskLevel: mapEscalationToRiskLevel(result.output.escalationLevel),
      summary: result.output.summary,
      recommendedActions: mapActionCodeToLegacyActions(
        result.output.recommendedActionCode,
        result.output.escalationLevel,
        result.output.riskScore
      ),
      analysisMetadata: {
        analysisType: result.output.metadata.analysisType,
        version: result.output.metadata.version,
        timestamp: result.output.metadata.timestamp,
      },
    };

    logger.debug("Legacy result created from new API", {
      traceId,
      patientId: input.patientId,
      riskScore: legacyResult.riskScore,
      fn: "zeina.adapter.analyze",
    });

    return legacyResult;
  } catch (error) {
    logger.error("Error in legacy analyze adapter", error as Error, {
      traceId,
      patientId: input.patientId,
      fn: "zeina.adapter.analyze",
    });

    // Return safe fallback
    return createLegacyFallback(input, traceId);
  }
}

/**
 * Detect trend from vitals summary
 */
function detectTrend(
  vitals?: VitalsSummary
): "increasing" | "decreasing" | "stable" | undefined {
  if (!vitals) return;

  // Check if any vitals are increasing
  const hasIncreasing = Object.values(vitals).some(
    (v) => v && typeof v === "object" && v.trend === "increasing"
  );

  const hasDecreasing = Object.values(vitals).some(
    (v) => v && typeof v === "object" && v.trend === "decreasing"
  );

  if (hasIncreasing) return "increasing";
  if (hasDecreasing) return "decreasing";
  return "stable";
}

/**
 * Map new EscalationLevel to old risk level
 */
function mapEscalationToRiskLevel(
  escalation: string
): "low" | "moderate" | "high" | "critical" {
  switch (escalation) {
    case "emergency":
      return "critical";
    case "caregiver":
      return "high";
    case "none":
    default:
      return "moderate";
  }
}

/**
 * Map new RecommendedActionCode to old RecommendedAction array
 */
function mapActionCodeToLegacyActions(
  actionCode: string,
  escalation: string,
  riskScore: number
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  // Map action code to primary action
  switch (actionCode) {
    case "IMMEDIATE_ATTENTION":
      actions.push({
        priority: "immediate",
        action: "Contact patient immediately to assess condition",
        rationale: "Critical alert requires immediate response",
      });
      break;

    case "CONTACT_PATIENT":
      actions.push({
        priority: "immediate",
        action: "Contact patient to verify status",
        rationale: "Direct patient contact needed",
      });
      break;

    case "CHECK_VITALS":
      actions.push({
        priority: "high",
        action: "Schedule follow-up measurement",
        rationale: "Verify reading and monitor for improvement",
      });
      break;

    case "NOTIFY_CAREGIVER":
      actions.push({
        priority: "high",
        action: "Notify caregiver team",
        rationale: "Alert requires caregiver attention",
      });
      break;

    case "REVIEW_MEDICATIONS":
      actions.push({
        priority: "moderate",
        action: "Review recent vital trends and medication compliance",
        rationale: "Identify potential causes of alert",
      });
      break;

    case "MONITOR":
    default:
      actions.push({
        priority: "low",
        action: "Continue monitoring",
        rationale: "Maintain baseline health tracking",
      });
      break;
  }

  // Add escalation-specific actions
  if (escalation === "emergency") {
    actions.push({
      priority: "immediate",
      action: "Consider calling emergency services if unable to reach patient",
      rationale: "Critical situation may require emergency response",
    });
  }

  if (riskScore >= 60) {
    actions.push({
      priority: "moderate",
      action: "Assess need for medical consultation",
      rationale: "Determine if professional medical review is needed",
    });
  }

  // Always include documentation
  actions.push({
    priority: "low",
    action: "Update family members on patient status",
    rationale: "Keep care team informed",
  });

  return actions;
}

/**
 * Create legacy fallback result
 */
function createLegacyFallback(
  input: ZeinaAnalysisInput,
  traceId: string
): ZeinaAnalysisResult {
  let riskScore = 50;

  switch (input.alert.severity) {
    case "critical":
      riskScore = 75;
      break;
    case "warning":
      riskScore = 50;
      break;
    case "info":
      riskScore = 25;
      break;
  }

  return {
    riskScore,
    riskLevel:
      riskScore >= 75 ? "critical" : riskScore >= 60 ? "high" : "moderate",
    summary: "Alert requires review",
    recommendedActions: [
      {
        priority: "high",
        action: "Review alert details and patient history",
        rationale: "Standard review recommended",
      },
    ],
    analysisMetadata: {
      analysisType: "deterministic",
      version: "1.0.0",
      timestamp: new Date(),
    },
  };
}
