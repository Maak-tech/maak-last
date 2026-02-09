/**
 * Zeina Utility Functions
 * Helper functions for testing, debugging, and development
 */

import { logger } from "../../observability/logger";
import { runZeinaAnalysis } from "./index";
import { getMetrics, resetMetrics } from "./observability";
import type { AlertContext, ZeinaAnalysisResult } from "./types";

/**
 * Create a test alert context for development/testing
 */
export function createTestAlertContext(
  overrides?: Partial<AlertContext>
): AlertContext {
  return {
    alertId: `test_alert_${Date.now()}`,
    patientId: `test_patient_${Date.now()}`,
    alertType: "vital",
    severity: "warning",
    vitalType: "heartRate",
    vitalValue: 125,
    vitalUnit: "bpm",
    patientAge: 68,
    medicationCount: 3,
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Run a test analysis for development/debugging
 */
export async function runTestAnalysis(
  alertContext?: Partial<AlertContext>
): Promise<ZeinaAnalysisResult> {
  const testContext = createTestAlertContext(alertContext);
  const traceId = `test_trace_${Date.now()}`;

  logger.info("Running test analysis", {
    traceId,
    alertId: testContext.alertId,
    fn: "zeina.utils.runTestAnalysis",
  });

  const result = await runZeinaAnalysis({
    traceId,
    alertContext: testContext,
  });

  if (!(result.success && result.output)) {
    throw new Error("Test analysis failed");
  }

  logger.info("Test analysis complete", {
    traceId,
    alertId: testContext.alertId,
    riskScore: result.output.riskScore,
    escalationLevel: result.output.escalationLevel,
    fn: "zeina.utils.runTestAnalysis",
  });

  return result;
}

/**
 * Benchmark analysis performance
 */
export async function benchmarkAnalysis(iterations = 10): Promise<{
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
}> {
  const durations: number[] = [];
  let successCount = 0;

  logger.info("Starting benchmark", {
    iterations,
    fn: "zeina.utils.benchmarkAnalysis",
  });

  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();

    try {
      await runTestAnalysis();
      successCount += 1;
      const duration = Date.now() - startTime;
      durations.push(duration);
    } catch (_error) {
      logger.warn("Benchmark iteration failed", {
        iteration: i,
        fn: "zeina.utils.benchmarkAnalysis",
      });
    }
  }

  const averageDuration =
    durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const successRate = (successCount / iterations) * 100;

  const results = {
    averageDuration,
    minDuration,
    maxDuration,
    successRate,
  };

  logger.info("Benchmark complete", {
    ...results,
    iterations,
    fn: "zeina.utils.benchmarkAnalysis",
  });

  return results;
}

/**
 * Test PHI sanitization (verify no PHI in output)
 */
export async function testPHISanitization(): Promise<{
  passed: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  logger.info("Testing PHI sanitization", {
    fn: "zeina.utils.testPHISanitization",
  });

  // Test with various PHI data
  const testCases = [
    {
      name: "Exact age",
      context: { patientAge: 68 },
      shouldNotContain: ["68"],
    },
    {
      name: "Exact vital value",
      context: { vitalValue: 127 },
      shouldNotContain: ["127"],
    },
  ];

  for (const testCase of testCases) {
    const result = await runTestAnalysis(testCase.context);

    if (!result.output) {
      issues.push(`${testCase.name}: No output generated`);
      continue;
    }

    const summaryLower = result.output.summary.toLowerCase();

    for (const term of testCase.shouldNotContain) {
      if (summaryLower.includes(term.toLowerCase())) {
        issues.push(`${testCase.name}: Found "${term}" in summary`);
      }
    }
  }

  const passed = issues.length === 0;

  if (passed) {
    logger.info("PHI sanitization test passed", {
      fn: "zeina.utils.testPHISanitization",
    });
  } else {
    logger.warn("PHI sanitization test failed", {
      issues,
      fn: "zeina.utils.testPHISanitization",
    });
  }

  return { passed, issues };
}

/**
 * Print current metrics summary
 */
export function printMetrics(): void {
  // Metrics printing disabled for production
  // Call getMetrics() to ensure metrics are tracked
  getMetrics();
}

/**
 * Simulate a series of alerts for testing
 */
export async function simulateAlerts(count = 5): Promise<void> {
  logger.info("Simulating alerts", {
    count,
    fn: "zeina.utils.simulateAlerts",
  });

  const alertTypes: Array<"vital" | "symptom" | "fall"> = [
    "vital",
    "symptom",
    "fall",
  ];
  const severities: Array<"info" | "warning" | "critical"> = [
    "info",
    "warning",
    "critical",
  ];

  for (let i = 0; i < count; i++) {
    const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];

    try {
      await runTestAnalysis({
        alertType,
        severity,
      });

      logger.info("Simulated alert processed", {
        iteration: i + 1,
        alertType,
        severity,
        fn: "zeina.utils.simulateAlerts",
      });
    } catch (error) {
      logger.warn("Simulated alert failed", {
        iteration: i + 1,
        error: (error as Error).message,
        fn: "zeina.utils.simulateAlerts",
      });
    }

    // Small delay between alerts
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  logger.info("Alert simulation complete", {
    count,
    fn: "zeina.utils.simulateAlerts",
  });

  // Print metrics
  printMetrics();
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetAllMetrics(): void {
  resetMetrics();
  logger.info("All metrics reset", {
    fn: "zeina.utils.resetAllMetrics",
  });
}
