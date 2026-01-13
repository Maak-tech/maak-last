/**
 * Observability: Traces & Metrics
 * 
 * HIPAA-SAFE LOGGING:
 * - NO PHI in logs (only traceId, alertId, patientId as identifiers)
 * - All metrics aggregatable
 * - Counter-based metrics for monitoring
 * 
 * Key Metrics:
 * - zeina.calls (total analysis calls)
 * - zeina.failures (analysis failures)
 * - zeina.guardrail_blocks (guardrail validation failures)
 * - zeina.llm_calls (LLM API calls)
 * - zeina.llm_timeouts (LLM timeout errors)
 */

import { logger } from '../../observability/logger';
import type { ZeinaMetrics } from './types';

/**
 * Metric counters (in-memory, can be exported to monitoring service)
 */
class MetricCounters {
  private counters: Map<string, number> = new Map();

  increment(metric: string, value: number = 1): void {
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
 * Track Zeina analysis call
 */
export function trackZeinaCall(traceId: string, alertId: string): void {
  metrics.increment('zeina.calls');
  
  logger.info('Zeina analysis call started', {
    traceId,
    alertId,
    fn: 'zeina.observability.trackZeinaCall',
  });
}

/**
 * Track Zeina analysis completion
 */
export function trackZeinaComplete(
  traceId: string,
  alertId: string,
  durationMs: number,
  analysisType: 'ai' | 'deterministic',
  riskScore: number
): void {
  logger.info('Zeina analysis completed', {
    traceId,
    alertId,
    durationMs,
    analysisType,
    riskScore,
    fn: 'zeina.observability.trackZeinaComplete',
  });

  // Track duration buckets
  if (durationMs < 1000) {
    metrics.increment('zeina.duration.under_1s');
  } else if (durationMs < 3000) {
    metrics.increment('zeina.duration.1s_to_3s');
  } else if (durationMs < 5000) {
    metrics.increment('zeina.duration.3s_to_5s');
  } else {
    metrics.increment('zeina.duration.over_5s');
  }

  // Track analysis type
  metrics.increment(`zeina.analysis_type.${analysisType}`);
}

/**
 * Track Zeina analysis failure
 */
export function trackZeinaFailure(
  traceId: string,
  alertId: string,
  errorType: string,
  error?: Error
): void {
  metrics.increment('zeina.failures');
  metrics.increment(`zeina.failures.${errorType}`);

  logger.error('Zeina analysis failed', error || new Error(errorType), {
    traceId,
    alertId,
    errorType,
    fn: 'zeina.observability.trackZeinaFailure',
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
  metrics.increment('zeina.guardrail_blocks');
  metrics.increment(`zeina.guardrail_blocks.${reason}`);

  logger.warn('Zeina guardrail block', {
    traceId,
    alertId,
    reason,
    errorCount: errors.length,
    fn: 'zeina.observability.trackGuardrailBlock',
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
  metrics.increment('zeina.llm_calls');
  metrics.increment(`zeina.llm_calls.${provider}`);

  if (success) {
    metrics.increment('zeina.llm_calls.success');
    logger.debug('LLM call succeeded', {
      traceId,
      provider,
      durationMs,
      fn: 'zeina.observability.trackLLMCall',
    });
  } else {
    metrics.increment('zeina.llm_calls.failure');
    logger.warn('LLM call failed', {
      traceId,
      provider,
      durationMs,
      fn: 'zeina.observability.trackLLMCall',
    });
  }
}

/**
 * Track LLM timeout
 */
export function trackLLMTimeout(traceId: string, provider: string): void {
  metrics.increment('zeina.llm_timeouts');
  metrics.increment(`zeina.llm_timeouts.${provider}`);

  logger.warn('LLM call timeout', {
    traceId,
    provider,
    fn: 'zeina.observability.trackLLMTimeout',
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
export function createMetricsObject(
  traceId: string,
  durationMs: number,
  success: boolean,
  analysisType: 'ai' | 'deterministic',
  guardrailBlocked: boolean,
  errorType?: string
): ZeinaMetrics {
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
  
  logger.info('Zeina metrics summary', {
    metrics: allMetrics,
    fn: 'zeina.observability.logMetricsSummary',
  });
}
