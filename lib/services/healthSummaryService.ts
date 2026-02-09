import type { Medication, Mood, Symptom } from "@/types";
import { medicationService } from "./medicationService";
import { moodService } from "./moodService";
import { symptomService } from "./symptomService";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Large localization lookup table with parameterized templates.
function getLocalizedText(
  key: string,
  isArabic: boolean,
  params?: Record<string, string | number>
): string {
  const texts: Record<string, { en: string; ar: string }> = {
    symptomImprovement: {
      en: "Symptom Improvement",
      ar: "تحسن الأعراض",
    },
    symptomImprovementDesc: {
      en: `Your average symptom severity decreased compared to last ${params?.period || "period"}`,
      ar: `انخفضت شدة أعراضك المتوسطة مقارنة بـ ${params?.period === "weekly" ? "الأسبوع الماضي" : "الشهر الماضي"}`,
    },
    increasedSymptoms: {
      en: "Increased Symptoms",
      ar: "زيادة الأعراض",
    },
    increasedSymptomsDesc: {
      en: `Your symptoms were more severe than last ${params?.period || "period"}`,
      ar: `كانت أعراضك أكثر شدة من ${params?.period === "weekly" ? "الأسبوع الماضي" : "الشهر الماضي"}`,
    },
    newMedications: {
      en: "New Medications",
      ar: "أدوية جديدة",
    },
    newMedicationsDesc: {
      en: `You started ${params?.count || 0} new medication${(params?.count || 0) !== 1 ? "s" : ""} this ${params?.period || "period"}`,
      ar: `بدأت ${params?.count || 0} دواء${(params?.count || 0) !== 1 ? " جديد" : ""} هذا ${params?.period === "weekly" ? "الأسبوع" : "الشهر"}`,
    },
    improvedMood: {
      en: "Improved Mood",
      ar: "تحسن المزاج",
    },
    improvedMoodDesc: {
      en: "Your mood has been better than last period",
      ar: "كان مزاجك أفضل من الفترة الماضية",
    },
    moodChanges: {
      en: "Mood Changes",
      ar: "تغيرات المزاج",
    },
    moodChangesDesc: {
      en: "Your mood has been lower than usual",
      ar: "كان مزاجك أقل من المعتاد",
    },
    weekdayWeekendPattern: {
      en: "Weekday vs Weekend Pattern",
      ar: "نمط أيام العمل مقابل عطلة نهاية الأسبوع",
    },
    weekendSeverity: {
      en: "Your symptoms tend to be more severe on weekends",
      ar: "تميل أعراضك إلى أن تكون أكثر شدة في عطلات نهاية الأسبوع",
    },
    weekendRecommendation: {
      en: "Consider maintaining consistent routines on weekends",
      ar: "فكر في الحفاظ على روتين ثابت في عطلات نهاية الأسبوع",
    },
    weekdaySeverity: {
      en: "Your symptoms tend to be more severe during weekdays",
      ar: "تميل أعراضك إلى أن تكون أكثر شدة خلال أيام الأسبوع",
    },
    weekdayRecommendation: {
      en: "Weekdays may be triggering factors - consider stress management techniques",
      ar: "قد تكون أيام الأسبوع عوامل مسببة - فكر في تقنيات إدارة التوتر",
    },
    noSignificantDifference: {
      en: "No significant difference between weekday and weekend symptoms",
      ar: "لا يوجد فرق كبير بين أعراض أيام الأسبوع وعطلة نهاية الأسبوع",
    },
    weekdayAvgSeverity: {
      en: `Weekday average severity: ${params?.value || 0}`,
      ar: `متوسط شدة أيام الأسبوع: ${params?.value || 0}`,
    },
    weekendAvgSeverity: {
      en: `Weekend average severity: ${params?.value || 0}`,
      ar: `متوسط شدة عطلة نهاية الأسبوع: ${params?.value || 0}`,
    },
    symptomPattern: {
      en: `${params?.timeOfDay || ""} Symptom Pattern`,
      ar: `نمط أعراض ${params?.timeOfDay || ""}`,
    },
    symptomPatternDesc: {
      en: `You experience more symptoms during ${params?.timeOfDay || ""} hours (${params?.hour || ""})`,
      ar: `تعاني من المزيد من الأعراض خلال ساعات ${params?.timeOfDay || ""} (${params?.hour || ""})`,
    },
    symptomPatternRecommendation: {
      en: `Consider adjusting your routine during ${params?.timeOfDay || ""} hours`,
      ar: `فكر في تعديل روتينك خلال ساعات ${params?.timeOfDay || ""}`,
    },
    symptomCorrelation: {
      en: "Symptom Correlation",
      ar: "ارتباط الأعراض",
    },
    symptomCorrelationDesc: {
      en: `${params?.symptom1 || ""} and ${params?.symptom2 || ""} frequently occur together`,
      ar: `${params?.symptom1 || ""} و ${params?.symptom2 || ""} يحدثان معًا بشكل متكرر`,
    },
    symptomCorrelationRecommendation: {
      en: "These symptoms may be related - consult your healthcare provider about comprehensive treatment",
      ar: "قد تكون هذه الأعراض مرتبطة - استشر مقدم الرعاية الصحية حول العلاج الشامل",
    },
    medicationEffectiveness: {
      en: "Medication Effectiveness",
      ar: "فعالية الأدوية",
    },
    medicationEffectivenessDesc: {
      en: "Continue monitoring your symptoms while on current medications",
      ar: "استمر في مراقبة أعراضك أثناء تناول الأدوية الحالية",
    },
    medicationEffectivenessRecommendation: {
      en: "Keep track of how your symptoms change with your current medication regimen",
      ar: "تتبع كيف تتغير أعراضك مع نظام الأدوية الحالي",
    },
    keepUpGoodWork: {
      en: `Keep up the good work with ${params?.topic || "your health"}`,
      ar: `استمر في العمل الجيد مع ${params?.topic || "صحتك"}`,
    },
    consultProvider: {
      en: `Consider consulting your healthcare provider about ${params?.topic || "your symptoms"}`,
      ar: `فكر في استشارة مقدم الرعاية الصحية حول ${params?.topic || "أعراضك"}`,
    },
    setReminders: {
      en: "Consider setting medication reminders to improve adherence",
      ar: "فكر في ضبط تذكيرات الأدوية لتحسين الالتزام",
    },
    symptomDiary: {
      en: "Consider keeping a symptom diary to identify triggers",
      ar: "فكر في الاحتفاظ بمذكرة أعراض لتحديد المحفزات",
    },
    boostMood: {
      en: "Consider activities that boost your mood and well-being",
      ar: "فكر في الأنشطة التي تعزز مزاجك ورفاهيتك",
    },
    continueMonitoring: {
      en: "Continue monitoring your health regularly",
      ar: "استمر في مراقبة صحتك بانتظام",
    },
    stayConsistent: {
      en: "Stay consistent with your medication schedule",
      ar: "حافظ على ثبات جدول الأدوية",
    },
    speakWithProvider: {
      en: "Consider speaking with your healthcare provider about your progress",
      ar: "فكر في التحدث مع مقدم الرعاية الصحية حول تقدمك",
    },
    unableToGenerate: {
      en: "Unable to generate summary due to data loading issues",
      ar: "تعذر إنشاء الملخص بسبب مشاكل تحميل البيانات",
    },
    morning: {
      en: "Morning",
      ar: "الصباح",
    },
    afternoon: {
      en: "Afternoon",
      ar: "بعد الظهر",
    },
    evening: {
      en: "Evening",
      ar: "المساء",
    },
    night: {
      en: "Night",
      ar: "الليل",
    },
    coOccurred: {
      en: `Co-occurred ${params?.count || 0} times`,
      ar: `حدث معًا ${params?.count || 0} مرات`,
    },
    symptomsRecorded: {
      en: `${params?.count || 0} symptoms recorded between ${params?.startHour || ""} and ${params?.endHour || ""}`,
      ar: `${params?.count || 0} أعراض مسجلة بين ${params?.startHour || ""} و ${params?.endHour || ""}`,
    },
    averageSeverity: {
      en: `Average severity: ${params?.value || 0}`,
      ar: `متوسط الشدة: ${params?.value || 0}`,
    },
    activeMedications: {
      en: `${params?.count || 0} active medications`,
      ar: `${params?.count || 0} أدوية نشطة`,
    },
    symptomsRecordedCount: {
      en: `${params?.count || 0} symptoms recorded`,
      ar: `${params?.count || 0} أعراض مسجلة`,
    },
  };

  const locale = isArabic ? "ar" : "en";
  return texts[key]?.[locale] || texts[key]?.en || key;
}

export type HealthSummary = {
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
};

export type HealthInsight = {
  type: "positive" | "neutral" | "concerning";
  title: string;
  description: string;
  metric?: string;
  change?: number;
  trend?: "improving" | "stable" | "declining";
};

export type HealthPattern = {
  type: "temporal" | "symptom" | "medication" | "lifestyle";
  title: string;
  description: string;
  confidence: number; // 0-1
  examples: string[];
  recommendation?: string;
};

export type HealthTrend = {
  metric: string;
  currentValue: number;
  previousValue: number;
  change: number;
  trend: "up" | "down" | "stable";
  period: string;
};

type PreviousPeriodData = {
  symptoms: Symptom[];
  medications: Medication[];
  moods: Mood[];
};

type OverviewMetrics = {
  totalSymptoms: number;
  averageSeverity: number;
  medicationAdherence: number;
  moodScore: number;
  healthScore: number;
};

type GenerateSummaryParams = {
  userId: string;
  period: "weekly" | "monthly";
  startDate: Date;
  endDate: Date;
  isArabic?: boolean;
};

type GenerateInsightsParams = {
  symptoms: Symptom[];
  medications: Medication[];
  moods: Mood[];
  previousData: PreviousPeriodData;
  period: "weekly" | "monthly";
  isArabic?: boolean;
};

type DetectPatternsParams = {
  symptoms: Symptom[];
  medications: Medication[];
  moods: Mood[];
  period: "weekly" | "monthly";
  isArabic?: boolean;
};

type CalculateTrendsParams = {
  symptoms: Symptom[];
  medications: Medication[];
  moods: Mood[];
  previousData: PreviousPeriodData;
  period: string;
};

class HealthSummaryService {
  /**
   * Generate weekly health summary
   */
  generateWeeklySummary(
    userId: string,
    weekStart?: Date,
    isArabic = false
  ): Promise<HealthSummary> {
    const startDate = weekStart || this.getWeekStart(new Date());
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    return this.generateSummary({
      userId,
      period: "weekly",
      startDate,
      endDate,
      isArabic,
    });
  }

  /**
   * Generate monthly health summary
   */
  generateMonthlySummary(
    userId: string,
    monthStart?: Date,
    isArabic = false
  ): Promise<HealthSummary> {
    const startDate = monthStart || this.getMonthStart(new Date());
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0); // Last day of the month

    return this.generateSummary({
      userId,
      period: "monthly",
      startDate,
      endDate,
      isArabic,
    });
  }

  /**
   * Generate health summary for a specific period
   */
  private async generateSummary({
    userId,
    period,
    startDate,
    endDate,
    isArabic = false,
  }: GenerateSummaryParams): Promise<HealthSummary> {
    try {
      // Fetch all relevant data for the period
      const [symptoms, medications, moods, previousPeriodData] =
        await Promise.all([
          this.getSymptomsInPeriod(userId, startDate, endDate),
          this.getMedicationsInPeriod(userId, startDate, endDate),
          this.getMoodsInPeriod(userId, startDate, endDate),
          this.getPreviousPeriodData(userId, period, startDate),
        ]);

      // Calculate overview metrics
      const overview = this.calculateOverviewMetrics(
        symptoms,
        medications,
        moods
      );

      // Generate insights
      const insights = this.generateInsights({
        symptoms,
        medications,
        moods,
        previousData: previousPeriodData,
        period,
        isArabic,
      });

      // Detect patterns
      const patterns = this.detectPatterns({
        symptoms,
        medications,
        moods,
        period,
        isArabic,
      });

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        insights,
        patterns,
        overview,
        isArabic
      );

      // Calculate trends
      const trends = this.calculateTrends({
        symptoms,
        medications,
        moods,
        previousData: previousPeriodData,
        period,
      });

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
    } catch (_error) {
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
        recommendations: [getLocalizedText("unableToGenerate", isArabic)],
        trends: [],
      };
    }
  }

  /**
   * Get symptoms within a date range
   */
  private async getSymptomsInPeriod(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Symptom[]> {
    try {
      const allSymptoms = await symptomService.getUserSymptoms(userId, 365);
      return allSymptoms.filter(
        (symptom) =>
          symptom.timestamp >= startDate && symptom.timestamp <= endDate
      );
    } catch (_error) {
      return [];
    }
  }

  /**
   * Get medications within a date range
   */
  private async getMedicationsInPeriod(
    userId: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<Medication[]> {
    try {
      return await medicationService.getUserMedications(userId);
    } catch (_error) {
      return [];
    }
  }

  /**
   * Get moods within a date range
   */
  private async getMoodsInPeriod(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Mood[]> {
    try {
      const allMoods = await moodService.getUserMoods(userId, 365);
      return allMoods.filter(
        (mood) => mood.timestamp >= startDate && mood.timestamp <= endDate
      );
    } catch (_error) {
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
    } catch (_error) {
      return { symptoms: [], medications: [], moods: [] };
    }
  }

  /**
   * Calculate overview metrics
   */
  private calculateOverviewMetrics(
    symptoms: Symptom[],
    medications: Medication[],
    moods: Mood[]
  ) {
    // Calculate average severity
    const avgSeverity =
      symptoms.length > 0
        ? symptoms.reduce((sum, s) => sum + s.severity, 0) / symptoms.length
        : 0;

    // Calculate medication adherence (simplified)
    const medicationAdherence =
      medications.length > 0
        ? (medications.filter((m) => m.isActive).length / medications.length) *
          100
        : 100;

    // Calculate average mood score
    const moodScore =
      moods.length > 0
        ? moods.reduce((sum: number, m: Mood) => sum + m.intensity, 0) /
          moods.length
        : 3; // Neutral default

    // Calculate health score (simplified algorithm)
    const healthScore = this.calculateHealthScore(
      avgSeverity,
      medicationAdherence,
      moodScore,
      symptoms.length
    );

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
    const severityScore = Math.max(0, 100 - avgSeverity * 20); // Lower severity = higher score
    const adherenceScore = medicationAdherence; // Direct percentage
    const moodScoreNormalized = (moodScore / 5) * 100; // Convert 1-5 scale to 0-100
    const activityScore = Math.max(0, 100 - symptomCount * 2); // Fewer symptoms = higher score

    // Weighted average
    const weights = {
      severity: 0.3,
      adherence: 0.25,
      mood: 0.25,
      activity: 0.2,
    };
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
  private generateInsights({
    symptoms,
    medications,
    moods,
    previousData,
    period,
    isArabic = false,
  }: GenerateInsightsParams): HealthInsight[] {
    const insights: HealthInsight[] = [];

    // Symptom insights
    if (symptoms.length > 0) {
      const avgSeverity =
        symptoms.reduce((sum: number, s: Symptom) => sum + s.severity, 0) /
        symptoms.length;
      const prevAvgSeverity =
        previousData.symptoms.length > 0
          ? previousData.symptoms.reduce(
              (sum: number, s: Symptom) => sum + s.severity,
              0
            ) / previousData.symptoms.length
          : avgSeverity;

      if (avgSeverity < prevAvgSeverity) {
        insights.push({
          type: "positive",
          title: getLocalizedText("symptomImprovement", isArabic),
          description: getLocalizedText("symptomImprovementDesc", isArabic, {
            period,
          }),
          metric: "severity",
          change: prevAvgSeverity - avgSeverity,
          trend: "improving",
        });
      } else if (avgSeverity > prevAvgSeverity) {
        insights.push({
          type: "concerning",
          title: getLocalizedText("increasedSymptoms", isArabic),
          description: getLocalizedText("increasedSymptomsDesc", isArabic, {
            period,
          }),
          metric: "severity",
          change: avgSeverity - prevAvgSeverity,
          trend: "declining",
        });
      }
    }

    // Medication adherence insights
    const activeMeds = medications.filter((m) => m.isActive).length;
    const prevActiveMeds = previousData.medications.filter(
      (m: Medication) => m.isActive
    ).length;

    if (activeMeds > prevActiveMeds) {
      insights.push({
        type: "neutral",
        title: getLocalizedText("newMedications", isArabic),
        description: getLocalizedText("newMedicationsDesc", isArabic, {
          count: activeMeds - prevActiveMeds,
          period,
        }),
      });
    }

    // Mood insights
    if (moods.length > 0) {
      const avgMood =
        moods.reduce((sum: number, m: Mood) => sum + m.intensity, 0) /
        moods.length;
      const prevAvgMood =
        previousData.moods.length > 0
          ? previousData.moods.reduce(
              (sum: number, m: Mood) => sum + m.intensity,
              0
            ) / previousData.moods.length
          : avgMood;

      if (avgMood > prevAvgMood + 0.5) {
        insights.push({
          type: "positive",
          title: getLocalizedText("improvedMood", isArabic),
          description: getLocalizedText("improvedMoodDesc", isArabic),
          trend: "improving",
        });
      } else if (avgMood < prevAvgMood - 0.5) {
        insights.push({
          type: "concerning",
          title: getLocalizedText("moodChanges", isArabic),
          description: getLocalizedText("moodChangesDesc", isArabic),
          trend: "declining",
        });
      }
    }

    return insights;
  }

  /**
   * Detect patterns in health data
   */
  private detectPatterns({
    symptoms,
    medications,
    moods: _moods,
    period: _period,
    isArabic = false,
  }: DetectPatternsParams): HealthPattern[] {
    const patterns: HealthPattern[] = [];

    // Temporal patterns (weekdays vs weekends)
    const weekdayVsWeekend = this.detectWeekdayWeekendPatterns(
      symptoms,
      isArabic
    );
    if (weekdayVsWeekend.confidence > 0.6) {
      patterns.push(weekdayVsWeekend);
    }

    // Time of day patterns
    const timeOfDayPatterns = this.detectTimeOfDayPatterns(symptoms, isArabic);
    if (timeOfDayPatterns.length > 0) {
      patterns.push(...timeOfDayPatterns);
    }

    // Symptom correlations
    const symptomCorrelations = this.detectSymptomCorrelations(
      symptoms,
      isArabic
    );
    if (symptomCorrelations.length > 0) {
      patterns.push(...symptomCorrelations);
    }

    // Medication effectiveness patterns
    const medicationPatterns = this.detectMedicationPatterns(
      symptoms,
      medications,
      isArabic
    );
    if (medicationPatterns.length > 0) {
      patterns.push(...medicationPatterns);
    }

    return patterns.slice(0, 5); // Limit to top 5 patterns
  }

  /**
   * Detect weekday vs weekend symptom patterns
   */
  private detectWeekdayWeekendPatterns(
    symptoms: Symptom[],
    isArabic = false
  ): HealthPattern {
    const weekdaySymptoms = symptoms.filter((s) => {
      const day = s.timestamp.getDay();
      return day >= 1 && day <= 5; // Monday to Friday
    });

    const weekendSymptoms = symptoms.filter((s) => {
      const day = s.timestamp.getDay();
      return day === 0 || day === 6; // Sunday or Saturday
    });

    const weekdayAvgSeverity =
      weekdaySymptoms.length > 0
        ? weekdaySymptoms.reduce((sum, s) => sum + s.severity, 0) /
          weekdaySymptoms.length
        : 0;

    const weekendAvgSeverity =
      weekendSymptoms.length > 0
        ? weekendSymptoms.reduce((sum, s) => sum + s.severity, 0) /
          weekendSymptoms.length
        : 0;

    const difference = Math.abs(weekendAvgSeverity - weekdayAvgSeverity);
    const confidence = Math.min(difference / 2, 1); // Scale confidence

    let description = "";
    let recommendation = "";

    if (weekendAvgSeverity > weekdayAvgSeverity + 0.5) {
      description = getLocalizedText("weekendSeverity", isArabic);
      recommendation = getLocalizedText("weekendRecommendation", isArabic);
    } else if (weekdayAvgSeverity > weekendAvgSeverity + 0.5) {
      description = getLocalizedText("weekdaySeverity", isArabic);
      recommendation = getLocalizedText("weekdayRecommendation", isArabic);
    } else {
      description = getLocalizedText("noSignificantDifference", isArabic);
    }

    return {
      type: "temporal",
      title: getLocalizedText("weekdayWeekendPattern", isArabic),
      description,
      confidence,
      examples: [
        getLocalizedText("weekdayAvgSeverity", isArabic, {
          value: weekdayAvgSeverity.toFixed(1),
        }),
        getLocalizedText("weekendAvgSeverity", isArabic, {
          value: weekendAvgSeverity.toFixed(1),
        }),
      ],
      recommendation,
    };
  }

  /**
   * Detect time of day patterns
   */
  private detectTimeOfDayPatterns(
    symptoms: Symptom[],
    isArabic = false
  ): HealthPattern[] {
    const patterns: HealthPattern[] = [];
    const hourGroups = symptoms.reduce(
      (acc, symptom) => {
        const hour = symptom.timestamp.getHours();
        if (!acc[hour]) {
          acc[hour] = [];
        }
        acc[hour].push(symptom);
        return acc;
      },
      {} as Record<number, Symptom[]>
    );

    // Find hours with highest symptom frequency
    const hourStats = Object.entries(hourGroups)
      .map(([hour, groupedSymptoms]) => ({
        hour: Number.parseInt(hour, 10),
        count: groupedSymptoms.length,
        avgSeverity:
          groupedSymptoms.reduce((sum, s) => sum + s.severity, 0) /
          groupedSymptoms.length,
      }))
      .sort((a, b) => b.count - a.count);

    if (hourStats.length > 0 && hourStats[0].count >= 3) {
      const peakHour = hourStats[0].hour;
      const timeOfDay = this.getTimeOfDayLabel(peakHour, isArabic);

      patterns.push({
        type: "temporal",
        title: getLocalizedText("symptomPattern", isArabic, { timeOfDay }),
        description: getLocalizedText("symptomPatternDesc", isArabic, {
          timeOfDay: timeOfDay.toLowerCase(),
          hour: this.formatHour(peakHour),
        }),
        confidence: Math.min(hourStats[0].count / 10, 1),
        examples: [
          getLocalizedText("symptomsRecorded", isArabic, {
            count: hourStats[0].count,
            startHour: this.formatHour(peakHour),
            endHour: this.formatHour(peakHour + 1),
          }),
          getLocalizedText("averageSeverity", isArabic, {
            value: hourStats[0].avgSeverity.toFixed(1),
          }),
        ],
        recommendation: getLocalizedText(
          "symptomPatternRecommendation",
          isArabic,
          { timeOfDay: timeOfDay.toLowerCase() }
        ),
      });
    }

    return patterns;
  }

  /**
   * Detect symptom correlations
   */
  private detectSymptomCorrelations(
    symptoms: Symptom[],
    isArabic = false
  ): HealthPattern[] {
    const patterns: HealthPattern[] = [];

    // Find frequently co-occurring symptoms
    const coOccurrences: Record<string, Record<string, number>> = {};

    for (const symptom of symptoms) {
      const sameDaySymptoms = symptoms.filter(
        (s) =>
          s.timestamp.toDateString() === symptom.timestamp.toDateString() &&
          s.id !== symptom.id
      );

      for (const coSymptom of sameDaySymptoms) {
        if (!coOccurrences[symptom.type]) {
          coOccurrences[symptom.type] = {};
        }
        coOccurrences[symptom.type][coSymptom.type] =
          (coOccurrences[symptom.type][coSymptom.type] || 0) + 1;
      }
    }

    // Find strong correlations
    for (const [symptom, correlations] of Object.entries(coOccurrences)) {
      for (const [coSymptom, count] of Object.entries(correlations)) {
        if (count >= 3) {
          patterns.push({
            type: "symptom",
            title: getLocalizedText("symptomCorrelation", isArabic),
            description: getLocalizedText("symptomCorrelationDesc", isArabic, {
              symptom1: symptom,
              symptom2: coSymptom,
            }),
            confidence: Math.min(count / 10, 1),
            examples: [getLocalizedText("coOccurred", isArabic, { count })],
            recommendation: getLocalizedText(
              "symptomCorrelationRecommendation",
              isArabic
            ),
          });
        }
      }
    }

    return patterns.slice(0, 3); // Limit to top 3 correlations
  }

  /**
   * Detect medication effectiveness patterns
   */
  private detectMedicationPatterns(
    symptoms: Symptom[],
    medications: Medication[],
    isArabic = false
  ): HealthPattern[] {
    const patterns: HealthPattern[] = [];

    // This is a simplified analysis - in practice, you'd need more sophisticated
    // time-series analysis to determine medication effectiveness
    const activeMedications = medications.filter((m) => m.isActive);

    if (activeMedications.length > 0 && symptoms.length > 5) {
      patterns.push({
        type: "medication",
        title: getLocalizedText("medicationEffectiveness", isArabic),
        description: getLocalizedText("medicationEffectivenessDesc", isArabic),
        confidence: 0.7,
        examples: [
          getLocalizedText("activeMedications", isArabic, {
            count: activeMedications.length,
          }),
          getLocalizedText("symptomsRecordedCount", isArabic, {
            count: symptoms.length,
          }),
        ],
        recommendation: getLocalizedText(
          "medicationEffectivenessRecommendation",
          isArabic
        ),
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
    overview: OverviewMetrics,
    isArabic = false
  ): string[] {
    const recommendations: string[] = [];

    // Based on insights
    for (const insight of insights) {
      if (insight.type === "positive") {
        recommendations.push(
          getLocalizedText("keepUpGoodWork", isArabic, {
            topic: insight.title.toLowerCase(),
          })
        );
      } else if (insight.type === "concerning") {
        recommendations.push(
          getLocalizedText("consultProvider", isArabic, {
            topic: insight.title.toLowerCase(),
          })
        );
      }
    }

    // Based on patterns
    for (const pattern of patterns) {
      if (pattern.recommendation) {
        recommendations.push(pattern.recommendation);
      }
    }

    // Based on overview metrics
    if (overview.medicationAdherence < 80) {
      recommendations.push(getLocalizedText("setReminders", isArabic));
    }

    if (overview.totalSymptoms > 10) {
      recommendations.push(getLocalizedText("symptomDiary", isArabic));
    }

    if (overview.moodScore < 3) {
      recommendations.push(getLocalizedText("boostMood", isArabic));
    }

    // Default recommendations if none generated
    if (recommendations.length === 0) {
      recommendations.push(getLocalizedText("continueMonitoring", isArabic));
      recommendations.push(getLocalizedText("stayConsistent", isArabic));
      recommendations.push(getLocalizedText("speakWithProvider", isArabic));
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Calculate trends compared to previous period
   */
  private calculateTrends({
    symptoms,
    medications: _medications,
    moods,
    previousData,
    period,
  }: CalculateTrendsParams): HealthTrend[] {
    const trends: HealthTrend[] = [];
    const getDirection = (
      currentValue: number,
      previousValue: number
    ): "up" | "down" | "stable" => {
      if (currentValue > previousValue) {
        return "up";
      }
      if (currentValue < previousValue) {
        return "down";
      }
      return "stable";
    };

    // Symptom count trend
    const currentSymptomCount = symptoms.length;
    const previousSymptomCount = previousData.symptoms.length;
    trends.push({
      metric: "Symptoms",
      currentValue: currentSymptomCount,
      previousValue: previousSymptomCount,
      change: currentSymptomCount - previousSymptomCount,
      trend: getDirection(currentSymptomCount, previousSymptomCount),
      period,
    });

    // Average severity trend
    const currentAvgSeverity =
      symptoms.length > 0
        ? symptoms.reduce((sum: number, s: Symptom) => sum + s.severity, 0) /
          symptoms.length
        : 0;
    const previousAvgSeverity =
      previousData.symptoms.length > 0
        ? previousData.symptoms.reduce(
            (sum: number, s: Symptom) => sum + s.severity,
            0
          ) / previousData.symptoms.length
        : 0;
    trends.push({
      metric: "Average Severity",
      currentValue: Math.round(currentAvgSeverity * 10) / 10,
      previousValue: Math.round(previousAvgSeverity * 10) / 10,
      change: currentAvgSeverity - previousAvgSeverity,
      trend: getDirection(currentAvgSeverity, previousAvgSeverity),
      period,
    });

    // Mood trend
    const currentAvgMood =
      moods.length > 0
        ? moods.reduce((sum: number, m: Mood) => sum + m.intensity, 0) /
          moods.length
        : 3;
    const previousAvgMood =
      previousData.moods.length > 0
        ? previousData.moods.reduce(
            (sum: number, m: Mood) => sum + m.intensity,
            0
          ) / previousData.moods.length
        : 3;
    trends.push({
      metric: "Mood",
      currentValue: Math.round(currentAvgMood * 10) / 10,
      previousValue: Math.round(previousAvgMood * 10) / 10,
      change: currentAvgMood - previousAvgMood,
      trend: getDirection(currentAvgMood, previousAvgMood),
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
  private getTimeOfDayLabel(hour: number, isArabic = false): string {
    if (hour >= 5 && hour < 12) {
      return getLocalizedText("morning", isArabic);
    }
    if (hour >= 12 && hour < 17) {
      return getLocalizedText("afternoon", isArabic);
    }
    if (hour >= 17 && hour < 21) {
      return getLocalizedText("evening", isArabic);
    }
    return getLocalizedText("night", isArabic);
  }

  /**
   * Helper: Format hour for display
   */
  private formatHour(hour: number): string {
    let displayHour = hour;
    if (hour === 0) {
      displayHour = 12;
    } else if (hour > 12) {
      displayHour = hour - 12;
    }
    const ampm = hour >= 12 ? "PM" : "AM";
    return `${displayHour}:00 ${ampm}`;
  }
}

export const healthSummaryService = new HealthSummaryService();
