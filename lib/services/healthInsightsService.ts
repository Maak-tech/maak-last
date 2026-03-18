/* biome-ignore-all lint/complexity/noForEach: Existing aggregation loops are stable and kept as-is in this patch. */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Insight engine refactor is deferred to a separate task. */
/* biome-ignore-all lint/style/noNestedTernary: Locale-dependent branching remains in current structure. */
/* biome-ignore-all lint/suspicious/noExplicitAny: Third-party payload typing remains partially dynamic for now. */
/* biome-ignore-all lint/nursery/useMaxParams: Current method signature is preserved for backward compatibility. */
import { api } from "@/lib/apiClient";
import type { Medication, Mood, Symptom } from "@/types";
import {
  calculateMedicationCompliance,
  generatePredictiveInsights,
  rankInsights,
} from "./healthInsightScoringService";
import {
  detectIntegrationSpecificInsights,
  detectMedicationCorrelations,
  detectTemporalPatterns,
  detectTrends,
  detectVitalRanges,
  detectVitalTrends,
} from "./healthPatternDetectionService";
import { medicationService } from "./medicationService";
import { symptomService } from "./symptomService";

export type PatternInsight = {
  type: "temporal" | "correlation" | "trend" | "recommendation" | "ml";
  title: string;
  description: string;
  confidence: number; // 0-100
  data?: any;
  actionable?: boolean;
  recommendation?: string;
};

type VitalSample = {
  id: string;
  type: string;
  value: number;
  unit?: string;
  timestamp: Date;
  source?: string;
};

// Localization helper for insights
const getLocalizedInsightText = (
  key: string,
  isArabic: boolean,
  params?: Record<string, string | number>
): { title: string; description: string; recommendation?: string } => {
  const texts: Record<
    string,
    {
      en: { title: string; description: string; recommendation?: string };
      ar: { title: string; description: string; recommendation?: string };
    }
  > = {
    weekendSymptomPattern: {
      en: {
        title: "Weekend Symptom Pattern",
        description:
          "Your symptoms tend to be more frequent on weekends. This could be related to changes in routine, stress, or activity levels.",
        recommendation:
          "Consider maintaining a consistent routine on weekends and monitor what activities might trigger symptoms.",
      },
      ar: {
        title: "نمط الأعراض في نهاية الأسبوع",
        description:
          "تميل أعراضك إلى أن تكون أكثر تكراراً في عطلات نهاية الأسبوع. قد يكون هذا مرتبطاً بتغييرات في الروتين أو التوتر أو مستويات النشاط.",
        recommendation:
          "حاول الحفاظ على روتين ثابت في عطلات نهاية الأسبوع وراقب الأنشطة التي قد تسبب الأعراض.",
      },
    },
    betterMoodsWeekends: {
      en: {
        title: "Better Moods on Weekends",
        description:
          "Your mood tends to be better on weekends. This suggests work or weekday activities may be affecting your well-being.",
        recommendation:
          "Consider what makes weekends better and try to incorporate those elements into your weekdays.",
      },
      ar: {
        title: "مزاج أفضل في نهاية الأسبوع",
        description:
          "يميل مزاجك إلى أن يكون أفضل في عطلات نهاية الأسبوع. هذا يشير إلى أن العمل أو أنشطة أيام الأسبوع قد تؤثر على صحتك النفسية.",
        recommendation:
          "فكر فيما يجعل عطلات نهاية الأسبوع أفضل وحاول دمج هذه العناصر في أيام الأسبوع.",
      },
    },
    medicationEffectiveness: {
      en: {
        title: `${params?.medicationName || "Medication"} Effectiveness`,
        description: `Your symptoms have decreased by ${params?.improvement || 0}% since starting ${params?.medicationName || "the medication"}. This suggests the medication may be helping.`,
      },
      ar: {
        title: `فعالية ${params?.medicationName || "الدواء"}`,
        description: `انخفضت أعراضك الصحية بنسبة ${params?.improvement || 0}% منذ بدء تناول ${params?.medicationName || "الدواء"}. هذا يشير إلى أن الدواء قد يكون مفيداً.`,
      },
    },
    increasingSymptomSeverity: {
      en: {
        title: "Increasing Symptom Severity",
        description:
          "Your symptoms have been more severe in the last 2 weeks compared to before. Consider discussing this with your healthcare provider.",
        recommendation:
          "Monitor your symptoms closely and consider scheduling a check-up if the trend continues.",
      },
      ar: {
        title: "زيادة شدة الأعراض",
        description:
          "كانت أعراضك أكثر شدة في الأسبوعين الأخيرين مقارنة بالسابق. فكر في مناقشة هذا مع مقدم الرعاية الصحية.",
        recommendation:
          "راقب أعراضك عن كثب وفكر في تحديد موعد للفحص إذا استمر هذا الاتجاه.",
      },
    },
    improvingSymptomSeverity: {
      en: {
        title: "Improving Symptom Severity",
        description:
          "Great news! Your symptoms have been less severe recently. Keep up whatever you're doing.",
      },
      ar: {
        title: "تحسن شدة الأعراض",
        description:
          "أخبار رائعة! كانت أعراضك الصحية أقل شدة مؤخراً. استمر في ما تفعله.",
      },
    },
    improvingMood: {
      en: {
        title: "Improving Mood",
        description:
          "Your mood has been improving over time. This is a positive trend!",
      },
      ar: {
        title: "تحسن المزاج النفسي",
        description: "يتحسن مزاجك النفسي بمرور الوقت. هذا اتجاه إيجابي!",
      },
    },
    decliningMood: {
      en: {
        title: "Declining Mood",
        description:
          "Your mood has been declining recently. Consider talking to someone or seeking support.",
        recommendation:
          "Consider speaking with a mental health professional or trusted friend about how you're feeling.",
      },
      ar: {
        title: "انخفاض المزاج النفسي",
        description:
          "انخفض مزاجك النفسي مؤخراً. فكر في التحدث مع شخص ما أو طلب الدعم.",
        recommendation:
          "فكر في التحدث مع متخصص في الصحة النفسية أو صديق موثوق حول ما تشعر به.",
      },
    },
    medicationAdherence: {
      en: {
        title: "Medication Adherence",
        description:
          "Consistent medication adherence is important for managing your health conditions.",
        recommendation:
          "Set reminders and try to take medications at the same time each day.",
      },
      ar: {
        title: "الالتزام بالدواء",
        description: "الالتزام المستمر بتناول الأدوية مهم لإدارة حالتك الصحية.",
        recommendation: "اضبط تذكيرات وحاول تناول الأدوية في نفس الوقت كل يوم.",
      },
    },
    frequentSymptoms: {
      en: {
        title: "Frequent Symptoms",
        description:
          "You've been experiencing symptoms frequently this week. Consider tracking triggers and patterns.",
        recommendation:
          "Keep a detailed log of when symptoms occur, what you were doing, and what you ate to identify patterns.",
      },
      ar: {
        title: "أعراض صحية متكررة",
        description:
          "كنت تعاني من أعراض متكررة هذا الأسبوع. فكر في تتبع المحفزات والأنماط.",
        recommendation:
          "احتفظ بسجل مفصل لوقت حدوث الأعراض، وما كنت تفعله، وما أكلته لتحديد الأنماط.",
      },
    },
    mentalWellbeing: {
      en: {
        title: "Mental Well-being",
        description:
          "You've been experiencing more negative moods recently. Self-care is important.",
        recommendation:
          "Consider activities that help you relax, such as exercise, meditation, or spending time with loved ones.",
      },
      ar: {
        title: "الصحة النفسية",
        description:
          "كنت تعاني من مزاج نفسي سلبي أكثر مؤخراً. الرعاية الذاتية مهمة.",
        recommendation:
          "فكر في الأنشطة التي تساعدك على الاسترخاء، مثل التمارين الرياضية أو التأمل أو قضاء الوقت مع أحبائك.",
      },
    },
    vitalTrendInsight: {
      en: {
        title: `${params?.vitalType || "Vital"} Trend`,
        description: `Your ${params?.vitalType || "vital signs"} have been ${params?.trend || "changing"} by about ${params?.change || 0}%.`,
        recommendation:
          "Consider monitoring this trend and discuss it with your healthcare provider if it continues.",
      },
      ar: {
        title: `اتجاه ${params?.vitalType || "المؤشرات الحيوية"}`,
        description: `كانت ${params?.vitalType || "المؤشرات الحيوية"} لديك ${params?.trend || "تتغير"} بنسبة حوالي ${params?.change || 0}%.`,
        recommendation:
          "فكر في مراقبة هذا الاتجاه ومناقشته مع مقدم الرعاية الصحية إذا استمر.",
      },
    },
    integrationSleepLow: {
      en: {
        title: `Low Sleep Duration (${params?.provider || "Integration"})`,
        description: `Based on your ${params?.provider || "integration"} data, you're averaging ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""} of sleep recently.`,
        recommendation:
          "Consider a consistent bedtime routine and reducing screen time before bed.",
      },
      ar: {
        title: `نقص مدة النوم (${params?.provider || "التكامل"})`,
        description: `استناداً إلى بيانات ${params?.provider || "التكامل"}، متوسط نومك مؤخراً هو ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""}.`,
        recommendation: "فكر في روتين نوم ثابت وتقليل وقت الشاشة قبل النوم.",
      },
    },
    integrationGlucoseHigh: {
      en: {
        title: `High Glucose Readings (${params?.provider || "Integration"})`,
        description: `Your recent glucose average is ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""} based on ${params?.provider || "integration"} data.`,
        recommendation:
          "Track meals and discuss persistent high readings with your healthcare provider.",
      },
      ar: {
        title: `ارتفاع قراءات السكر (${params?.provider || "التكامل"})`,
        description: `متوسط قراءات السكر الأخيرة هو ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""} استناداً إلى بيانات ${params?.provider || "التكامل"}.`,
        recommendation:
          "تتبع الوجبات وناقش الارتفاع المستمر مع مقدم الرعاية الصحية.",
      },
    },
    integrationGlucoseLow: {
      en: {
        title: `Low Glucose Readings (${params?.provider || "Integration"})`,
        description: `Your recent glucose average is ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""} based on ${params?.provider || "integration"} data.`,
        recommendation:
          "Monitor for symptoms and discuss low readings with your healthcare provider.",
      },
      ar: {
        title: `انخفاض قراءات السكر (${params?.provider || "التكامل"})`,
        description: `متوسط قراءات السكر الأخيرة هو ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""} استناداً إلى بيانات ${params?.provider || "التكامل"}.`,
        recommendation: "راقب الأعراض وناقش الانخفاض مع مقدم الرعاية الصحية.",
      },
    },
    integrationLowSteps: {
      en: {
        title: `Low Activity (${params?.provider || "Integration"})`,
        description: `Your recent steps average is ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""} based on ${params?.provider || "integration"} data.`,
        recommendation:
          "Try short walks or light activity to build a consistent daily baseline.",
      },
      ar: {
        title: `انخفاض النشاط (${params?.provider || "التكامل"})`,
        description: `متوسط خطواتك مؤخراً هو ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""} استناداً إلى بيانات ${params?.provider || "التكامل"}.`,
        recommendation: "جرّب المشي القصير أو نشاطاً خفيفاً لبناء أساس يومي ثابت.",
      },
    },
    integrationLowHrv: {
      en: {
        title: `Low HRV (${params?.provider || "Integration"})`,
        description: `Your recent HRV average is ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""} based on ${params?.provider || "integration"} data.`,
        recommendation:
          "Consider rest, hydration, and stress‑reduction to support recovery.",
      },
      ar: {
        title: `انخفاض HRV (${params?.provider || "التكامل"})`,
        description: `متوسط HRV الأخير هو ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""} استناداً إلى بيانات ${params?.provider || "التكامل"}.`,
        recommendation: "فكر في الراحة والترطيب وتقليل التوتر لدعم التعافي.",
      },
    },
    integrationIrregularSleep: {
      en: {
        title: `Irregular Sleep Pattern (${params?.provider || "Integration"})`,
        description: `Your sleep duration varies by about ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""} recently.`,
        recommendation:
          "Try keeping a consistent sleep and wake time to improve recovery.",
      },
      ar: {
        title: `نمط نوم غير منتظم (${params?.provider || "التكامل"})`,
        description: `يتفاوت وقت نومك بحوالي ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""} مؤخراً.`,
        recommendation: "حاول تثبيت وقت النوم والاستيقاظ لتحسين التعافي.",
      },
    },
    vitalOutOfRangeHigh: {
      en: {
        title: `${params?.vitalType || "Vital"} Above Typical Range`,
        description: `Your recent ${params?.vitalType || "vital"} readings average ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""}, which is higher than typical.`,
        recommendation:
          "Keep tracking this metric and consider discussing it with your healthcare provider.",
      },
      ar: {
        title: `${params?.vitalType || "المؤشرات الحيوية"} أعلى من المعتاد`,
        description: `متوسط قياسات ${params?.vitalType || "المؤشرات الحيوية"} الأخيرة هو ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""}، وهو أعلى من المعتاد.`,
        recommendation:
          "استمر في تتبع هذا القياس وفكر في مناقشته مع مقدم الرعاية الصحية.",
      },
    },
    vitalOutOfRangeLow: {
      en: {
        title: `${params?.vitalType || "Vital"} Below Typical Range`,
        description: `Your recent ${params?.vitalType || "vital"} readings average ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""}, which is lower than typical.`,
        recommendation:
          "Keep tracking this metric and consider discussing it with your healthcare provider.",
      },
      ar: {
        title: `${params?.vitalType || "المؤشرات الحيوية"} أقل من المعتاد`,
        description: `متوسط قياسات ${params?.vitalType || "المؤشرات الحيوية"} الأخيرة هو ${params?.value || 0}${params?.unit ? ` ${params.unit}` : ""}، وهو أقل من المعتاد.`,
        recommendation:
          "استمر في تتبع هذا القياس وفكر في مناقشته مع مقدم الرعاية الصحية.",
      },
    },
  };

  const locale = isArabic ? "ar" : "en";
  return (
    texts[key]?.[locale] || texts[key]?.en || { title: key, description: "" }
  );
};

export type WeeklySummary = {
  weekStart: Date;
  weekEnd: Date;
  symptoms: {
    total: number;
    averageSeverity: number;
    mostCommon: Array<{ type: string; count: number }>;
    trend: "increasing" | "decreasing" | "stable";
  };
  medications: {
    compliance: number;
    totalMedications: number;
    missedDoses: number;
  };
  moods: {
    averageIntensity: number;
    mostCommon: Mood["mood"];
    trend: "improving" | "declining" | "stable";
  };
  insights: PatternInsight[];
  /** Daily data for chart/sparkline display (7 days, Sun–Sat) */
  dailyChartData?: {
    symptomCounts: number[];
    symptomSeverities: number[];
    moodIntensities: number[];
  };
};

export type MonthlySummary = {
  month: number;
  year: number;
  symptoms: {
    total: number;
    averageSeverity: number;
    mostCommon: Array<{ type: string; count: number }>;
  };
  medications: {
    compliance: number;
    totalMedications: number;
  };
  moods: {
    averageIntensity: number;
    mostCommon: Mood["mood"];
  };
  insights: PatternInsight[];
  recommendations: string[];
};

class HealthInsightsService {
  // Uses getLocalizedInsightText from this module (localization dict stays here)
  private generateRecommendations(
    symptoms: Symptom[],
    medications: Medication[],
    moods: Mood[],
    isArabic = false
  ): PatternInsight[] {
    const insights: PatternInsight[] = [];

    const activeMedications = medications.filter((m) => m.isActive);
    if (activeMedications.length > 0) {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const { compliance } = calculateMedicationCompliance(
        medications,
        start,
        end
      );
      if (compliance < 85) {
        const localizedText = getLocalizedInsightText(
          "medicationAdherence",
          isArabic
        );
        insights.push({
          type: "recommendation",
          title: localizedText.title,
          description: localizedText.description,
          confidence: 80,
          actionable: true,
          recommendation: localizedText.recommendation,
          data: { compliance },
        });
      }
    }

    const recentSymptoms = symptoms.filter(
      (s) => s.timestamp >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    if (recentSymptoms.length > 5) {
      const localizedText = getLocalizedInsightText(
        "frequentSymptoms",
        isArabic
      );
      insights.push({
        type: "recommendation",
        title: localizedText.title,
        description: localizedText.description,
        confidence: 75,
        actionable: true,
        recommendation: localizedText.recommendation,
      });
    }

    const negativeMoods: Mood["mood"][] = [
      "sad",
      "anxious",
      "stressed",
      "tired",
      "overwhelmed",
    ];
    const recentMoods = moods.slice(0, 7);
    const negativeMoodCount = recentMoods.filter((m) =>
      negativeMoods.includes(m.mood)
    ).length;

    if (negativeMoodCount > recentMoods.length * 0.5) {
      const localizedText = getLocalizedInsightText(
        "mentalWellbeing",
        isArabic
      );
      insights.push({
        type: "recommendation",
        title: localizedText.title,
        description: localizedText.description,
        confidence: 70,
        actionable: true,
        recommendation: localizedText.recommendation,
      });
    }

    return insights;
  }

  /**
   * Get weekly health summary
   */
  async getWeeklySummary(
    userId: string,
    weekStart?: Date,
    isArabic = false
  ): Promise<WeeklySummary> {
    const start = weekStart || new Date();
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const prevWeekStart = new Date(start);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const [symptoms, medications, moodsData, weekVitals] = await Promise.all([
      symptomService.getUserSymptoms(userId, 50),
      medicationService.getUserMedications(userId),
      this.getMoodsForPeriod(userId, prevWeekStart, end),
      this.getVitalsForPeriod(userId, start, end),
    ]);

    const weekSymptoms = symptoms.filter(
      (s) => s.timestamp >= start && s.timestamp < end
    );
    const weekMoods = moodsData.filter(
      (m) => m.timestamp >= start && m.timestamp < end
    );

    const symptomCounts: Record<string, number> = {};
    weekSymptoms.forEach((s) => {
      symptomCounts[s.type] = (symptomCounts[s.type] || 0) + 1;
    });

    const mostCommonSymptoms = Object.entries(symptomCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const avgSeverity =
      weekSymptoms.length > 0
        ? weekSymptoms.reduce((sum, s) => sum + s.severity, 0) /
          weekSymptoms.length
        : 0;

    const prevWeekEnd = new Date(start);
    const prevWeekSymptoms = symptoms.filter(
      (s) => s.timestamp >= prevWeekStart && s.timestamp < prevWeekEnd
    );

    let symptomTrend: "increasing" | "decreasing" | "stable" = "stable";
    if (prevWeekSymptoms.length > 0) {
      if (weekSymptoms.length > prevWeekSymptoms.length * 1.2) {
        symptomTrend = "increasing";
      } else if (weekSymptoms.length < prevWeekSymptoms.length * 0.8) {
        symptomTrend = "decreasing";
      }
    }

    const { compliance, missedDoses } = calculateMedicationCompliance(
      medications,
      start,
      end
    );

    const moodCounts: Record<Mood["mood"], number> = {} as any;
    weekMoods.forEach((m) => {
      moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1;
    });

    const mostCommonMood = Object.entries(moodCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] as Mood["mood"] | undefined;

    const avgMoodIntensity =
      weekMoods.length > 0
        ? weekMoods.reduce((sum, m) => sum + m.intensity, 0) / weekMoods.length
        : 0;

    const prevWeekMoods = moodsData.filter(
      (m) => m.timestamp >= prevWeekStart && m.timestamp < prevWeekEnd
    );
    let moodTrend: "improving" | "declining" | "stable" = "stable";
    if (prevWeekMoods.length > 0 && weekMoods.length > 0) {
      const prevAvg =
        prevWeekMoods.reduce((sum, m) => sum + m.intensity, 0) /
        prevWeekMoods.length;
      if (avgMoodIntensity > prevAvg + 0.3) {
        moodTrend = "improving";
      } else if (avgMoodIntensity < prevAvg - 0.3) {
        moodTrend = "declining";
      }
    }

    const allInsights = rankInsights([
      ...detectTemporalPatterns(weekSymptoms, weekMoods, isArabic),
      ...detectMedicationCorrelations(weekSymptoms, medications, isArabic),
      ...detectTrends(weekSymptoms, weekMoods, isArabic, userId, false),
      ...detectVitalTrends(weekVitals, isArabic, userId, false),
      ...detectVitalRanges(weekVitals, isArabic),
      ...detectIntegrationSpecificInsights(weekVitals, isArabic),
      ...generatePredictiveInsights(
        weekSymptoms,
        medications,
        weekMoods,
        weekVitals,
        start,
        end,
        isArabic
      ),
      ...this.generateRecommendations(
        weekSymptoms,
        medications,
        weekMoods,
        isArabic
      ),
    ]);

    const symptomCountsByDay: number[] = [];
    const symptomSeveritiesByDay: number[] = [];
    const moodIntensitiesByDay: number[] = [];

    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(start);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const daySymptoms = weekSymptoms.filter(
        (s) => s.timestamp >= dayStart && s.timestamp < dayEnd
      );
      const dayMoods = weekMoods.filter(
        (m) => m.timestamp >= dayStart && m.timestamp < dayEnd
      );

      symptomCountsByDay.push(daySymptoms.length);
      symptomSeveritiesByDay.push(
        daySymptoms.length > 0
          ? daySymptoms.reduce((sum, s) => sum + s.severity, 0) /
              daySymptoms.length
          : 0
      );
      moodIntensitiesByDay.push(
        dayMoods.length > 0
          ? dayMoods.reduce((sum, m) => sum + m.intensity, 0) / dayMoods.length
          : 0
      );
    }

    return {
      weekStart: start,
      weekEnd: end,
      symptoms: {
        total: weekSymptoms.length,
        averageSeverity: Math.round(avgSeverity * 10) / 10,
        mostCommon: mostCommonSymptoms,
        trend: symptomTrend,
      },
      medications: {
        compliance: Math.round(compliance),
        totalMedications: medications.filter((m) => m.isActive).length,
        missedDoses,
      },
      moods: {
        averageIntensity: Math.round(avgMoodIntensity * 10) / 10,
        mostCommon: mostCommonMood || "neutral",
        trend: moodTrend,
      },
      insights: allInsights.slice(0, 5),
      dailyChartData: {
        symptomCounts: symptomCountsByDay,
        symptomSeverities: symptomSeveritiesByDay,
        moodIntensities: moodIntensitiesByDay,
      },
    };
  }

  private async getMoodsForPeriod(
    _userId: string,
    start: Date,
    end: Date
  ): Promise<Mood[]> {
    try {
      const daysDiff = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      const fetchLimit = Math.min(Math.max(daysDiff * 5, 50), 500);
      const rows = await api.get<Record<string, unknown>[]>(
        `/api/health/moods?from=${encodeURIComponent(start.toISOString())}&limit=${fetchLimit}`
      );
      return rows.map((m) => ({
        id: m.id as string,
        userId: m.userId as string,
        mood: m.mood as Mood["mood"],
        intensity: m.intensity as Mood["intensity"],
        notes: m.notes as string | undefined,
        activities: m.activities as string[] | undefined,
        timestamp: new Date(m.recordedAt as string),
      }));
    } catch (_error) {
      return [];
    }
  }

  /**
   * Get monthly health summary
   */
  async getMonthlySummary(
    userId: string,
    month?: number,
    year?: number,
    isArabic = false
  ): Promise<MonthlySummary> {
    const now = new Date();
    const targetMonth = month ?? now.getMonth();
    const targetYear = year ?? now.getFullYear();

    const start = new Date(targetYear, targetMonth, 1);
    const end = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    const [symptoms, medications, moodsData, monthVitals] = await Promise.all([
      symptomService.getUserSymptoms(userId, 100),
      medicationService.getUserMedications(userId),
      this.getMoodsForPeriod(userId, start, end),
      this.getVitalsForPeriod(userId, start, end),
    ]);

    const monthSymptoms = symptoms.filter(
      (s) => s.timestamp >= start && s.timestamp <= end
    );
    const monthMoods = moodsData.filter(
      (m) => m.timestamp >= start && m.timestamp <= end
    );

    const symptomCounts: Record<string, number> = {};
    monthSymptoms.forEach((s) => {
      symptomCounts[s.type] = (symptomCounts[s.type] || 0) + 1;
    });

    const mostCommonSymptoms = Object.entries(symptomCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const avgSeverity =
      monthSymptoms.length > 0
        ? monthSymptoms.reduce((sum, s) => sum + s.severity, 0) /
          monthSymptoms.length
        : 0;

    const { compliance } = calculateMedicationCompliance(
      medications,
      start,
      end
    );

    const moodCounts: Record<Mood["mood"], number> = {} as any;
    monthMoods.forEach((m) => {
      moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1;
    });

    const mostCommonMood = Object.entries(moodCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] as Mood["mood"] | undefined;

    const avgMoodIntensity =
      monthMoods.length > 0
        ? monthMoods.reduce((sum, m) => sum + m.intensity, 0) /
          monthMoods.length
        : 0;

    const allInsights = rankInsights([
      ...detectTemporalPatterns(monthSymptoms, monthMoods, isArabic),
      ...detectMedicationCorrelations(monthSymptoms, medications, isArabic),
      ...detectTrends(monthSymptoms, monthMoods, isArabic, userId, false),
      ...detectVitalTrends(monthVitals, isArabic, userId, false),
      ...detectVitalRanges(monthVitals, isArabic),
      ...detectIntegrationSpecificInsights(monthVitals, isArabic),
      ...generatePredictiveInsights(
        monthSymptoms,
        medications,
        monthMoods,
        monthVitals,
        start,
        end,
        isArabic
      ),
      ...this.generateRecommendations(
        monthSymptoms,
        medications,
        monthMoods,
        isArabic
      ),
    ]);

    const recommendations: string[] = [];
    allInsights
      .filter((i) => i.actionable && i.recommendation)
      .forEach((i) => {
        if (i.recommendation) {
          recommendations.push(i.recommendation);
        }
      });

    return {
      month: targetMonth,
      year: targetYear,
      symptoms: {
        total: monthSymptoms.length,
        averageSeverity: Math.round(avgSeverity * 10) / 10,
        mostCommon: mostCommonSymptoms,
      },
      medications: {
        compliance: Math.round(compliance),
        totalMedications: medications.filter((m) => m.isActive).length,
      },
      moods: {
        averageIntensity: Math.round(avgMoodIntensity * 10) / 10,
        mostCommon: mostCommonMood || "neutral",
      },
      insights: allInsights.slice(0, 10),
      recommendations: [...new Set(recommendations)].slice(0, 5),
    };
  }

  /**
   * Get all insights for a user
   */
  async getAllInsights(
    userId: string,
    isArabic = false
  ): Promise<PatternInsight[]> {
    const rangeStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rangeEnd = new Date();
    const [symptoms, medications, moodsData, vitals] = await Promise.all([
      symptomService.getUserSymptoms(userId, 100),
      medicationService.getUserMedications(userId),
      this.getMoodsForPeriod(userId, rangeStart, rangeEnd),
      this.getVitalsForPeriod(userId, rangeStart, rangeEnd),
    ]);

    return rankInsights([
      ...detectTemporalPatterns(symptoms, moodsData, isArabic),
      ...detectMedicationCorrelations(symptoms, medications, isArabic),
      ...detectTrends(symptoms, moodsData, isArabic, userId, false),
      ...detectVitalTrends(vitals, isArabic, userId, false),
      ...detectVitalRanges(vitals, isArabic),
      ...detectIntegrationSpecificInsights(vitals, isArabic),
      ...generatePredictiveInsights(
        symptoms,
        medications,
        moodsData,
        vitals,
        rangeStart,
        rangeEnd,
        isArabic
      ),
      ...this.generateRecommendations(
        symptoms,
        medications,
        moodsData,
        isArabic
      ),
    ]);
  }

  private async getVitalsForPeriod(
    _userId: string,
    start: Date,
    end: Date
  ): Promise<VitalSample[]> {
    try {
      const daysDiff = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      const estimatedLimit = Math.min(
        Math.max(daysDiff * 15, 50),
        daysDiff <= 7 ? 100 : daysDiff <= 30 ? 200 : 500
      );

      const rows = await api.get<Record<string, unknown>[]>(
        `/api/health/vitals?from=${encodeURIComponent(start.toISOString())}&limit=${estimatedLimit}`
      );

      return rows
        .filter((v) => typeof v.value === "number" && v.type)
        .map((v) => ({
          id: v.id as string,
          type: String(v.type),
          value: v.value as number,
          unit: v.unit as string | undefined,
          timestamp: new Date(v.recordedAt as string),
          source: v.source as string | undefined,
        }));
    } catch {
      return [];
    }
  }
}

export const healthInsightsService = new HealthInsightsService();
