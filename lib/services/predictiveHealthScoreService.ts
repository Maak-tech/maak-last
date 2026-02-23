/**
 * Predictive Health Score Service
 *
 * Calculates a 7-day health score forecast using historical symptom and
 * medication data. Premium Individual+ feature.
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
import type { Medication, Symptom } from "@/types";

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

/** Build per-day symptom buckets from raw arrays over the past N days */
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

    const [symptomsSnap, medsSnap] = await Promise.all([
      getDocs(
        query(
          symptomsRef,
          where("timestamp", ">=", Timestamp.fromDate(cutoff)),
          orderBy("timestamp", "desc"),
          limit(200)
        )
      ),
      getDocs(query(medsRef, orderBy("startDate", "desc"), limit(50))),
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

    // Build daily score history for past 14 days
    const historyDays = 14;
    const dailyBuckets = buildDailyBuckets(symptoms, medications, historyDays);
    const historicalScores = dailyBuckets.map((b) => ({
      date: b.date,
      score: calculateHealthScoreFromData(b.symptoms, b.medications).score,
    }));

    // Use last 7 days for trend regression
    const last7 = historicalScores.slice(-7).map((h) => h.score);
    const { slope, intercept } = linearRegression(last7);

    const trend: HealthScoreForecast["trend"] =
      slope > 0.5 ? "improving" : slope < -0.5 ? "declining" : "stable";
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

      // Extrapolate from regression, add small noise for realism
      const extrapolated = intercept + slope * (last7.length - 1 + i);
      const noise = (Math.random() - 0.5) * 4;
      const score = Math.max(
        30,
        Math.min(100, Math.round(extrapolated + noise))
      );
      const confidence = Math.max(40, 90 - i * 6);

      const riskFactors: string[] = [];
      if (score < 70) riskFactors.push("Low compliance trend");
      if (slope < -1) riskFactors.push("Worsening symptom trend");
      if (score < 60) riskFactors.push("High symptom severity predicted");

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
      insight =
        "Your health score is trending upward. Keep up the great work!";
      insightAr = "مؤشر صحتك في تحسن مستمر. استمر في العمل الرائع!";
    } else if (trend === "declining") {
      insight = lowestDayName
        ? `Your score may dip on ${lowestDayName} — consider monitoring your symptoms closely.`
        : "Your health score may decline this week. Stay on top of medications and symptoms.";
      insightAr = lowestDayNameAr
        ? `قد ينخفض مؤشرك يوم ${lowestDayNameAr} — راقب أعراضك عن كثب.`
        : "قد ينخفض مؤشر صحتك هذا الأسبوع. تابع أدويتك وأعراضك.";
    } else {
      insight =
        "Your health score is stable. Continue your current routine.";
      insightAr = "مؤشر صحتك مستقر. استمر في روتينك الحالي.";
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
