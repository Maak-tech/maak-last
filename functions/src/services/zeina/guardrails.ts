/**
 * Guardrails: Schema + Medical Safety
 *
 * HIPAA-SAFE VALIDATION:
 * - Validates strict schema (only allowed fields)
 * - No free-text medical advice
 * - Ensures non-diagnostic language
 * - Blocks any output that doesn't meet safety requirements
 *
 * Allowed output fields ONLY:
 * - riskScore (0-100)
 * - summary (short, non-diagnostic)
 * - recommendedActionCode (enum)
 * - escalationLevel (none | caregiver | emergency)
 */
/* biome-ignore-all lint/style/useBlockStatements: concise guard checks are intentionally used for validation readability. */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: safety validator intentionally contains explicit layered checks. */

import { logger } from "../../observability/logger";
import type {
  AlertContext,
  GuardrailResult,
  RawAIResponse,
  ZeinaOutput,
} from "./types";
import { EscalationLevel, RecommendedActionCode } from "./types";

/**
 * Validate AlertContext input
 */
export function validateAlertContext(
  context: AlertContext,
  traceId: string
): GuardrailResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!context.alertId) errors.push("alertId is required");
  if (!context.patientId) errors.push("patientId is required");
  if (!context.alertType) errors.push("alertType is required");
  if (!context.severity) errors.push("severity is required");

  // Validate enums
  const validAlertTypes = ["vital", "symptom", "fall", "trend", "medication"];
  if (context.alertType && !validAlertTypes.includes(context.alertType)) {
    errors.push(`alertType must be one of: ${validAlertTypes.join(", ")}`);
  }

  const validSeverities = ["info", "warning", "critical"];
  if (context.severity && !validSeverities.includes(context.severity)) {
    errors.push(`severity must be one of: ${validSeverities.join(", ")}`);
  }

  // Validate vital data
  if (
    context.vitalValue !== undefined &&
    (context.vitalValue < 0 || context.vitalValue > 1000)
  ) {
    warnings.push("vitalValue appears out of reasonable range");
  }

  if (errors.length > 0) {
    logger.warn("AlertContext validation failed", {
      traceId,
      errors,
      fn: "zeina.guardrails.validateAlertContext",
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate AI response against strict schema
 * BLOCKS any response that doesn't meet requirements
 */
export function validateAIResponse(
  response: RawAIResponse,
  traceId: string
): GuardrailResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required field: riskScore
  if (response.riskScore === undefined || response.riskScore === null) {
    errors.push("riskScore is required");
  } else if (typeof response.riskScore !== "number") {
    errors.push("riskScore must be a number");
  } else if (response.riskScore < 0 || response.riskScore > 100) {
    errors.push("riskScore must be between 0 and 100");
  }

  // Required field: summary
  if (!response.summary) {
    errors.push("summary is required");
  } else if (typeof response.summary !== "string") {
    errors.push("summary must be a string");
  } else {
    // Validate summary is non-diagnostic
    const summary = response.summary.toLowerCase();
    const diagnosticTerms = [
      "diagnosis",
      "diagnose",
      "diagnosed",
      "disease",
      "disorder",
      "syndrome",
      "condition is",
      "you have",
      "patient has",
      "cancer",
      "infection",
      "diabetes",
      "hypertension",
    ];

    for (const term of diagnosticTerms) {
      if (summary.includes(term)) {
        errors.push(`summary contains diagnostic language: "${term}"`);
        break;
      }
    }

    // Check length
    if (response.summary.length > 200) {
      errors.push("summary must be under 200 characters");
    }
    if (response.summary.length < 10) {
      warnings.push("summary is very short");
    }
  }

  // Required field: recommendedActionCode
  const validActionCodes = [
    "MONITOR",
    "CHECK_VITALS",
    "RECHECK_IN_1H",
    "RECHECK_IN_24H",
    "CONTACT_PATIENT",
    "UPDATE_FAMILY",
    "NOTIFY_CAREGIVER",
    "REVIEW_MEDICATIONS",
    "REVIEW_HISTORY",
    "ASSESS_SYMPTOMS",
    "SCHEDULE_CONSULTATION",
    "CONSIDER_EMERGENCY",
    "IMMEDIATE_ATTENTION",
  ];

  if (!response.recommendedActionCode) {
    errors.push("recommendedActionCode is required");
  } else if (!validActionCodes.includes(response.recommendedActionCode)) {
    errors.push(
      `recommendedActionCode must be one of: ${validActionCodes.join(", ")}`
    );
  }

  // Required field: escalationLevel
  const validEscalationLevels = ["none", "caregiver", "emergency"];
  if (!response.escalationLevel) {
    errors.push("escalationLevel is required");
  } else if (
    !validEscalationLevels.includes(response.escalationLevel.toLowerCase())
  ) {
    errors.push(
      `escalationLevel must be one of: ${validEscalationLevels.join(", ")}`
    );
  }

  if (errors.length > 0) {
    logger.warn("AI response validation failed - GUARDRAIL BLOCK", {
      traceId,
      errors,
      fn: "zeina.guardrails.validateAIResponse",
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Apply medical safety constraints
 * Ensures risk scores align with severity and escalation levels
 */
export function applySafetyConstraints(
  riskScore: number,
  escalationLevel: string,
  severity: string,
  traceId: string
): number {
  let constrainedScore = riskScore;

  // Critical severity must have risk score >= 60
  if (severity === "critical" && constrainedScore < 60) {
    logger.warn(
      "Applying safety constraint: critical severity requires high risk score",
      {
        traceId,
        originalScore: riskScore,
        adjustedScore: 60,
        fn: "zeina.guardrails.applySafetyConstraints",
      }
    );
    constrainedScore = 60;
  }

  // Emergency escalation must have risk score >= 70
  if (escalationLevel === "emergency" && constrainedScore < 70) {
    logger.warn(
      "Applying safety constraint: emergency escalation requires high risk score",
      {
        traceId,
        originalScore: riskScore,
        adjustedScore: 70,
        fn: "zeina.guardrails.applySafetyConstraints",
      }
    );
    constrainedScore = 70;
  }

  // Info severity should not exceed 60
  if (severity === "info" && constrainedScore > 60) {
    logger.warn(
      "Applying safety constraint: info severity should not have high risk score",
      {
        traceId,
        originalScore: riskScore,
        adjustedScore: 60,
        fn: "zeina.guardrails.applySafetyConstraints",
      }
    );
    constrainedScore = 60;
  }

  // None escalation should not exceed 50
  if (escalationLevel === "none" && constrainedScore > 50) {
    logger.warn(
      "Applying safety constraint: no escalation should not have high risk score",
      {
        traceId,
        originalScore: riskScore,
        adjustedScore: 50,
        fn: "zeina.guardrails.applySafetyConstraints",
      }
    );
    constrainedScore = 50;
  }

  return Math.max(0, Math.min(100, constrainedScore));
}

/**
 * Sanitize and normalize AI response to ZeinaOutput
 * Only includes allowed fields, strips everything else
 */
export function sanitizeToZeinaOutput(
  response: RawAIResponse,
  alertContext: AlertContext,
  traceId: string,
  model?: string
): ZeinaOutput {
  // Extract and constrain risk score
  let riskScore = response.riskScore ?? 50;
  riskScore = applySafetyConstraints(
    riskScore,
    response.escalationLevel ?? "none",
    alertContext.severity,
    traceId
  );

  // Normalize action code
  const actionCode =
    (response.recommendedActionCode as RecommendedActionCode) ||
    RecommendedActionCode.MONITOR;

  // Normalize escalation level
  const escalationLevel =
    (response.escalationLevel?.toLowerCase() as EscalationLevel) ||
    EscalationLevel.NONE;

  // Sanitize summary (truncate if too long)
  let summary = response.summary || "Alert requires review";
  if (summary.length > 200) {
    summary = `${summary.substring(0, 197)}...`;
  }

  return {
    riskScore,
    summary,
    recommendedActionCode: actionCode,
    escalationLevel,
    metadata: {
      analysisType: "ai",
      model,
      timestamp: new Date(),
      version: "1.0.0",
    },
  };
}
