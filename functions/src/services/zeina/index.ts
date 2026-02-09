/**
 * Zeina AI Analysis Service - Public API
 *
 * HIPAA-SAFE AI ORCHESTRATION:
 * - Accepts raw alert context (with PHI)
 * - Strips PHI before AI processing
 * - Returns structured, validated output
 *
 * FAIL CLOSED: If Zeina fails, system falls back to standard alerts
 * - Never blocks critical health alerts
 * - Always returns a valid result
 * - Failures are logged but don't break the alert flow
 */

import { logger } from "../../observability/logger";
import { callLLM, generateDeterministicResponse } from "./analyze";
import {
  sanitizeToZeinaOutput,
  validateAIResponse,
  validateAlertContext,
} from "./guardrails";
import { buildAnalysisPrompt, buildZeinaInput } from "./inputBuilder";
import {
  trackGuardrailBlock,
  trackLLMCall,
  trackLLMTimeout,
  trackZeinaCall,
  trackZeinaComplete,
  trackZeinaFailure,
} from "./observability";
import { formatForAudit, mapToBackendActions } from "./outputMapper";
import type {
  AlertContext,
  BackendActions,
  RawAIResponse,
  ZeinaAnalysisRequest,
  ZeinaAnalysisResult,
  ZeinaOutput,
} from "./types";

/**
 * Run Zeina AI analysis on alert
 *
 * This is the main entry point for Zeina analysis
 *
 * FAIL CLOSED BEHAVIOR:
 * - If any step fails, returns deterministic fallback
 * - Never throws errors that would break alert flow
 * - Always returns success=true with valid output
 *
 * @param request - Analysis request with traceId and alertContext, optionally openaiApiKey
 * @returns ZeinaAnalysisResult with output or error
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestrator intentionally layers validation, fallback, and telemetry in one flow.
export async function runZeinaAnalysis(
  request: ZeinaAnalysisRequest & { openaiApiKey?: string }
): Promise<ZeinaAnalysisResult> {
  const { traceId, alertContext } = request;
  const startTime = Date.now();
  let errorType: string | undefined;

  // Track call
  trackZeinaCall(traceId, alertContext.alertId);

  try {
    // Step 1: Validate input
    const inputValidation = validateAlertContext(alertContext, traceId);
    if (!inputValidation.valid) {
      trackGuardrailBlock(
        traceId,
        alertContext.alertId,
        "input_validation",
        inputValidation.errors
      );

      // FAIL CLOSED: Use deterministic fallback
      return createDeterministicFallback(alertContext, traceId, startTime);
    }

    // Step 2: Build AI-safe input (strip PHI)
    const zeinaInput = buildZeinaInput(alertContext, traceId);
    const prompt = buildAnalysisPrompt(zeinaInput);

    // Step 3: Call LLM or use deterministic fallback
    const llmStartTime = Date.now();
    const useAI = process.env.ZEINA_ENABLED !== "false"; // Default enabled
    let rawResponse: RawAIResponse | null = null;
    let analysisType: "ai" | "deterministic" = "deterministic";

    if (useAI) {
      try {
        // API key can be passed via request.secrets or fall back to process.env
        const apiKey = request.openaiApiKey;
        rawResponse = await callLLM(zeinaInput, prompt, traceId, apiKey);
        const llmDuration = Date.now() - llmStartTime;

        if (rawResponse) {
          analysisType = "ai";
          trackLLMCall(traceId, "openai", true, llmDuration);
        } else {
          trackLLMCall(traceId, "openai", false, llmDuration);
        }
      } catch (error) {
        const llmDuration = Date.now() - llmStartTime;

        if ((error as Error).message.includes("timeout")) {
          trackLLMTimeout(traceId, "openai");
        } else {
          trackLLMCall(traceId, "openai", false, llmDuration);
        }

        // FAIL CLOSED: Continue to deterministic fallback
        logger.warn("LLM call failed, using deterministic fallback", {
          traceId,
          error: (error as Error).message,
          fn: "zeina.runZeinaAnalysis",
        });
      }
    }

    // If no AI response, generate deterministic
    if (!rawResponse) {
      rawResponse = generateDeterministicResponse(zeinaInput, traceId);
      analysisType = "deterministic";
    }

    // Step 4: Validate AI response
    if (analysisType === "ai") {
      const responseValidation = validateAIResponse(rawResponse, traceId);
      if (!responseValidation.valid) {
        trackGuardrailBlock(
          traceId,
          alertContext.alertId,
          "response_validation",
          responseValidation.errors
        );

        // FAIL CLOSED: Fall back to deterministic
        rawResponse = generateDeterministicResponse(zeinaInput, traceId);
        analysisType = "deterministic";
      }
    }

    // Step 5: Sanitize to ZeinaOutput
    const output = sanitizeToZeinaOutput(
      rawResponse,
      alertContext,
      traceId,
      analysisType === "ai" ? "gpt-4o-mini" : undefined
    );
    output.metadata.analysisType = analysisType;

    // Track completion
    const duration = Date.now() - startTime;
    trackZeinaComplete(
      traceId,
      alertContext.alertId,
      duration,
      analysisType,
      output.riskScore
    );

    return {
      success: true,
      output,
      traceId,
    };
  } catch (error) {
    // FAIL CLOSED: Return deterministic fallback even on unexpected errors
    errorType = (error as Error).name || "unknown_error";
    trackZeinaFailure(traceId, alertContext.alertId, errorType, error as Error);

    return createDeterministicFallback(alertContext, traceId, startTime);
  }
}

/**
 * Create deterministic fallback result
 * Used when Zeina analysis fails at any stage
 */
function createDeterministicFallback(
  alertContext: AlertContext,
  traceId: string,
  startTime: number
): ZeinaAnalysisResult {
  const zeinaInput = buildZeinaInput(alertContext, traceId);
  const rawResponse = generateDeterministicResponse(zeinaInput, traceId);
  const output = sanitizeToZeinaOutput(rawResponse, alertContext, traceId);
  output.metadata.analysisType = "deterministic";

  const duration = Date.now() - startTime;
  trackZeinaComplete(
    traceId,
    alertContext.alertId,
    duration,
    "deterministic",
    output.riskScore
  );

  return {
    success: true,
    output,
    traceId,
  };
}

/**
 * Execute backend actions from Zeina analysis
 * This should be called by the alert handler after runZeinaAnalysis
 */
export function executeZeinaActions(
  output: ZeinaOutput,
  alertContext: AlertContext,
  traceId: string
): Promise<BackendActions> {
  const actions = mapToBackendActions(output, traceId);

  logger.info("Executing Zeina backend actions", {
    traceId,
    alertId: alertContext.alertId,
    sendAlert: actions.sendAlert,
    recipientCount: actions.alertRecipients.length,
    autoActionCount: actions.autoActions.length,
    fn: "zeina.executeZeinaActions",
  });

  // Return actions for caller to execute
  // (Actual execution happens in alert handler)
  return Promise.resolve(actions);
}

/**
 * Store Zeina analysis result for audit
 * This should be called after analysis completes
 */
export function auditZeinaAnalysis(
  output: ZeinaOutput,
  alertContext: AlertContext,
  traceId: string
): Promise<void> {
  const auditData = formatForAudit(output, traceId, alertContext.alertId);

  logger.info("Zeina analysis audit", {
    ...auditData,
    fn: "zeina.auditZeinaAnalysis",
  });

  // TODO: Implement actual audit log storage
  // Could write to Firestore audit collection, CloudWatch, etc.
  return Promise.resolve();
}

// Re-export vitals summary (for backward compatibility)
export { getRecentVitalsSummary } from "../../modules/vitals/recentSummary";
// Re-export backward compatibility adapter
export { analyze } from "./adapter";

// Re-export monitoring functions
export {
  type AnomalyDetection,
  detectAnomalies,
  generateMonitoringReport,
  getServiceStats,
  type HealthStatus,
  healthCheck,
  logMonitoringSummary,
  type MonitoringReport,
  type ServiceStats,
} from "./monitoring";
// Re-export observability functions
export {
  getMetrics,
  logMetricsSummary,
  resetMetrics,
} from "./observability";
// Re-export types for external use
export type {
  AlertContext,
  BackendActions,
  EscalationLevel,
  RecommendedActionCode,
  ZeinaAnalysisRequest,
  ZeinaAnalysisResult,
  ZeinaInput,
  ZeinaOutput,
} from "./types";

// Re-export utility functions (for development/testing)
export {
  benchmarkAnalysis,
  createTestAlertContext,
  printMetrics,
  resetAllMetrics,
  runTestAnalysis,
  simulateAlerts,
  testPHISanitization,
} from "./utils";
