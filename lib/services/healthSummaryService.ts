import type { Medication, Symptom, Mood } from "@/types";
import { medicationService } from "./medicationService";
import { symptomService } from "./symptomService";
import { moodService } from "./moodService";
import { healthScoreService } from "./healthScoreService";

export interface HealthSummary {
  period: "weekly" | "monthly";
  startDate: Date;
  endDate: Date;
  overview: {
    totalSymptoms: number;
    averageSeverity: number;
    medicationAdherence: number;
    moodScore: number;
    healthScore: number;
  };
  insights: HealthInsight[];
  patterns: HealthPattern[];
  recommendations: string[];
  trends: HealthTrend[];
}

export interface HealthInsight {
  type: "positive" | "neutral" | "concerning";
  title: string;
  description: string;
  metric?: string;
  change?: number;
  trend?: "improving" | "stable" | "declining";
}

export interface HealthPattern {
  type: "temporal" | "symptom" | "medication" | "lifestyle";
  title: string;
  description: string;
  confidence: number; // 0-1
  examples: string[];
  recommendation?: string;
}

export interface HealthTrend {
  metric: string;
  currentValue: number;
  previousValue: number;
  change: number;
  trend: "up" | "down" | "stable";
  period: string;
}

class HealthSummaryService {
  /**
   * Generate weekly health summary
   */
  async generateWeeklySummary(userId: string, weekStart?: Date): Promise<HealthSummary> {
    const startDate = weekStart || this.getWeekStart(new Date());
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    return this.generateSummary(userId, "weekly", startDate, endDate);
  }

  /**
   * Generate monthly health summary
   */
  async generateMonthlySummary(userId: string, monthStart?: Date): Promise<HealthSummary> {
    const startDate = monthStart || this.getMonthStart(new Date());
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0); // Last day of the month

    return this.generateSummary(userId, "monthly", startDate, endDate);
  }

  /**
   * Generate health summary for a specific period
   */
  private async generateSummary(
    userId: string,
    period: "weekly" | "monthly",
    startDate: Date,
    endDate: Date
  ): Promise<HealthSummary> {
    try {
      // Fetch all relevant data for the period
      const [
        symptoms,
        medications,
        moods,
        previousPeriodData
      ] = await Promise.all([
        this.getSymptomsInPeriod(userId, startDate, endDate),
        this.getMedicationsInPeriod(userId, startDate, endDate),
        this.getMoodsInPeriod(userId, startDate, endDate),
        this.getPreviousPeriodData(userId, period, startDate)
      ]);

      // Calculate overview metrics
      const overview = this.calculateOverviewMetrics(symptoms, medications, moods);

      // Generate insights
      const insights = this.generateInsights(symptoms, medications, moods, previousPeriodData, period);

      // Detect patterns
      const patterns = this.detectPatterns(symptoms, medications, moods, period);

      // Generate recommendations
      const recommendations = this.generateRecommendations(insights, patterns, overview);

      // Calculate trends
      const trends = this.calculateTrends(symptoms, medications, moods, previousPeriodData, period);

      return {
        period,
        startDate,
        endDate,
        overview,
        insights,
        patterns,
        recommendations,
        trends,
      };
    } catch (error) {
      console.error("Error generating health summary:", error);
      // Return a basic summary if there's an error
      return {
        period,
        startDate,
        endDate,
        overview: {
          totalSymptoms: 0,
          averageSeverity: 0,
          medicationAdherence: 0,
          moodScore: 0,
          healthScore: 0,
        },
        insights: [],
        patterns: [],
        recommendations: ["Unable to generate summary due to data loading issues"],
        trends: [],
      };
    }
  }

  /**
   * Get symptoms within a date range
   */
  private async getSymptomsInPeriod(userId: string, startDate: Date, endDate: Date): Promise<Symptom[]> {
    try {
      const allSymptoms = await symptomService.getUserSymptoms(userId, 365);
      return allSymptoms.filter(symptom =>
        symptom.timestamp >= startDate && symptom.timestamp <= endDate
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Get medications within a date range
   */
  private async getMedicationsInPeriod(userId: string, startDate: Date, endDate: Date): Promise<Medication[]> {
    try {
      return await medicationService.getUserMedications(userId);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get moods within a date range
   */
  private async getMoodsInPeriod(userId: string, startDate: Date, endDate: Date): Promise<Mood[]> {
    try {
      const allMoods = await moodService.getUserMoods(userId, 365);
      return allMoods.filter(mood =>
        mood.timestamp >= startDate && mood.timestamp <= endDate
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Get data from previous period for comparison
   */
  private async getPreviousPeriodData(
    userId: string,
    period: "weekly" | "monthly",
    currentStartDate: Date
  ): Promise<{
    symptoms: Symptom[];
    medications: Medication[];
    moods: Mood[];
  }> {
    try {
      const previousStart = new Date(currentStartDate);
      const previousEnd = new Date(currentStartDate);

      if (period === "weekly") {
        previousStart.setDate(previousStart.getDate() - 7);
        previousEnd.setDate(previousEnd.getDate() - 1);
      } else {
        previousStart.setMonth(previousStart.getMonth() - 1);
        previousEnd.setDate(0); // Last day of previous month
      }

      const [symptoms, medications, moods] = await Promise.all([
        this.getSymptomsInPeriod(userId, previousStart, previousEnd),
        this.getMedicationsInPeriod(userId, previousStart, previousEnd),
        this.getMoodsInPeriod(userId, previousStart, previousEnd),
      ]);

      return { symptoms, medications, moods };
    } catch (error) {
      return { symptoms: [], medications: [], moods: [] };
    }
  }

  /**
   * Calculate overview metrics
   */
  private calculateOverviewMetrics(symptoms: Symptom[], medications: Medication[], moods: Mood[]) {
    // Calculate average severity
    const avgSeverity = symptoms.length > 0
      ? symptoms.reduce((sum, s) => sum + s.severity, 0) / symptoms.length
      : 0;

    // Calculate medication adherence (simplified)
    const medicationAdherence = medications.length > 0
      ? medications.filter(m => m.isActive).length / medications.length * 100
      : 100;

    // Calculate average mood score
    const moodScore = moods.length > 0
      ? moods.reduce((sum, m) => sum + m.moodRating, 0) / moods.length
      : 3; // Neutral default

    // Calculate health score (simplified algorithm)
    const healthScore = this.calculateHealthScore(avgSeverity, medicationAdherence, moodScore, symptoms.length);

    return {
      totalSymptoms: symptoms.length,
      averageSeverity: Math.round(avgSeverity * 10) / 10,
      medicationAdherence: Math.round(medicationAdherence),
      moodScore: Math.round(moodScore * 10) / 10,
      healthScore: Math.round(healthScore),
    };
  }

  /**
   * Calculate health score based on various metrics
   */
  private calculateHealthScore(
    avgSeverity: number,
    medicationAdherence: number,
    moodScore: number,
    symptomCount: number
  ): number {
    // Normalize and weight different factors
    const severityScore = Math.max(0, 100 - (avgSeverity * 20)); // Lower severity = higher score
    const adherenceScore = medicationAdherence; // Direct percentage
    const moodScoreNormalized = (moodScore / 5) * 100; // Convert 1-5 scale to 0-100
    const activityScore = Math.max(0, 100 - (symptomCount * 2)); // Fewer symptoms = higher score

    // Weighted average
    const weights = { severity: 0.3, adherence: 0.25, mood: 0.25, activity: 0.2 };
    return (
      severityScore * weights.severity +
      adherenceScore * weights.adherence +
      moodScoreNormalized * weights.mood +
      activityScore * weights.activity
    );
  }

  /**
   * Generate insights based on data analysis
   */
  private generateInsights(
    symptoms: Symptom[],
    medications: Medication[],
    moods: Mood[],
    previousData: any,
    period: string
  ): HealthInsight[] {
    const insights: HealthInsight[] = [];

    // Symptom insights
    if (symptoms.length > 0) {
      const avgSeverity = symptoms.reduce((sum, s) => sum + s.severity, 0) / symptoms.length;
      const prevAvgSeverity = previousData.symptoms.length > 0
        ? previousData.symptoms.reduce((sum, s) => sum + s.severity, 0) / previousData.symptoms.length
        : avgSeverity;

      if (avgSeverity < prevAvgSeverity) {
        insights.push({
          type: "positive",
          title: "Symptom Improvement",
          description: `Your average symptom severity decreased compared to last ${period}`,
          metric: "severity",
          change: prevAvgSeverity - avgSeverity,
          trend: "improving",
        });
      } else if (avgSeverity > prevAvgSeverity) {
        insights.push({
          type: "concerning",
          title: "Increased Symptoms",
          description: `Your symptoms were more severe than last ${period}`,
          metric: "severity",
          change: avgSeverity - prevAvgSeverity,
          trend: "declining",
        });
      }
    }

    // Medication adherence insights
    const activeMeds = medications.filter(m => m.isActive).length;
    const prevActiveMeds = previousData.medications.filter((m: Medication) => m.isActive).length;

    if (activeMeds > prevActiveMeds) {
      insights.push({
        type: "neutral",
        title: "New Medications",
        description: `You started ${activeMeds - prevActiveMeds} new medication${activeMeds - prevActiveMeds !== 1 ? 's' : ''} this ${period}`,
      });
    }

    // Mood insights
    if (moods.length > 0) {
      const avgMood = moods.reduce((sum, m) => sum + m.moodRating, 0) / moods.length;
      const prevAvgMood = previousData.moods.length > 0
        ? previousData.moods.reduce((sum, m) => sum + m.moodRating, 0) / previousData.moods.length
        : avgMood;

      if (avgMood > prevAvgMood + 0.5) {
        insights.push({
          type: "positive",
          title: "Improved Mood",
          description: "Your mood has been better than last period",
          trend: "improving",
        });
      } else if (avgMood < prevAvgMood - 0.5) {
        insights.push({
          type: "concerning",
          title: "Mood Changes",
          description: "Your mood has been lower than usual",
          trend: "declining",
        });
      }
    }

    return insights;
  }

  /**
   * Detect patterns in health data
   */
  private detectPatterns(
    symptoms: Symptom[],
    medications: Medication[],
    moods: Mood[],
    period: string
  ): HealthPattern[] {
    const patterns: HealthPattern[] = [];

    // Temporal patterns (weekdays vs weekends)
    const weekdayVsWeekend = this.detectWeekdayWeekendPatterns(symptoms);
    if (weekdayVsWeekend.confidence > 0.6) {
      patterns.push(weekdayVsWeekend);
    }

    // Time of day patterns
    const timeOfDayPatterns = this.detectTimeOfDayPatterns(symptoms);
    if (timeOfDayPatterns.length > 0) {
      patterns.push(...timeOfDayPatterns);
    }

    // Symptom correlations
    const symptomCorrelations = this.detectSymptomCorrelations(symptoms);
    if (symptomCorrelations.length > 0) {
      patterns.push(...symptomCorrelations);
    }

    // Medication effectiveness patterns
    const medicationPatterns = this.detectMedicationPatterns(symptoms, medications);
    if (medicationPatterns.length > 0) {
      patterns.push(...medicationPatterns);
    }

    return patterns.slice(0, 5); // Limit to top 5 patterns
  }

  /**
   * Detect weekday vs weekend symptom patterns
   */
  private detectWeekdayWeekendPatterns(symptoms: Symptom[]): HealthPattern {
    const weekdaySymptoms = symptoms.filter(s => {
      const day = s.timestamp.getDay();
      return day >= 1 && day <= 5; // Monday to Friday
    });

    const weekendSymptoms = symptoms.filter(s => {
      const day = s.timestamp.getDay();
      return day === 0 || day === 6; // Sunday or Saturday
    });

    const weekdayAvgSeverity = weekdaySymptoms.length > 0
      ? weekdaySymptoms.reduce((sum, s) => sum + s.severity, 0) / weekdaySymptoms.length
      : 0;

    const weekendAvgSeverity = weekendSymptoms.length > 0
      ? weekendSymptoms.reduce((sum, s) => sum + s.severity, 0) / weekendSymptoms.length
      : 0;

    const difference = Math.abs(weekendAvgSeverity - weekdayAvgSeverity);
    const confidence = Math.min(difference / 2, 1); // Scale confidence

    let description = "";
    let recommendation = "";

    if (weekendAvgSeverity > weekdayAvgSeverity + 0.5) {
      description = "Your symptoms tend to be more severe on weekends";
      recommendation = "Consider maintaining consistent routines on weekends";
    } else if (weekdayAvgSeverity > weekendAvgSeverity + 0.5) {
      description = "Your symptoms tend to be more severe during weekdays";
      recommendation = "Weekdays may be triggering factors - consider stress management techniques";
    } else {
      description = "No significant difference between weekday and weekend symptoms";
    }

    return {
      type: "temporal",
      title: "Weekday vs Weekend Pattern",
      description,
      confidence,
      examples: [
        `Weekday average severity: ${weekdayAvgSeverity.toFixed(1)}`,
        `Weekend average severity: ${weekendAvgSeverity.toFixed(1)}`,
      ],
      recommendation,
    };
  }

  /**
   * Detect time of day patterns
   */
  private detectTimeOfDayPatterns(symptoms: Symptom[]): HealthPattern[] {
    const patterns: HealthPattern[] = [];
    const hourGroups = symptoms.reduce((acc, symptom) => {
      const hour = symptom.timestamp.getHours();
      if (!acc[hour]) acc[hour] = [];
      acc[hour].push(symptom);
      return acc;
    }, {} as Record<number, Symptom[]>);

    // Find hours with highest symptom frequency
    const hourStats = Object.entries(hourGroups).map(([hour, symptoms]) => ({
      hour: parseInt(hour),
      count: symptoms.length,
      avgSeverity: symptoms.reduce((sum, s) => sum + s.severity, 0) / symptoms.length,
    })).sort((a, b) => b.count - a.count);

    if (hourStats.length > 0 && hourStats[0].count >= 3) {
      const peakHour = hourStats[0].hour;
      const timeOfDay = this.getTimeOfDayLabel(peakHour);

      patterns.push({
        type: "temporal",
        title: `${timeOfDay} Symptom Pattern`,
        description: `You experience more symptoms during ${timeOfDay.toLowerCase()} hours (${this.formatHour(peakHour)})`,
        confidence: Math.min(hourStats[0].count / 10, 1),
        examples: [
          `${hourStats[0].count} symptoms recorded between ${this.formatHour(peakHour)} and ${this.formatHour(peakHour + 1)}`,
          `Average severity: ${hourStats[0].avgSeverity.toFixed(1)}`,
        ],
        recommendation: `Consider adjusting your routine during ${timeOfDay.toLowerCase()} hours`,
      });
    }

    return patterns;
  }

  /**
   * Detect symptom correlations
   */
  private detectSymptomCorrelations(symptoms: Symptom[]): HealthPattern[] {
    const patterns: HealthPattern[] = [];
    const symptomTypes = [...new Set(symptoms.map(s => s.type))];

    // Find frequently co-occurring symptoms
    const coOccurrences: Record<string, Record<string, number>> = {};

    symptoms.forEach(symptom => {
      const sameDaySymptoms = symptoms.filter(s =>
        s.timestamp.toDateString() === symptom.timestamp.toDateString() &&
        s.id !== symptom.id
      );

      sameDaySymptoms.forEach(coSymptom => {
        if (!coOccurrences[symptom.type]) coOccurrences[symptom.type] = {};
        coOccurrences[symptom.type][coSymptom.type] =
          (coOccurrences[symptom.type][coSymptom.type] || 0) + 1;
      });
    });

    // Find strong correlations
    Object.entries(coOccurrences).forEach(([symptom, correlations]) => {
      Object.entries(correlations).forEach(([coSymptom, count]) => {
        if (count >= 3) {
          patterns.push({
            type: "symptom",
            title: "Symptom Correlation",
            description: `${symptom} and ${coSymptom} frequently occur together`,
            confidence: Math.min(count / 10, 1),
            examples: [
              `Co-occurred ${count} times`,
              `Consider addressing both symptoms together`,
            ],
            recommendation: `These symptoms may be related - consult your healthcare provider about comprehensive treatment`,
          });
        }
      });
    });

    return patterns.slice(0, 3); // Limit to top 3 correlations
  }

  /**
   * Detect medication effectiveness patterns
   */
  private detectMedicationPatterns(symptoms: Symptom[], medications: Medication[]): HealthPattern[] {
    const patterns: HealthPattern[] = [];

    // This is a simplified analysis - in practice, you'd need more sophisticated
    // time-series analysis to determine medication effectiveness
    const activeMedications = medications.filter(m => m.isActive);

    if (activeMedications.length > 0 && symptoms.length > 5) {
      patterns.push({
        type: "medication",
        title: "Medication Effectiveness",
        description: "Continue monitoring your symptoms while on current medications",
        confidence: 0.7,
        examples: [
          `${activeMedications.length} active medications`,
          `${symptoms.length} symptoms recorded`,
        ],
        recommendation: "Keep track of how your symptoms change with your current medication regimen",
      });
    }

    return patterns;
  }

  /**
   * Generate personalized recommendations
   */
  private generateRecommendations(
    insights: HealthInsight[],
    patterns: HealthPattern[],
    overview: any
  ): string[] {
    const recommendations: string[] = [];

    // Based on insights
    insights.forEach(insight => {
      if (insight.type === "positive") {
        recommendations.push(`Keep up the good work with ${insight.title.toLowerCase()}`);
      } else if (insight.type === "concerning") {
        recommendations.push(`Consider consulting your healthcare provider about ${insight.title.toLowerCase()}`);
      }
    });

    // Based on patterns
    patterns.forEach(pattern => {
      if (pattern.recommendation) {
        recommendations.push(pattern.recommendation);
      }
    });

    // Based on overview metrics
    if (overview.medicationAdherence < 80) {
      recommendations.push("Consider setting medication reminders to improve adherence");
    }

    if (overview.totalSymptoms > 10) {
      recommendations.push("Consider keeping a symptom diary to identify triggers");
    }

    if (overview.moodScore < 3) {
      recommendations.push("Consider activities that boost your mood and well-being");
    }

    // Default recommendations if none generated
    if (recommendations.length === 0) {
      recommendations.push("Continue monitoring your health regularly");
      recommendations.push("Stay consistent with your medication schedule");
      recommendations.push("Consider speaking with your healthcare provider about your progress");
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Calculate trends compared to previous period
   */
  private calculateTrends(
    symptoms: Symptom[],
    medications: Medication[],
    moods: Mood[],
    previousData: any,
    period: string
  ): HealthTrend[] {
    const trends: HealthTrend[] = [];

    // Symptom count trend
    const currentSymptomCount = symptoms.length;
    const previousSymptomCount = previousData.symptoms.length;
    trends.push({
      metric: "Symptoms",
      currentValue: currentSymptomCount,
      previousValue: previousSymptomCount,
      change: currentSymptomCount - previousSymptomCount,
      trend: currentSymptomCount > previousSymptomCount ? "up" :
             currentSymptomCount < previousSymptomCount ? "down" : "stable",
      period,
    });

    // Average severity trend
    const currentAvgSeverity = symptoms.length > 0
      ? symptoms.reduce((sum, s) => sum + s.severity, 0) / symptoms.length
      : 0;
    const previousAvgSeverity = previousData.symptoms.length > 0
      ? previousData.symptoms.reduce((sum, s) => sum + s.severity, 0) / previousData.symptoms.length
      : 0;
    trends.push({
      metric: "Average Severity",
      currentValue: Math.round(currentAvgSeverity * 10) / 10,
      previousValue: Math.round(previousAvgSeverity * 10) / 10,
      change: currentAvgSeverity - previousAvgSeverity,
      trend: currentAvgSeverity > previousAvgSeverity ? "up" :
             currentAvgSeverity < previousAvgSeverity ? "down" : "stable",
      period,
    });

    // Mood trend
    const currentAvgMood = moods.length > 0
      ? moods.reduce((sum, m) => sum + m.moodRating, 0) / moods.length
      : 3;
    const previousAvgMood = previousData.moods.length > 0
      ? previousData.moods.reduce((sum, m) => sum + m.moodRating, 0) / previousData.moods.length
      : 3;
    trends.push({
      metric: "Mood",
      currentValue: Math.round(currentAvgMood * 10) / 10,
      previousValue: Math.round(previousAvgMood * 10) / 10,
      change: currentAvgMood - previousAvgMood,
      trend: currentAvgMood > previousAvgMood ? "up" :
             currentAvgMood < previousAvgMood ? "down" : "stable",
      period,
    });

    return trends;
  }

  /**
   * Helper: Get start of week (Monday)
   */
  private getWeekStart(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  /**
   * Helper: Get start of month
   */
  private getMonthStart(date: Date): Date {
    const start = new Date(date);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  /**
   * Helper: Get time of day label
   */
  private getTimeOfDayLabel(hour: number): string {
    if (hour >= 5 && hour < 12) return "Morning";
    if (hour >= 12 && hour < 17) return "Afternoon";
    if (hour >= 17 && hour < 21) return "Evening";
    return "Night";
  }

  /**
   * Helper: Format hour for display
   */
  private formatHour(hour: number): string {
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? "PM" : "AM";
    return `${displayHour}:00 ${ampm}`;
  }
}

export const healthSummaryService = new HealthSummaryService();