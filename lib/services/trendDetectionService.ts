/**
 * Trend Detection Service
 * Analyzes health data over time to detect concerning trends
 */

export interface TrendAnalysis {
  vitalType: string;
  trend: "increasing" | "decreasing" | "stable" | "fluctuating";
  severity: "critical" | "warning" | "normal";
  changePercent: number;
  timePeriod: string; // e.g., "7 days", "30 days"
  currentValue: number;
  averageValue: number;
  unit: string;
  message: string;
}

export interface SymptomTrendAnalysis {
  symptomType: string;
  frequency: number; // occurrences per week
  trend: "increasing" | "decreasing" | "stable";
  severity: "critical" | "warning" | "normal";
  averageSeverity: number;
  timePeriod: string;
  message: string;
}

/**
 * Analyze vital sign trends over a time period
 */
export function analyzeVitalTrend(
  values: Array<{ value: number; timestamp: Date }>,
  vitalType: string,
  unit: string,
  timePeriodDays = 7
): TrendAnalysis | null {
  if (values.length < 3) {
    return null; // Need at least 3 data points for trend analysis
  }

  // Sort by timestamp
  const sortedValues = [...values].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const currentValue = sortedValues[sortedValues.length - 1].value;
  const averageValue =
    sortedValues.reduce((sum, v) => sum + v.value, 0) / sortedValues.length;

  // Calculate linear regression to determine trend
  const n = sortedValues.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  sortedValues.forEach((point, index) => {
    const x = index;
    const y = point.value;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const changePercent = ((slope * (n - 1)) / averageValue) * 100;

  // Determine trend direction
  let trend: "increasing" | "decreasing" | "stable" | "fluctuating";
  if (Math.abs(changePercent) < 2) {
    trend = "stable";
  } else if (changePercent > 0) {
    trend = "increasing";
  } else {
    trend = "decreasing";
  }

  // Check for high variance (fluctuating)
  const variance =
    sortedValues.reduce((sum, v) => sum + (v.value - averageValue) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = (stdDev / averageValue) * 100;

  if (coefficientOfVariation > 15 && Math.abs(changePercent) < 5) {
    trend = "fluctuating";
  }

  // Determine severity based on vital type and trend
  let severity: "critical" | "warning" | "normal" = "normal";
  let message = "";

  // Define concerning thresholds for each vital type
  const thresholds: Record<
    string,
    {
      increasing: { critical: number; warning: number };
      decreasing: { critical: number; warning: number };
    }
  > = {
    heartRate: {
      increasing: { critical: 15, warning: 10 }, // % increase
      decreasing: { critical: -20, warning: -10 },
    },
    restingHeartRate: {
      increasing: { critical: 20, warning: 12 },
      decreasing: { critical: -25, warning: -15 },
    },
    bloodPressure: {
      increasing: { critical: 15, warning: 10 },
      decreasing: { critical: -20, warning: -10 },
    },
    respiratoryRate: {
      increasing: { critical: 25, warning: 15 },
      decreasing: { critical: -30, warning: -20 },
    },
    oxygenSaturation: {
      increasing: { critical: 5, warning: 3 },
      decreasing: { critical: -5, warning: -3 },
    },
    bodyTemperature: {
      increasing: { critical: 10, warning: 5 },
      decreasing: { critical: -10, warning: -5 },
    },
    weight: {
      increasing: { critical: 5, warning: 3 },
      decreasing: { critical: -5, warning: -3 },
    },
  };

  const vitalThresholds = thresholds[vitalType.toLowerCase()] || {
    increasing: { critical: 20, warning: 10 },
    decreasing: { critical: -20, warning: -10 },
  };

  if (trend === "increasing") {
    if (changePercent >= vitalThresholds.increasing.critical) {
      severity = "critical";
      message = `${vitalType} has increased significantly (${changePercent.toFixed(1)}%) over the past ${timePeriodDays} days`;
    } else if (changePercent >= vitalThresholds.increasing.warning) {
      severity = "warning";
      message = `${vitalType} is trending upward (${changePercent.toFixed(1)}%) over the past ${timePeriodDays} days`;
    }
  } else if (trend === "decreasing") {
    if (changePercent <= vitalThresholds.decreasing.critical) {
      severity = "critical";
      message = `${vitalType} has decreased significantly (${changePercent.toFixed(1)}%) over the past ${timePeriodDays} days`;
    } else if (changePercent <= vitalThresholds.decreasing.warning) {
      severity = "warning";
      message = `${vitalType} is trending downward (${changePercent.toFixed(1)}%) over the past ${timePeriodDays} days`;
    }
  } else if (trend === "fluctuating") {
    severity = "warning";
    message = `${vitalType} is showing high variability, which may indicate instability`;
  }

  return {
    vitalType,
    trend,
    severity,
    changePercent,
    timePeriod: `${timePeriodDays} days`,
    currentValue,
    averageValue,
    unit,
    message,
  };
}

/**
 * Analyze symptom frequency and severity trends
 */
export function analyzeSymptomTrend(
  symptoms: Array<{ type: string; severity: number; timestamp: Date }>,
  symptomType: string,
  timePeriodDays = 7
): SymptomTrendAnalysis | null {
  const filteredSymptoms = symptoms.filter(
    (s) => s.type.toLowerCase() === symptomType.toLowerCase()
  );

  if (filteredSymptoms.length === 0) {
    return null;
  }

  // Calculate frequency (occurrences per week)
  const daysSinceFirst =
    (Date.now() - filteredSymptoms[0].timestamp.getTime()) /
    (1000 * 60 * 60 * 24);
  const frequency = (filteredSymptoms.length / daysSinceFirst) * 7;

  // Calculate average severity
  const averageSeverity =
    filteredSymptoms.reduce((sum, s) => sum + s.severity, 0) /
    filteredSymptoms.length;

  // Determine trend by comparing recent vs older symptoms
  const midpoint = Math.floor(filteredSymptoms.length / 2);
  const recentSymptoms = filteredSymptoms.slice(midpoint);
  const olderSymptoms = filteredSymptoms.slice(0, midpoint);

  const recentFrequency =
    olderSymptoms.length > 0
      ? (recentSymptoms.length / olderSymptoms.length) * frequency
      : frequency;

  let trend: "increasing" | "decreasing" | "stable";
  if (recentFrequency > frequency * 1.3) {
    trend = "increasing";
  } else if (recentFrequency < frequency * 0.7) {
    trend = "decreasing";
  } else {
    trend = "stable";
  }

  // Determine severity
  let severity: "critical" | "warning" | "normal" = "normal";
  let message = "";

  if (trend === "increasing") {
    if (frequency >= 5 || averageSeverity >= 4) {
      severity = "critical";
      message = `${symptomType} is becoming more frequent (${frequency.toFixed(1)}x per week) with average severity ${averageSeverity.toFixed(1)}/5`;
    } else if (frequency >= 3 || averageSeverity >= 3) {
      severity = "warning";
      message = `${symptomType} frequency is increasing (${frequency.toFixed(1)}x per week)`;
    }
  } else if (averageSeverity >= 4 && frequency >= 2) {
    severity = "warning";
    message = `${symptomType} is occurring regularly with high severity (${averageSeverity.toFixed(1)}/5)`;
  }

  return {
    symptomType,
    frequency,
    trend,
    severity,
    averageSeverity,
    timePeriod: `${timePeriodDays} days`,
    message,
  };
}

/**
 * Check if a trend is concerning enough to alert
 */
export function isTrendConcerning(
  analysis: TrendAnalysis | SymptomTrendAnalysis
): boolean {
  return analysis.severity === "critical" || analysis.severity === "warning";
}

/**
 * Create an alert for a concerning trend
 * This will be picked up by the real-time WebSocket service
 */
export async function createTrendAlert(
  userId: string,
  trendAnalysis: TrendAnalysis | SymptomTrendAnalysis,
  type: "vital_trend" | "symptom_trend"
): Promise<string | null> {
  if (!isTrendConcerning(trendAnalysis)) {
    return null;
  }

  try {
    const { alertService } = await import("./alertService");

    const alertType: "vital_trend" | "symptom_trend" =
      type === "vital_trend" ? "vital_trend" : "symptom_trend";
    const severity =
      trendAnalysis.severity === "critical" ? "critical" : "high";

    const alertId = await alertService.createAlert({
      userId,
      type: alertType,
      severity,
      message: trendAnalysis.message,
      timestamp: new Date(),
      resolved: false,
      responders: [],
      metadata: {
        trendAnalysis,
        trendType: type,
      },
    });

    return alertId;
  } catch (_error) {
    return null;
  }
}
