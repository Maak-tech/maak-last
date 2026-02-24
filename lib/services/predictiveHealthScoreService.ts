/**
 * Predictive Health Score Service
 *
 * Calculates a 7-day health score forecast using historical symptom,
 * medication, vital anomaly, and mood data. Premium Individual+ feature.
 */

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
import { calculateHealthScoreFromData } from "@/lib/services/healthScoreService";
import type { Medication, Mood, Symptom } from "@/types";

export type DayForecast = {
  date: Date;
  score: number;
  confidence: number; // 0-100
  riskFactors: string[];
};

export type HealthScoreForecast = {
  currentScore: number;
  trend: "improving" | "stable" | "declining";
  trendStrength: number; // slope magnitude 0-1
  forecast: DayForecast[]; // next 7 days
  historicalScores: { date: Date; score: number }[]; // last 7 days
  lowestDay?: DayForecast;
  insight: string;
  insightAr: string;
  generatedAt: Date;
};

const DAY_NAMES_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_AR = ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

/** Simple linear regression — returns slope and intercept */
function linearRegression(values: number[]): {
  slope: number;
  intercept: number;
} {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 75 };
  const xs = values.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * values[i], 0);
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/** Build per-day buckets from raw arrays over the past N days */
function buildDailyBuckets(
  symptoms: Symptom[],
  medications: Medication[],
  days: number
): Array<{ date: Date; symptoms: Symptom[]; medications: Medication[] }> {
  const buckets: Array<{
    date: Date;
    symptoms: Symptom[];
    medications: Medication[];
  }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    const daySymptoms = symptoms.filter((s) => {
      const ts =
        s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp);
      return ts >= d && ts < next;
    });

    buckets.push({ date: d, symptoms: daySymptoms, medications });
  }

  return buckets;
}

/**
 * Build a map of dateString → anomaly severity sum for the given window.
 * Anomaly docs live at users/{userId}/anomalies/{id}.
 */
async function fetchAnomalyByDay(
  userId: string,
  since: Date
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const snap = await getDocs(
      query(
        collection(db, "users", userId, "anomalies"),
        where("timestamp", ">=", Timestamp.fromDate(since)),
        orderBy("timestamp", "desc"),
        limit(200)
      )
    );
    for (const d of snap.docs) {
      const data = d.data();
      const ts: Date =
        data.timestamp instanceof Timestamp
          ? data.timestamp.toDate()
          : new Date(data.timestamp);
      const dateKey = ts.toDateString();
      // severity: "warning" = 30pts, "critical" = 60pts
      const severity = data.severity === "critical" ? 60 : 30;
      map.set(dateKey, (map.get(dateKey) ?? 0) + severity);
    }
  } catch {
    // Non-critical — continue without anomaly data
  }
  return map;
}

/**
 * Build a map of dateString → mood risk score (0-100) for each day.
 * Uses negative mood types to compute a simple risk proxy.
 */
function buildMoodRiskByDay(moods: Mood[]): Map<string, number> {
  const NEGATIVE_MOODS = new Set([
    "sad", "anxious", "stressed", "tired", "overwhelmed", "angry",
    "confused", "empty",
  ]);
  const byDay = new Map<string, Mood[]>();
  for (const mood of moods) {
    const key = mood.timestamp.toDateString();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(mood);
  }
  const result = new Map<string, number>();
  for (const [day, dayMoods] of byDay) {
    const negRatio = dayMoods.filter((m) => NEGATIVE_MOODS.has(m.mood)).length / dayMoods.length;
    const lowIntRatio = dayMoods.filter((m) => m.intensity <= 2).length / dayMoods.length;
    result.set(day, Math.round(Math.min(100, negRatio * 70 + lowIntRatio * 30)));
  }
  return result;
}

/** Get predictive health score forecast for a user */
export async function getPredictiveForecast(
  userId: string,
  forecastDays = 7
): Promise<HealthScoreForecast> {
  try {
    const lookbackDays = 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);

    const symptomsRef = collection(db, "users", userId, "symptoms");
    const medsRef = collection(db, "users", userId, "medications");
    const moodsRef = collection(db, "users", userId, "moods");

    const [symptomsSnap, medsSnap, moodsSnap, anomalyByDay] =
      await Promise.all([
        getDocs(
          query(
            symptomsRef,
            where("timestamp", ">=", Timestamp.fromDate(cutoff)),
            orderBy("timestamp", "desc"),
            limit(200)
          )
        ),
        getDocs(query(medsRef, orderBy("startDate", "desc"), limit(50))),
        getDocs(
          query(
            moodsRef,
            where("timestamp", ">=", Timestamp.fromDate(cutoff)),
            orderBy("timestamp", "desc"),
            limit(200)
          )
        ).catch(() => ({ docs: [] })),
        fetchAnomalyByDay(userId, cutoff),
      ]);

    const symptoms: Symptom[] = symptomsSnap.docs.map((d) => ({
      ...(d.data() as Omit<Symptom, "id">),
      id: d.id,
      timestamp:
        d.data().timestamp instanceof Timestamp
          ? d.data().timestamp.toDate()
          : new Date(d.data().timestamp),
    }));

    const medications: Medication[] = medsSnap.docs
      .map((d) => ({
        ...(d.data() as Omit<Medication, "id">),
        id: d.id,
      }))
      .filter((m) => m.isActive);

    const moods: Mood[] = moodsSnap.docs.map((d) => ({
      ...(d.data() as Omit<Mood, "id">),
      id: d.id,
      timestamp:
        d.data().timestamp instanceof Timestamp
          ? d.data().timestamp.toDate()
          : new Date(d.data().timestamp),
    }));

    // Build mood risk by day for adjustment
    const moodRiskByDay = buildMoodRiskByDay(moods);

    // Build daily score history for past 14 days
    const historyDays = 14;
    const dailyBuckets = buildDailyBuckets(symptoms, medications, historyDays);
    const historicalScores = dailyBuckets.map((b) => {
      const baseScore = calculateHealthScoreFromData(b.symptoms, b.medications).score;
      const dateKey = b.date.toDateString();
      // Apply anomaly penalty: each anomaly severity point → 0.1 score penalty, capped at 15
      const anomalySeverity = anomalyByDay.get(dateKey) ?? 0;
      const anomalyPenalty = Math.min(15, anomalySeverity * 0.1);
      // Apply mood risk adjustment: high mood risk (>60) → up to 5 point penalty
      const moodRisk = moodRiskByDay.get(dateKey) ?? 0;
      const moodPenalty = moodRisk > 60 ? Math.min(5, (moodRisk - 60) / 8) : 0;
      const adjusted = Math.max(0, Math.min(100, Math.round(baseScore - anomalyPenalty - moodPenalty)));
      return { date: b.date, score: adjusted };
    });

    // Use last 7 days for trend regression
    const last7 = historicalScores.slice(-7).map((h) => h.score);
    const { slope, intercept } = linearRegression(last7);

    // Check if anomalies are worsening in recent days (last 7)
    const recentAnomalySeverity = historicalScores.slice(-7).map((h) =>
      anomalyByDay.get(h.date.toDateString()) ?? 0
    );
    const anomalyTrend = linearRegression(recentAnomalySeverity);
    const anomalyWorsening = anomalyTrend.slope > 5; // rising by 5+ severity pts/day

    // Override trend to declining if anomalies are worsening regardless of symptom score
    const rawTrend: HealthScoreForecast["trend"] =
      slope > 0.5 ? "improving" : slope < -0.5 ? "declining" : "stable";
    const trend: HealthScoreForecast["trend"] =
      anomalyWorsening && rawTrend !== "declining" ? "declining" : rawTrend;
    const trendStrength = Math.min(1, Math.abs(slope) / 5);

    const currentScore =
      historicalScores[historicalScores.length - 1]?.score ?? 75;

    // Build forecast
    const forecast: DayForecast[] = [];
    let lowestDay: DayForecast | undefined;

    for (let i = 1; i <= forecastDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);

      // Extrapolate from regression (deterministic — no random noise)
      const extrapolated = intercept + slope * (last7.length - 1 + i);
      // Apply anomaly momentum: if anomalies are rising, add extra penalty per day
      const anomalyMomentumPenalty = anomalyWorsening ? Math.min(10, i * 1.5) : 0;
      const score = Math.max(
        30,
        Math.min(100, Math.round(extrapolated - anomalyMomentumPenalty))
      );
      // Confidence degrades over time and further if anomalies present
      const confidence = Math.max(
        35,
        90 - i * 6 - (anomalyWorsening ? 8 : 0)
      );

      const riskFactors: string[] = [];
      if (score < 70) riskFactors.push("Low compliance trend");
      if (slope < -1) riskFactors.push("Worsening symptom trend");
      if (score < 60) riskFactors.push("High symptom severity predicted");
      if (anomalyWorsening) riskFactors.push("Recent vital sign anomalies detected");
      const avgMoodRisk =
        recentAnomalySeverity.length > 0
          ? recentAnomalySeverity.reduce((a, b) => a + b, 0) / recentAnomalySeverity.length
          : 0;
      if (avgMoodRisk > 0 && moodRiskByDay.size > 0) {
        const avgMood = [...moodRiskByDay.values()].slice(-7).reduce((a, b) => a + b, 0) /
          Math.max(1, Math.min(7, moodRiskByDay.size));
        if (avgMood > 60) riskFactors.push("Elevated stress or mood risk");
      }

      const dayForecast: DayForecast = { date, score, confidence, riskFactors };
      forecast.push(dayForecast);

      if (!lowestDay || score < lowestDay.score) {
        lowestDay = dayForecast;
      }
    }

    const lowestDayName = lowestDay
      ? DAY_NAMES_EN[lowestDay.date.getDay()]
      : null;
    const lowestDayNameAr = lowestDay
      ? DAY_NAMES_AR[lowestDay.date.getDay()]
      : null;

    let insight: string;
    let insightAr: string;

    if (trend === "improving") {
      insight = "Your health score is trending upward. Keep up the great work!";
      insightAr = "مؤشر صحتك في تحسن مستمر. استمر في العمل الرائع!";
    } else if (trend === "declining") {
      if (anomalyWorsening) {
        insight = lowestDayName
          ? `Recent vital sign anomalies are affecting your forecast — your score may dip on ${lowestDayName}. Monitor closely and consult your doctor if symptoms worsen.`
          : "Recent vital sign anomalies are pulling your health score down. Consider consulting your healthcare provider.";
        insightAr = lowestDayNameAr
          ? `تؤثر تشوهات العلامات الحيوية الأخيرة على توقعاتك — قد ينخفض مؤشرك يوم ${lowestDayNameAr}. راقب عن كثب واستشر طبيبك.`
          : "تؤثر تشوهات العلامات الحيوية الأخيرة على مؤشر صحتك. فكر في استشارة مقدم الرعاية الصحية.";
      } else {
        insight = lowestDayName
          ? `Your score may dip on ${lowestDayName} — consider monitoring your symptoms closely.`
          : "Your health score may decline this week. Stay on top of medications and symptoms.";
        insightAr = lowestDayNameAr
          ? `قد ينخفض مؤشرك يوم ${lowestDayNameAr} — راقب أعراضك عن كثب.`
          : "قد ينخفض مؤشر صحتك هذا الأسبوع. تابع أدويتك وأعراضك.";
      }
    } else {
      insight = anomalyWorsening
        ? "Your symptom trend is stable, but recent vital sign anomalies detected — keep an eye on your vitals."
        : "Your health score is stable. Continue your current routine.";
      insightAr = anomalyWorsening
        ? "اتجاه أعراضك مستقر، لكن تم اكتشاف تشوهات في العلامات الحيوية مؤخراً — تابع علاماتك الحيوية."
        : "مؤشر صحتك مستقر. استمر في روتينك الحالي.";
    }

    return {
      currentScore,
      trend,
      trendStrength,
      forecast,
      historicalScores: historicalScores.slice(-7),
      lowestDay:
        lowestDay && lowestDay.score < currentScore - 5
          ? lowestDay
          : undefined,
      insight,
      insightAr,
      generatedAt: new Date(),
    };
  } catch (_error) {
    // Return safe default
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      currentScore: 75,
      trend: "stable",
      trendStrength: 0,
      forecast: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() + i + 1);
        return { date: d, score: 75, confidence: 60, riskFactors: [] };
      }),
      historicalScores: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (6 - i));
        return { date: d, score: 75 };
      }),
      insight: "Not enough data to generate a forecast yet.",
      insightAr: "لا توجد بيانات كافية لإنشاء توقعات بعد.",
      generatedAt: new Date(),
    };
  }
}

export const predictiveHealthScoreService = {
  getPredictiveForecast,
};
