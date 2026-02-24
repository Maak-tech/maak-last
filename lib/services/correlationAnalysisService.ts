import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
// Vitals accessed directly from Firestore
import { db } from "@/lib/firebase";
import type { Medication, Mood, Symptom, VitalSign } from "@/types";
import { medicationService } from "./medicationService";
import { symptomService } from "./symptomService";

export type CorrelationResult = {
  type:
    | "symptom_medication"
    | "symptom_mood"
    | "symptom_vital"
    | "medication_vital"
    | "mood_vital"
    | "temporal_pattern"
    | "sleep_vital"
    | "sleep_symptom"
    | "sleep_mood"
    | "activity_vital"
    | "activity_symptom"
    | "activity_mood"
    | "hrv_symptom"
    | "hrv_mood"
    | "hrv_vital";
  strength: number; // Correlation coefficient (-1 to 1)
  confidence: number; // 0-100
  description: string;
  actionable: boolean;
  recommendation?: string;
  data: {
    factor1: string;
    factor2: string;
    correlationType: string;
    supportingData?: unknown;
  };
};

export type CorrelationInsight = {
  id: string;
  title: string;
  description: string;
  correlationResults: CorrelationResult[];
  timestamp: Date;
  userId: string;
};

export type CrossCorrelationMatrix = {
  symptoms: string[];
  medications: string[];
  moods: string[];
  vitals: string[];
  correlations: Array<{
    factor1: string;
    factor2: string;
    correlation: number;
    pValue: number;
    sampleSize: number;
  }>;
};

class CorrelationAnalysisService {
  /**
   * Calculate Pearson correlation coefficient
   */
  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) {
      return 0;
    }

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate Spearman rank correlation (more robust for ordinal data)
   */
  private calculateSpearmanCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) {
      return 0;
    }

    // Create rank arrays
    const xRanks = this.getRanks(x);
    const yRanks = this.getRanks(y);

    return this.calculatePearsonCorrelation(xRanks, yRanks);
  }

  /**
   * Convert values to ranks for Spearman correlation
   */
  private getRanks(values: number[]): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    return values.map((val) => sorted.indexOf(val) + 1);
  }

  /**
   * Analyze correlations between symptoms and medications
   */
  private analyzeSymptomMedicationCorrelations(
    symptoms: Symptom[],
    medications: Medication[],
    isArabic = false
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];

    if (symptoms.length === 0 || medications.length === 0) {
      return results;
    }

    // Group symptoms by date for time-series analysis
    const _symptomsByDate = this.groupSymptomsByDate(symptoms);

    for (const medication of medications) {
      const medStartDate = medication.startDate;

      // Split symptoms into before and after medication start
      const symptomsBefore = symptoms.filter((s) => s.timestamp < medStartDate);
      const symptomsAfter = symptoms.filter((s) => s.timestamp >= medStartDate);

      if (symptomsBefore.length < 3 || symptomsAfter.length < 3) {
        continue;
      }

      // Calculate average severity before and after
      const avgSeverityBefore =
        symptomsBefore.reduce((sum, s) => sum + s.severity, 0) /
        symptomsBefore.length;
      const avgSeverityAfter =
        symptomsAfter.reduce((sum, s) => sum + s.severity, 0) /
        symptomsAfter.length;

      // Calculate frequency before and after
      const daysBefore = Math.max(
        1,
        (medStartDate.getTime() - symptomsBefore[0]?.timestamp.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const daysAfter = Math.max(
        1,
        (Date.now() - medStartDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const frequencyBefore = symptomsBefore.length / daysBefore;
      const frequencyAfter = symptomsAfter.length / daysAfter;

      // Calculate correlation strength based on improvement
      const severityImprovement =
        (avgSeverityBefore - avgSeverityAfter) / avgSeverityBefore;
      const frequencyImprovement =
        (frequencyBefore - frequencyAfter) / frequencyBefore;

      const overallImprovement =
        (severityImprovement + frequencyImprovement) / 2;

      if (Math.abs(overallImprovement) > 0.1) {
        const strength = Math.max(-1, Math.min(1, overallImprovement));
        const confidence = Math.min(95, Math.abs(overallImprovement) * 100);

        results.push({
          type: "symptom_medication",
          strength,
          confidence,
          description: this.getMedicationCorrelationDescription(
            medication.name,
            strength,
            isArabic
          ),
          actionable: strength > 0,
          recommendation: this.getMedicationCorrelationRecommendation(
            medication.name,
            strength,
            isArabic
          ),
          data: {
            factor1: "Symptoms (severity/frequency)",
            factor2: medication.name,
            correlationType: "temporal",
            supportingData: {
              severityBefore: avgSeverityBefore.toFixed(1),
              severityAfter: avgSeverityAfter.toFixed(1),
              frequencyBefore: frequencyBefore.toFixed(2),
              frequencyAfter: frequencyAfter.toFixed(2),
            },
          },
        });
      }
    }

    return results;
  }

  /**
   * Analyze correlations between symptoms and mood
   */
  private analyzeSymptomMoodCorrelations(
    symptoms: Symptom[],
    moods: Mood[],
    isArabic = false
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];

    if (symptoms.length === 0 || moods.length === 0) {
      return results;
    }

    // Create time-aligned datasets
    const timePoints = this.getCommonTimePoints(symptoms, moods);

    if (timePoints.length < 5) {
      return results;
    }

    const symptomSeverities: number[] = [];
    const moodIntensities: number[] = [];

    for (const point of timePoints) {
      const daySymptoms = symptoms.filter(
        (s) => s.timestamp.toDateString() === point.toDateString()
      );
      const dayMoods = moods.filter(
        (m) => m.timestamp.toDateString() === point.toDateString()
      );

      if (daySymptoms.length > 0 && dayMoods.length > 0) {
        const avgSeverity =
          daySymptoms.reduce((sum, s) => sum + s.severity, 0) /
          daySymptoms.length;
        const avgMood =
          dayMoods.reduce((sum, m) => sum + m.intensity, 0) / dayMoods.length;

        symptomSeverities.push(avgSeverity);
        moodIntensities.push(avgMood);
      }
    }

    if (symptomSeverities.length >= 5) {
      const correlation = this.calculateSpearmanCorrelation(
        symptomSeverities,
        moodIntensities
      );
      const confidence = Math.min(90, Math.abs(correlation) * 100);

      if (Math.abs(correlation) > 0.3) {
        results.push({
          type: "symptom_mood",
          strength: correlation,
          confidence,
          description: this.getMoodCorrelationDescription(
            correlation,
            isArabic
          ),
          actionable: Math.abs(correlation) > 0.6,
          recommendation: this.getMoodCorrelationRecommendation(
            correlation,
            isArabic
          ),
          data: {
            factor1: "Symptom Severity",
            factor2: "Mood Intensity",
            correlationType: "daily correlation",
            supportingData: {
              sampleSize: symptomSeverities.length,
              correlationCoefficient: correlation.toFixed(3),
            },
          },
        });
      }
    }

    return results;
  }

  /**
   * Analyze correlations between symptoms and vital signs
   */
  private analyzeSymptomVitalCorrelations(
    symptoms: Symptom[],
    vitals: VitalSign[],
    isArabic = false
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];

    if (symptoms.length === 0 || vitals.length === 0) {
      return results;
    }

    // Group vitals by type
    const vitalsByType: Record<string, VitalSign[]> = {};
    for (const vital of vitals) {
      if (!vitalsByType[vital.type]) {
        vitalsByType[vital.type] = [];
      }
      vitalsByType[vital.type].push(vital);
    }

    for (const [vitalType, vitalData] of Object.entries(vitalsByType)) {
      const timePoints = this.getCommonTimePoints(symptoms, vitalData);

      if (timePoints.length < 5) {
        continue;
      }

      const { symptomSeverities, vitalValues } =
        this.buildDailySymptomVitalSeries(symptoms, vitalData, timePoints);

      if (symptomSeverities.length >= 5) {
        const correlation = this.calculatePearsonCorrelation(
          symptomSeverities,
          vitalValues
        );
        const confidence = Math.min(85, Math.abs(correlation) * 100);

        if (Math.abs(correlation) > 0.4) {
          results.push({
            type: "symptom_vital",
            strength: correlation,
            confidence,
            description: this.getVitalCorrelationDescription(
              vitalType,
              correlation,
              isArabic
            ),
            actionable: Math.abs(correlation) > 0.6,
            recommendation: this.getVitalCorrelationRecommendation(
              vitalType,
              correlation,
              isArabic
            ),
            data: {
              factor1: "Symptom Severity",
              factor2: `${vitalType} (${this.getVitalUnit(vitalType)})`,
              correlationType: "daily correlation",
              supportingData: {
                sampleSize: symptomSeverities.length,
                correlationCoefficient: correlation.toFixed(3),
              },
            },
          });
        }
      }
    }

    return results;
  }

  /**
   * Analyze temporal patterns across all health data
   */
  private analyzeTemporalPatterns(
    symptoms: Symptom[],
    moods: Mood[]
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];

    // Analyze day-of-week patterns
    const dayPatterns = this.analyzeDayOfWeekPatterns(symptoms, moods);
    results.push(...dayPatterns);

    // Analyze time-of-day patterns
    const timePatterns = this.analyzeTimeOfDayPatterns(symptoms);
    results.push(...timePatterns);

    // Analyze seasonal patterns
    const seasonalPatterns = this.analyzeSeasonalPatterns(symptoms, moods);
    results.push(...seasonalPatterns);

    return results;
  }

  /**
   * Analyze day-of-week patterns
   */
  private analyzeDayOfWeekPatterns(
    symptoms: Symptom[],
    moods: Mood[]
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];

    if (symptoms.length < 14) {
      return results; // Need at least 2 weeks of data
    }

    // Group by day of week
    const symptomSeverityByDay = this.groupNumericByBucket(
      symptoms,
      (symptom) => symptom.timestamp.getDay(),
      (symptom) => symptom.severity
    );
    const _moodIntensityByDay = this.groupNumericByBucket(
      moods,
      (mood) => mood.timestamp.getDay(),
      (mood) => mood.intensity
    );

    // Calculate average severity by day
    const avgSeverityByDay = this.getBucketAverages(symptomSeverityByDay);

    // Find patterns
    const weekdays = [1, 2, 3, 4, 5]; // Mon-Fri
    const weekends = [0, 6]; // Sun, Sat

    const weekdayAvg = weekdays
      .map((d) => avgSeverityByDay[d])
      .filter((v) => !Number.isNaN(v));
    const weekendAvg = weekends
      .map((d) => avgSeverityByDay[d])
      .filter((v) => !Number.isNaN(v));

    if (weekdayAvg.length >= 3 && weekendAvg.length >= 2) {
      const weekdayMean =
        weekdayAvg.reduce((a, b) => a + b, 0) / weekdayAvg.length;
      const weekendMean =
        weekendAvg.reduce((a, b) => a + b, 0) / weekendAvg.length;

      const difference = weekendMean - weekdayMean;
      const strength = Math.max(-1, Math.min(1, difference / 2)); // Normalize to -1 to 1

      if (Math.abs(strength) > 0.2) {
        results.push({
          type: "temporal_pattern",
          strength,
          confidence: 75,
          description:
            strength > 0
              ? "Symptoms tend to be more severe on weekends"
              : "Symptoms tend to be less severe on weekends",
          actionable: true,
          recommendation:
            strength > 0
              ? "Consider maintaining consistent routines on weekends"
              : "Take advantage of lower symptom days for important activities",
          data: {
            factor1: "Day of Week",
            factor2: "Symptom Severity",
            correlationType: "temporal pattern",
            supportingData: {
              weekdayAverage: weekdayMean.toFixed(1),
              weekendAverage: weekendMean.toFixed(1),
            },
          },
        });
      }
    }

    return results;
  }

  /**
   * Analyze time-of-day patterns
   */
  private analyzeTimeOfDayPatterns(symptoms: Symptom[]): CorrelationResult[] {
    const results: CorrelationResult[] = [];

    if (symptoms.length < 20) {
      return results;
    }

    // Group by hour of day
    const severityByHour: Record<number, number[]> = {};

    for (const symptom of symptoms) {
      const hour = symptom.timestamp.getHours();
      if (!severityByHour[hour]) {
        severityByHour[hour] = [];
      }
      severityByHour[hour].push(symptom.severity);
    }

    // Find peak hours
    const avgSeverityByHour: Record<number, number> = {};
    for (const hour of Object.keys(severityByHour)) {
      const hourNum = Number.parseInt(hour, 10);
      avgSeverityByHour[hourNum] =
        severityByHour[hourNum].reduce((a, b) => a + b, 0) /
        severityByHour[hourNum].length;
    }

    const peakHour = Object.entries(avgSeverityByHour).sort(
      ([, a], [, b]) => b - a
    )[0];

    if (peakHour && peakHour[1] > 3.5) {
      const hour = Number.parseInt(peakHour[0], 10);
      let period = "evening";
      if (hour < 12) {
        period = "morning";
      } else if (hour < 17) {
        period = "afternoon";
      }

      results.push({
        type: "temporal_pattern",
        strength: 0.6,
        confidence: 70,
        description: `Symptoms tend to be more severe in the ${period} (${hour}:00)`,
        actionable: true,
        recommendation:
          "Consider timing activities around your symptom patterns",
        data: {
          factor1: "Time of Day",
          factor2: "Symptom Severity",
          correlationType: "temporal pattern",
          supportingData: {
            peakHour: `${hour}:00`,
            averageSeverity: peakHour[1].toFixed(1),
          },
        },
      });
    }

    return results;
  }

  /**
   * Analyze seasonal patterns
   */
  private analyzeSeasonalPatterns(
    symptoms: Symptom[],
    moods: Mood[]
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];

    if (symptoms.length < 30) {
      return results; // Need substantial data
    }

    // Group by month
    const severityByMonth = this.groupNumericByBucket(
      symptoms,
      (symptom) => symptom.timestamp.getMonth(),
      (symptom) => symptom.severity
    );
    const _moodByMonth = this.groupNumericByBucket(
      moods,
      (mood) => mood.timestamp.getMonth(),
      (mood) => mood.intensity
    );

    // Calculate seasonal averages
    const winterMonths = [11, 0, 1]; // Dec, Jan, Feb
    const summerMonths = [5, 6, 7]; // Jun, Jul, Aug

    const winterSeverity = winterMonths.flatMap(
      (m) => severityByMonth[m] || []
    );
    const summerSeverity = summerMonths.flatMap(
      (m) => severityByMonth[m] || []
    );

    if (winterSeverity.length >= 5 && summerSeverity.length >= 5) {
      const winterAvg =
        winterSeverity.reduce((a, b) => a + b, 0) / winterSeverity.length;
      const summerAvg =
        summerSeverity.reduce((a, b) => a + b, 0) / summerSeverity.length;

      const difference = winterAvg - summerAvg;

      if (Math.abs(difference) > 0.5) {
        results.push({
          type: "temporal_pattern",
          strength: Math.max(-1, Math.min(1, difference / 2)),
          confidence: 65,
          description:
            difference > 0
              ? "Symptoms tend to be more severe in winter months"
              : "Symptoms tend to be more severe in summer months",
          actionable: true,
          recommendation:
            difference > 0
              ? "Consider seasonal health management strategies for winter"
              : "Monitor symptoms during summer months",
          data: {
            factor1: "Season",
            factor2: "Symptom Severity",
            correlationType: "seasonal pattern",
            supportingData: {
              winterAverage: winterAvg.toFixed(1),
              summerAverage: summerAvg.toFixed(1),
            },
          },
        });
      }
    }

    return results;
  }

  /**
   * Generate comprehensive correlation analysis
   */
  async generateCorrelationAnalysis(
    userId: string,
    daysBack = 90,
    isArabic = false
  ): Promise<CorrelationInsight> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch all relevant data
    const [symptoms, medications, moods, vitals] = await Promise.all([
      symptomService.getUserSymptoms(userId, 500),
      medicationService.getUserMedications(userId),
      this.getUserMoods(userId, startDate, endDate),
      this.getUserVitals(userId, startDate, endDate),
    ]);

    // Filter data to the specified time range
    const filteredSymptoms = symptoms.filter(
      (s) => s.timestamp >= startDate && s.timestamp <= endDate
    );

    // Analyze all correlation types
    const correlationResults = [
      ...(await this.analyzeSymptomMedicationCorrelations(
        filteredSymptoms,
        medications,
        isArabic
      )),
      ...(await this.analyzeSymptomMoodCorrelations(
        filteredSymptoms,
        moods,
        isArabic
      )),
      ...(await this.analyzeSymptomVitalCorrelations(
        filteredSymptoms,
        vitals,
        isArabic
      )),
      ...this.analyzeTemporalPatterns(filteredSymptoms, moods),
      // Sleep cross-correlations
      ...this.analyzeSleepVitalCorrelations(vitals, isArabic),
      ...this.analyzeSleepSymptomCorrelations(filteredSymptoms, vitals, isArabic),
      ...this.analyzeSleepMoodCorrelations(moods, vitals, isArabic),
      // Activity cross-correlations
      ...this.analyzeActivityVitalCorrelations(vitals, isArabic),
      ...this.analyzeActivitySymptomCorrelations(filteredSymptoms, vitals, isArabic),
      ...this.analyzeActivityMoodCorrelations(moods, vitals, isArabic),
      // HRV (wearable) cross-correlations
      ...this.analyzeHrvSymptomCorrelations(filteredSymptoms, vitals, isArabic),
      ...this.analyzeHrvMoodCorrelations(moods, vitals, isArabic),
      ...this.analyzeHrvVitalCorrelations(vitals, isArabic),
    ];

    // Sort by strength and confidence
    correlationResults.sort((a, b) => {
      const scoreA = Math.abs(a.strength) * (a.confidence / 100);
      const scoreB = Math.abs(b.strength) * (b.confidence / 100);
      return scoreB - scoreA;
    });

    return {
      id: `correlation-${userId}-${Date.now()}`,
      title: isArabic
        ? "تحليل ارتباط البيانات الصحية"
        : "Health Data Correlation Analysis",
      description: isArabic
        ? `تحليل العلاقات بين أعراضك الصحية والأدوية والمزاج والعلامات الحيوية خلال آخر ${daysBack} يوم`
        : `Analysis of relationships between your symptoms, medications, mood, and vital signs over the past ${daysBack} days`,
      correlationResults: correlationResults.slice(0, 10), // Top 10 correlations
      timestamp: new Date(),
      userId,
    };
  }

  /**
   * Generate cross-correlation matrix for advanced analysis
   */
  async generateCrossCorrelationMatrix(
    userId: string,
    daysBack = 90
  ): Promise<CrossCorrelationMatrix> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const [symptoms, medications, moods, vitals] = await Promise.all([
      symptomService.getUserSymptoms(userId, 500),
      medicationService.getUserMedications(userId),
      this.getUserMoods(userId, startDate, endDate),
      this.getUserVitals(userId, startDate, endDate),
    ]);

    const filteredSymptoms = symptoms.filter(
      (s) => s.timestamp >= startDate && s.timestamp <= endDate
    );

    // Extract unique factors
    const symptomTypes = [...new Set(filteredSymptoms.map((s) => s.type))];
    const medicationNames = medications.map((m) => m.name);
    const moodTypes = [...new Set(moods.map((m) => m.mood))];
    const vitalTypes = [...new Set(vitals.map((v) => v.type))];

    const correlations: Array<{
      factor1: string;
      factor2: string;
      correlation: number;
      pValue: number;
      sampleSize: number;
    }> = [];

    // Calculate correlations between all factor pairs
    // This is a simplified implementation - in production you'd want more sophisticated statistical analysis

    // Symptom vs Medication correlations (temporal)
    for (const symptomType of symptomTypes) {
      for (const medName of medicationNames) {
        const symptomData = filteredSymptoms.filter(
          (s) => s.type === symptomType
        );
        const medData = medications.find((m) => m.name === medName);

        if (medData && symptomData.length > 3) {
          const beforeMed = symptomData.filter(
            (s) => s.timestamp < medData.startDate
          );
          const afterMed = symptomData.filter(
            (s) => s.timestamp >= medData.startDate
          );

          if (beforeMed.length >= 2 && afterMed.length >= 2) {
            const beforeAvg =
              beforeMed.reduce((sum, s) => sum + s.severity, 0) /
              beforeMed.length;
            const afterAvg =
              afterMed.reduce((sum, s) => sum + s.severity, 0) /
              afterMed.length;

            const correlation = (beforeAvg - afterAvg) / beforeAvg; // Simplified

            correlations.push({
              factor1: `Symptom: ${symptomType}`,
              factor2: `Medication: ${medName}`,
              correlation: Math.max(-1, Math.min(1, correlation)),
              pValue: 0.05, // Placeholder
              sampleSize: beforeMed.length + afterMed.length,
            });
          }
        }
      }
    }

    return {
      symptoms: symptomTypes,
      medications: medicationNames,
      moods: moodTypes,
      vitals: vitalTypes,
      correlations,
    };
  }

  // Helper methods

  private groupSymptomsByDate(symptoms: Symptom[]): Record<string, Symptom[]> {
    const grouped: Record<string, Symptom[]> = {};
    for (const symptom of symptoms) {
      const dateKey = symptom.timestamp.toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(symptom);
    }
    return grouped;
  }

  private buildDailySymptomVitalSeries(
    symptoms: Symptom[],
    vitalData: VitalSign[],
    timePoints: Date[]
  ): { symptomSeverities: number[]; vitalValues: number[] } {
    const symptomSeverities: number[] = [];
    const vitalValues: number[] = [];

    for (const point of timePoints) {
      const daySymptoms = symptoms.filter(
        (symptom) => symptom.timestamp.toDateString() === point.toDateString()
      );
      const dayVitals = vitalData.filter(
        (vital) => vital.timestamp.toDateString() === point.toDateString()
      );

      if (daySymptoms.length === 0 || dayVitals.length === 0) {
        continue;
      }

      const avgSeverity =
        daySymptoms.reduce((sum, symptom) => sum + symptom.severity, 0) /
        daySymptoms.length;
      const avgVital =
        dayVitals.reduce((sum, vital) => sum + vital.value, 0) /
        dayVitals.length;

      symptomSeverities.push(avgSeverity);
      vitalValues.push(avgVital);
    }

    return { symptomSeverities, vitalValues };
  }

  private groupNumericByBucket<T>(
    items: T[],
    getBucket: (item: T) => number,
    getValue: (item: T) => number
  ): Record<number, number[]> {
    const grouped: Record<number, number[]> = {};
    for (const item of items) {
      const bucket = getBucket(item);
      if (!grouped[bucket]) {
        grouped[bucket] = [];
      }
      grouped[bucket].push(getValue(item));
    }
    return grouped;
  }

  private getBucketAverages(
    grouped: Record<number, number[]>
  ): Record<number, number> {
    const averages: Record<number, number> = {};
    for (const key of Object.keys(grouped)) {
      const bucket = Number.parseInt(key, 10);
      averages[bucket] =
        grouped[bucket].reduce((a, b) => a + b, 0) / grouped[bucket].length;
    }
    return averages;
  }

  private getMedicationCorrelationDescription(
    medicationName: string,
    strength: number,
    isArabic: boolean
  ): string {
    if (isArabic) {
      if (strength > 0) {
        return `تحسنت الأعراض بعد بدء تناول ${medicationName}`;
      }
      return `ساءت الأعراض بعد بدء تناول ${medicationName}`;
    }

    if (strength > 0) {
      return `Symptoms improved after starting ${medicationName}`;
    }
    return `Symptoms worsened after starting ${medicationName}`;
  }

  private getMedicationCorrelationRecommendation(
    medicationName: string,
    strength: number,
    isArabic: boolean
  ): string {
    if (isArabic) {
      if (strength > 0) {
        return `استمر في تناول ${medicationName} حسب الوصفة`;
      }
      return `ناقش فعالية ${medicationName} مع مقدم الرعاية الصحية`;
    }

    if (strength > 0) {
      return `Continue ${medicationName} as prescribed`;
    }
    return `Discuss ${medicationName} effectiveness with healthcare provider`;
  }

  private getMoodCorrelationDescription(
    correlation: number,
    isArabic: boolean
  ): string {
    if (isArabic) {
      if (correlation < -0.5) {
        return "شدة الأعراض العالية مرتبطة بقوة بانخفاض المزاج";
      }
      if (correlation > 0.5) {
        return "شدة الأعراض العالية ترتبط بشدة المزاج العالية";
      }
      return "علاقة معتدلة بين شدة الأعراض والمزاج";
    }

    if (correlation < -0.5) {
      return "Higher symptom severity is strongly associated with lower mood";
    }
    if (correlation > 0.5) {
      return "Higher symptom severity correlates with higher mood intensity";
    }
    return "Moderate relationship between symptom severity and mood";
  }

  private getMoodCorrelationRecommendation(
    correlation: number,
    isArabic: boolean
  ): string {
    if (isArabic) {
      if (correlation < -0.5) {
        return "فكر في مراقبة المزاج عندما تكون الأعراض شديدة";
      }
      return "راقب كل من الأعراض والمزاج لتتبع صحي شامل";
    }

    if (correlation < -0.5) {
      return "Consider mood monitoring when symptoms are severe";
    }
    return "Monitor both symptoms and mood for comprehensive health tracking";
  }

  private getCommonTimePoints(
    data1: Array<{ timestamp: Date }>,
    data2: Array<{ timestamp: Date }>
  ): Date[] {
    const dates1 = new Set(data1.map((item) => item.timestamp.toDateString()));
    const dates2 = new Set(data2.map((item) => item.timestamp.toDateString()));

    const commonDates = [...dates1].filter((date) => dates2.has(date));
    return commonDates.map((dateStr) => new Date(dateStr));
  }

  private async getUserMoods(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Mood[]> {
    try {
      const q = query(
        collection(db, "moods"),
        where("userId", "==", userId),
        where("timestamp", ">=", Timestamp.fromDate(startDate)),
        where("timestamp", "<=", Timestamp.fromDate(endDate)),
        orderBy("timestamp", "desc")
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.() || new Date(),
          }) as Mood
      );
    } catch (_error) {
      return [];
    }
  }

  private async getUserVitals(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<VitalSign[]> {
    try {
      const q = query(
        collection(db, "vitals"),
        where("userId", "==", userId),
        where("timestamp", ">=", Timestamp.fromDate(startDate)),
        where("timestamp", "<=", Timestamp.fromDate(endDate)),
        orderBy("timestamp", "desc")
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.() || new Date(),
          }) as VitalSign
      );
    } catch (_error) {
      return [];
    }
  }

  private getVitalCorrelationDescription(
    vitalType: string,
    correlation: number,
    isArabic = false
  ): string {
    if (isArabic) {
      const direction = correlation > 0 ? "أعلى" : "أقل";
      const strength = Math.abs(correlation) > 0.7 ? "بقوة" : "باعتدال";
      return `قيم ${vitalType} ترتبط ${strength} بشدة الأعراض (${direction} ${vitalType} مرتبط بأعراض أكثر شدة)`;
    }
    const direction = correlation > 0 ? "higher" : "lower";
    const strength = Math.abs(correlation) > 0.7 ? "strongly" : "moderately";

    return `${vitalType} values ${strength} correlate with symptom severity (${direction} ${vitalType} associated with more severe symptoms)`;
  }

  private getVitalCorrelationRecommendation(
    vitalType: string,
    correlation: number,
    isArabic = false
  ): string {
    if (isArabic) {
      if (Math.abs(correlation) < 0.5) {
        return "استمر في مراقبة كل من الأعراض والعلامات الحيوية";
      }

      if (correlation > 0.7) {
        return `راقب ${vitalType} عن كثب عندما تتفاقم الأعراض، حيث قد تكون مرتبطة`;
      }
      if (correlation < -0.7) {
        return `لاحظ أن ${vitalType} يميل إلى الانخفاض عندما تكون الأعراض شديدة`;
      }

      return "فكر في مناقشة هذه العلاقة مع مقدم الرعاية الصحية";
    }

    if (Math.abs(correlation) < 0.5) {
      return "Continue monitoring both symptoms and vital signs";
    }

    if (correlation > 0.7) {
      return `Monitor ${vitalType} closely when symptoms worsen, as they may be related`;
    }
    if (correlation < -0.7) {
      return `Note that ${vitalType} tends to decrease when symptoms are severe`;
    }

    return "Consider discussing this relationship with your healthcare provider";
  }

  private getVitalUnit(vitalType: string): string {
    const units: Record<string, string> = {
      heartRate: "bpm",
      bloodPressure: "mmHg",
      temperature: "°C",
      weight: "kg",
      oxygenSaturation: "%",
      respiratoryRate: "breaths/min",
    };
    return units[vitalType] || "";
  }

  // ─── Sleep Cross-Correlations ──────────────────────────────────────────────

  // ─── Wearable vital type name sets ─────────────────────────────────────────
  private readonly SLEEP_TYPES = new Set([
    "sleep", "sleepDuration", "sleepHours", "sleep_analysis",
  ]);
  private readonly STEPS_TYPES = new Set([
    "steps", "stepCount", "dailySteps",
  ]);
  private readonly HRV_TYPES = new Set([
    "heart_rate_variability", "heartRateVariability", "hrv",
  ]);
  private readonly ACTIVE_ENERGY_TYPES = new Set([
    "active_energy", "activeEnergy", "caloriesBurned",
  ]);

  /**
   * Build a daily map of sleep hours from vitals collection.
   * Accepts all provider-specific type names.
   */
  private buildDailySleepMap(vitals: VitalSign[]): Map<string, number> {
    const sleepVitals = vitals.filter((v) => this.SLEEP_TYPES.has(v.type));
    const dailyMap = new Map<string, number[]>();
    for (const v of sleepVitals) {
      const key = v.timestamp.toDateString();
      if (!dailyMap.has(key)) dailyMap.set(key, []);
      dailyMap.get(key)!.push(v.value);
    }
    const result = new Map<string, number>();
    for (const [day, vals] of dailyMap) {
      result.set(day, vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    return result;
  }

  /**
   * Build a daily map of step counts from vitals collection.
   */
  private buildDailyStepsMap(vitals: VitalSign[]): Map<string, number> {
    const stepVitals = vitals.filter((v) => this.STEPS_TYPES.has(v.type));
    const dailyMap = new Map<string, number[]>();
    for (const v of stepVitals) {
      const key = v.timestamp.toDateString();
      if (!dailyMap.has(key)) dailyMap.set(key, []);
      dailyMap.get(key)!.push(v.value);
    }
    const result = new Map<string, number>();
    for (const [day, vals] of dailyMap) {
      // Sum steps within the day (multiple syncs)
      result.set(day, vals.reduce((a, b) => a + b, 0));
    }
    return result;
  }

  /**
   * Analyse how sleep duration correlates with non-sleep vital signs
   * (heart rate, blood pressure, SpO2, glucose, etc.).
   */
  private analyzeSleepVitalCorrelations(
    vitals: VitalSign[],
    isArabic = false
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    const sleepMap = this.buildDailySleepMap(vitals);
    if (sleepMap.size < 5) return results;

    const nonSleepVitalTypes = [
      ...new Set(
        vitals
          .filter(
            (v) =>
              !this.SLEEP_TYPES.has(v.type) &&
              !this.STEPS_TYPES.has(v.type)
          )
          .map((v) => v.type)
      ),
    ];

    for (const vType of nonSleepVitalTypes) {
      const typeVitals = vitals.filter((v) => v.type === vType);
      const vitalMap = new Map<string, number[]>();
      for (const v of typeVitals) {
        const key = v.timestamp.toDateString();
        if (!vitalMap.has(key)) vitalMap.set(key, []);
        vitalMap.get(key)!.push(v.value);
      }

      // Align on common days
      const sleepVals: number[] = [];
      const vitalVals: number[] = [];
      for (const [day, sleepHrs] of sleepMap) {
        const dayVitals = vitalMap.get(day);
        if (!dayVitals) continue;
        const avg = dayVitals.reduce((a, b) => a + b, 0) / dayVitals.length;
        sleepVals.push(sleepHrs);
        vitalVals.push(avg);
      }

      if (sleepVals.length < 5) continue;
      const r = this.calculatePearsonCorrelation(sleepVals, vitalVals);
      if (Math.abs(r) < 0.3) continue;

      const confidence = Math.min(95, Math.round(Math.abs(r) * 100));
      const direction = r < 0 ? (isArabic ? "ينخفض" : "decreases") : (isArabic ? "يرتفع" : "increases");
      const vLabel = vType.replace(/([A-Z])/g, " $1").trim();

      results.push({
        type: "sleep_vital",
        strength: r,
        confidence,
        description: isArabic
          ? `${vLabel} ${direction} في الأيام التي تنام فيها أكثر`
          : `${vLabel} ${direction} on days with more sleep`,
        actionable: Math.abs(r) >= 0.5,
        recommendation: isArabic
          ? `استهدف 7–9 ساعات من النوم لتحسين ${vLabel}`
          : `Aim for 7–9 hours of sleep to optimise your ${vLabel}`,
        data: {
          factor1: "Sleep Duration (hours)",
          factor2: vLabel,
          correlationType: "pearson",
          supportingData: { correlation: r.toFixed(3), n: sleepVals.length },
        },
      });
    }

    return results;
  }

  /**
   * Analyse how sleep duration correlates with next-day symptom severity.
   * Uses a 1-day lag: sleep on day D vs symptoms on day D+1.
   */
  private analyzeSleepSymptomCorrelations(
    symptoms: Symptom[],
    vitals: VitalSign[],
    isArabic = false
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    const sleepMap = this.buildDailySleepMap(vitals);
    if (sleepMap.size < 5 || symptoms.length < 5) return results;

    // Build daily symptom severity map
    const symptomMap = new Map<string, number[]>();
    for (const s of symptoms) {
      const key = s.timestamp.toDateString();
      if (!symptomMap.has(key)) symptomMap.set(key, []);
      symptomMap.get(key)!.push(s.severity);
    }

    // Align: sleep on day D → symptoms on D+1
    const sleepVals: number[] = [];
    const symptomVals: number[] = [];
    for (const [dayStr, sleepHrs] of sleepMap) {
      const day = new Date(dayStr);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDaySymptoms = symptomMap.get(nextDay.toDateString());
      if (!nextDaySymptoms) continue;
      const avgSeverity =
        nextDaySymptoms.reduce((a, b) => a + b, 0) / nextDaySymptoms.length;
      sleepVals.push(sleepHrs);
      symptomVals.push(avgSeverity);
    }

    if (sleepVals.length < 5) return results;
    const r = this.calculatePearsonCorrelation(sleepVals, symptomVals);
    if (Math.abs(r) < 0.3) return results;

    const confidence = Math.min(95, Math.round(Math.abs(r) * 100));
    const protective = r < 0; // More sleep → lower symptoms

    results.push({
      type: "sleep_symptom",
      strength: r,
      confidence,
      description: isArabic
        ? protective
          ? "النوم لساعات أكثر يرتبط بأعراض أخف في اليوم التالي"
          : "النوم الأقل يرتبط بأعراض أشد في اليوم التالي"
        : protective
        ? "More sleep is associated with milder symptoms the next day"
        : "Less sleep is associated with worse symptoms the following day",
      actionable: true,
      recommendation: isArabic
        ? "حافظ على نوم 7–9 ساعات لتخفيف الأعراض"
        : "Aim for 7–9 hours of sleep to help manage your symptoms",
      data: {
        factor1: "Sleep Duration (hours, day D)",
        factor2: "Symptom Severity (day D+1)",
        correlationType: "pearson_lagged",
        supportingData: { correlation: r.toFixed(3), n: sleepVals.length },
      },
    });

    return results;
  }

  /**
   * Analyse how sleep duration correlates with same-day mood.
   */
  private analyzeSleepMoodCorrelations(
    moods: Mood[],
    vitals: VitalSign[],
    isArabic = false
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    const sleepMap = this.buildDailySleepMap(vitals);
    if (sleepMap.size < 5 || moods.length < 5) return results;

    // Build daily mood intensity map
    const moodMap = new Map<string, number[]>();
    for (const m of moods) {
      const key = m.timestamp.toDateString();
      if (!moodMap.has(key)) moodMap.set(key, []);
      moodMap.get(key)!.push(m.intensity ?? 5);
    }

    const sleepVals: number[] = [];
    const moodVals: number[] = [];
    for (const [dayStr, sleepHrs] of sleepMap) {
      const dayMoods = moodMap.get(dayStr);
      if (!dayMoods) continue;
      const avg = dayMoods.reduce((a, b) => a + b, 0) / dayMoods.length;
      sleepVals.push(sleepHrs);
      moodVals.push(avg);
    }

    if (sleepVals.length < 5) return results;
    const r = this.calculateSpearmanCorrelation(sleepVals, moodVals);
    if (Math.abs(r) < 0.3) return results;

    const confidence = Math.min(95, Math.round(Math.abs(r) * 100));
    const positive = r > 0;

    results.push({
      type: "sleep_mood",
      strength: r,
      confidence,
      description: isArabic
        ? positive
          ? "مزيد من النوم يرتبط بمزاج أفضل"
          : "النوم الأقل يرتبط بانخفاض في المزاج"
        : positive
        ? "More sleep is associated with better mood"
        : "Less sleep correlates with lower mood scores",
      actionable: true,
      recommendation: isArabic
        ? "حافظ على روتين نوم منتظم لتحسين مزاجك"
        : "Maintain a consistent sleep schedule to support your mood",
      data: {
        factor1: "Sleep Duration (hours)",
        factor2: "Mood Intensity",
        correlationType: "spearman",
        supportingData: { correlation: r.toFixed(3), n: sleepVals.length },
      },
    });

    return results;
  }

  // ─── Activity Cross-Correlations ───────────────────────────────────────────

  /**
   * Analyse how daily step count correlates with non-activity vital signs.
   */
  private analyzeActivityVitalCorrelations(
    vitals: VitalSign[],
    isArabic = false
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    const stepsMap = this.buildDailyStepsMap(vitals);
    if (stepsMap.size < 5) return results;

    const nonActivityVitalTypes = [
      ...new Set(
        vitals
          .filter(
            (v) =>
              !this.STEPS_TYPES.has(v.type) &&
              !this.SLEEP_TYPES.has(v.type)
          )
          .map((v) => v.type)
      ),
    ];

    for (const vType of nonActivityVitalTypes) {
      const typeVitals = vitals.filter((v) => v.type === vType);
      const vitalMap = new Map<string, number[]>();
      for (const v of typeVitals) {
        const key = v.timestamp.toDateString();
        if (!vitalMap.has(key)) vitalMap.set(key, []);
        vitalMap.get(key)!.push(v.value);
      }

      const stepsVals: number[] = [];
      const vitalVals: number[] = [];
      for (const [day, steps] of stepsMap) {
        const dayVitals = vitalMap.get(day);
        if (!dayVitals) continue;
        const avg = dayVitals.reduce((a, b) => a + b, 0) / dayVitals.length;
        stepsVals.push(steps);
        vitalVals.push(avg);
      }

      if (stepsVals.length < 5) continue;
      const r = this.calculatePearsonCorrelation(stepsVals, vitalVals);
      if (Math.abs(r) < 0.3) continue;

      const confidence = Math.min(95, Math.round(Math.abs(r) * 100));
      const vLabel = vType.replace(/([A-Z])/g, " $1").trim();
      const direction = r < 0
        ? (isArabic ? "ينخفض" : "decreases")
        : (isArabic ? "يرتفع" : "increases");

      results.push({
        type: "activity_vital",
        strength: r,
        confidence,
        description: isArabic
          ? `${vLabel} ${direction} في أيام نشاطك الأعلى`
          : `${vLabel} ${direction} on your more active days`,
        actionable: Math.abs(r) >= 0.5,
        recommendation: isArabic
          ? `استهدف 8,000 خطوة يومياً لتحسين ${vLabel}`
          : `Aim for 8,000 steps/day to help optimise your ${vLabel}`,
        data: {
          factor1: "Daily Steps",
          factor2: vLabel,
          correlationType: "pearson",
          supportingData: { correlation: r.toFixed(3), n: stepsVals.length },
        },
      });
    }

    return results;
  }

  /**
   * Analyse how daily step count correlates with same-day symptom severity.
   */
  private analyzeActivitySymptomCorrelations(
    symptoms: Symptom[],
    vitals: VitalSign[],
    isArabic = false
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    const stepsMap = this.buildDailyStepsMap(vitals);
    if (stepsMap.size < 5 || symptoms.length < 5) return results;

    const symptomMap = new Map<string, number[]>();
    for (const s of symptoms) {
      const key = s.timestamp.toDateString();
      if (!symptomMap.has(key)) symptomMap.set(key, []);
      symptomMap.get(key)!.push(s.severity);
    }

    const stepsVals: number[] = [];
    const symptomVals: number[] = [];
    for (const [day, steps] of stepsMap) {
      const daySymptoms = symptomMap.get(day);
      if (!daySymptoms) continue;
      const avg = daySymptoms.reduce((a, b) => a + b, 0) / daySymptoms.length;
      stepsVals.push(steps);
      symptomVals.push(avg);
    }

    if (stepsVals.length < 5) return results;
    const r = this.calculatePearsonCorrelation(stepsVals, symptomVals);
    if (Math.abs(r) < 0.3) return results;

    const confidence = Math.min(95, Math.round(Math.abs(r) * 100));
    const protective = r < 0;

    results.push({
      type: "activity_symptom",
      strength: r,
      confidence,
      description: isArabic
        ? protective
          ? "الأيام الأكثر نشاطاً ترتبط بأعراض أخف"
          : "الأيام الأكثر نشاطاً ترتبط بأعراض أشد"
        : protective
        ? "More active days are associated with milder symptoms"
        : "Higher step counts correlate with increased symptom severity",
      actionable: protective,
      recommendation: isArabic
        ? protective
          ? "حافظ على نشاطك البدني — يبدو أنه يقلل أعراضك"
          : "إذا كانت الحركة تزيد أعراضك، ناقش ذلك مع طبيبك"
        : protective
        ? "Keep up your physical activity — it appears to reduce your symptoms"
        : "If activity worsens symptoms, discuss with your doctor",
      data: {
        factor1: "Daily Steps",
        factor2: "Symptom Severity",
        correlationType: "pearson",
        supportingData: { correlation: r.toFixed(3), n: stepsVals.length },
      },
    });

    return results;
  }

  /**
   * Analyse how daily step count correlates with same-day mood.
   */
  private analyzeActivityMoodCorrelations(
    moods: Mood[],
    vitals: VitalSign[],
    isArabic = false
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    const stepsMap = this.buildDailyStepsMap(vitals);
    if (stepsMap.size < 5 || moods.length < 5) return results;

    const moodMap = new Map<string, number[]>();
    for (const m of moods) {
      const key = m.timestamp.toDateString();
      if (!moodMap.has(key)) moodMap.set(key, []);
      moodMap.get(key)!.push(m.intensity ?? 5);
    }

    const stepsVals: number[] = [];
    const moodVals: number[] = [];
    for (const [day, steps] of stepsMap) {
      const dayMoods = moodMap.get(day);
      if (!dayMoods) continue;
      const avg = dayMoods.reduce((a, b) => a + b, 0) / dayMoods.length;
      stepsVals.push(steps);
      moodVals.push(avg);
    }

    if (stepsVals.length < 5) return results;
    const r = this.calculateSpearmanCorrelation(stepsVals, moodVals);
    if (Math.abs(r) < 0.3) return results;

    const confidence = Math.min(95, Math.round(Math.abs(r) * 100));
    const positive = r > 0;

    results.push({
      type: "activity_mood",
      strength: r,
      confidence,
      description: isArabic
        ? positive
          ? "الأيام الأكثر نشاطاً ترتبط بمزاج أفضل"
          : "الأيام الأكثر نشاطاً ترتبط بانخفاض في المزاج"
        : positive
        ? "More active days are associated with better mood"
        : "Higher step counts correlate with lower mood on your active days",
      actionable: positive,
      recommendation: isArabic
        ? positive
          ? "النشاط البدني يحسّن مزاجك — استمر!"
          : "راقب كيف يؤثر النشاط على مزاجك وناقش الأمر مع طبيبك"
        : positive
        ? "Physical activity boosts your mood — keep it up!"
        : "Monitor how activity affects your mood and discuss with your doctor",
      data: {
        factor1: "Daily Steps",
        factor2: "Mood Intensity",
        correlationType: "spearman",
        supportingData: { correlation: r.toFixed(3), n: stepsVals.length },
      },
    });

    return results;
  }

  // ─── HRV Cross-Correlations ────────────────────────────────────────────────

  /**
   * Build a daily map of average HRV (ms) from wearable vitals.
   * Oura writes "heart_rate_variability"; Garmin "heartRateVariability".
   */
  private buildDailyHrvMap(vitals: VitalSign[]): Map<string, number> {
    const hrvVitals = vitals.filter((v) => this.HRV_TYPES.has(v.type));
    const dailyMap = new Map<string, number[]>();
    for (const v of hrvVitals) {
      const key = v.timestamp.toDateString();
      if (!dailyMap.has(key)) dailyMap.set(key, []);
      dailyMap.get(key)!.push(v.value);
    }
    const result = new Map<string, number>();
    for (const [day, vals] of dailyMap) {
      result.set(day, vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    return result;
  }

  /**
   * Analyse HRV vs next-day symptom severity (lag 1 day).
   * Low HRV (poor autonomic recovery) often predicts symptom flares.
   */
  private analyzeHrvSymptomCorrelations(
    symptoms: Symptom[],
    vitals: VitalSign[],
    isArabic = false
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    const hrvMap = this.buildDailyHrvMap(vitals);
    if (hrvMap.size < 5 || symptoms.length < 5) return results;

    const symptomMap = new Map<string, number[]>();
    for (const s of symptoms) {
      const key = s.timestamp.toDateString();
      if (!symptomMap.has(key)) symptomMap.set(key, []);
      symptomMap.get(key)!.push(s.severity);
    }

    const hrvVals: number[] = [];
    const symptomVals: number[] = [];
    for (const [dayStr, hrv] of hrvMap) {
      const nextDay = new Date(dayStr);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextSymptoms = symptomMap.get(nextDay.toDateString());
      if (!nextSymptoms) continue;
      const avg = nextSymptoms.reduce((a, b) => a + b, 0) / nextSymptoms.length;
      hrvVals.push(hrv);
      symptomVals.push(avg);
    }

    if (hrvVals.length < 5) return results;
    const r = this.calculatePearsonCorrelation(hrvVals, symptomVals);
    if (Math.abs(r) < 0.3) return results;

    const confidence = Math.min(95, Math.round(Math.abs(r) * 100));
    const protective = r < 0; // Higher HRV → lower next-day symptoms

    results.push({
      type: "hrv_symptom",
      strength: r,
      confidence,
      description: isArabic
        ? protective
          ? "انخفاض تقلب معدل القلب (HRV) يسبق تفاقم الأعراض في اليوم التالي"
          : "ارتفاع HRV يرتبط بأعراض أشد — قد يعكس جهداً جسدياً"
        : protective
        ? "Lower HRV often precedes worse symptoms the next day — a sign your body needs recovery"
        : "Higher HRV days correlate with increased symptom severity",
      actionable: protective,
      recommendation: isArabic
        ? protective
          ? "في أيام HRV المنخفضة، خذ قسطاً من الراحة وراقب أعراضك"
          : "ناقش نتائج HRV مع طبيبك"
        : protective
        ? "On low-HRV days, prioritise rest and watch for symptom flares"
        : "Discuss your HRV patterns with your doctor",
      data: {
        factor1: "HRV (ms, day D)",
        factor2: "Symptom Severity (day D+1)",
        correlationType: "pearson_lagged",
        supportingData: { correlation: r.toFixed(3), n: hrvVals.length },
      },
    });

    return results;
  }

  /**
   * Analyse HRV vs same-day mood (HRV is a validated physiological marker
   * of emotional regulation and stress).
   */
  private analyzeHrvMoodCorrelations(
    moods: Mood[],
    vitals: VitalSign[],
    isArabic = false
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    const hrvMap = this.buildDailyHrvMap(vitals);
    if (hrvMap.size < 5 || moods.length < 5) return results;

    const moodMap = new Map<string, number[]>();
    for (const m of moods) {
      const key = m.timestamp.toDateString();
      if (!moodMap.has(key)) moodMap.set(key, []);
      moodMap.get(key)!.push(m.intensity ?? 5);
    }

    const hrvVals: number[] = [];
    const moodVals: number[] = [];
    for (const [day, hrv] of hrvMap) {
      const dayMoods = moodMap.get(day);
      if (!dayMoods) continue;
      const avg = dayMoods.reduce((a, b) => a + b, 0) / dayMoods.length;
      hrvVals.push(hrv);
      moodVals.push(avg);
    }

    if (hrvVals.length < 5) return results;
    const r = this.calculateSpearmanCorrelation(hrvVals, moodVals);
    if (Math.abs(r) < 0.3) return results;

    const confidence = Math.min(95, Math.round(Math.abs(r) * 100));
    const positive = r > 0;

    results.push({
      type: "hrv_mood",
      strength: r,
      confidence,
      description: isArabic
        ? positive
          ? "أيام HRV الأعلى ترتبط بمزاج أفضل — جهازك العصبي في حالة جيدة"
          : "انخفاض HRV يرتبط بانخفاض المزاج — إشارة إلى ضغط أو إجهاد"
        : positive
        ? "Higher HRV days align with better mood — your nervous system is in a recovery state"
        : "Lower HRV correlates with lower mood — a possible stress signal",
      actionable: true,
      recommendation: isArabic
        ? "مارس التأمل والتنفس العميق لرفع HRV وتحسين مزاجك"
        : "Breathing exercises, meditation, and good sleep can raise HRV and lift mood",
      data: {
        factor1: "HRV (ms)",
        factor2: "Mood Intensity",
        correlationType: "spearman",
        supportingData: { correlation: r.toFixed(3), n: hrvVals.length },
      },
    });

    return results;
  }

  /**
   * Analyse HRV vs same-day non-HRV vital signs (e.g. resting heart rate,
   * blood pressure — both are clinically linked to autonomic tone).
   */
  private analyzeHrvVitalCorrelations(
    vitals: VitalSign[],
    isArabic = false
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    const hrvMap = this.buildDailyHrvMap(vitals);
    if (hrvMap.size < 5) return results;

    // Focus on the most clinically relevant non-HRV vitals
    const targetVitalTypes = ["heartRate", "heart_rate", "resting_heart_rate",
      "bloodPressure", "blood_pressure_systolic", "oxygenSaturation", "blood_oxygen"];

    for (const vType of targetVitalTypes) {
      const typeVitals = vitals.filter((v) => v.type === vType);
      if (typeVitals.length < 5) continue;

      const vitalMap = new Map<string, number[]>();
      for (const v of typeVitals) {
        const key = v.timestamp.toDateString();
        if (!vitalMap.has(key)) vitalMap.set(key, []);
        vitalMap.get(key)!.push(v.value);
      }

      const hrvVals: number[] = [];
      const vitalVals: number[] = [];
      for (const [day, hrv] of hrvMap) {
        const dayVitals = vitalMap.get(day);
        if (!dayVitals) continue;
        const avg = dayVitals.reduce((a, b) => a + b, 0) / dayVitals.length;
        hrvVals.push(hrv);
        vitalVals.push(avg);
      }

      if (hrvVals.length < 5) continue;
      const r = this.calculatePearsonCorrelation(hrvVals, vitalVals);
      if (Math.abs(r) < 0.35) continue;

      const confidence = Math.min(95, Math.round(Math.abs(r) * 100));
      const vLabel = vType.replace(/[_]/g, " ").replace(/([A-Z])/g, " $1").trim();
      const direction = r < 0
        ? (isArabic ? "ينخفض" : "decreases")
        : (isArabic ? "يرتفع" : "increases");

      results.push({
        type: "hrv_vital",
        strength: r,
        confidence,
        description: isArabic
          ? `${vLabel} ${direction} عندما يرتفع HRV — علاقة فسيولوجية مهمة`
          : `${vLabel} ${direction} when HRV is higher — a meaningful autonomic signal`,
        actionable: Math.abs(r) >= 0.5,
        recommendation: isArabic
          ? "راقب HRV لفهم صحة جهازك العصبي اللاإرادي"
          : "Track HRV alongside this vital to understand your autonomic health",
        data: {
          factor1: "HRV (ms)",
          factor2: vLabel,
          correlationType: "pearson",
          supportingData: { correlation: r.toFixed(3), n: hrvVals.length },
        },
      });
    }

    return results;
  }
}

export const correlationAnalysisService = new CorrelationAnalysisService();
