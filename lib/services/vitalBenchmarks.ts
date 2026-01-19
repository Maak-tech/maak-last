/**
 * Vital Sign Benchmarks and Thresholds
 * Defines normal ranges and alert thresholds for various vital signs
 */

export interface VitalBenchmark {
  type: string;
  unit: string;
  normalRange: {
    min: number;
    max: number;
  };
  alertThresholds: {
    low: {
      critical: number; // Critical low threshold
      warning: number; // Warning low threshold
    };
    high: {
      critical: number; // Critical high threshold
      warning: number; // Warning high threshold
    };
  };
}

export interface SymptomBenchmark {
  severityThreshold: number; // Alert when severity >= this value (1-5 scale)
}

/**
 * Standard vital sign benchmarks based on medical guidelines
 * These are general adult ranges - can be customized per user
 */
export const VITAL_BENCHMARKS: Record<string, VitalBenchmark> = {
  heartRate: {
    type: "heartRate",
    unit: "bpm",
    normalRange: {
      min: 60,
      max: 100,
    },
    alertThresholds: {
      low: {
        critical: 40, // Bradycardia - critical
        warning: 50, // Low heart rate - warning
      },
      high: {
        critical: 150, // Tachycardia - critical
        warning: 120, // Elevated heart rate - warning
      },
    },
  },
  restingHeartRate: {
    type: "restingHeartRate",
    unit: "bpm",
    normalRange: {
      min: 50,
      max: 90,
    },
    alertThresholds: {
      low: {
        critical: 35,
        warning: 45,
      },
      high: {
        critical: 120,
        warning: 100,
      },
    },
  },
  heartRateVariability: {
    type: "heartRateVariability",
    unit: "ms",
    normalRange: {
      min: 20,
      max: 60,
    },
    alertThresholds: {
      low: {
        critical: 10, // Very low HRV - critical
        warning: 15, // Low HRV - warning
      },
      high: {
        critical: 100, // Very high HRV - unusual but not necessarily bad
        warning: 80,
      },
    },
  },
  bloodPressure: {
    type: "bloodPressure",
    unit: "mmHg",
    normalRange: {
      min: 90, // Systolic minimum
      max: 120, // Systolic maximum
    },
    alertThresholds: {
      low: {
        critical: 80, // Hypotension - critical
        warning: 85, // Low BP - warning
      },
      high: {
        critical: 180, // Hypertensive crisis - critical
        warning: 140, // Hypertension - warning
      },
    },
  },
  respiratoryRate: {
    type: "respiratoryRate",
    unit: "bpm",
    normalRange: {
      min: 12,
      max: 20,
    },
    alertThresholds: {
      low: {
        critical: 8, // Very low respiratory rate - critical
        warning: 10, // Low respiratory rate - warning
      },
      high: {
        critical: 30, // Very high respiratory rate - critical
        warning: 24, // Elevated respiratory rate - warning
      },
    },
  },
  oxygenSaturation: {
    type: "oxygenSaturation",
    unit: "%",
    normalRange: {
      min: 95,
      max: 100,
    },
    alertThresholds: {
      low: {
        critical: 88, // Severe hypoxemia - critical
        warning: 92, // Low oxygen - warning
      },
      high: {
        critical: 100, // Not applicable
        warning: 100,
      },
    },
  },
  bodyTemperature: {
    type: "bodyTemperature",
    unit: "°C",
    normalRange: {
      min: 36.1,
      max: 37.2,
    },
    alertThresholds: {
      low: {
        critical: 35.0, // Hypothermia - critical
        warning: 35.5, // Low temperature - warning
      },
      high: {
        critical: 40.0, // Hyperthermia - critical
        warning: 38.0, // Fever - warning
      },
    },
  },
  weight: {
    type: "weight",
    unit: "kg",
    normalRange: {
      min: 0, // Will be user-specific
      max: 0, // Will be user-specific
    },
    alertThresholds: {
      low: {
        critical: 0, // User-specific
        warning: 0,
      },
      high: {
        critical: 0, // User-specific
        warning: 0,
      },
    },
  },
};

/**
 * Symptom severity benchmark
 * Alerts when symptom severity is at or above threshold
 */
export const SYMPTOM_BENCHMARK: SymptomBenchmark = {
  severityThreshold: 4, // Alert for severity 4 (severe) or 5 (very severe)
};

/**
 * Check if a vital sign value is below benchmark
 */
export function isVitalBelowBenchmark(
  vitalType: string,
  value: number,
  benchmark?: VitalBenchmark
): { isBelow: boolean; severity: "critical" | "warning" | null } {
  const vitalBenchmark = benchmark || VITAL_BENCHMARKS[vitalType.toLowerCase()];

  if (!vitalBenchmark) {
    return { isBelow: false, severity: null };
  }

  // Check critical low threshold
  if (value <= vitalBenchmark.alertThresholds.low.critical) {
    return { isBelow: true, severity: "critical" };
  }

  // Check warning low threshold
  if (value <= vitalBenchmark.alertThresholds.low.warning) {
    return { isBelow: true, severity: "warning" };
  }

  // Check if below normal range minimum
  if (value < vitalBenchmark.normalRange.min) {
    return { isBelow: true, severity: "warning" };
  }

  return { isBelow: false, severity: null };
}

/**
 * Check if a vital sign value is above benchmark
 */
export function isVitalAboveBenchmark(
  vitalType: string,
  value: number,
  benchmark?: VitalBenchmark
): { isAbove: boolean; severity: "critical" | "warning" | null } {
  const vitalBenchmark = benchmark || VITAL_BENCHMARKS[vitalType.toLowerCase()];

  if (!vitalBenchmark) {
    return { isAbove: false, severity: null };
  }

  // Check critical high threshold
  if (value >= vitalBenchmark.alertThresholds.high.critical) {
    return { isAbove: true, severity: "critical" };
  }

  // Check warning high threshold
  if (value >= vitalBenchmark.alertThresholds.high.warning) {
    return { isAbove: true, severity: "warning" };
  }

  // Check if above normal range maximum
  if (value > vitalBenchmark.normalRange.max) {
    return { isAbove: true, severity: "warning" };
  }

  return { isAbove: false, severity: null };
}

/**
 * Check if a symptom severity is below benchmark (i.e., severity is high enough to alert)
 */
export function isSymptomBelowBenchmark(severity: number): {
  isBelow: boolean;
  severity: "critical" | "warning" | null;
} {
  if (severity >= 5) {
    return { isBelow: true, severity: "critical" };
  }

  if (severity >= SYMPTOM_BENCHMARK.severityThreshold) {
    return { isBelow: true, severity: "warning" };
  }

  return { isBelow: false, severity: null };
}

/**
 * Get benchmark for a specific vital type
 */
export function getVitalBenchmark(
  vitalType: string
): VitalBenchmark | undefined {
  return VITAL_BENCHMARKS[vitalType.toLowerCase()];
}
