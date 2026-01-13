/**
 * Zeina Monitoring & Health Checks
 * 
 * Provides health check endpoints and monitoring utilities
 * for production deployment
 */

import { logger } from '../../observability/logger';
import { getMetrics } from './observability';
// Metrics type imported locally to avoid unused import warning

/**
 * Health status
 */
export interface HealthStatus {
  healthy: boolean;
  version: string;
  timestamp: Date;
  checks: {
    api: boolean;
    metrics: boolean;
    configuration: boolean;
  };
  metrics?: Record<string, number>;
  warnings?: string[];
  errors?: string[];
}

/**
 * Perform health check
 * Tests basic functionality without making actual LLM calls
 */
export async function healthCheck(): Promise<HealthStatus> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const checks = {
    api: true,
    metrics: true,
    configuration: true,
  };

  // Check API configuration
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      warnings.push('OpenAI API key not configured - running in deterministic mode');
      checks.configuration = false;
    } else if (apiKey.length < 10) {
      errors.push('OpenAI API key appears invalid');
      checks.configuration = false;
    }
  } catch (error) {
    errors.push('Failed to check API configuration');
    checks.configuration = false;
  }

  // Check metrics system
  try {
    const metrics = getMetrics();
    if (typeof metrics !== 'object') {
      errors.push('Metrics system not responding correctly');
      checks.metrics = false;
    }
  } catch (error) {
    errors.push('Failed to retrieve metrics');
    checks.metrics = false;
  }

  // Overall health
  const healthy = errors.length === 0 && checks.api && checks.metrics;

  const status: HealthStatus = {
    healthy,
    version: '1.0.0',
    timestamp: new Date(),
    checks,
  };

  if (warnings.length > 0) {
    status.warnings = warnings;
  }

  if (errors.length > 0) {
    status.errors = errors;
  }

  // Include metrics in health check
  try {
    status.metrics = getMetrics();
  } catch (error) {
    // Metrics not critical for health check
  }

  logger.info('Health check completed', {
    healthy,
    warningCount: warnings.length,
    errorCount: errors.length,
    fn: 'zeina.monitoring.healthCheck',
  });

  return status;
}

/**
 * Get service statistics
 */
export interface ServiceStats {
  totalCalls: number;
  successRate: number;
  failureRate: number;
  guardrailBlockRate: number;
  aiRate: number;
  deterministicRate: number;
  averageDuration?: number;
}

/**
 * Calculate service statistics from metrics
 */
export function getServiceStats(): ServiceStats {
  const metrics = getMetrics();

  const totalCalls = metrics['zeina.calls'] || 0;
  const failures = metrics['zeina.failures'] || 0;
  const guardrailBlocks = metrics['zeina.guardrail_blocks'] || 0;
  const aiCalls = metrics['zeina.analysis_type.ai'] || 0;
  const deterministicCalls = metrics['zeina.analysis_type.deterministic'] || 0;

  const successRate = totalCalls > 0 ? ((totalCalls - failures) / totalCalls) * 100 : 100;
  const failureRate = totalCalls > 0 ? (failures / totalCalls) * 100 : 0;
  const guardrailBlockRate = totalCalls > 0 ? (guardrailBlocks / totalCalls) * 100 : 0;
  const aiRate = totalCalls > 0 ? (aiCalls / totalCalls) * 100 : 0;
  const deterministicRate = totalCalls > 0 ? (deterministicCalls / totalCalls) * 100 : 0;

  return {
    totalCalls,
    successRate,
    failureRate,
    guardrailBlockRate,
    aiRate,
    deterministicRate,
  };
}

/**
 * Detect anomalies in service metrics
 */
export interface AnomalyDetection {
  hasAnomalies: boolean;
  anomalies: Array<{
    type: 'high_failure_rate' | 'high_guardrail_blocks' | 'no_ai_calls' | 'high_latency';
    severity: 'warning' | 'error' | 'critical';
    message: string;
    value: number;
    threshold: number;
  }>;
}

/**
 * Detect anomalies in service behavior
 */
export function detectAnomalies(): AnomalyDetection {
  const stats = getServiceStats();
  const anomalies: AnomalyDetection['anomalies'] = [];

  // High failure rate
  if (stats.failureRate > 10) {
    anomalies.push({
      type: 'high_failure_rate',
      severity: 'critical',
      message: 'Failure rate exceeds 10%',
      value: stats.failureRate,
      threshold: 10,
    });
  } else if (stats.failureRate > 5) {
    anomalies.push({
      type: 'high_failure_rate',
      severity: 'warning',
      message: 'Failure rate exceeds 5%',
      value: stats.failureRate,
      threshold: 5,
    });
  }

  // High guardrail block rate
  if (stats.guardrailBlockRate > 10) {
    anomalies.push({
      type: 'high_guardrail_blocks',
      severity: 'error',
      message: 'Guardrail block rate exceeds 10%',
      value: stats.guardrailBlockRate,
      threshold: 10,
    });
  } else if (stats.guardrailBlockRate > 5) {
    anomalies.push({
      type: 'high_guardrail_blocks',
      severity: 'warning',
      message: 'Guardrail block rate exceeds 5%',
      value: stats.guardrailBlockRate,
      threshold: 5,
    });
  }

  // No AI calls (all deterministic)
  if (stats.totalCalls > 10 && stats.aiRate === 0) {
    anomalies.push({
      type: 'no_ai_calls',
      severity: 'warning',
      message: 'No AI calls detected - running in deterministic mode',
      value: stats.aiRate,
      threshold: 0,
    });
  }

  return {
    hasAnomalies: anomalies.length > 0,
    anomalies,
  };
}

/**
 * Generate monitoring report
 */
export interface MonitoringReport {
  timestamp: Date;
  health: HealthStatus;
  stats: ServiceStats;
  anomalies: AnomalyDetection;
  recommendations: string[];
}

/**
 * Generate comprehensive monitoring report
 */
export async function generateMonitoringReport(): Promise<MonitoringReport> {
  const health = await healthCheck();
  const stats = getServiceStats();
  const anomalies = detectAnomalies();
  const recommendations: string[] = [];

  // Generate recommendations based on stats and anomalies
  if (stats.failureRate > 5) {
    recommendations.push('Investigate recent failures and consider adjusting timeout settings');
  }

  if (stats.guardrailBlockRate > 5) {
    recommendations.push('Review AI responses and consider adjusting prompt or validation rules');
  }

  if (stats.aiRate === 0 && stats.totalCalls > 10) {
    recommendations.push('AI is not being used - verify OpenAI API key configuration');
  }

  if (stats.deterministicRate > 50) {
    recommendations.push('High deterministic fallback rate - check LLM availability and performance');
  }

  if (!health.healthy) {
    recommendations.push('Service health check failed - review errors and warnings');
  }

  logger.info('Monitoring report generated', {
    healthy: health.healthy,
    totalCalls: stats.totalCalls,
    successRate: stats.successRate,
    hasAnomalies: anomalies.hasAnomalies,
    fn: 'zeina.monitoring.generateMonitoringReport',
  });

  return {
    timestamp: new Date(),
    health,
    stats,
    anomalies,
    recommendations,
  };
}

/**
 * Log monitoring summary (for scheduled jobs)
 */
export async function logMonitoringSummary(): Promise<void> {
  const report = await generateMonitoringReport();

  logger.info('Zeina monitoring summary', {
    healthy: report.health.healthy,
    totalCalls: report.stats.totalCalls,
    successRate: report.stats.successRate.toFixed(2),
    failureRate: report.stats.failureRate.toFixed(2),
    guardrailBlockRate: report.stats.guardrailBlockRate.toFixed(2),
    aiRate: report.stats.aiRate.toFixed(2),
    hasAnomalies: report.anomalies.hasAnomalies,
    anomalyCount: report.anomalies.anomalies.length,
    recommendations: report.recommendations,
    fn: 'zeina.monitoring.logMonitoringSummary',
  });
}
