/* biome-ignore-all lint/complexity/noForEach: Existing aggregation loops are stable and kept as-is in this patch. */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Pattern detection algorithms require multi-factor analysis. */
/* biome-ignore-all lint/style/noNestedTernary: Locale-dependent branching remains in current structure. */
/* biome-ignore-all lint/suspicious/noExplicitAny: Third-party payload typing remains partially dynamic for now. */
/* biome-ignore-all lint/nursery/useMaxParams: Current method signature is preserved for backward compatibility. */
import type { Medication, Mood, Symptom } from "@/types";
import {
  analyzeSymptomTrend,
  analyzeVitalTrend,
  createTrendAlert,
  isTrendConcerning,
} from "./trendDetectionService";

// ─── Re-exported types used by callers of this module ───────────────────────
export type PatternInsight = {
  type: "temporal" | "correlation" | "trend" | "recommendation" | "ml";
  title: string;
  description: string;
  confidence: number; // 0-100
  data?: any;
  actionable?: boolean;
  recommendation?: string;
};

export type VitalSample = {
  id: string;
  type: string;
  value: number;
  unit?: string;
  timestamp: Date;
  source?: string;
};

// ─── Internal localization helper (subset used by pattern functions) ──────────
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

// ─── Internal helpers ─────────────────────────────────────────────────────────

export function getVitalDisplayName(type: string, isArabic: boolean): string {
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

function getProviderDisplayName(
  source: string | undefined,
  isArabic: boolean
): string | null {
  if (!source) {
    return null;
  }
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

function groupVitalsByProvider(
  vitals: VitalSample[],
  isArabic: boolean
): Record<string, VitalSample[]> {
  const grouped: Record<string, VitalSample[]> = {};
  for (const vital of vitals) {
    const provider = getProviderDisplayName(vital.source, isArabic);
    if (!provider) {
      continue;
    }
    if (!grouped[provider]) {
      grouped[provider] = [];
    }
    grouped[provider].push(vital);
  }
  return grouped;
}

function getVitalThresholds(
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

// ─── Exported standalone functions ───────────────────────────────────────────

/**
 * Detect temporal patterns (e.g., symptoms on weekends)
 */
export function detectTemporalPatterns(
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
    const dayNum = Number.parseInt(day, 10);
    const intensities = moodsByDay[dayNum];
    avgMoodByDay[dayNum] =
      intensities.reduce((sum, i) => sum + i, 0) / intensities.length;
  });

  const weekendMoods = weekendDays
    .map((day) => avgMoodByDay[day])
    .filter((v) => !Number.isNaN(v));
  const weekdayMoods = weekdayDays
    .map((day) => avgMoodByDay[day])
    .filter((v) => !Number.isNaN(v));

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

      // Evidence-based confidence for mood temporal pattern:
      //  - Absolute mood difference (0.5–5 scale): larger diff → more reliable
      //  - Sample size: more mood entries per day-bucket → higher confidence
      //  - Cap at 85% (self-reported mood data has inherent subjectivity)
      const moodDiff = weekendAvg - weekdayAvg; // 0.5..5
      const diffBonus = Math.min(25, Math.round(moodDiff * 10)); // up to +25 pts
      const totalMoodEntries = moods.length;
      const sampleBonus = Math.min(15, Math.floor(totalMoodEntries / 10) * 3); // up to +15 pts
      const moodConfidence = Math.min(85, 45 + diffBonus + sampleBonus);

      insights.push({
        type: "temporal",
        title: localizedText.title,
        description: localizedText.description,
        confidence: moodConfidence,
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
export function detectMedicationCorrelations(
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
        (Date.now() - medStartDate.getTime()) / (1000 * 60 * 60 * 24)
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

        // Evidence-based confidence:
        //  - Start at 50% baseline (≥30% improvement already met the threshold above)
        //  - Add up to 20pts for larger improvements (each 10% improvement above 30% → +5pts)
        //  - Add up to 15pts for longer observation window (each week after the first → +3pts)
        //  - Add up to 10pts for more pre-medication data points (larger before-sample → more reliable baseline)
        //  - Cap at 90% (observational data cannot provide certainty)
        const improvementBonus = Math.min(20, Math.round((improvement - 30) / 10) * 5);
        const durationBonus = Math.min(15, Math.round((daysAfter - 7) / 7) * 3);
        const sampleBonus = Math.min(10, Math.floor(symptomsBefore.length / 5) * 2);
        const confidence = Math.min(90, 50 + improvementBonus + durationBonus + sampleBonus);

        insights.push({
          type: "correlation",
          title: localizedText.title,
          description: localizedText.description,
          confidence,
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
export function detectTrends(
  symptoms: Symptom[],
  moods: Mood[],
  isArabic = false,
  userId?: string,
  createAlerts = false
): PatternInsight[] {
  const insights: PatternInsight[] = [];

  if (symptoms.length < 7) {
    return insights; // Need at least a week of data
  }

  // Group symptoms by type and analyze trends for each
  const symptomsByType: Record<string, Symptom[]> = {};
  symptoms.forEach((symptom) => {
    if (!symptomsByType[symptom.type]) {
      symptomsByType[symptom.type] = [];
    }
    symptomsByType[symptom.type].push(symptom);
  });

  // Analyze trends for each symptom type
  for (const [symptomType, symptomList] of Object.entries(symptomsByType)) {
    const trendAnalysis = analyzeSymptomTrend(
      symptomList.map((s) => ({
        type: s.type,
        severity: s.severity,
        timestamp: s.timestamp,
      })),
      symptomType,
      7 // 7 days
    );

    if (trendAnalysis && isTrendConcerning(trendAnalysis)) {
      const localizedText = getLocalizedInsightText(
        trendAnalysis.trend === "increasing"
          ? "increasingSymptomSeverity"
          : "improvingSymptomSeverity",
        isArabic
      );
      insights.push({
        type: "trend",
        title: localizedText.title,
        description: trendAnalysis.message || localizedText.description,
        confidence: trendAnalysis.severity === "critical" ? 90 : 75,
        actionable: true,
        recommendation: localizedText.recommendation,
        data: {
          symptomType,
          trendAnalysis,
        },
      });

      // Create alert if concerning trend detected
      if (createAlerts && userId) {
        createTrendAlert(userId, trendAnalysis, "symptom_trend").catch(() => {
          // Error creating symptom trend alert
        });
      }
    }
  }

  // Analyze mood trends
  if (moods.length >= 7) {
    const recentMoods = moods.slice(0, Math.floor(moods.length / 2));
    const olderMoods = moods.slice(Math.floor(moods.length / 2));

    const recentAvg =
      recentMoods.reduce((sum, m) => sum + m.intensity, 0) / recentMoods.length;
    const olderAvg =
      olderMoods.reduce((sum, m) => sum + m.intensity, 0) / olderMoods.length;

    if (recentAvg > olderAvg + 0.5) {
      const localizedText = getLocalizedInsightText("improvingMood", isArabic);
      insights.push({
        type: "trend",
        title: localizedText.title,
        description: localizedText.description,
        confidence: 70,
        actionable: false,
      });
    } else if (recentAvg < olderAvg - 0.5) {
      const localizedText = getLocalizedInsightText("decliningMood", isArabic);
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
 * Detect trends in vital signs
 */
export function detectVitalTrends(
  vitals: VitalSample[],
  isArabic = false,
  userId?: string,
  createAlerts = false
): PatternInsight[] {
  const insights: PatternInsight[] = [];
  if (vitals.length < 4) {
    return insights;
  }

  const vitalsByType: Record<string, VitalSample[]> = {};
  for (const vital of vitals) {
    if (!vitalsByType[vital.type]) {
      vitalsByType[vital.type] = [];
    }
    vitalsByType[vital.type].push(vital);
  }

  for (const [type, readings] of Object.entries(vitalsByType)) {
    if (readings.length < 3) {
      continue; // Need at least 3 for trend analysis
    }

    // Use proper trend analysis function
    const trendAnalysis = analyzeVitalTrend(
      readings.map((r) => ({
        value: r.value,
        timestamp: r.timestamp,
      })),
      type,
      readings[0]?.unit || "",
      7 // 7 days
    );

    if (!trendAnalysis) {
      continue;
    }

    // Only show insights for concerning trends
    if (!isTrendConcerning(trendAnalysis)) {
      continue;
    }

    const trendLabel = isArabic
      ? trendAnalysis.trend === "increasing"
        ? "مرتفعة"
        : trendAnalysis.trend === "decreasing"
          ? "منخفضة"
          : "مستقرة"
      : trendAnalysis.trend;

    const localizedText = getLocalizedInsightText(
      "vitalTrendInsight",
      isArabic,
      {
        vitalType: getVitalDisplayName(type, isArabic),
        trend: trendLabel,
        change: Math.abs(trendAnalysis.changePercent).toFixed(1),
      }
    );

    // Evidence-based confidence for vital trend:
    //  - Magnitude: each 5% change → +10pts (bigger swing = more notable)
    //  - Reading count: each 5 readings above minimum (3) → +5pts (more data = more reliable)
    //  - Cap at 90% (physiological measurements still have noise and context factors)
    const changePct = Math.abs(trendAnalysis.changePercent);
    const magnitudeBonus = Math.min(40, Math.floor(changePct / 5) * 10);
    const readingBonus = Math.min(20, Math.floor((readings.length - 3) / 5) * 5);
    const vitalConfidence = Math.min(90, 35 + magnitudeBonus + readingBonus);

    insights.push({
      type: "trend",
      title: localizedText.title,
      description: trendAnalysis.message || localizedText.description,
      confidence: vitalConfidence,
      actionable: true,
      recommendation: localizedText.recommendation,
      data: {
        vitalType: type,
        trendAnalysis,
        recentAvg: Number(trendAnalysis.currentValue.toFixed(2)),
        olderAvg: Number(trendAnalysis.averageValue.toFixed(2)),
      },
    });

    // Create alert if concerning trend detected and createAlerts is true
    if (createAlerts && userId && isTrendConcerning(trendAnalysis)) {
      createTrendAlert(userId, trendAnalysis, "vital_trend").catch(() => {
        // Error creating trend alert
      });
    }
  }

  return insights;
}

/**
 * Detect whether recent vital readings fall outside typical ranges
 */
export function detectVitalRanges(
  vitals: VitalSample[],
  isArabic = false
): PatternInsight[] {
  const insights: PatternInsight[] = [];
  if (vitals.length < 3) {
    return insights;
  }

  const vitalsByType: Record<string, VitalSample[]> = {};
  for (const vital of vitals) {
    if (!vitalsByType[vital.type]) {
      vitalsByType[vital.type] = [];
    }
    vitalsByType[vital.type].push(vital);
  }

  for (const [type, readings] of Object.entries(vitalsByType)) {
    const thresholds = getVitalThresholds(type);
    if (!thresholds) {
      continue;
    }

    const sorted = [...readings].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    const values = sorted.slice(0, 3).map((r) => r.value);
    if (values.length < 3) {
      continue;
    }

    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const vitalType = getVitalDisplayName(type, isArabic);
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

/**
 * Detect integration-specific insights (sleep, glucose, steps, HRV per provider)
 */
export function detectIntegrationSpecificInsights(
  vitals: VitalSample[],
  isArabic = false
): PatternInsight[] {
  const insights: PatternInsight[] = [];
  if (vitals.length < 3) {
    return insights;
  }

  const vitalsByProvider = groupVitalsByProvider(vitals, isArabic);
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

    if (readings.length < 3) {
      return null;
    }
    const avg = readings.reduce((sum, r) => sum + r.value, 0) / readings.length;
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

    if (readings.length < 5) {
      return null;
    }
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
      const hrv = getAverageForType(providerVitals, "heartRateVariability", 7);
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
