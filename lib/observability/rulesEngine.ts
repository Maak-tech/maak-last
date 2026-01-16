import { logger } from "@/lib/utils/logger";
import { observabilityEmitter } from "./eventEmitter";
import type { HealthThreshold, EventSeverity } from "./types";

export interface VitalReading {
  type: string;
  value: number;
  unit: string;
  timestamp: Date;
  userId: string;
}

export interface RuleEvaluation {
  triggered: boolean;
  severity: EventSeverity;
  thresholdBreached?: string;
  message?: string;
  recommendedAction?: string;
}

const DEFAULT_THRESHOLDS: HealthThreshold[] = [
  { vitalType: "heart_rate", min: 50, max: 100, unit: "bpm", severity: "warn" },
  { vitalType: "heart_rate", min: 40, max: 120, unit: "bpm", severity: "error" },
  { vitalType: "heart_rate", min: 30, max: 150, unit: "bpm", severity: "critical" },
  { vitalType: "blood_oxygen", min: 95, max: 100, unit: "%", severity: "warn" },
  { vitalType: "blood_oxygen", min: 90, max: 100, unit: "%", severity: "error" },
  { vitalType: "blood_oxygen", min: 85, max: 100, unit: "%", severity: "critical" },
  { vitalType: "systolic_bp", min: 90, max: 140, unit: "mmHg", severity: "warn" },
  { vitalType: "systolic_bp", min: 80, max: 180, unit: "mmHg", severity: "error" },
  { vitalType: "systolic_bp", min: 70, max: 200, unit: "mmHg", severity: "critical" },
  { vitalType: "diastolic_bp", min: 60, max: 90, unit: "mmHg", severity: "warn" },
  { vitalType: "diastolic_bp", min: 50, max: 110, unit: "mmHg", severity: "error" },
  { vitalType: "diastolic_bp", min: 40, max: 130, unit: "mmHg", severity: "critical" },
  { vitalType: "temperature", min: 36.1, max: 37.2, unit: "°C", severity: "warn" },
  { vitalType: "temperature", min: 35.0, max: 38.5, unit: "°C", severity: "error" },
  { vitalType: "temperature", min: 34.0, max: 40.0, unit: "°C", severity: "critical" },
  { vitalType: "blood_glucose", min: 70, max: 140, unit: "mg/dL", severity: "warn" },
  { vitalType: "blood_glucose", min: 55, max: 200, unit: "mg/dL", severity: "error" },
  { vitalType: "blood_glucose", min: 40, max: 300, unit: "mg/dL", severity: "critical" },
  { vitalType: "respiratory_rate", min: 12, max: 20, unit: "breaths/min", severity: "warn" },
  { vitalType: "respiratory_rate", min: 8, max: 30, unit: "breaths/min", severity: "error" },
];

class HealthRulesEngine {
  private thresholds: HealthThreshold[] = DEFAULT_THRESHOLDS;
  private recentReadings: Map<string, VitalReading[]> = new Map();
  private maxReadingsPerUser = 100;

  setThresholds(thresholds: HealthThreshold[]): void {
    this.thresholds = thresholds;
  }

  addThreshold(threshold: HealthThreshold): void {
    this.thresholds.push(threshold);
  }

  evaluateVital(reading: VitalReading): RuleEvaluation {
    const userKey = `${reading.userId}_${reading.type}`;
    
    if (!this.recentReadings.has(userKey)) {
      this.recentReadings.set(userKey, []);
    }
    
    const readings = this.recentReadings.get(userKey)!;
    readings.push(reading);
    
    if (readings.length > this.maxReadingsPerUser) {
      readings.shift();
    }

    const thresholdResult = this.checkThresholds(reading);
    if (thresholdResult.triggered) {
      return thresholdResult;
    }

    const trendResult = this.checkTrends(reading, readings);
    if (trendResult.triggered) {
      return trendResult;
    }

    return {
      triggered: false,
      severity: "info",
    };
  }

  private checkThresholds(reading: VitalReading): RuleEvaluation {
    const applicableThresholds = this.thresholds
      .filter((t) => t.vitalType === reading.type)
      .sort((a, b) => {
        const severityOrder = { debug: 0, info: 1, warn: 2, error: 3, critical: 4 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });

    for (const threshold of applicableThresholds) {
      const belowMin = threshold.min !== undefined && reading.value < threshold.min;
      const aboveMax = threshold.max !== undefined && reading.value > threshold.max;

      if (belowMin || aboveMax) {
        const direction = belowMin ? "below" : "above";
        const limit = belowMin ? threshold.min : threshold.max;
        
        return {
          triggered: true,
          severity: threshold.severity,
          thresholdBreached: `${reading.type}_${direction}_${limit}`,
          message: `${this.formatVitalName(reading.type)} is ${direction} normal range (${reading.value} ${reading.unit})`,
          recommendedAction: this.getRecommendedAction(reading.type, threshold.severity, direction),
        };
      }
    }

    return { triggered: false, severity: "info" };
  }

  private checkTrends(reading: VitalReading, history: VitalReading[]): RuleEvaluation {
    if (history.length < 5) {
      return { triggered: false, severity: "info" };
    }

    const recentReadings = history.slice(-10);
    const values = recentReadings.map((r) => r.value);
    
    const trend = this.calculateTrend(values);
    
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    const changePercent = Math.abs((reading.value - avgValue) / avgValue) * 100;

    if (changePercent > 20 && Math.abs(trend) > 0.5) {
      const direction = trend > 0 ? "increasing" : "decreasing";
      return {
        triggered: true,
        severity: "warn",
        thresholdBreached: `${reading.type}_rapid_${direction}`,
        message: `${this.formatVitalName(reading.type)} is rapidly ${direction} (${changePercent.toFixed(1)}% change)`,
        recommendedAction: `Monitor ${this.formatVitalName(reading.type)} closely. Contact caregiver if trend continues.`,
      };
    }

    return { triggered: false, severity: "info" };
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private formatVitalName(type: string): string {
    const names: Record<string, string> = {
      heart_rate: "Heart Rate",
      blood_oxygen: "Blood Oxygen",
      systolic_bp: "Systolic Blood Pressure",
      diastolic_bp: "Diastolic Blood Pressure",
      temperature: "Body Temperature",
      blood_glucose: "Blood Glucose",
      respiratory_rate: "Respiratory Rate",
    };
    return names[type] || type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private getRecommendedAction(
    vitalType: string,
    severity: EventSeverity,
    direction: string
  ): string {
    if (severity === "critical") {
      return "Seek immediate medical attention. Contact emergency services if symptoms are severe.";
    }
    
    if (severity === "error") {
      return "Contact your healthcare provider soon. Monitor for worsening symptoms.";
    }

    const actions: Record<string, Record<string, string>> = {
      heart_rate: {
        below: "Rest and stay calm. Stay hydrated. If symptoms persist, consult a doctor.",
        above: "Sit down and rest. Practice deep breathing. Avoid caffeine.",
      },
      blood_oxygen: {
        below: "Sit upright or stand. Take deep breaths. If below 90%, seek medical attention.",
        above: "No action needed - high oxygen levels are typically not concerning.",
      },
      blood_glucose: {
        below: "Consume fast-acting sugar (juice, glucose tablets). Recheck in 15 minutes.",
        above: "Drink water. Check for missed medications. Contact healthcare provider if very high.",
      },
      temperature: {
        below: "Warm up gradually. Drink warm fluids. Seek help if severely cold.",
        above: "Rest, stay hydrated. Take fever-reducing medication if appropriate.",
      },
    };

    return actions[vitalType]?.[direction] || 
      `Monitor your ${this.formatVitalName(vitalType)} and consult healthcare provider if abnormal readings persist.`;
  }

  async processVitalAndEmit(reading: VitalReading): Promise<RuleEvaluation> {
    const result = this.evaluateVital(reading);

    if (result.triggered) {
      await observabilityEmitter.emitHealthEvent(
        "vital_threshold_breach",
        result.message || "Vital sign outside normal range",
        {
          userId: reading.userId,
          vitalType: reading.type,
          value: reading.value,
          unit: reading.unit,
          isAbnormal: true,
          thresholdBreached: result.thresholdBreached,
          severity: result.severity,
          status: "pending",
          metadata: {
            recommendedAction: result.recommendedAction,
          },
        }
      );
    } else {
      await observabilityEmitter.emitHealthEvent(
        "vital_recorded",
        `${this.formatVitalName(reading.type)} recorded: ${reading.value} ${reading.unit}`,
        {
          userId: reading.userId,
          vitalType: reading.type,
          value: reading.value,
          unit: reading.unit,
          isAbnormal: false,
          severity: "info",
          status: "success",
        }
      );
    }

    return result;
  }
}

export const healthRulesEngine = new HealthRulesEngine();
