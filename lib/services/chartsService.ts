import type { Medication, Symptom, VitalSign } from "@/types";
import { coerceToDate } from "@/utils/dateCoercion";

export type ChartDataPoint = {
  x: string | number; // Date or timestamp
  y: number; // Value
  label?: string; // Optional label
};

export type TimeSeriesData = {
  labels: string[];
  datasets: Array<{
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
  }>;
};

export type CorrelationData = {
  xLabel: string;
  yLabel: string;
  dataPoints: Array<{ x: number; y: number; label?: string }>;
  correlation: number; // -1 to 1
  trend: "positive" | "negative" | "none";
};

export type TrendPrediction = {
  historical: ChartDataPoint[];
  predicted: ChartDataPoint[];
  confidence: number; // 0-1
  trend: "increasing" | "decreasing" | "stable";
};

class ChartsService {
  private isWithinRange(date: Date, startDate: Date, endDate: Date): boolean {
    return date >= startDate && date <= endDate;
  }

  private buildSymptomSeverityByDate(
    symptoms: Symptom[],
    startDate: Date,
    endDate: Date
  ): Map<string, number> {
    const symptomData = new Map<string, number>();

    for (const symptom of symptoms) {
      const symptomDate =
        symptom.timestamp instanceof Date
          ? symptom.timestamp
          : new Date(symptom.timestamp);
      if (!this.isWithinRange(symptomDate, startDate, endDate)) {
        continue;
      }

      const dateKey = this.formatDateKey(symptom.timestamp);
      const current = symptomData.get(dateKey) || 0;
      symptomData.set(dateKey, current + symptom.severity);
    }

    return symptomData;
  }

  private buildMedicationTakenByDate(
    medications: Medication[],
    startDate: Date,
    endDate: Date
  ): Map<string, number> {
    const medicationData = new Map<string, number>();

    for (const med of medications) {
      if (!(med.reminders && Array.isArray(med.reminders))) {
        continue;
      }

      for (const reminder of med.reminders) {
        if (!(reminder.taken && reminder.takenAt)) {
          continue;
        }

        const takenDate = coerceToDate(reminder.takenAt);
        if (!(takenDate && this.isWithinRange(takenDate, startDate, endDate))) {
          continue;
        }

        const dateKey = this.formatDateKey(takenDate);
        const current = medicationData.get(dateKey) || 0;
        medicationData.set(dateKey, current + 1);
      }
    }

    return medicationData;
  }

  private getMedicationDayStats(
    medications: Medication[],
    dateKey: string
  ): { totalReminders: number; takenReminders: number } {
    let totalReminders = 0;
    let takenReminders = 0;

    for (const med of medications) {
      if (!(med.reminders && Array.isArray(med.reminders))) {
        continue;
      }

      for (const reminder of med.reminders) {
        totalReminders += 1;

        if (!(reminder.taken && reminder.takenAt)) {
          continue;
        }

        const takenDate = coerceToDate(reminder.takenAt);
        if (takenDate?.toDateString() === dateKey) {
          takenReminders += 1;
        }
      }
    }

    return { totalReminders, takenReminders };
  }

  /**
   * Prepare time-series data for symptoms
   */
  prepareSymptomTimeSeries(symptoms: Symptom[], days = 30): TimeSeriesData {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Group symptoms by date
    const dailyData = new Map<string, number[]>();

    for (const symptom of symptoms) {
      const symptomDate =
        symptom.timestamp instanceof Date
          ? symptom.timestamp
          : new Date(symptom.timestamp);
      if (symptomDate < startDate || symptomDate > endDate) {
        continue;
      }

      const dateKey = this.formatDateKey(symptom.timestamp);
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, []);
      }
      dailyData.get(dateKey)?.push(symptom.severity);
    }

    // Calculate average severity per day
    const labels: string[] = [];
    const data: number[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = this.formatDateKey(date);
      const severities = dailyData.get(dateKey) || [];
      const avgSeverity =
        severities.length > 0
          ? severities.reduce((a, b) => a + b, 0) / severities.length
          : 0;

      labels.push(this.formatDateLabel(date));
      data.push(avgSeverity);
    }

    return {
      labels,
      datasets: [
        {
          data,
          color: (opacity: number) => `rgba(239, 68, 68, ${opacity})`, // Red
          strokeWidth: 2,
        },
      ],
    };
  }

  /**
   * Prepare time-series data for vital signs
   */
  prepareVitalTimeSeries(
    vitals: VitalSign[],
    type: VitalSign["type"],
    days = 30
  ): TimeSeriesData {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const filteredVitals = vitals.filter((v) => {
      if (v.type !== type) {
        return false;
      }
      const vitalDate =
        v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp);
      return vitalDate >= startDate && vitalDate <= endDate;
    });

    // Group by date
    const dailyData = new Map<string, number[]>();

    for (const vital of filteredVitals) {
      const dateKey = this.formatDateKey(vital.timestamp);
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, []);
      }
      dailyData.get(dateKey)?.push(vital.value);
    }

    // Calculate average per day
    const labels: string[] = [];
    const data: number[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = this.formatDateKey(date);
      const values = dailyData.get(dateKey) || [];
      const avgValue =
        values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;

      labels.push(this.formatDateLabel(date));
      data.push(avgValue);
    }

    const colorMap: Record<VitalSign["type"], (opacity: number) => string> = {
      heartRate: (opacity) => `rgba(239, 68, 68, ${opacity})`, // Red
      bloodPressure: (opacity) => `rgba(59, 130, 246, ${opacity})`, // Blue
      temperature: (opacity) => `rgba(245, 158, 11, ${opacity})`, // Orange
      weight: (opacity) => `rgba(34, 197, 94, ${opacity})`, // Green
      bloodSugar: (opacity) => `rgba(168, 85, 247, ${opacity})`, // Purple
    };

    return {
      labels,
      datasets: [
        {
          data,
          color:
            colorMap[type] || ((opacity) => `rgba(100, 100, 100, ${opacity})`),
          strokeWidth: 2,
        },
      ],
    };
  }

  /**
   * Prepare medication compliance time-series
   */
  prepareMedicationComplianceTimeSeries(
    medications: Medication[],
    days = 30
  ): TimeSeriesData {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const labels: string[] = [];
    const data: number[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toDateString();

      const { totalReminders, takenReminders } = this.getMedicationDayStats(
        medications,
        dateKey
      );

      const compliance =
        totalReminders > 0 ? (takenReminders / totalReminders) * 100 : 100;

      labels.push(this.formatDateLabel(date));
      data.push(Math.round(compliance));
    }

    return {
      labels,
      datasets: [
        {
          data,
          color: (opacity: number) => `rgba(34, 197, 94, ${opacity})`, // Green
          strokeWidth: 2,
        },
      ],
    };
  }

  /**
   * Calculate correlation between symptoms and medications
   */
  calculateCorrelation(
    symptoms: Symptom[],
    medications: Medication[],
    days = 30
  ): CorrelationData {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const symptomData = this.buildSymptomSeverityByDate(
      symptoms,
      startDate,
      endDate
    );
    const medicationData = this.buildMedicationTakenByDate(
      medications,
      startDate,
      endDate
    );

    // Create data points
    const dataPoints: Array<{ x: number; y: number; label?: string }> = [];
    const allDates = new Set([
      ...Array.from(symptomData.keys()),
      ...Array.from(medicationData.keys()),
    ]);

    for (const dateKey of allDates) {
      const symptomValue = symptomData.get(dateKey) || 0;
      const medicationValue = medicationData.get(dateKey) || 0;
      dataPoints.push({
        x: medicationValue,
        y: symptomValue,
        label: dateKey,
      });
    }

    // Calculate correlation coefficient
    const correlation = this.calculateCorrelationCoefficient(
      dataPoints.map((p) => p.x),
      dataPoints.map((p) => p.y)
    );

    let trend: CorrelationData["trend"] = "none";
    if (correlation > 0.3) {
      trend = "negative";
    } else if (correlation < -0.3) {
      trend = "positive";
    }

    return {
      xLabel: "Medication Compliance",
      yLabel: "Symptom Severity",
      dataPoints,
      correlation,
      trend,
    };
  }

  /**
   * Predict trend based on historical data
   */
  predictTrend(dataPoints: ChartDataPoint[], futureDays = 7): TrendPrediction {
    if (dataPoints.length < 7) {
      return {
        historical: dataPoints,
        predicted: [],
        confidence: 0,
        trend: "stable",
      };
    }

    // Simple linear regression for trend prediction
    const n = dataPoints.length;
    const xValues = dataPoints.map((_, i) => i);
    const yValues = dataPoints.map((p) => p.y);

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate predictions
    const predicted: ChartDataPoint[] = [];
    const toValidDate = (value: ChartDataPoint["x"]): Date | null => {
      const d = typeof value === "number" ? new Date(value) : new Date(value);
      return Number.isFinite(d.getTime()) ? d : null;
    };

    let baseDate: Date | null = null;
    for (let i = dataPoints.length - 1; i >= 0; i--) {
      const d = toValidDate(dataPoints[i].x);
      if (d) {
        baseDate = d;
        break;
      }
    }
    const hasDateAxis = baseDate !== null;
    const lastDateObj = baseDate ?? new Date();

    for (let i = 1; i <= futureDays; i++) {
      const futureDate = new Date(lastDateObj);
      futureDate.setDate(futureDate.getDate() + i);
      const futureX = n + i - 1;
      const predictedY = slope * futureX + intercept;

      predicted.push({
        x: hasDateAxis ? futureDate.toISOString() : futureX,
        y: Math.max(0, predictedY), // Ensure non-negative
      });
    }

    // Calculate confidence based on data variance
    const mean = sumY / n;
    const variance = yValues.reduce((sum, y) => sum + (y - mean) ** 2, 0) / n;
    const confidence = Math.max(
      0,
      Math.min(1, 1 - variance / (mean * mean || 1))
    );

    let trend: TrendPrediction["trend"] = "stable";
    if (slope > 0.1) {
      trend = "increasing";
    } else if (slope < -0.1) {
      trend = "decreasing";
    }

    return {
      historical: dataPoints,
      predicted,
      confidence,
      trend,
    };
  }

  /**
   * Format date for use as map key
   */
  private formatDateKey(date: Date | string): string {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split("T")[0];
  }

  /**
   * Format date for chart label
   */
  private formatDateLabel(date: Date): string {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private calculateCorrelationCoefficient(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) {
      return 0;
    }

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY)
    );

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Prepare comparison data for two time periods
   */
  prepareComparisonData(
    currentData: ChartDataPoint[],
    previousData: ChartDataPoint[]
  ): {
    current: TimeSeriesData;
    previous: TimeSeriesData;
    change: number; // Percentage change
  } {
    const currentAvg =
      currentData.reduce((sum, p) => sum + p.y, 0) / currentData.length;
    const previousAvg =
      previousData.reduce((sum, p) => sum + p.y, 0) / previousData.length;
    const change =
      previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;

    return {
      current: {
        labels: currentData.map((p) =>
          typeof p.x === "string"
            ? this.formatDateLabel(new Date(p.x))
            : String(p.x)
        ),
        datasets: [
          {
            data: currentData.map((p) => p.y),
            color: (opacity: number) => `rgba(59, 130, 246, ${opacity})`,
            strokeWidth: 2,
          },
        ],
      },
      previous: {
        labels: previousData.map((p) =>
          typeof p.x === "string"
            ? this.formatDateLabel(new Date(p.x))
            : String(p.x)
        ),
        datasets: [
          {
            data: previousData.map((p) => p.y),
            color: (opacity: number) => `rgba(156, 163, 175, ${opacity})`,
            strokeWidth: 2,
          },
        ],
      },
      change: Math.round(change * 10) / 10,
    };
  }
}

export const chartsService = new ChartsService();
