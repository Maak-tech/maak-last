import type { Symptom, Medication, Mood, VitalSign, User } from "@/types";
import { symptomService } from "./symptomService";
import { medicationService } from "./medicationService";
import { moodService } from "./moodService";
// Vitals accessed directly from Firestore
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";

export interface CorrelationResult {
  type: "symptom_medication" | "symptom_mood" | "symptom_vital" | "medication_vital" | "mood_vital" | "temporal_pattern";
  strength: number; // Correlation coefficient (-1 to 1)
  confidence: number; // 0-100
  description: string;
  actionable: boolean;
  recommendation?: string;
  data: {
    factor1: string;
    factor2: string;
    correlationType: string;
    supportingData?: any;
  };
}

export interface CorrelationInsight {
  id: string;
  title: string;
  description: string;
  correlationResults: CorrelationResult[];
  timestamp: Date;
  userId: string;
}

export interface CrossCorrelationMatrix {
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
}

class CorrelationAnalysisService {
  /**
   * Calculate Pearson correlation coefficient
   */
  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate Spearman rank correlation (more robust for ordinal data)
   */
  private calculateSpearmanCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;

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
    return values.map(val => sorted.indexOf(val) + 1);
  }

  /**
   * Calculate point-biserial correlation for binary vs continuous data
   */
  private calculatePointBiserialCorrelation(binary: number[], continuous: number[]): number {
    if (binary.length !== continuous.length || binary.length < 2) return 0;

    const n = binary.length;
    const n1 = binary.reduce((sum, val) => sum + val, 0); // Number of 1s
    const n0 = n - n1; // Number of 0s

    if (n1 === 0 || n0 === 0) return 0;

    const mean1 = binary.reduce((sum, val, i) => sum + (val === 1 ? continuous[i] : 0), 0) / n1;
    const mean0 = binary.reduce((sum, val, i) => sum + (val === 0 ? continuous[i] : 0), 0) / n0;
    const overallMean = continuous.reduce((sum, val) => sum + val, 0) / n;

    const variance = continuous.reduce((sum, val) => sum + Math.pow(val - overallMean, 2), 0) / n;

    if (variance === 0) return 0;

    return ((mean1 - mean0) / Math.sqrt(variance)) * Math.sqrt((n1 * n0) / (n * n));
  }

  /**
   * Analyze correlations between symptoms and medications
   */
  private async analyzeSymptomMedicationCorrelations(
    symptoms: Symptom[],
    medications: Medication[]
  ): Promise<CorrelationResult[]> {
    const results: CorrelationResult[] = [];

    if (symptoms.length === 0 || medications.length === 0) return results;

    // Group symptoms by date for time-series analysis
    const symptomsByDate = this.groupSymptomsByDate(symptoms);

    for (const medication of medications) {
      const medStartDate = medication.startDate;

      // Split symptoms into before and after medication start
      const symptomsBefore = symptoms.filter(s => s.timestamp < medStartDate);
      const symptomsAfter = symptoms.filter(s => s.timestamp >= medStartDate);

      if (symptomsBefore.length < 3 || symptomsAfter.length < 3) continue;

      // Calculate average severity before and after
      const avgSeverityBefore = symptomsBefore.reduce((sum, s) => sum + s.severity, 0) / symptomsBefore.length;
      const avgSeverityAfter = symptomsAfter.reduce((sum, s) => sum + s.severity, 0) / symptomsAfter.length;

      // Calculate frequency before and after
      const daysBefore = Math.max(1, (medStartDate.getTime() - symptomsBefore[0]?.timestamp.getTime()) / (1000 * 60 * 60 * 24));
      const daysAfter = Math.max(1, (Date.now() - medStartDate.getTime()) / (1000 * 60 * 60 * 24));

      const frequencyBefore = symptomsBefore.length / daysBefore;
      const frequencyAfter = symptomsAfter.length / daysAfter;

      // Calculate correlation strength based on improvement
      const severityImprovement = (avgSeverityBefore - avgSeverityAfter) / avgSeverityBefore;
      const frequencyImprovement = (frequencyBefore - frequencyAfter) / frequencyBefore;

      const overallImprovement = (severityImprovement + frequencyImprovement) / 2;

      if (Math.abs(overallImprovement) > 0.1) {
        const strength = Math.max(-1, Math.min(1, overallImprovement));
        const confidence = Math.min(95, Math.abs(overallImprovement) * 100);

        results.push({
          type: "symptom_medication",
          strength,
          confidence,
          description: strength > 0
            ? `Symptoms improved after starting ${medication.name}`
            : `Symptoms worsened after starting ${medication.name}`,
          actionable: strength > 0,
          recommendation: strength > 0
            ? `Continue ${medication.name} as prescribed`
            : `Discuss ${medication.name} effectiveness with healthcare provider`,
          data: {
            factor1: `Symptoms (severity/frequency)`,
            factor2: medication.name,
            correlationType: "temporal",
            supportingData: {
              severityBefore: avgSeverityBefore.toFixed(1),
              severityAfter: avgSeverityAfter.toFixed(1),
              frequencyBefore: frequencyBefore.toFixed(2),
              frequencyAfter: frequencyAfter.toFixed(2)
            }
          }
        });
      }
    }

    return results;
  }

  /**
   * Analyze correlations between symptoms and mood
   */
  private async analyzeSymptomMoodCorrelations(
    symptoms: Symptom[],
    moods: Mood[]
  ): Promise<CorrelationResult[]> {
    const results: CorrelationResult[] = [];

    if (symptoms.length === 0 || moods.length === 0) return results;

    // Create time-aligned datasets
    const timePoints = this.getCommonTimePoints(symptoms, moods);

    if (timePoints.length < 5) return results;

    const symptomSeverities: number[] = [];
    const moodIntensities: number[] = [];

    timePoints.forEach(point => {
      const daySymptoms = symptoms.filter(s =>
        s.timestamp.toDateString() === point.toDateString()
      );
      const dayMoods = moods.filter(m =>
        m.timestamp.toDateString() === point.toDateString()
      );

      if (daySymptoms.length > 0 && dayMoods.length > 0) {
        const avgSeverity = daySymptoms.reduce((sum, s) => sum + s.severity, 0) / daySymptoms.length;
        const avgMood = dayMoods.reduce((sum, m) => sum + m.intensity, 0) / dayMoods.length;

        symptomSeverities.push(avgSeverity);
        moodIntensities.push(avgMood);
      }
    });

    if (symptomSeverities.length >= 5) {
      const correlation = this.calculateSpearmanCorrelation(symptomSeverities, moodIntensities);
      const confidence = Math.min(90, Math.abs(correlation) * 100);

      if (Math.abs(correlation) > 0.3) {
        results.push({
          type: "symptom_mood",
          strength: correlation,
          confidence,
          description: correlation < -0.5
            ? "Higher symptom severity is strongly associated with lower mood"
            : correlation > 0.5
            ? "Higher symptom severity correlates with higher mood intensity"
            : "Moderate relationship between symptom severity and mood",
          actionable: Math.abs(correlation) > 0.6,
          recommendation: correlation < -0.5
            ? "Consider mood monitoring when symptoms are severe"
            : "Monitor both symptoms and mood for comprehensive health tracking",
          data: {
            factor1: "Symptom Severity",
            factor2: "Mood Intensity",
            correlationType: "daily correlation",
            supportingData: {
              sampleSize: symptomSeverities.length,
              correlationCoefficient: correlation.toFixed(3)
            }
          }
        });
      }
    }

    return results;
  }

  /**
   * Analyze correlations between symptoms and vital signs
   */
  private async analyzeSymptomVitalCorrelations(
    symptoms: Symptom[],
    vitals: VitalSign[]
  ): Promise<CorrelationResult[]> {
    const results: CorrelationResult[] = [];

    if (symptoms.length === 0 || vitals.length === 0) return results;

    // Group vitals by type
    const vitalsByType: Record<string, VitalSign[]> = {};
    vitals.forEach(vital => {
      if (!vitalsByType[vital.type]) vitalsByType[vital.type] = [];
      vitalsByType[vital.type].push(vital);
    });

    for (const [vitalType, vitalData] of Object.entries(vitalsByType)) {
      const timePoints = this.getCommonTimePoints(symptoms, vitalData);

      if (timePoints.length < 5) continue;

      const symptomSeverities: number[] = [];
      const vitalValues: number[] = [];

      timePoints.forEach(point => {
        const daySymptoms = symptoms.filter(s =>
          s.timestamp.toDateString() === point.toDateString()
        );
        const dayVitals = vitalData.filter(v =>
          v.timestamp.toDateString() === point.toDateString()
        );

        if (daySymptoms.length > 0 && dayVitals.length > 0) {
          const avgSeverity = daySymptoms.reduce((sum, s) => sum + s.severity, 0) / daySymptoms.length;
          const avgVital = dayVitals.reduce((sum, v) => sum + v.value, 0) / dayVitals.length;

          symptomSeverities.push(avgSeverity);
          vitalValues.push(avgVital);
        }
      });

      if (symptomSeverities.length >= 5) {
        const correlation = this.calculatePearsonCorrelation(symptomSeverities, vitalValues);
        const confidence = Math.min(85, Math.abs(correlation) * 100);

        if (Math.abs(correlation) > 0.4) {
          results.push({
            type: "symptom_vital",
            strength: correlation,
            confidence,
            description: this.getVitalCorrelationDescription(vitalType, correlation),
            actionable: Math.abs(correlation) > 0.6,
            recommendation: this.getVitalCorrelationRecommendation(vitalType, correlation),
            data: {
              factor1: "Symptom Severity",
              factor2: `${vitalType} (${this.getVitalUnit(vitalType)})`,
              correlationType: "daily correlation",
              supportingData: {
                sampleSize: symptomSeverities.length,
                correlationCoefficient: correlation.toFixed(3)
              }
            }
          });
        }
      }
    }

    return results;
  }

  /**
   * Analyze temporal patterns across all health data
   */
  private async analyzeTemporalPatterns(
    symptoms: Symptom[],
    medications: Medication[],
    moods: Mood[],
    vitals: VitalSign[]
  ): Promise<CorrelationResult[]> {
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
  private analyzeDayOfWeekPatterns(symptoms: Symptom[], moods: Mood[]): CorrelationResult[] {
    const results: CorrelationResult[] = [];

    if (symptoms.length < 14) return results; // Need at least 2 weeks of data

    // Group by day of week
    const symptomSeverityByDay: Record<number, number[]> = {};
    const moodIntensityByDay: Record<number, number[]> = {};

    symptoms.forEach(symptom => {
      const day = symptom.timestamp.getDay();
      if (!symptomSeverityByDay[day]) symptomSeverityByDay[day] = [];
      symptomSeverityByDay[day].push(symptom.severity);
    });

    moods.forEach(mood => {
      const day = mood.timestamp.getDay();
      if (!moodIntensityByDay[day]) moodIntensityByDay[day] = [];
      moodIntensityByDay[day].push(mood.intensity);
    });

    // Calculate average severity by day
    const avgSeverityByDay: Record<number, number> = {};
    Object.keys(symptomSeverityByDay).forEach(day => {
      const dayNum = parseInt(day);
      avgSeverityByDay[dayNum] = symptomSeverityByDay[dayNum].reduce((a, b) => a + b, 0) / symptomSeverityByDay[dayNum].length;
    });

    // Find patterns
    const weekdays = [1, 2, 3, 4, 5]; // Mon-Fri
    const weekends = [0, 6]; // Sun, Sat

    const weekdayAvg = weekdays.map(d => avgSeverityByDay[d]).filter(v => !isNaN(v));
    const weekendAvg = weekends.map(d => avgSeverityByDay[d]).filter(v => !isNaN(v));

    if (weekdayAvg.length >= 3 && weekendAvg.length >= 2) {
      const weekdayMean = weekdayAvg.reduce((a, b) => a + b, 0) / weekdayAvg.length;
      const weekendMean = weekendAvg.reduce((a, b) => a + b, 0) / weekendAvg.length;

      const difference = weekendMean - weekdayMean;
      const strength = Math.max(-1, Math.min(1, difference / 2)); // Normalize to -1 to 1

      if (Math.abs(strength) > 0.2) {
        results.push({
          type: "temporal_pattern",
          strength,
          confidence: 75,
          description: strength > 0
            ? "Symptoms tend to be more severe on weekends"
            : "Symptoms tend to be less severe on weekends",
          actionable: true,
          recommendation: strength > 0
            ? "Consider maintaining consistent routines on weekends"
            : "Take advantage of lower symptom days for important activities",
          data: {
            factor1: "Day of Week",
            factor2: "Symptom Severity",
            correlationType: "temporal pattern",
            supportingData: {
              weekdayAverage: weekdayMean.toFixed(1),
              weekendAverage: weekendMean.toFixed(1)
            }
          }
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

    if (symptoms.length < 20) return results;

    // Group by hour of day
    const severityByHour: Record<number, number[]> = {};

    symptoms.forEach(symptom => {
      const hour = symptom.timestamp.getHours();
      if (!severityByHour[hour]) severityByHour[hour] = [];
      severityByHour[hour].push(symptom.severity);
    });

    // Find peak hours
    const avgSeverityByHour: Record<number, number> = {};
    Object.keys(severityByHour).forEach(hour => {
      const hourNum = parseInt(hour);
      avgSeverityByHour[hourNum] = severityByHour[hourNum].reduce((a, b) => a + b, 0) / severityByHour[hourNum].length;
    });

    const peakHour = Object.entries(avgSeverityByHour)
      .sort(([,a], [,b]) => b - a)[0];

    if (peakHour && parseFloat(peakHour[1]) > 3.5) {
      const hour = parseInt(peakHour[0]);
      const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

      results.push({
        type: "temporal_pattern",
        strength: 0.6,
        confidence: 70,
        description: `Symptoms tend to be more severe in the ${period} (${hour}:00)`,
        actionable: true,
        recommendation: `Consider timing activities around your symptom patterns`,
        data: {
          factor1: "Time of Day",
          factor2: "Symptom Severity",
          correlationType: "temporal pattern",
          supportingData: {
            peakHour: `${hour}:00`,
            averageSeverity: parseFloat(peakHour[1]).toFixed(1)
          }
        }
      });
    }

    return results;
  }

  /**
   * Analyze seasonal patterns
   */
  private analyzeSeasonalPatterns(symptoms: Symptom[], moods: Mood[]): CorrelationResult[] {
    const results: CorrelationResult[] = [];

    if (symptoms.length < 30) return results; // Need substantial data

    // Group by month
    const severityByMonth: Record<number, number[]> = {};
    const moodByMonth: Record<number, number[]> = {};

    symptoms.forEach(symptom => {
      const month = symptom.timestamp.getMonth();
      if (!severityByMonth[month]) severityByMonth[month] = [];
      severityByMonth[month].push(symptom.severity);
    });

    moods.forEach(mood => {
      const month = mood.timestamp.getMonth();
      if (!moodByMonth[month]) moodByMonth[month] = [];
      moodByMonth[month].push(mood.intensity);
    });

    // Calculate seasonal averages
    const winterMonths = [11, 0, 1]; // Dec, Jan, Feb
    const summerMonths = [5, 6, 7]; // Jun, Jul, Aug

    const winterSeverity = winterMonths.flatMap(m => severityByMonth[m] || []);
    const summerSeverity = summerMonths.flatMap(m => severityByMonth[m] || []);

    if (winterSeverity.length >= 5 && summerSeverity.length >= 5) {
      const winterAvg = winterSeverity.reduce((a, b) => a + b, 0) / winterSeverity.length;
      const summerAvg = summerSeverity.reduce((a, b) => a + b, 0) / summerSeverity.length;

      const difference = winterAvg - summerAvg;

      if (Math.abs(difference) > 0.5) {
        results.push({
          type: "temporal_pattern",
          strength: Math.max(-1, Math.min(1, difference / 2)),
          confidence: 65,
          description: difference > 0
            ? "Symptoms tend to be more severe in winter months"
            : "Symptoms tend to be more severe in summer months",
          actionable: true,
          recommendation: difference > 0
            ? "Consider seasonal health management strategies for winter"
            : "Monitor symptoms during summer months",
          data: {
            factor1: "Season",
            factor2: "Symptom Severity",
            correlationType: "seasonal pattern",
            supportingData: {
              winterAverage: winterAvg.toFixed(1),
              summerAverage: summerAvg.toFixed(1)
            }
          }
        });
      }
    }

    return results;
  }

  /**
   * Generate comprehensive correlation analysis
   */
  async generateCorrelationAnalysis(userId: string, daysBack: number = 90): Promise<CorrelationInsight> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch all relevant data
    const [symptoms, medications, moods, vitals] = await Promise.all([
      symptomService.getUserSymptoms(userId, 500),
      medicationService.getUserMedications(userId),
      this.getUserMoods(userId, startDate, endDate),
      this.getUserVitals(userId, startDate, endDate)
    ]);

    // Filter data to the specified time range
    const filteredSymptoms = symptoms.filter(s => s.timestamp >= startDate && s.timestamp <= endDate);

    // Analyze all correlation types
    const correlationResults = [
      ...(await this.analyzeSymptomMedicationCorrelations(filteredSymptoms, medications)),
      ...(await this.analyzeSymptomMoodCorrelations(filteredSymptoms, moods)),
      ...(await this.analyzeSymptomVitalCorrelations(filteredSymptoms, vitals)),
      ...(await this.analyzeTemporalPatterns(filteredSymptoms, medications, moods, vitals))
    ];

    // Sort by strength and confidence
    correlationResults.sort((a, b) => {
      const scoreA = Math.abs(a.strength) * (a.confidence / 100);
      const scoreB = Math.abs(b.strength) * (b.confidence / 100);
      return scoreB - scoreA;
    });

    return {
      id: `correlation-${userId}-${Date.now()}`,
      title: "Health Data Correlation Analysis",
      description: `Analysis of relationships between your symptoms, medications, mood, and vital signs over the past ${daysBack} days`,
      correlationResults: correlationResults.slice(0, 10), // Top 10 correlations
      timestamp: new Date(),
      userId
    };
  }

  /**
   * Generate cross-correlation matrix for advanced analysis
   */
  async generateCrossCorrelationMatrix(userId: string, daysBack: number = 90): Promise<CrossCorrelationMatrix> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const [symptoms, medications, moods, vitals] = await Promise.all([
      symptomService.getUserSymptoms(userId, 500),
      medicationService.getUserMedications(userId),
      this.getUserMoods(userId, startDate, endDate),
      this.getUserVitals(userId, startDate, endDate)
    ]);

    const filteredSymptoms = symptoms.filter(s => s.timestamp >= startDate && s.timestamp <= endDate);

    // Extract unique factors
    const symptomTypes = [...new Set(filteredSymptoms.map(s => s.type))];
    const medicationNames = medications.map(m => m.name);
    const moodTypes = [...new Set(moods.map(m => m.mood))];
    const vitalTypes = [...new Set(vitals.map(v => v.type))];

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
    symptomTypes.forEach(symptomType => {
      medicationNames.forEach(medName => {
        const symptomData = filteredSymptoms.filter(s => s.type === symptomType);
        const medData = medications.find(m => m.name === medName);

        if (medData && symptomData.length > 3) {
          const beforeMed = symptomData.filter(s => s.timestamp < medData.startDate);
          const afterMed = symptomData.filter(s => s.timestamp >= medData.startDate);

          if (beforeMed.length >= 2 && afterMed.length >= 2) {
            const beforeAvg = beforeMed.reduce((sum, s) => sum + s.severity, 0) / beforeMed.length;
            const afterAvg = afterMed.reduce((sum, s) => sum + s.severity, 0) / afterMed.length;

            const correlation = (beforeAvg - afterAvg) / beforeAvg; // Simplified

            correlations.push({
              factor1: `Symptom: ${symptomType}`,
              factor2: `Medication: ${medName}`,
              correlation: Math.max(-1, Math.min(1, correlation)),
              pValue: 0.05, // Placeholder
              sampleSize: beforeMed.length + afterMed.length
            });
          }
        }
      });
    });

    return {
      symptoms: symptomTypes,
      medications: medicationNames,
      moods: moodTypes,
      vitals: vitalTypes,
      correlations
    };
  }

  // Helper methods

  private groupSymptomsByDate(symptoms: Symptom[]): Record<string, Symptom[]> {
    const grouped: Record<string, Symptom[]> = {};
    symptoms.forEach(symptom => {
      const dateKey = symptom.timestamp.toDateString();
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(symptom);
    });
    return grouped;
  }

  private getCommonTimePoints(data1: any[], data2: any[]): Date[] {
    const dates1 = new Set(data1.map(item => item.timestamp.toDateString()));
    const dates2 = new Set(data2.map(item => item.timestamp.toDateString()));

    const commonDates = [...dates1].filter(date => dates2.has(date));
    return commonDates.map(dateStr => new Date(dateStr));
  }

  private async getUserMoods(userId: string, startDate: Date, endDate: Date): Promise<Mood[]> {
    try {
      const q = query(
        collection(db, "moods"),
        where("userId", "==", userId),
        where("timestamp", ">=", Timestamp.fromDate(startDate)),
        where("timestamp", "<=", Timestamp.fromDate(endDate)),
        orderBy("timestamp", "desc")
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date(),
      } as Mood));
    } catch (error) {
      return [];
    }
  }

  private async getUserVitals(userId: string, startDate: Date, endDate: Date): Promise<VitalSign[]> {
    try {
      const q = query(
        collection(db, "vitals"),
        where("userId", "==", userId),
        where("timestamp", ">=", Timestamp.fromDate(startDate)),
        where("timestamp", "<=", Timestamp.fromDate(endDate)),
        orderBy("timestamp", "desc")
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date(),
      } as VitalSign));
    } catch (error) {
      return [];
    }
  }

  private getVitalCorrelationDescription(vitalType: string, correlation: number): string {
    const direction = correlation > 0 ? "higher" : "lower";
    const strength = Math.abs(correlation) > 0.7 ? "strongly" : "moderately";

    return `${vitalType} values ${strength} correlate with symptom severity (${direction} ${vitalType} associated with more severe symptoms)`;
  }

  private getVitalCorrelationRecommendation(vitalType: string, correlation: number): string {
    if (Math.abs(correlation) < 0.5) return "Continue monitoring both symptoms and vital signs";

    if (correlation > 0.7) {
      return `Monitor ${vitalType} closely when symptoms worsen, as they may be related`;
    } else if (correlation < -0.7) {
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
      respiratoryRate: "breaths/min"
    };
    return units[vitalType] || "";
  }
}

export const correlationAnalysisService = new CorrelationAnalysisService();