/**
 * Alert Engine - Pure functions for alert generation
 * No Firestore dependencies - fully testable
 */

export type VitalType =
  | "heartRate"
  | "bloodPressure"
  | "respiratoryRate"
  | "oxygenSaturation"
  | "bodyTemperature"
  | "weight"
  | "restingHeartRate"
  | "heartRateVariability";

export type AlertSeverity = "critical" | "warning" | null;
export type AlertDirection = "low" | "high" | null;

export interface VitalBenchmark {
  alertThresholds: {
    low: { critical: number; warning: number };
    high: { critical: number; warning: number };
  };
  normalRange: { min: number; max: number };
}

export interface AlertResult {
  isAlert: boolean;
  severity: AlertSeverity;
  direction: AlertDirection;
}

export interface Alert {
  id: string;
  userId: string;
  vitalType: VitalType;
  timestamp: number;
  severity: AlertSeverity;
}

// ============================================================================
// Vital Benchmarks
// ============================================================================

export const VITAL_BENCHMARKS: Record<VitalType, VitalBenchmark> = {
  heartRate: {
    alertThresholds: {
      low: { critical: 40, warning: 50 },
      high: { critical: 150, warning: 120 },
    },
    normalRange: { min: 60, max: 100 },
  },
  restingHeartRate: {
    alertThresholds: {
      low: { critical: 35, warning: 45 },
      high: { critical: 120, warning: 100 },
    },
    normalRange: { min: 50, max: 90 },
  },
  heartRateVariability: {
    alertThresholds: {
      low: { critical: 10, warning: 15 },
      high: { critical: 100, warning: 80 },
    },
    normalRange: { min: 20, max: 60 },
  },
  bloodPressure: {
    alertThresholds: {
      low: { critical: 80, warning: 85 },
      high: { critical: 180, warning: 140 },
    },
    normalRange: { min: 90, max: 120 },
  },
  respiratoryRate: {
    alertThresholds: {
      low: { critical: 8, warning: 10 },
      high: { critical: 30, warning: 24 },
    },
    normalRange: { min: 12, max: 20 },
  },
  oxygenSaturation: {
    alertThresholds: {
      low: { critical: 88, warning: 92 },
      high: { critical: 100, warning: 100 },
    },
    normalRange: { min: 95, max: 100 },
  },
  bodyTemperature: {
    alertThresholds: {
      low: { critical: 35.0, warning: 35.5 },
      high: { critical: 40.0, warning: 38.0 },
    },
    normalRange: { min: 36.1, max: 37.2 },
  },
  weight: {
    alertThresholds: {
      low: { critical: 40, warning: 45 },
      high: { critical: 200, warning: 150 },
    },
    normalRange: { min: 50, max: 120 },
  },
};

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Check if a vital reading should trigger an alert
 * Pure function - no side effects
 */
export function checkVitalBenchmark(
  vitalType: VitalType,
  value: number
): AlertResult {
  const benchmark = VITAL_BENCHMARKS[vitalType];
  if (!benchmark) {
    return { isAlert: false, severity: null, direction: null };
  }

  // Check critical low
  if (value <= benchmark.alertThresholds.low.critical) {
    return { isAlert: true, severity: "critical", direction: "low" };
  }

  // Check critical high
  if (value >= benchmark.alertThresholds.high.critical) {
    return { isAlert: true, severity: "critical", direction: "high" };
  }

  // Check warning low
  if (value <= benchmark.alertThresholds.low.warning) {
    return { isAlert: true, severity: "warning", direction: "low" };
  }

  // Check warning high
  if (value >= benchmark.alertThresholds.high.warning) {
    return { isAlert: true, severity: "warning", direction: "high" };
  }

  // Check if outside normal range
  if (value < benchmark.normalRange.min) {
    return { isAlert: true, severity: "warning", direction: "low" };
  }

  if (value > benchmark.normalRange.max) {
    return { isAlert: true, severity: "warning", direction: "high" };
  }

  return { isAlert: false, severity: null, direction: null };
}

/**
 * Check if an alert should be suppressed due to duplicate within time window
 * Pure function - no side effects
 *
 * @param newAlert - The new alert to potentially create
 * @param recentAlerts - Recent alerts from the same user
 * @param suppressionWindowMs - Time window in milliseconds (default 1 hour)
 */
export function shouldSuppressAlert(
  newAlert: {
    userId: string;
    vitalType: VitalType;
    severity: AlertSeverity;
    timestamp: number;
  },
  recentAlerts: Alert[],
  suppressionWindowMs: number = 60 * 60 * 1000 // 1 hour default
): boolean {
  if (!newAlert.severity) {
    return true; // Suppress if no severity (shouldn't happen but safe)
  }

  // Filter to relevant recent alerts
  const relevantAlerts = recentAlerts.filter(
    (alert) =>
      alert.userId === newAlert.userId &&
      alert.vitalType === newAlert.vitalType &&
      alert.severity === newAlert.severity &&
      alert.timestamp >= newAlert.timestamp - suppressionWindowMs
  );

  // Suppress if there's a duplicate within the window
  return relevantAlerts.length > 0;
}

/**
 * Calculate alert suppression window based on severity
 * Critical alerts: 30 minutes
 * Warning alerts: 2 hours
 */
export function getSuppressionWindow(severity: AlertSeverity): number {
  if (severity === "critical") {
    return 30 * 60 * 1000; // 30 minutes
  }
  return 2 * 60 * 60 * 1000; // 2 hours
}

/**
 * Create alert message for vital reading
 * Pure function - returns formatted message
 */
export function createAlertMessage(
  vitalType: VitalType,
  value: number,
  unit: string,
  severity: AlertSeverity,
  direction: AlertDirection
): { title: string; message: string } {
  const directionText = direction === "low" ? "below" : "above";
  const severityEmoji = severity === "critical" ? "🚨" : "⚠️";

  const vitalName = vitalType
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase();

  return {
    title: `${severityEmoji} ${severity === "critical" ? "Critical" : "Warning"} Alert`,
    message: `${vitalName} is ${directionText} normal range: ${value} ${unit}`,
  };
}
