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
    moods: Mood[]
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
        insights.push({
          type: "temporal",
          title: "Weekend Symptom Pattern",
          description:
            "Your symptoms tend to be more frequent on weekends. This could be related to changes in routine, stress, or activity levels.",
          confidence: Math.min(85, Math.round((weekendAvg / weekdayAvg) * 50)),
          actionable: true,
          recommendation:
            "Consider maintaining a consistent routine on weekends and monitor what activities might trigger symptoms.",
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
        insights.push({
          type: "temporal",
          title: "Better Moods on Weekends",
          description:
            "Your mood tends to be better on weekends. This suggests work or weekday activities may be affecting your well-being.",
          confidence: 70,
          actionable: true,
          recommendation:
            "Consider what makes weekends better and try to incorporate those elements into your weekdays.",
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
    medications: Medication[]
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
          insights.push({
            type: "correlation",
            title: `${medication.name} Effectiveness`,
            description: `Your symptoms have decreased by ${Math.round(
              ((avgBefore - avgAfter) / avgBefore) * 100
            )}% since starting ${medication.name}. This suggests the medication may be helping.`,
            confidence: Math.min(
              90,
              Math.round(((avgBefore - avgAfter) / avgBefore) * 100)
            ),
            actionable: false,
            data: {
              medication: medication.name,
              improvement: Math.round(((avgBefore - avgAfter) / avgBefore) * 100),
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
    moods: Mood[]
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
        insights.push({
          type: "trend",
          title: "Increasing Symptom Severity",
          description:
            "Your symptoms have been more severe in the last 2 weeks compared to before. Consider discussing this with your healthcare provider.",
          confidence: 75,
          actionable: true,
          recommendation:
            "Monitor your symptoms closely and consider scheduling a check-up if the trend continues.",
        });
      } else if (recentAvg < olderAvg - 0.5) {
        insights.push({
          type: "trend",
          title: "Improving Symptom Severity",
          description:
            "Great news! Your symptoms have been less severe recently. Keep up whatever you're doing.",
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
        insights.push({
          type: "trend",
          title: "Improving Mood",
          description:
            "Your mood has been improving over time. This is a positive trend!",
          confidence: 70,
          actionable: false,
        });
      } else if (recentAvg < olderAvg - 0.5) {
        insights.push({
          type: "trend",
          title: "Declining Mood",
          description:
            "Your mood has been declining recently. Consider talking to someone or seeking support.",
          confidence: 70,
          actionable: true,
          recommendation:
            "Consider speaking with a mental health professional or trusted friend about how you're feeling.",
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
    moods: Mood[]
  ): PatternInsight[] {
    const insights: PatternInsight[] = [];

    // Check medication compliance
    const activeMedications = medications.filter((m) => m.isActive);
    if (activeMedications.length > 0) {
      // This would ideally use actual compliance data
      // For now, we'll generate a general recommendation
      insights.push({
        type: "recommendation",
        title: "Medication Adherence",
        description:
          "Consistent medication adherence is important for managing your health conditions.",
        confidence: 80,
        actionable: true,
        recommendation:
          "Set reminders and try to take medications at the same time each day.",
      });
    }

    // Check symptom frequency
    const recentSymptoms = symptoms.filter(
      (s) => s.timestamp >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    if (recentSymptoms.length > 5) {
      insights.push({
        type: "recommendation",
        title: "Frequent Symptoms",
        description:
          "You've been experiencing symptoms frequently this week. Consider tracking triggers and patterns.",
        confidence: 75,
        actionable: true,
        recommendation:
          "Keep a detailed log of when symptoms occur, what you were doing, and what you ate to identify patterns.",
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
      insights.push({
        type: "recommendation",
        title: "Mental Well-being",
        description:
          "You've been experiencing more negative moods recently. Self-care is important.",
        confidence: 70,
        actionable: true,
        recommendation:
          "Consider activities that help you relax, such as exercise, meditation, or spending time with loved ones.",
      });
    }

    return insights;
  }

  /**
   * Get weekly health summary
   */
  async getWeeklySummary(
    userId: string,
    weekStart?: Date
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

    // Generate insights
    const allInsights = [
      ...this.detectTemporalPatterns(weekSymptoms, weekMoods),
      ...this.detectMedicationCorrelations(weekSymptoms, medications),
      ...this.detectTrends(weekSymptoms, weekMoods),
      ...this.generateRecommendations(weekSymptoms, medications, weekMoods),
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
    year?: number
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

    // Generate insights
    const allInsights = [
      ...this.detectTemporalPatterns(monthSymptoms, monthMoods),
      ...this.detectMedicationCorrelations(monthSymptoms, medications),
      ...this.detectTrends(monthSymptoms, monthMoods),
      ...this.generateRecommendations(monthSymptoms, medications, monthMoods),
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
  async getAllInsights(userId: string): Promise<PatternInsight[]> {
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
      ...this.detectTemporalPatterns(symptoms, moodsData),
      ...this.detectMedicationCorrelations(symptoms, medications),
      ...this.detectTrends(symptoms, moodsData),
      ...this.generateRecommendations(symptoms, medications, moodsData),
    ];
  }
}

export const healthInsightsService = new HealthInsightsService();
