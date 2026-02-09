/**
 * Evaluate vital signs against health thresholds
 * Returns severity level and reasons for any abnormalities
 */

import { calculateSeverity } from "./thresholds";

export type VitalsInput = {
  heartRate?: number;
  spo2?: number; // oxygen saturation
  systolic?: number;
  diastolic?: number;
  temp?: number; // temperature
  timestamp: Date;
};

export type VitalsEvaluation = {
  severity: "normal" | "attention" | "urgent";
  reasons: string[];
  timestamp: Date;
};

const severityRank: Record<VitalsEvaluation["severity"], number> = {
  normal: 0,
  attention: 1,
  urgent: 2,
};

const resolveSeverity = (
  current: VitalsEvaluation["severity"],
  candidate: VitalsEvaluation["severity"]
): VitalsEvaluation["severity"] =>
  severityRank[candidate] > severityRank[current] ? candidate : current;

/**
 * Evaluate a set of vital signs against health thresholds
 * Returns severity level and specific reasons for abnormalities
 */
export function evaluateVitals(vitals: VitalsInput): VitalsEvaluation {
  const reasons: string[] = [];
  let highestSeverity: VitalsEvaluation["severity"] = "normal";

  const checks: Array<{
    metric:
      | "heartRate"
      | "oxygenSaturation"
      | "bloodPressureSystolic"
      | "bloodPressureDiastolic"
      | "bodyTemperature";
    value: number | undefined;
    toReason: (severity: VitalsEvaluation["severity"]) => string;
  }> = [
    {
      metric: "heartRate",
      value: vitals.heartRate,
      toReason: (severity) =>
        `Heart rate: ${vitals.heartRate} bpm (${severity})`,
    },
    {
      metric: "oxygenSaturation",
      value: vitals.spo2,
      toReason: (severity) =>
        `Oxygen saturation: ${vitals.spo2}% (${severity})`,
    },
    {
      metric: "bloodPressureSystolic",
      value: vitals.systolic,
      toReason: (severity) =>
        `Systolic BP: ${vitals.systolic} mmHg (${severity})`,
    },
    {
      metric: "bloodPressureDiastolic",
      value: vitals.diastolic,
      toReason: (severity) =>
        `Diastolic BP: ${vitals.diastolic} mmHg (${severity})`,
    },
    {
      metric: "bodyTemperature",
      value: vitals.temp,
      toReason: (severity) => `Temperature: ${vitals.temp} deg C (${severity})`,
    },
  ];

  for (const check of checks) {
    if (check.value === undefined) {
      continue;
    }

    const result = calculateSeverity(check.metric, check.value);
    if (result.severity === "normal") {
      continue;
    }

    reasons.push(check.toReason(result.severity));
    highestSeverity = resolveSeverity(highestSeverity, result.severity);
  }

  return {
    severity: highestSeverity,
    reasons,
    timestamp: vitals.timestamp,
  };
}

/**
 * Check if evaluation requires creating a health event
 */
export function requiresHealthEvent(evaluation: VitalsEvaluation): boolean {
  return evaluation.severity !== "normal" && evaluation.reasons.length > 0;
}

/**
 * Get a human-readable summary of the evaluation
 */
export function getEvaluationSummary(evaluation: VitalsEvaluation): string {
  if (evaluation.severity === "normal") {
    return "All vitals within normal ranges";
  }

  const severityText =
    evaluation.severity === "urgent" ? "URGENT" : "ATTENTION";
  return `${severityText}: ${evaluation.reasons.join(", ")}`;
}
