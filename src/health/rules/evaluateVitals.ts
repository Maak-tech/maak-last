/**
 * Evaluate vital signs against health thresholds
 * Returns severity level and reasons for any abnormalities
 */

import { calculateSeverity, getVitalThresholds, isInNormalRange } from "./thresholds";

export interface VitalsInput {
  heartRate?: number;
  spo2?: number; // oxygen saturation
  systolic?: number;
  diastolic?: number;
  temp?: number; // temperature
  timestamp: Date;
}

export interface VitalsEvaluation {
  severity: "normal" | "attention" | "urgent";
  reasons: string[];
  timestamp: Date;
}

/**
 * Evaluate a set of vital signs against health thresholds
 * Returns severity level and specific reasons for abnormalities
 */
export function evaluateVitals(vitals: VitalsInput): VitalsEvaluation {
  const reasons: string[] = [];
  let maxSeverity: "normal" | "attention" | "urgent" = "normal";

  // Evaluate heart rate
  if (vitals.heartRate !== undefined) {
    const hrSeverity = calculateSeverity("heartRate", vitals.heartRate);
    if (hrSeverity.severity !== "normal") {
      reasons.push(`Heart rate: ${vitals.heartRate} bpm (${hrSeverity.severity})`);
      if (hrSeverity.severity === "urgent") maxSeverity = "urgent";
      else if (hrSeverity.severity === "attention" && maxSeverity === "normal") maxSeverity = "attention";
    }
  }

  // Evaluate oxygen saturation (SpO2)
  if (vitals.spo2 !== undefined) {
    const spo2Severity = calculateSeverity("oxygenSaturation", vitals.spo2);
    if (spo2Severity.severity !== "normal") {
      reasons.push(`Oxygen saturation: ${vitals.spo2}% (${spo2Severity.severity})`);
      if (spo2Severity.severity === "urgent") maxSeverity = "urgent";
      else if (spo2Severity.severity === "attention" && maxSeverity === "normal") maxSeverity = "attention";
    }
  }

  // Evaluate blood pressure (systolic)
  if (vitals.systolic !== undefined) {
    const systolicSeverity = calculateSeverity("bloodPressureSystolic", vitals.systolic);
    if (systolicSeverity.severity !== "normal") {
      reasons.push(`Systolic BP: ${vitals.systolic} mmHg (${systolicSeverity.severity})`);
      if (systolicSeverity.severity === "urgent") maxSeverity = "urgent";
      else if (systolicSeverity.severity === "attention" && maxSeverity === "normal") maxSeverity = "attention";
    }
  }

  // Evaluate blood pressure (diastolic)
  if (vitals.diastolic !== undefined) {
    const diastolicSeverity = calculateSeverity("bloodPressureDiastolic", vitals.diastolic);
    if (diastolicSeverity.severity !== "normal") {
      reasons.push(`Diastolic BP: ${vitals.diastolic} mmHg (${diastolicSeverity.severity})`);
      if (diastolicSeverity.severity === "urgent") maxSeverity = "urgent";
      else if (diastolicSeverity.severity === "attention" && maxSeverity === "normal") maxSeverity = "attention";
    }
  }

  // Evaluate temperature
  if (vitals.temp !== undefined) {
    const tempSeverity = calculateSeverity("bodyTemperature", vitals.temp);
    if (tempSeverity.severity !== "normal") {
      reasons.push(`Temperature: ${vitals.temp}°C (${tempSeverity.severity})`);
      if (tempSeverity.severity === "urgent") maxSeverity = "urgent";
      else if (tempSeverity.severity === "attention" && maxSeverity === "normal") maxSeverity = "attention";
    }
  }

  return {
    severity: maxSeverity,
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

  const severityText = evaluation.severity === "urgent" ? "URGENT" : "ATTENTION";
  return `${severityText}: ${evaluation.reasons.join(", ")}`;
}