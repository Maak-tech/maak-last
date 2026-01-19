/**
 * Health threshold definitions for vital signs monitoring
 * Simple rule-based system for detecting abnormal vitals
 */

export interface VitalThresholds {
  min?: number;
  max?: number;
  unit: string;
  attentionThreshold?: number; // Deviation that triggers attention
  urgentThreshold?: number; // Deviation that triggers urgent alert
}

export interface VitalThresholdsMap {
  [key: string]: VitalThresholds;
}

/**
 * Threshold definitions for different vital signs
 * These are basic medical guidelines - should be reviewed by healthcare professionals
 */
export const VITAL_THRESHOLDS: VitalThresholdsMap = {
  heartRate: {
    min: 50,
    max: 100,
    unit: "bpm",
    attentionThreshold: 20, // 20% deviation from normal range
    urgentThreshold: 40, // 40% deviation from normal range
  },
  restingHeartRate: {
    min: 50,
    max: 90,
    unit: "bpm",
    attentionThreshold: 25,
    urgentThreshold: 50,
  },
  oxygenSaturation: {
    min: 95,
    max: 100,
    unit: "%",
    attentionThreshold: 3, // 3% below normal
    urgentThreshold: 5, // 5% below normal
  },
  bloodPressureSystolic: {
    min: 90,
    max: 140,
    unit: "mmHg",
    attentionThreshold: 20,
    urgentThreshold: 40,
  },
  bloodPressureDiastolic: {
    min: 60,
    max: 90,
    unit: "mmHg",
    attentionThreshold: 15,
    urgentThreshold: 30,
  },
  bodyTemperature: {
    min: 36.1,
    max: 37.8,
    unit: "°C",
    attentionThreshold: 1.0,
    urgentThreshold: 2.0,
  },
  bloodGlucose: {
    min: 70,
    max: 140,
    unit: "mg/dL",
    attentionThreshold: 30,
    urgentThreshold: 60,
  },
};

/**
 * Get thresholds for a specific vital type
 */
export function getVitalThresholds(
  vitalType: string
): VitalThresholds | undefined {
  return VITAL_THRESHOLDS[vitalType];
}

/**
 * Check if a value is within normal range
 */
export function isInNormalRange(vitalType: string, value: number): boolean {
  const thresholds = getVitalThresholds(vitalType);
  if (!thresholds) return true; // If no thresholds defined, assume normal

  return (
    value >= (thresholds.min || Number.NEGATIVE_INFINITY) &&
    value <= (thresholds.max || Number.POSITIVE_INFINITY)
  );
}

/**
 * Calculate severity level based on deviation from normal range
 */
export function calculateSeverity(
  vitalType: string,
  value: number
): { severity: "normal" | "attention" | "urgent"; deviation: number } {
  const thresholds = getVitalThresholds(vitalType);
  if (!thresholds) return { severity: "normal", deviation: 0 };

  // Check if within normal range
  if (isInNormalRange(vitalType, value)) {
    return { severity: "normal", deviation: 0 };
  }

  // Calculate deviation from normal range
  let deviation = 0;
  if (value < (thresholds.min || 0)) {
    deviation = Math.abs((thresholds.min || 0) - value);
  } else if (value > (thresholds.max || 0)) {
    deviation = Math.abs(value - (thresholds.max || 0));
  }

  // Determine severity based on thresholds
  const urgentThreshold = thresholds.urgentThreshold || thresholds.max || 0;
  const attentionThreshold =
    thresholds.attentionThreshold || urgentThreshold * 0.5;

  if (deviation >= urgentThreshold) {
    return { severity: "urgent", deviation };
  }
  if (deviation >= attentionThreshold) {
    return { severity: "attention", deviation };
  }

  return { severity: "normal", deviation: 0 };
}
