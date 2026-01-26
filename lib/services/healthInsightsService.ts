import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Medication, Mood, Symptom } from "@/types";
import { medicationService } from "./medicationService";
import { symptomService } from "./symptomService";

export interface PatternInsight {
  type: "temporal" | "correlation" | "trend" | "recommendation";
  title: string;
  description: string;
  confidence: number; // 0-100
  data?: any;
  actionable?: boolean;
  recommendation?: string;
}

interface VitalSample {
  id: string;
  type: string;
  value: number;
  unit?: string;
  timestamp: Date;
  source?: string;
}

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

export interface WeeklySummary {
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
}

export interface MonthlySummary {
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
}

class HealthInsightsService {
  /**
   * Detect temporal patterns (e.g., symptoms on weekends)
   */
  private detectTemporalPatterns(
    symptoms: Symptom[],
    moods: Mood[],
    isArabic = false
  ): PatternInsight[] {
    const insights: PatternInsight[] = [];

    // Analyze by day of week
    const symptomsByDay: Record<number, number> = {};
    const moodsByDay: Record<number, number[]> = {};

    symptoms.forEach((symptom) => {
      const dayOfWeek = symptom.timestamp.getDay();
      symptomsByDay[dayOfWeek] = (symptomsByDay[dayOfWeek] || 0) + 1;
    });

    moods.forEach((mood) => {
      const dayOfWeek = mood.timestamp.getDay();
      if (!moodsByDay[dayOfWeek]) {
        moodsByDay[dayOfWeek] = [];
      }
      moodsByDay[dayOfWeek].push(mood.intensity);
    });

    // Check for weekend patterns
    const weekendDays = [0, 6]; // Sunday, Saturday
    const weekdayDays = [1, 2, 3, 4, 5];

    const weekendSymptoms = weekendDays.reduce(
      (sum, day) => sum + (symptomsByDay[day] || 0),
      0
    );
    const weekdaySymptoms = weekdayDays.reduce(
      (sum, day) => sum + (symptomsByDay[day] || 0),
      0
    );

    const totalWeekendDays = symptoms.filter((s) =>
      weekendDays.includes(s.timestamp.getDay())
    ).length;
    const totalWeekdayDays = symptoms.filter((s) =>
      weekdayDays.includes(s.timestamp.getDay())
    ).length;

    if (totalWeekendDays > 0 && totalWeekdayDays > 0) {
      const weekendAvg = weekendSymptoms / totalWeekendDays;
      const weekdayAvg = weekdaySymptoms / totalWeekdayDays;

      if (weekendAvg > weekdayAvg * 1.3) {
        const localizedText = getLocalizedInsightText(
          "weekendSymptomPattern",
          isArabic
        );
        insights.push({
          type: "temporal",
          title: localizedText.title,
          description: localizedText.description,
          confidence: Math.min(85, Math.round((weekendAvg / weekdayAvg) * 50)),
          actionable: true,
          recommendation: localizedText.recommendation,
        });
      }
    }

    // Analyze mood patterns by day
    const avgMoodByDay: Record<number, number> = {};
    Object.keys(moodsByDay).forEach((day) => {
      const dayNum = Number.parseInt(day);
      const intensities = moodsByDay[dayNum];
      avgMoodByDay[dayNum] =
        intensities.reduce((sum, i) => sum + i, 0) / intensities.length;
    });

    const weekendMoods = weekendDays
      .map((day) => avgMoodByDay[day])
      .filter((v) => !isNaN(v));
    const weekdayMoods = weekdayDays
      .map((day) => avgMoodByDay[day])
      .filter((v) => !isNaN(v));

    if (weekendMoods.length > 0 && weekdayMoods.length > 0) {
      const weekendAvg =
        weekendMoods.reduce((sum, m) => sum + m, 0) / weekendMoods.length;
      const weekdayAvg =
        weekdayMoods.reduce((sum, m) => sum + m, 0) / weekdayMoods.length;

      if (weekendAvg > weekdayAvg + 0.5) {
        const localizedText = getLocalizedInsightText(
          "betterMoodsWeekends",
          isArabic
        );
        insights.push({
          type: "temporal",
          title: localizedText.title,
          description: localizedText.description,
          confidence: 70,
          actionable: true,
          recommendation: localizedText.recommendation,
        });
      }
    }

    return insights;
  }

  /**
   * Detect correlations between symptoms and medications
   */
  private detectMedicationCorrelations(
    symptoms: Symptom[],
    medications: Medication[],
    isArabic = false
  ): PatternInsight[] {
    const insights: PatternInsight[] = [];

    if (medications.length === 0 || symptoms.length === 0) {
      return insights;
    }

    // Group symptoms by medication start dates
    medications.forEach((medication) => {
      const medStartDate = medication.startDate;
      const symptomsBefore = symptoms.filter((s) => s.timestamp < medStartDate);
      const symptomsAfter = symptoms.filter((s) => s.timestamp >= medStartDate);

      if (symptomsBefore.length > 0 && symptomsAfter.length > 0) {
        // Check if symptom frequency decreased after medication
        const daysBefore = Math.max(
          1,
          (medStartDate.getTime() - symptomsBefore[0].timestamp.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        const daysAfter = Math.max(
          1,
          (new Date().getTime() - medStartDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        const avgBefore = symptomsBefore.length / daysBefore;
        const avgAfter = symptomsAfter.length / daysAfter;

        if (avgAfter < avgBefore * 0.7 && daysAfter >= 7) {
          const improvement = Math.round(
            ((avgBefore - avgAfter) / avgBefore) * 100
          );
          const localizedText = getLocalizedInsightText(
            "medicationEffectiveness",
            isArabic,
            {
              medicationName: medication.name,
              improvement,
            }
          );
          insights.push({
            type: "correlation",
            title: localizedText.title,
            description: localizedText.description,
            confidence: Math.min(90, improvement),
            actionable: false,
            data: {
              medication: medication.name,
              improvement,
            },
          });
        }
      }
    });

    return insights;
  }

  /**
   * Detect trends in symptoms and moods
   */
  private detectTrends(
    symptoms: Symptom[],
    moods: Mood[],
    isArabic = false
  ): PatternInsight[] {
    const insights: PatternInsight[] = [];

    if (symptoms.length < 7) {
      return insights; // Need at least a week of data
    }

    // Analyze symptom trend over last 2 weeks
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const recentSymptoms = symptoms.filter((s) => s.timestamp >= twoWeeksAgo);
    const olderSymptoms = symptoms.filter((s) => s.timestamp < twoWeeksAgo);

    if (recentSymptoms.length > 0 && olderSymptoms.length > 0) {
      const recentAvg =
        recentSymptoms.reduce((sum, s) => sum + s.severity, 0) /
        recentSymptoms.length;
      const olderAvg =
        olderSymptoms.reduce((sum, s) => sum + s.severity, 0) /
        olderSymptoms.length;

      if (recentAvg > olderAvg + 0.5) {
        const localizedText = getLocalizedInsightText(
          "increasingSymptomSeverity",
          isArabic
        );
        insights.push({
          type: "trend",
          title: localizedText.title,
          description: localizedText.description,
          confidence: 75,
          actionable: true,
          recommendation: localizedText.recommendation,
        });
      } else if (recentAvg < olderAvg - 0.5) {
        const localizedText = getLocalizedInsightText(
          "improvingSymptomSeverity",
          isArabic
        );
        insights.push({
          type: "trend",
          title: localizedText.title,
          description: localizedText.description,
          confidence: 75,
          actionable: false,
        });
      }
    }

    // Analyze mood trends
    if (moods.length >= 7) {
      const recentMoods = moods.slice(0, Math.floor(moods.length / 2));
      const olderMoods = moods.slice(Math.floor(moods.length / 2));

      const recentAvg =
        recentMoods.reduce((sum, m) => sum + m.intensity, 0) /
        recentMoods.length;
      const olderAvg =
        olderMoods.reduce((sum, m) => sum + m.intensity, 0) / olderMoods.length;

      if (recentAvg > olderAvg + 0.5) {
        const localizedText = getLocalizedInsightText(
          "improvingMood",
          isArabic
        );
        insights.push({
          type: "trend",
          title: localizedText.title,
          description: localizedText.description,
          confidence: 70,
          actionable: false,
        });
      } else if (recentAvg < olderAvg - 0.5) {
        const localizedText = getLocalizedInsightText(
          "decliningMood",
          isArabic
        );
        insights.push({
          type: "trend",
          title: localizedText.title,
          description: localizedText.description,
          confidence: 70,
          actionable: true,
          recommendation: localizedText.recommendation,
        });
      }
    }

    return insights;
  }

  /**
   * Generate personalized recommendations
   */
  private generateRecommendations(
    symptoms: Symptom[],
    medications: Medication[],
    moods: Mood[],
    isArabic = false
  ): PatternInsight[] {
    const insights: PatternInsight[] = [];

    // Check medication compliance over the last 7 days
    const activeMedications = medications.filter((m) => m.isActive);
    if (activeMedications.length > 0) {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const { compliance } = this.calculateMedicationCompliance(
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

    // Check symptom frequency
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

    // Check mood patterns
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

  private getVitalDisplayName(type: string, isArabic: boolean): string {
    const map: Record<string, { en: string; ar: string }> = {
      heartRate: { en: "Heart Rate", ar: "معدل ضربات القلب" },
      restingHeartRate: {
        en: "Resting Heart Rate",
        ar: "معدل ضربات القلب أثناء الراحة",
      },
      bloodPressure: { en: "Blood Pressure", ar: "ضغط الدم" },
      respiratoryRate: { en: "Respiratory Rate", ar: "معدل التنفس" },
      oxygenSaturation: { en: "Oxygen Level", ar: "مستوى الأكسجين" },
      temperature: { en: "Temperature", ar: "درجة الحرارة" },
      weight: { en: "Weight", ar: "الوزن" },
      steps: { en: "Steps", ar: "الخطوات" },
      sleepHours: { en: "Sleep", ar: "النوم" },
      activeEnergy: { en: "Active Energy", ar: "الطاقة النشطة" },
      glucoseLevel: { en: "Blood Glucose", ar: "سكر الدم" },
      bloodSugar: { en: "Blood Sugar", ar: "سكر الدم" },
      distanceWalkingRunning: {
        en: "Distance Walking/Running",
        ar: "المسافة (مشي/جري)",
      },
    };

    const entry = map[type];
    if (entry) {
      return isArabic ? entry.ar : entry.en;
    }

    return isArabic ? "المؤشرات الحيوية" : "Vital Signs";
  }

  private getProviderDisplayName(
    source: string | undefined,
    isArabic: boolean
  ) {
    if (!source) return null;
    const normalized = source.toLowerCase();

    if (normalized.includes("oura")) {
      return isArabic ? "Oura" : "Oura";
    }
    if (normalized.includes("garmin")) {
      return isArabic ? "Garmin" : "Garmin";
    }
    if (normalized.includes("samsung")) {
      return isArabic ? "Samsung Health" : "Samsung Health";
    }
    if (normalized.includes("dexcom")) {
      return isArabic ? "Dexcom" : "Dexcom";
    }
    if (normalized.includes("freestyle")) {
      return isArabic ? "Freestyle Libre" : "Freestyle Libre";
    }
    if (normalized.includes("withings")) {
      return isArabic ? "Withings" : "Withings";
    }
    if (normalized.includes("fitbit")) {
      return isArabic ? "Fitbit" : "Fitbit";
    }
    if (normalized.includes("apple")) {
      return isArabic ? "Apple Health" : "Apple Health";
    }
    if (normalized.includes("health connect")) {
      return isArabic ? "Health Connect" : "Health Connect";
    }
    if (normalized.includes("ppg")) {
      return isArabic ? "كاميرا PPG" : "PPG Camera";
    }

    return source;
  }

  private groupVitalsByProvider(
    vitals: VitalSample[],
    isArabic: boolean
  ): Record<string, VitalSample[]> {
    const grouped: Record<string, VitalSample[]> = {};
    for (const vital of vitals) {
      const provider = this.getProviderDisplayName(vital.source, isArabic);
      if (!provider) continue;
      if (!grouped[provider]) {
        grouped[provider] = [];
      }
      grouped[provider].push(vital);
    }
    return grouped;
  }

  private detectVitalTrends(
    vitals: VitalSample[],
    isArabic = false
  ): PatternInsight[] {
    const insights: PatternInsight[] = [];
    if (vitals.length < 4) return insights;

    const vitalsByType: Record<string, VitalSample[]> = {};
    for (const vital of vitals) {
      if (!vitalsByType[vital.type]) {
        vitalsByType[vital.type] = [];
      }
      vitalsByType[vital.type].push(vital);
    }

    for (const [type, readings] of Object.entries(vitalsByType)) {
      if (readings.length < 4) continue;
      const sorted = [...readings].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );

      const recent = sorted.slice(0, 3).map((r) => r.value);
      const older = sorted.slice(-3).map((r) => r.value);
      const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
      const olderAvg = older.reduce((sum, v) => sum + v, 0) / older.length;

      if (olderAvg === 0) continue;

      const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;
      if (Math.abs(percentChange) < 10) continue;

      const trend = percentChange > 0 ? "increasing" : "decreasing";
      const trendLabel = isArabic
        ? trend === "increasing"
          ? "مرتفعة"
          : "منخفضة"
        : trend;

      const localizedText = getLocalizedInsightText(
        "vitalTrendInsight",
        isArabic,
        {
          vitalType: this.getVitalDisplayName(type, isArabic),
          trend: trendLabel,
          change: Math.abs(percentChange).toFixed(1),
        }
      );

      insights.push({
        type: "trend",
        title: localizedText.title,
        description: localizedText.description,
        confidence: Math.min(90, Math.round(Math.abs(percentChange) * 2)),
        actionable: true,
        recommendation: localizedText.recommendation,
        data: {
          vitalType: type,
          recentAvg: Number(recentAvg.toFixed(2)),
          olderAvg: Number(olderAvg.toFixed(2)),
        },
      });
    }

    return insights;
  }

  private getVitalThresholds(
    type: string
  ): { low?: number; high?: number; unit?: string } | null {
    const thresholds: Record<
      string,
      { low?: number; high?: number; unit?: string }
    > = {
      heartRate: { low: 50, high: 100, unit: "bpm" },
      restingHeartRate: { low: 45, high: 90, unit: "bpm" },
      bloodPressure: { low: 90, high: 140, unit: "mmHg" }, // systolic
      respiratoryRate: { low: 12, high: 20, unit: "breaths/min" },
      oxygenSaturation: { low: 92, high: 100, unit: "%" },
      temperature: { low: 36.1, high: 37.8, unit: "°C" },
      glucoseLevel: { low: 70, high: 140, unit: "mg/dL" },
      bloodSugar: { low: 70, high: 140, unit: "mg/dL" },
      bloodGlucose: { low: 70, high: 140, unit: "mg/dL" },
    };

    return thresholds[type] ?? null;
  }

  private detectVitalRanges(
    vitals: VitalSample[],
    isArabic = false
  ): PatternInsight[] {
    const insights: PatternInsight[] = [];
    if (vitals.length < 3) return insights;

    const vitalsByType: Record<string, VitalSample[]> = {};
    for (const vital of vitals) {
      if (!vitalsByType[vital.type]) {
        vitalsByType[vital.type] = [];
      }
      vitalsByType[vital.type].push(vital);
    }

    for (const [type, readings] of Object.entries(vitalsByType)) {
      const thresholds = this.getVitalThresholds(type);
      if (!thresholds) continue;

      const sorted = [...readings].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
      const values = sorted.slice(0, 3).map((r) => r.value);
      if (values.length < 3) continue;

      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      const vitalType = this.getVitalDisplayName(type, isArabic);
      const unit = thresholds.unit || readings[0]?.unit || "";

      if (thresholds.high !== undefined && avg > thresholds.high) {
        const localizedText = getLocalizedInsightText(
          "vitalOutOfRangeHigh",
          isArabic,
          { vitalType, value: avg.toFixed(1), unit }
        );

        insights.push({
          type: "trend",
          title: localizedText.title,
          description: localizedText.description,
          confidence: 70,
          actionable: true,
          recommendation: localizedText.recommendation,
          data: {
            vitalType: type,
            average: Number(avg.toFixed(2)),
            threshold: thresholds.high,
          },
        });
      }

      if (thresholds.low !== undefined && avg < thresholds.low) {
        const localizedText = getLocalizedInsightText(
          "vitalOutOfRangeLow",
          isArabic,
          { vitalType, value: avg.toFixed(1), unit }
        );

        insights.push({
          type: "trend",
          title: localizedText.title,
          description: localizedText.description,
          confidence: 70,
          actionable: true,
          recommendation: localizedText.recommendation,
          data: {
            vitalType: type,
            average: Number(avg.toFixed(2)),
            threshold: thresholds.low,
          },
        });
      }
    }

    return insights;
  }

  private detectIntegrationSpecificInsights(
    vitals: VitalSample[],
    isArabic = false
  ): PatternInsight[] {
    const insights: PatternInsight[] = [];
    if (vitals.length < 3) return insights;

    const vitalsByProvider = this.groupVitalsByProvider(vitals, isArabic);
    const glucoseProviders = ["Dexcom", "Freestyle Libre"];
    const sleepProviders = ["Oura"];
    const hrvProviders = ["Oura", "Garmin"];
    const activityProviders = [
      "Garmin",
      "Samsung Health",
      "Fitbit",
      "Apple Health",
      "Health Connect",
      "Withings",
    ];

    const getAverageForType = (
      providerVitals: VitalSample[],
      type: string,
      count = 5
    ) => {
      const readings = providerVitals
        .filter((v) => v.type === type)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, count);

      if (readings.length < 3) return null;
      const avg =
        readings.reduce((sum, r) => sum + r.value, 0) / readings.length;
      const unit = readings[0]?.unit;
      return { avg, unit };
    };

    const getStdDevForType = (
      providerVitals: VitalSample[],
      type: string,
      count = 7
    ) => {
      const readings = providerVitals
        .filter((v) => v.type === type)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, count);

      if (readings.length < 5) return null;
      const values = readings.map((r) => r.value);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance =
        values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
      return Math.sqrt(variance);
    };

    for (const [provider, providerVitals] of Object.entries(vitalsByProvider)) {
      if (glucoseProviders.includes(provider)) {
        const glucose = getAverageForType(providerVitals, "bloodGlucose", 6);
        if (glucose) {
          if (glucose.avg > 140) {
            const localizedText = getLocalizedInsightText(
              "integrationGlucoseHigh",
              isArabic,
              {
                provider,
                value: glucose.avg.toFixed(0),
                unit: glucose.unit || "mg/dL",
              }
            );
            insights.push({
              type: "trend",
              title: localizedText.title,
              description: localizedText.description,
              confidence: 80,
              actionable: true,
              recommendation: localizedText.recommendation,
              data: { provider, average: Number(glucose.avg.toFixed(1)) },
            });
          } else if (glucose.avg < 70) {
            const localizedText = getLocalizedInsightText(
              "integrationGlucoseLow",
              isArabic,
              {
                provider,
                value: glucose.avg.toFixed(0),
                unit: glucose.unit || "mg/dL",
              }
            );
            insights.push({
              type: "trend",
              title: localizedText.title,
              description: localizedText.description,
              confidence: 80,
              actionable: true,
              recommendation: localizedText.recommendation,
              data: { provider, average: Number(glucose.avg.toFixed(1)) },
            });
          }
        }
      }

      if (sleepProviders.includes(provider)) {
        const sleep = getAverageForType(providerVitals, "sleepHours", 7);
        if (sleep && sleep.avg < 6.5) {
          const localizedText = getLocalizedInsightText(
            "integrationSleepLow",
            isArabic,
            {
              provider,
              value: sleep.avg.toFixed(1),
              unit: sleep.unit || "hours",
            }
          );
          insights.push({
            type: "trend",
            title: localizedText.title,
            description: localizedText.description,
            confidence: 75,
            actionable: true,
            recommendation: localizedText.recommendation,
            data: { provider, average: Number(sleep.avg.toFixed(1)) },
          });
        }

        const sleepStdDev = getStdDevForType(providerVitals, "sleepHours", 7);
        if (sleepStdDev && sleepStdDev > 1.5) {
          const localizedText = getLocalizedInsightText(
            "integrationIrregularSleep",
            isArabic,
            {
              provider,
              value: sleepStdDev.toFixed(1),
              unit: sleep?.unit || "hours",
            }
          );
          insights.push({
            type: "trend",
            title: localizedText.title,
            description: localizedText.description,
            confidence: 70,
            actionable: true,
            recommendation: localizedText.recommendation,
            data: { provider, variability: Number(sleepStdDev.toFixed(2)) },
          });
        }
      }

      if (activityProviders.includes(provider)) {
        const steps = getAverageForType(providerVitals, "steps", 7);
        if (steps && steps.avg < 5000) {
          const localizedText = getLocalizedInsightText(
            "integrationLowSteps",
            isArabic,
            {
              provider,
              value: steps.avg.toFixed(0),
              unit: steps.unit || "steps",
            }
          );
          insights.push({
            type: "trend",
            title: localizedText.title,
            description: localizedText.description,
            confidence: 70,
            actionable: true,
            recommendation: localizedText.recommendation,
            data: { provider, average: Number(steps.avg.toFixed(0)) },
          });
        }
      }

      if (hrvProviders.includes(provider)) {
        const hrv = getAverageForType(
          providerVitals,
          "heartRateVariability",
          7
        );
        if (hrv && hrv.avg < 30) {
          const localizedText = getLocalizedInsightText(
            "integrationLowHrv",
            isArabic,
            {
              provider,
              value: hrv.avg.toFixed(0),
              unit: hrv.unit || "ms",
            }
          );
          insights.push({
            type: "trend",
            title: localizedText.title,
            description: localizedText.description,
            confidence: 75,
            actionable: true,
            recommendation: localizedText.recommendation,
            data: { provider, average: Number(hrv.avg.toFixed(1)) },
          });
        }
      }
    }

    return insights;
  }

  private calculateMedicationCompliance(
    medications: Medication[],
    start: Date,
    end: Date
  ): { compliance: number; missedDoses: number } {
    const activeMedications = medications.filter((med) => med.isActive);
    if (activeMedications.length === 0) {
      return { compliance: 100, missedDoses: 0 };
    }

    const millisPerDay = 24 * 60 * 60 * 1000;
    let expectedDoses = 0;
    let takenDoses = 0;

    for (const medication of activeMedications) {
      const reminders = Array.isArray(medication.reminders)
        ? medication.reminders
        : [];

      const reminderCount = reminders.length;
      if (reminderCount === 0) continue;

      const medStart = medication.startDate ?? start;
      const medEnd = medication.endDate ?? end;

      const overlapStart = medStart > start ? medStart : start;
      const overlapEnd = medEnd < end ? medEnd : end;

      const daysInRange = Math.ceil(
        (overlapEnd.getTime() - overlapStart.getTime()) / millisPerDay
      );

      if (daysInRange <= 0) continue;

      expectedDoses += daysInRange * reminderCount;

      for (const reminder of reminders) {
        if (!(reminder.taken && reminder.takenAt)) continue;
        const takenAt =
          reminder.takenAt instanceof Date
            ? reminder.takenAt
            : new Date(reminder.takenAt);

        if (takenAt >= overlapStart && takenAt < overlapEnd) {
          takenDoses += 1;
        }
      }
    }

    if (expectedDoses === 0) {
      return { compliance: 100, missedDoses: 0 };
    }

    const compliance = (takenDoses / expectedDoses) * 100;
    const missedDoses = Math.max(0, expectedDoses - takenDoses);

    return {
      compliance: Math.round(compliance),
      missedDoses,
    };
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
    start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    // Fetch data for the week - optimize limits for better performance
    // For weekly summary, we need current week + previous week for comparison (14 days max)
    const prevWeekStart = new Date(start);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const [symptoms, medications, moodsData, weekVitals] = await Promise.all([
      symptomService.getUserSymptoms(userId, 50), // Reduced from 100 - only need ~2 weeks worth
      medicationService.getUserMedications(userId),
      this.getMoodsForPeriod(userId, prevWeekStart, end), // Include previous week for trend comparison
      this.getVitalsForPeriod(userId, start, end),
    ]);

    const weekSymptoms = symptoms.filter(
      (s) => s.timestamp >= start && s.timestamp < end
    );
    const weekMoods = moodsData.filter(
      (m) => m.timestamp >= start && m.timestamp < end
    );

    // Calculate symptom stats
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

    // Compare with previous week for trend (already fetched above)
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

    const { compliance, missedDoses } = this.calculateMedicationCompliance(
      medications,
      start,
      end
    );

    // Calculate mood stats
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

    // Compare mood trend
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

    // Generate insights with localization
    const allInsights = [
      ...this.detectTemporalPatterns(weekSymptoms, weekMoods, isArabic),
      ...this.detectMedicationCorrelations(weekSymptoms, medications, isArabic),
      ...this.detectTrends(weekSymptoms, weekMoods, isArabic),
      ...this.detectVitalTrends(weekVitals, isArabic),
      ...this.detectVitalRanges(weekVitals, isArabic),
      ...this.detectIntegrationSpecificInsights(weekVitals, isArabic),
      ...this.generateRecommendations(
        weekSymptoms,
        medications,
        weekMoods,
        isArabic
      ),
    ];

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
      insights: allInsights.slice(0, 5), // Top 5 insights
    };
  }

  /**
   * Get moods for a specific period
   */
  private async getMoodsForPeriod(
    userId: string,
    start: Date,
    end: Date
  ): Promise<Mood[]> {
    try {
      const q = query(
        collection(db, "moods"),
        where("userId", "==", userId),
        where("timestamp", ">=", Timestamp.fromDate(start)),
        where("timestamp", "<=", Timestamp.fromDate(end)),
        orderBy("timestamp", "desc")
      );

      const snapshot = await getDocs(q);
      const moods: Mood[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        moods.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as Mood);
      });

      return moods;
    } catch (error) {
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

    // Fetch all data for the month - optimize limits for better performance
    const [symptoms, medications, moodsData, monthVitals] = await Promise.all([
      symptomService.getUserSymptoms(userId, 100), // Reduced from 200 - monthly data rarely exceeds 100 entries
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

    // Calculate stats
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

    const { compliance } = this.calculateMedicationCompliance(
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

    // Generate insights with localization
    const allInsights = [
      ...this.detectTemporalPatterns(monthSymptoms, monthMoods, isArabic),
      ...this.detectMedicationCorrelations(
        monthSymptoms,
        medications,
        isArabic
      ),
      ...this.detectTrends(monthSymptoms, monthMoods, isArabic),
      ...this.detectVitalTrends(monthVitals, isArabic),
      ...this.detectVitalRanges(monthVitals, isArabic),
      ...this.detectIntegrationSpecificInsights(monthVitals, isArabic),
      ...this.generateRecommendations(
        monthSymptoms,
        medications,
        monthMoods,
        isArabic
      ),
    ];

    // Generate recommendations
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

    return [
      ...this.detectTemporalPatterns(symptoms, moodsData, isArabic),
      ...this.detectMedicationCorrelations(symptoms, medications, isArabic),
      ...this.detectTrends(symptoms, moodsData, isArabic),
      ...this.detectVitalTrends(vitals, isArabic),
      ...this.detectVitalRanges(vitals, isArabic),
      ...this.detectIntegrationSpecificInsights(vitals, isArabic),
      ...this.generateRecommendations(
        symptoms,
        medications,
        moodsData,
        isArabic
      ),
    ];
  }

  private async getVitalsForPeriod(
    userId: string,
    start: Date,
    end: Date
  ): Promise<VitalSample[]> {
    try {
      // Calculate days in period to optimize limit
      const daysDiff = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      // Estimate: ~10-20 vitals per day max, but cap at reasonable limits
      const estimatedLimit = Math.min(
        Math.max(daysDiff * 15, 50), // At least 50, but scale with days
        daysDiff <= 7 ? 100 : daysDiff <= 30 ? 200 : 500 // Week: 100, Month: 200, Longer: 500
      );

      const q = query(
        collection(db, "vitals"),
        where("userId", "==", userId),
        where("timestamp", ">=", Timestamp.fromDate(start)),
        where("timestamp", "<=", Timestamp.fromDate(end)),
        orderBy("timestamp", "desc"),
        limit(estimatedLimit)
      );

      const snapshot = await getDocs(q);
      const vitals: VitalSample[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (typeof data.value !== "number" || !data.type) {
          return;
        }

        vitals.push({
          id: doc.id,
          type: String(data.type),
          value: data.value,
          unit: data.unit,
          timestamp: data.timestamp?.toDate?.() || new Date(),
          source: data.source,
        });
      });

      return vitals;
    } catch {
      return [];
    }
  }
}

export const healthInsightsService = new HealthInsightsService();
