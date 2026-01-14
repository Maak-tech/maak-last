import type {
  Symptom,
  Medication,
  Mood,
  VitalSign,
} from "@/types";
import { symptomService } from "./symptomService";
import { medicationService } from "./medicationService";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";

export interface PatternInsight {
  type: "temporal" | "correlation" | "trend" | "recommendation";
  title: string;
  description: string;
  confidence: number; // 0-100
  data?: any;
  actionable?: boolean;
  recommendation?: string;
}

// Localization helper for insights
const getLocalizedInsightText = (key: string, isArabic: boolean, params?: Record<string, string | number>): { title: string; description: string; recommendation?: string } => {
  const texts: Record<string, { en: { title: string; description: string; recommendation?: string }; ar: { title: string; description: string; recommendation?: string } }> = {
    weekendSymptomPattern: {
      en: {
        title: "Weekend Symptom Pattern",
        description: "Your symptoms tend to be more frequent on weekends. This could be related to changes in routine, stress, or activity levels.",
        recommendation: "Consider maintaining a consistent routine on weekends and monitor what activities might trigger symptoms.",
      },
      ar: {
        title: "نمط الأعراض في نهاية الأسبوع",
        description: "تميل أعراضك إلى أن تكون أكثر تكراراً في عطلات نهاية الأسبوع. قد يكون هذا مرتبطاً بتغييرات في الروتين أو التوتر أو مستويات النشاط.",
        recommendation: "حاول الحفاظ على روتين ثابت في عطلات نهاية الأسبوع وراقب الأنشطة التي قد تسبب الأعراض.",
      },
    },
    betterMoodsWeekends: {
      en: {
        title: "Better Moods on Weekends",
        description: "Your mood tends to be better on weekends. This suggests work or weekday activities may be affecting your well-being.",
        recommendation: "Consider what makes weekends better and try to incorporate those elements into your weekdays.",
      },
      ar: {
        title: "مزاج أفضل في نهاية الأسبوع",
        description: "يميل مزاجك إلى أن يكون أفضل في عطلات نهاية الأسبوع. هذا يشير إلى أن العمل أو أنشطة أيام الأسبوع قد تؤثر على صحتك النفسية.",
        recommendation: "فكر فيما يجعل عطلات نهاية الأسبوع أفضل وحاول دمج هذه العناصر في أيام الأسبوع.",
      },
    },
    medicationEffectiveness: {
      en: {
        title: `${params?.medicationName || "Medication"} Effectiveness`,
        description: `Your symptoms have decreased by ${params?.improvement || 0}% since starting ${params?.medicationName || "the medication"}. This suggests the medication may be helping.`,
      },
      ar: {
        title: `فعالية ${params?.medicationName || "الدواء"}`,
        description: `انخفضت أعراضك بنسبة ${params?.improvement || 0}% منذ بدء تناول ${params?.medicationName || "الدواء"}. هذا يشير إلى أن الدواء قد يكون مفيداً.`,
      },
    },
    increasingSymptomSeverity: {
      en: {
        title: "Increasing Symptom Severity",
        description: "Your symptoms have been more severe in the last 2 weeks compared to before. Consider discussing this with your healthcare provider.",
        recommendation: "Monitor your symptoms closely and consider scheduling a check-up if the trend continues.",
      },
      ar: {
        title: "زيادة شدة الأعراض",
        description: "كانت أعراضك أكثر شدة في الأسبوعين الأخيرين مقارنة بالسابق. فكر في مناقشة هذا مع مقدم الرعاية الصحية.",
        recommendation: "راقب أعراضك عن كثب وفكر في تحديد موعد للفحص إذا استمر هذا الاتجاه.",
      },
    },
    improvingSymptomSeverity: {
      en: {
        title: "Improving Symptom Severity",
        description: "Great news! Your symptoms have been less severe recently. Keep up whatever you're doing.",
      },
      ar: {
        title: "تحسن شدة الأعراض",
        description: "أخبار رائعة! كانت أعراضك أقل شدة مؤخراً. استمر في ما تفعله.",
      },
    },
    improvingMood: {
      en: {
        title: "Improving Mood",
        description: "Your mood has been improving over time. This is a positive trend!",
      },
      ar: {
        title: "تحسن المزاج",
        description: "يتحسن مزاجك بمرور الوقت. هذا اتجاه إيجابي!",
      },
    },
    decliningMood: {
      en: {
        title: "Declining Mood",
        description: "Your mood has been declining recently. Consider talking to someone or seeking support.",
        recommendation: "Consider speaking with a mental health professional or trusted friend about how you're feeling.",
      },
      ar: {
        title: "انخفاض المزاج",
        description: "انخفض مزاجك مؤخراً. فكر في التحدث مع شخص ما أو طلب الدعم.",
        recommendation: "فكر في التحدث مع متخصص في الصحة النفسية أو صديق موثوق حول ما تشعر به.",
      },
    },
    medicationAdherence: {
      en: {
        title: "Medication Adherence",
        description: "Consistent medication adherence is important for managing your health conditions.",
        recommendation: "Set reminders and try to take medications at the same time each day.",
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
        description: "You've been experiencing symptoms frequently this week. Consider tracking triggers and patterns.",
        recommendation: "Keep a detailed log of when symptoms occur, what you were doing, and what you ate to identify patterns.",
      },
      ar: {
        title: "أعراض متكررة",
        description: "كنت تعاني من أعراض متكررة هذا الأسبوع. فكر في تتبع المحفزات والأنماط.",
        recommendation: "احتفظ بسجل مفصل لوقت حدوث الأعراض، وما كنت تفعله، وما أكلته لتحديد الأنماط.",
      },
    },
    mentalWellbeing: {
      en: {
        title: "Mental Well-being",
        description: "You've been experiencing more negative moods recently. Self-care is important.",
        recommendation: "Consider activities that help you relax, such as exercise, meditation, or spending time with loved ones.",
      },
      ar: {
        title: "الصحة النفسية",
        description: "كنت تعاني من مزاج سلبي أكثر مؤخراً. الرعاية الذاتية مهمة.",
        recommendation: "فكر في الأنشطة التي تساعدك على الاسترخاء، مثل التمارين الرياضية أو التأمل أو قضاء الوقت مع أحبائك.",
      },
    },
  };

  const locale = isArabic ? "ar" : "en";
  return texts[key]?.[locale] || texts[key]?.en || { title: key, description: "" };
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
        const localizedText = getLocalizedInsightText("weekendSymptomPattern", isArabic);
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
        const localizedText = getLocalizedInsightText("betterMoodsWeekends", isArabic);
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
      const symptomsBefore = symptoms.filter(
        (s) => s.timestamp < medStartDate
      );
      const symptomsAfter = symptoms.filter(
        (s) => s.timestamp >= medStartDate
      );

      if (symptomsBefore.length > 0 && symptomsAfter.length > 0) {
        // Check if symptom frequency decreased after medication
        const daysBefore = Math.max(
          1,
          (medStartDate.getTime() -
            symptomsBefore[0].timestamp.getTime()) /
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
          const improvement = Math.round(((avgBefore - avgAfter) / avgBefore) * 100);
          const localizedText = getLocalizedInsightText("medicationEffectiveness", isArabic, { 
            medicationName: medication.name, 
            improvement 
          });
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
        const localizedText = getLocalizedInsightText("increasingSymptomSeverity", isArabic);
        insights.push({
          type: "trend",
          title: localizedText.title,
          description: localizedText.description,
          confidence: 75,
          actionable: true,
          recommendation: localizedText.recommendation,
        });
      } else if (recentAvg < olderAvg - 0.5) {
        const localizedText = getLocalizedInsightText("improvingSymptomSeverity", isArabic);
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
        olderMoods.reduce((sum, m) => sum + m.intensity, 0) /
        olderMoods.length;

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
   * Generate personalized recommendations
   */
  private generateRecommendations(
    symptoms: Symptom[],
    medications: Medication[],
    moods: Mood[],
    isArabic = false
  ): PatternInsight[] {
    const insights: PatternInsight[] = [];

    // Check medication compliance
    const activeMedications = medications.filter((m) => m.isActive);
    if (activeMedications.length > 0) {
      // This would ideally use actual compliance data
      // For now, we'll generate a general recommendation
      const localizedText = getLocalizedInsightText("medicationAdherence", isArabic);
      insights.push({
        type: "recommendation",
        title: localizedText.title,
        description: localizedText.description,
        confidence: 80,
        actionable: true,
        recommendation: localizedText.recommendation,
      });
    }

    // Check symptom frequency
    const recentSymptoms = symptoms.filter(
      (s) => s.timestamp >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    if (recentSymptoms.length > 5) {
      const localizedText = getLocalizedInsightText("frequentSymptoms", isArabic);
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
      const localizedText = getLocalizedInsightText("mentalWellbeing", isArabic);
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
    start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    // Fetch data for the week
    const [symptoms, medications, moodsData] = await Promise.all([
      symptomService.getUserSymptoms(userId, 100),
      medicationService.getUserMedications(userId),
      this.getMoodsForPeriod(userId, start, end),
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

    // Compare with previous week for trend
    const prevWeekStart = new Date(start);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
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

    // Calculate medication compliance (simplified)
    const activeMeds = medications.filter((m) => m.isActive);
    let compliance = 100;
    if (activeMeds.length > 0) {
      // This is a simplified calculation - ideally would use actual reminder data
      compliance = 85; // Placeholder
    }

    // Calculate mood stats
    const moodCounts: Record<Mood["mood"], number> = {} as any;
    weekMoods.forEach((m) => {
      moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1;
    });

    const mostCommonMood = Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] as Mood["mood"] | undefined;

    const avgMoodIntensity =
      weekMoods.length > 0
        ? weekMoods.reduce((sum, m) => sum + m.intensity, 0) /
          weekMoods.length
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
      ...this.generateRecommendations(weekSymptoms, medications, weekMoods, isArabic),
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
        totalMedications: activeMeds.length,
        missedDoses: Math.round(activeMeds.length * ((100 - compliance) / 100)),
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

    // Fetch all data for the month
    const [symptoms, medications, moodsData] = await Promise.all([
      symptomService.getUserSymptoms(userId, 200),
      medicationService.getUserMedications(userId),
      this.getMoodsForPeriod(userId, start, end),
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

    const activeMeds = medications.filter((m) => m.isActive);
    const compliance = 85; // Placeholder

    const moodCounts: Record<Mood["mood"], number> = {} as any;
    monthMoods.forEach((m) => {
      moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1;
    });

    const mostCommonMood = Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] as Mood["mood"] | undefined;

    const avgMoodIntensity =
      monthMoods.length > 0
        ? monthMoods.reduce((sum, m) => sum + m.intensity, 0) /
          monthMoods.length
        : 0;

    // Generate insights with localization
    const allInsights = [
      ...this.detectTemporalPatterns(monthSymptoms, monthMoods, isArabic),
      ...this.detectMedicationCorrelations(monthSymptoms, medications, isArabic),
      ...this.detectTrends(monthSymptoms, monthMoods, isArabic),
      ...this.generateRecommendations(monthSymptoms, medications, monthMoods, isArabic),
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
        totalMedications: activeMeds.length,
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
  async getAllInsights(userId: string, isArabic = false): Promise<PatternInsight[]> {
    const [symptoms, medications, moodsData] = await Promise.all([
      symptomService.getUserSymptoms(userId, 100),
      medicationService.getUserMedications(userId),
      this.getMoodsForPeriod(
        userId,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date()
      ),
    ]);

    return [
      ...this.detectTemporalPatterns(symptoms, moodsData, isArabic),
      ...this.detectMedicationCorrelations(symptoms, medications, isArabic),
      ...this.detectTrends(symptoms, moodsData, isArabic),
      ...this.generateRecommendations(symptoms, medications, moodsData, isArabic),
    ];
  }
}

export const healthInsightsService = new HealthInsightsService();
