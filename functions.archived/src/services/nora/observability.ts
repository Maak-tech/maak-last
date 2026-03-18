/**
 * Observability: Traces & Metrics
 *
 * HIPAA-SAFE LOGGING:
 * - NO PHI in logs (only traceId, alertId, patientId as identifiers)
 * - All metrics aggregatable
 * - Counter-based metrics for monitoring
 *
 * Key Metrics:
 * - nora.calls (total analysis calls)
 * - nora.failures (analysis failures)
 * - nora.guardrail_blocks (guardrail validation failures)
 * - nora.llm_calls (LLM API calls)
 * - nora.llm_timeouts (LLM timeout errors)
 */

import { logger } from "../../observability/logger";
import type { NoraMetrics } from "./types";

/**
 * Metric counters (in-memory, can be exported to monitoring service)
 */
class MetricCounters {
  private readonly counters: Map<string, number> = new Map();

  increment(metric: string, value = 1): void {
    const current = this.counters.get(metric) || 0;
    this.counters.set(metric, current + value);
  }

  get(metric: string): number {
    return this.counters.get(metric) || 0;
  }

  getAll(): Record<string, number> {
    return Object.fromEntries(this.counters.entries());
  }

  reset(): void {
    this.counters.clear();
  }
}

// Global metric counters
const metrics = new MetricCounters();

/**
 * Track Nora analysis call
 */
export function trackNoraCall(traceId: string, alertId: string): void {
  metrics.increment("nora.calls");

  logger.info("Nora analysis call started", {
    traceId,
    alertId,
    fn: "nora.observability.trackNoraCall",
  });
}

/**
 * Track Nora analysis completion
 */
// biome-ignore lint/nursery/useMaxParams: Legacy call shape used across service modules.
export function trackNoraComplete(
  traceId: string,
  alertId: string,
  durationMs: number,
  analysisType: "ai" | "deterministic",
  riskScore: number
): void {
  logger.info("Nora analysis completed", {
    traceId,
    alertId,
    durationMs,
    analysisType,
    riskScore,
    fn: "nora.observability.trackNoraComplete",
  });

  // Track duration buckets
  if (durationMs < 1000) {
    metrics.increment("nora.duration.under_1s");
  } else if (durationMs < 3000) {
    metrics.increment("nora.duration.1s_to_3s");
  } else if (durationMs < 5000) {
    metrics.increment("nora.duration.3s_to_5s");
  } else {
    metrics.increment("nora.duration.over_5s");
  }

  // Track analysis type
  metrics.increment(`nora.analysis_type.${analysisType}`);
}

/**
 * Track Nora analysis failure
 */
export function trackNoraFailure(
  traceId: string,
  alertId: string,
  errorType: string,
  error?: Error
): void {
  metrics.increment("nora.failures");
  metrics.increment(`nora.failures.${errorType}`);

  logger.error("Nora analysis failed", error || new Error(errorType), {
    traceId,
    alertId,
    errorType,
    fn: "nora.observability.trackNoraFailure",
  });
}

/**
 * Track guardrail block
 */
export function trackGuardrailBlock(
  traceId: string,
  alertId: string,
  reason: string,
  errors: string[]
): void {
  metrics.increment("nora.guardrail_blocks");
  metrics.increment(`nora.guardrail_blocks.${reason}`);

  logger.warn("Nora guardrail block", {
    traceId,
    alertId,
    reason,
    errorCount: errors.length,
    fn: "nora.observability.trackGuardrailBlock",
  });
}

/**
 * Track LLM API call
 */
export function trackLLMCall(
  traceId: string,
  provider: string,
  success: boolean,
  durationMs?: number
): void {
  metrics.increment("nora.llm_calls");
  metrics.increment(`nora.llm_calls.${provider}`);

  if (success) {
    metrics.increment("nora.llm_calls.success");
    logger.debug("LLM call succeeded", {
      traceId,
      provider,
      durationMs,
      fn: "nora.observability.trackLLMCall",
    });
  } else {
    metrics.increment("nora.llm_calls.failure");
    logger.warn("LLM call failed", {
      traceId,
      provider,
      durationMs,
      fn: "nora.observability.trackLLMCall",
    });
  }
}

/**
 * Track LLM timeout
 */
export function trackLLMTimeout(traceId: string, provider: string): void {
  metrics.increment("nora.llm_timeouts");
  metrics.increment(`nora.llm_timeouts.${provider}`);

  logger.warn("LLM call timeout", {
    traceId,
    provider,
    fn: "nora.observability.trackLLMTimeout",
  });
}

/**
 * Get current metrics snapshot
 */
export function getMetrics(): Record<string, number> {
  return metrics.getAll();
}

/**
 * Reset metrics (useful for testing)
 */
export function resetMetrics(): void {
  metrics.reset();
}

/**
 * Create metrics object for storage
 */
// biome-ignore lint/nursery/useMaxParams: Metrics builder intentionally accepts explicit fields.
export function createMetricsObject(
  traceId: string,
  durationMs: number,
  success: boolean,
  analysisType: "ai" | "deterministic",
  guardrailBlocked: boolean,
  errorType?: string
): NoraMetrics {
  return {
    traceId,
    durationMs,
    success,
    analysisType,
    guardrailBlocked,
    errorType,
  };
}

/**
 * Log metrics summary (called periodically or on deployment)
 */
export function logMetricsSummary(): void {
  const allMetrics = metrics.getAll();

  logger.info("Nora metrics summary", {
    metrics: allMetrics,
    fn: "nora.observability.logMetricsSummary",
  });
}
