/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Recovery scoring algorithm combines multiple weighted health signals with personalized baselines. */
/* biome-ignore-all lint/style/noNestedTernary: Score-level branching uses compact conditionals. */
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { clamp, getMean } from "./healthInsightScoringService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecoveryDirection = "improving" | "stable" | "declining";

export type RecoveryFactor = {
  label: { en: string; ar: string };
  score: number; // 0-100 (higher = contributing positively to recovery)
  weight: number; // fixed weight this factor carries (0-1)
  direction: RecoveryDirection;
  insight: { en: string; ar: string };
  dataPoints: number; // number of data points used (0 = insufficient)
};

export type RecoveryState =
  | "recovering_well" // 85-100
  | "on_track" // 70-84
  | "holding_steady" // 50-69
  | "some_strain" // 30-49
  | "under_stress"; // 0-29

export type RecoveryStateDisplay = {
  label: { en: string; ar: string };
  color: string;
};

export type RecoverySuggestion = {
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  targetFactor: keyof RecoveryScoreBreakdown["factors"];
};

export type RecoveryScoreBreakdown = {
  factors: {
    hrv: RecoveryFactor;
    sleep: RecoveryFactor;
    rhr: RecoveryFactor;
    respiratoryRate: RecoveryFactor;
    bodyTemperature: RecoveryFactor;
  };
  weakestFactor: keyof RecoveryScoreBreakdown["factors"];
};

export type RecoveryScoreResult = {
  score: number; // 0-100
  state: RecoveryState;
  stateDisplay: RecoveryStateDisplay;
  breakdown: RecoveryScoreBreakdown;
  primaryInsight: { en: string; ar: string };
  suggestions: RecoverySuggestion[];
  dataConfidence: number; // 55-95
  insufficientData: boolean;
  /** Set when SpO2 averaged < 94% — shown as override banner independent of score */
  spO2AnomalyFlag: boolean;
  computedAt: Date;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const WEIGHTS = {
  hrv: 0.35,
  sleep: 0.25,
  rhr: 0.15,
  respiratoryRate: 0.10,
  bodyTemperature: 0.10,
} as const;

// SpO2 threshold below which we flag an override banner
const SPO2_ANOMALY_THRESHOLD = 94;

// Minimum data points needed for a factor to be "valid" (not insufficient)
const MIN_HRV_DAYS = 14;
const MIN_SLEEP_DAYS = 3;
const MIN_RHR_DAYS = 7;

const STATE_DISPLAY: Record<RecoveryState, RecoveryStateDisplay> = {
  recovering_well: {
    label: { en: "Recovering Well", ar: "تعافٍ ممتاز" },
    color: "#10B981",
  },
  on_track: {
    label: { en: "On Track", ar: "على المسار" },
    color: "#14B8A6",
  },
  holding_steady: {
    label: { en: "Holding Steady", ar: "مستقر" },
    color: "#F59E0B",
  },
  some_strain: {
    label: { en: "Some Strain", ar: "بعض الضغط" },
    color: "#F97316",
  },
  under_stress: {
    label: { en: "Body Under Stress", ar: "الجسم تحت ضغط" },
    color: "#EF4444",
  },
};

const SUGGESTIONS: Record<
  keyof RecoveryScoreBreakdown["factors"],
  RecoverySuggestion
> = {
  hrv: {
    title: {
      en: "Support Your Nervous System",
      ar: "دعم جهازك العصبي",
    },
    description: {
      en: "Your HRV is below your personal baseline. Prioritise 8+ hours of sleep, avoid intense exercise today, and try a short breathing or mindfulness session.",
      ar: "معدل تقلب ضربات قلبك أقل من معدلك الشخصي. أعطِ الأولوية للنوم أكثر من 8 ساعات، وتجنب التمارين المكثفة اليوم، وجرب جلسة تنفس أو تأمل قصيرة.",
    },
    targetFactor: "hrv",
  },
  sleep: {
    title: {
      en: "Improve Your Sleep Quality",
      ar: "تحسين جودة نومك",
    },
    description: {
      en: "Sleep quality is a key recovery driver. Aim for 7–9 hours on a consistent schedule and limit screens 30 minutes before bed.",
      ar: "جودة النوم هي محرك رئيسي للتعافي. استهدف 7-9 ساعات بجدول منتظم وقلل الشاشات قبل النوم بـ30 دقيقة.",
    },
    targetFactor: "sleep",
  },
  rhr: {
    title: {
      en: "Your Heart Rate Is Elevated",
      ar: "معدل ضربات قلبك مرتفع",
    },
    description: {
      en: "A resting heart rate above your baseline may indicate fatigue, mild illness, or dehydration. Rest, hydrate well, and monitor for symptoms.",
      ar: "معدل ضربات القلب أثناء الراحة فوق المعتاد قد يشير إلى الإجهاد أو مرض بسيط أو الجفاف. استرح، واشرب الماء بكثرة، وراقب الأعراض.",
    },
    targetFactor: "rhr",
  },
  respiratoryRate: {
    title: {
      en: "Elevated Breathing Rate",
      ar: "معدل التنفس مرتفع",
    },
    description: {
      en: "Your resting respiratory rate is slightly above your baseline. Deep breathing exercises and relaxation techniques can help bring it back to normal.",
      ar: "معدل تنفسك أثناء الراحة أعلى قليلاً من معدلك الطبيعي. تمارين التنفس العميق والاسترخاء يمكن أن تساعد في إعادته إلى الطبيعي.",
    },
    targetFactor: "respiratoryRate",
  },
  bodyTemperature: {
    title: {
      en: "Temperature Deviation Detected",
      ar: "تم اكتشاف انحراف في درجة الحرارة",
    },
    description: {
      en: "A slight rise in your body temperature was detected. Monitor for other symptoms and consider reducing your training load today.",
      ar: "تم اكتشاف ارتفاع طفيف في درجة حرارة جسمك. راقب الأعراض الأخرى وفكر في تقليل حمل التدريب اليوم.",
    },
    targetFactor: "bodyTemperature",
  },
};

// ─── Cache ────────────────────────────────────────────────────────────────────

type CacheEntry = { result: RecoveryScoreResult; timestamp: number };
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const _cache = new Map<string, CacheEntry>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreToState(score: number): RecoveryState {
  if (score >= 85) return "recovering_well";
  if (score >= 70) return "on_track";
  if (score >= 50) return "holding_steady";
  if (score >= 30) return "some_strain";
  return "under_stress";
}

function directionFromDelta(
  delta: number,
  positiveThreshold = 5,
  negativeThreshold = -5
): RecoveryDirection {
  if (delta > positiveThreshold) return "improving";
  if (delta < negativeThreshold) return "declining";
  return "stable";
}

/** Fetch recent vitals of a given type from Firestore */
async function fetchVitals(
  userId: string,
  vitalType: string,
  daysBack: number
): Promise<Array<{ value: number; timestamp: Date }>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const snap = await getDocs(
    query(
      collection(db, "vitals"),
      where("userId", "==", userId),
      where("type", "==", vitalType),
      where("timestamp", ">=", cutoff),
      orderBy("timestamp", "desc"),
      limit(200)
    )
  );

  return snap.docs.map((d) => {
    const data = d.data();
    const ts =
      data.timestamp?.toDate?.() instanceof Date
        ? data.timestamp.toDate()
        : new Date(data.timestamp);
    return { value: Number(data.value), timestamp: ts };
  });
}

// ─── Safe default factor ──────────────────────────────────────────────────────

function neutralFactor(
  label: { en: string; ar: string },
  weight: number
): RecoveryFactor {
  return {
    label,
    score: 50,
    weight,
    direction: "stable",
    insight: {
      en: "Not enough data yet — keep logging to improve accuracy.",
      ar: "لا توجد بيانات كافية بعد — استمر في التسجيل لتحسين الدقة.",
    },
    dataPoints: 0,
  };
}

// ─── Service class ────────────────────────────────────────────────────────────

class RecoveryScoreService {
  // ── Factor 1: HRV (35%) ────────────────────────────────────────────────────
  // Evidence: RMSSD ±10% from 30-day personal baseline is the clinically
  // actionable threshold (WHOOP, Oura, peer-reviewed HRV literature).
  private async computeHRVRecovery(
    userId: string
  ): Promise<RecoveryFactor> {
    const label = {
      en: "Heart Rate Variability",
      ar: "تقلب معدل ضربات القلب",
    };
    try {
      const readings = await fetchVitals(userId, "heartRateVariability", 30);
      if (readings.length < MIN_HRV_DAYS) {
        return neutralFactor(label, WEIGHTS.hrv);
      }

      // Sort oldest→newest
      const sorted = [...readings].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
      const values = sorted.map((r) => r.value);
      const baseline = getMean(values);

      if (baseline <= 0) return neutralFactor(label, WEIGHTS.hrv);

      // Use most recent 3 readings to reduce single-night noise
      const recentAvg = getMean(values.slice(-3));
      const deltaPct = ((recentAvg - baseline) / baseline) * 100;

      // Score bands (from clinical HRV research)
      let score: number;
      if (deltaPct > 10) score = 95;
      else if (deltaPct > 5) score = 85;
      else if (deltaPct > -5) score = 65;
      else if (deltaPct > -10) score = 45;
      else if (deltaPct > -20) score = 25;
      else score = 10;

      return {
        label,
        score,
        weight: WEIGHTS.hrv,
        direction: directionFromDelta(deltaPct),
        insight:
          deltaPct > 5
            ? {
                en: `Your HRV is ${Math.round(deltaPct)}% above your baseline — excellent recovery signal.`,
                ar: `معدل تقلب ضربات قلبك أعلى بـ${Math.round(deltaPct)}% من معدلك الطبيعي — إشارة تعافٍ ممتازة.`,
              }
            : deltaPct < -10
              ? {
                  en: `Your HRV is ${Math.round(Math.abs(deltaPct))}% below your baseline — your body needs more rest.`,
                  ar: `معدل تقلب ضربات قلبك أقل بـ${Math.round(Math.abs(deltaPct))}% من معدلك الطبيعي — جسمك يحتاج إلى مزيد من الراحة.`,
                }
              : {
                  en: "Your HRV is within your normal range — recovery is on track.",
                  ar: "معدل تقلب ضربات قلبك ضمن نطاقك الطبيعي — التعافي على المسار الصحيح.",
                },
        dataPoints: readings.length,
      };
    } catch {
      return neutralFactor(label, WEIGHTS.hrv);
    }
  }

  // ── Factor 2: Sleep (25%) ──────────────────────────────────────────────────
  // Evidence: 7-9h optimal; GH pulse during N3 drives tissue repair.
  // Duration component maps 4h→0, 9h→100. Trend bonus if improving.
  private async computeSleepRecovery(userId: string): Promise<RecoveryFactor> {
    const label = { en: "Sleep Quality", ar: "جودة النوم" };
    try {
      const readings = await fetchVitals(userId, "sleepHours", 14);
      if (readings.length < MIN_SLEEP_DAYS) {
        return neutralFactor(label, WEIGHTS.sleep);
      }

      const sorted = [...readings].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
      const values = sorted.map((r) => r.value);

      // Duration component: 4h→0, 9h→100
      const recent7 = getMean(values.slice(-7));
      const durationScore = clamp(((recent7 - 4) / 5) * 100, 0, 100);

      // Trend component: recent 7d vs prior 7d
      const prior7 = values.slice(0, -7);
      let trendBonus = 0;
      if (prior7.length >= 3) {
        const priorAvg = getMean(prior7);
        const improvementDelta = recent7 - priorAvg;
        trendBonus = clamp(improvementDelta * 10, -15, 15);
      }

      const score = clamp(Math.round(durationScore * 0.8 + trendBonus * 0.2 + trendBonus), 0, 100);

      return {
        label,
        score,
        weight: WEIGHTS.sleep,
        direction:
          recent7 >= 7.5
            ? "improving"
            : recent7 >= 6
              ? "stable"
              : "declining",
        insight:
          recent7 >= 7.5
            ? {
                en: `Averaging ${recent7.toFixed(1)}h — great sleep foundation for recovery.`,
                ar: `معدل ${recent7.toFixed(1)} ساعة — أساس نوم ممتاز للتعافي.`,
              }
            : recent7 >= 6
              ? {
                  en: `Averaging ${recent7.toFixed(1)}h — slightly below optimal. Aim for 7–9 hours.`,
                  ar: `معدل ${recent7.toFixed(1)} ساعة — أقل قليلاً من المثالي. استهدف 7-9 ساعات.`,
                }
              : {
                  en: `Averaging only ${recent7.toFixed(1)}h — insufficient sleep is limiting recovery.`,
                  ar: `معدل ${recent7.toFixed(1)} ساعة فقط — النوم غير الكافي يحد من التعافي.`,
                },
        dataPoints: readings.length,
      };
    } catch {
      return neutralFactor(label, WEIGHTS.sleep);
    }
  }

  // ── Factor 3: Resting Heart Rate Trend (15%) ───────────────────────────────
  // Evidence: +5 bpm above 7-day personal baseline = clinically meaningful
  // flag for incomplete recovery or early overreaching.
  private async computeRHRRecovery(userId: string): Promise<RecoveryFactor> {
    const label = { en: "Resting Heart Rate", ar: "معدل ضربات القلب أثناء الراحة" };
    try {
      const readings = await fetchVitals(userId, "heartRate", 14);
      if (readings.length < MIN_RHR_DAYS) {
        return neutralFactor(label, WEIGHTS.rhr);
      }

      // Group by day and use minimum daily value (proxy for resting HR)
      const byDay = new Map<string, number[]>();
      for (const r of readings) {
        const key = r.timestamp.toISOString().slice(0, 10);
        const arr = byDay.get(key) ?? [];
        arr.push(r.value);
        byDay.set(key, arr);
      }
      const dailyMin = [...byDay.values()].map((arr) =>
        Math.min(...arr)
      );

      // 7-day baseline = older half; recent = newest 3 days
      const halfLen = Math.max(3, Math.floor(dailyMin.length / 2));
      const baseline = getMean(dailyMin.slice(0, halfLen));
      const recentAvg = getMean(dailyMin.slice(-3));
      const delta = recentAvg - baseline; // bpm

      // Score bands (from clinical literature: +5 bpm = flag threshold)
      let score: number;
      if (delta < -3) score = 95; // bradycardia adaptation — good
      else if (delta < 0) score = 80;
      else if (delta <= 2) score = 65; // normal variation
      else if (delta <= 5) score = 45;
      else if (delta <= 7) score = 25; // clinical flag threshold
      else score = 10;

      return {
        label,
        score,
        weight: WEIGHTS.rhr,
        direction: directionFromDelta(-delta, 2, -3), // invert: lower HR = improving
        insight:
          delta > 5
            ? {
                en: `Resting HR is ${Math.round(delta)} bpm above your baseline — possible fatigue or illness signal.`,
                ar: `معدل ضربات القلب أعلى بـ${Math.round(delta)} نبضة/دقيقة من معدلك الطبيعي — إشارة محتملة للإجهاد أو المرض.`,
              }
            : delta > 2
              ? {
                  en: `Resting HR is slightly elevated (+${Math.round(delta)} bpm). Rest and hydration recommended.`,
                  ar: `معدل ضربات القلب مرتفع قليلاً (+${Math.round(delta)} ن/د). ينصح بالراحة والترطيب.`,
                }
              : {
                  en: "Resting heart rate is within your normal range.",
                  ar: "معدل ضربات القلب ضمن نطاقك الطبيعي.",
                },
        dataPoints: dailyMin.length,
      };
    } catch {
      return neutralFactor(label, WEIGHTS.rhr);
    }
  }

  // ── Factor 4: Respiratory Rate (10%) ──────────────────────────────────────
  // Evidence: +2 bpm above personal baseline = early stress/deterioration flag.
  // Called "the neglected vital sign" — highly sensitive to systemic stress.
  private async computeRespiratoryRecovery(
    userId: string
  ): Promise<RecoveryFactor> {
    const label = { en: "Respiratory Rate", ar: "معدل التنفس" };
    try {
      const readings = await fetchVitals(userId, "respiratoryRate", 14);
      if (readings.length < 3) {
        // Many devices don't track this — return neutral gracefully
        return neutralFactor(label, WEIGHTS.respiratoryRate);
      }

      const sorted = [...readings].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
      const values = sorted.map((r) => r.value);
      const baseline = getMean(values.slice(0, -3));
      const recentAvg = getMean(values.slice(-3));

      if (baseline <= 0) return neutralFactor(label, WEIGHTS.respiratoryRate);

      const delta = recentAvg - baseline; // bpm

      // Score bands (clinical: +2 bpm = stress flag, +3 = concerning)
      let score: number;
      if (delta < 0) score = 90;
      else if (delta <= 1) score = 75;
      else if (delta <= 2) score = 55; // early stress flag
      else if (delta <= 3) score = 35;
      else score = 15;

      return {
        label,
        score,
        weight: WEIGHTS.respiratoryRate,
        direction: directionFromDelta(-delta, 1, -1),
        insight:
          delta > 2
            ? {
                en: `Breathing rate is ${delta.toFixed(1)} bpm above your baseline — a sign of elevated systemic stress.`,
                ar: `معدل التنفس أعلى بـ${delta.toFixed(1)} نبضة/دقيقة من معدلك الطبيعي — علامة على ضغط جهازي مرتفع.`,
              }
            : {
                en: "Respiratory rate is stable and within your normal range.",
                ar: "معدل التنفس مستقر وضمن نطاقك الطبيعي.",
              },
        dataPoints: readings.length,
      };
    } catch {
      return neutralFactor(label, WEIGHTS.respiratoryRate);
    }
  }

  // ── Factor 5: Body Temperature (10%) ──────────────────────────────────────
  // Evidence: Oura uses +0.5°C nightly deviation from 30-day baseline as the
  // illness-prodrome flag. Temperature is a *leading* indicator — it rises
  // 24-48h before HRV drops during illness.
  private async computeTemperatureRecovery(
    userId: string
  ): Promise<{ factor: RecoveryFactor; spO2AnomalyFlag: boolean }> {
    const label = { en: "Body Temperature", ar: "درجة حرارة الجسم" };
    let spO2AnomalyFlag = false;

    // Also fetch SpO2 as an anomaly gate (not weighted, just flagged)
    try {
      const spo2Readings = await fetchVitals(userId, "oxygenSaturation", 7);
      if (spo2Readings.length >= 2) {
        const avgSpo2 = getMean(spo2Readings.map((r) => r.value));
        if (avgSpo2 < SPO2_ANOMALY_THRESHOLD) {
          spO2AnomalyFlag = true;
        }
      }
    } catch {
      // SpO2 fetch failure is non-blocking
    }

    try {
      const readings = await fetchVitals(userId, "bodyTemperature", 30);
      if (readings.length < 3) {
        return { factor: neutralFactor(label, WEIGHTS.bodyTemperature), spO2AnomalyFlag };
      }

      const sorted = [...readings].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
      const values = sorted.map((r) => r.value);
      const baseline = getMean(values.slice(0, -3));
      const recentAvg = getMean(values.slice(-3));
      const deviation = recentAvg - baseline; // °C

      // Score bands (Oura: +0.5°C = flag; clinical sub-febrile: +0.4-0.6°C)
      let score: number;
      if (deviation < 0) score = 90; // below baseline — excellent
      else if (deviation <= 0.2) score = 80; // normal variation
      else if (deviation <= 0.4) score = 60; // mild elevation
      else if (deviation <= 0.6) score = 35; // Oura flag threshold
      else score = 15; // significant elevation

      return {
        factor: {
          label,
          score,
          weight: WEIGHTS.bodyTemperature,
          direction: directionFromDelta(-deviation * 10, 2, -2),
          insight:
            deviation > 0.4
              ? {
                  en: `Temperature is ${deviation.toFixed(2)}°C above your baseline — possible early illness signal.`,
                  ar: `درجة الحرارة أعلى بـ${deviation.toFixed(2)}°C من معدلك الطبيعي — إشارة محتملة لبداية مرض.`,
                }
              : {
                  en: "Body temperature is within your normal range.",
                  ar: "درجة حرارة الجسم ضمن نطاقك الطبيعي.",
                },
          dataPoints: readings.length,
        },
        spO2AnomalyFlag,
      };
    } catch {
      return { factor: neutralFactor(label, WEIGHTS.bodyTemperature), spO2AnomalyFlag };
    }
  }

  // ── Primary insight builder ────────────────────────────────────────────────

  private buildPrimaryInsight(
    factors: RecoveryScoreBreakdown["factors"],
    score: number
  ): { en: string; ar: string } {
    const weakest = Object.entries(factors).sort(
      ([, a], [, b]) => a.score - b.score
    )[0][1];
    const strongest = Object.entries(factors).sort(
      ([, a], [, b]) => b.score - a.score
    )[0][1];

    if (score >= 85) {
      return {
        en: `Your body is recovering well — ${strongest.label.en} looks great. Keep up the consistency.`,
        ar: `جسمك يتعافى بشكل جيد — ${strongest.label.ar} يبدو رائعاً. حافظ على الاستمرارية.`,
      };
    }
    if (score >= 70) {
      return {
        en: `Recovery is on track. Your main opportunity is ${weakest.label.en.toLowerCase()}.`,
        ar: `التعافي على المسار الصحيح. فرصتك الرئيسية هي تحسين ${weakest.label.ar}.`,
      };
    }
    if (score >= 50) {
      return {
        en: `Your body is holding steady but ${weakest.label.en.toLowerCase()} is pulling recovery down. Rest and consistent habits will help.`,
        ar: `جسمك مستقر لكن ${weakest.label.ar} يؤثر سلباً على التعافي. الراحة والعادات المنتظمة ستساعد.`,
      };
    }
    return {
      en: `Your body is showing signs of strain. Prioritise rest and address ${weakest.label.en.toLowerCase()} first.`,
      ar: `جسمك يُظهر علامات ضغط. أعطِ الأولوية للراحة وعالج ${weakest.label.ar} أولاً.`,
    };
  }

  // ── Main public method ─────────────────────────────────────────────────────

  async calculateRecoveryScore(userId: string): Promise<RecoveryScoreResult> {
    // Check cache
    const cached = _cache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.result;
    }

    try {
      // Run all 5 factor computations in parallel
      const [
        hrv,
        sleep,
        rhr,
        respiratoryRate,
        temperatureResult,
      ] = await Promise.all([
        this.computeHRVRecovery(userId),
        this.computeSleepRecovery(userId),
        this.computeRHRRecovery(userId),
        this.computeRespiratoryRecovery(userId),
        this.computeTemperatureRecovery(userId),
      ]);

      const bodyTemperature = temperatureResult.factor;
      const spO2AnomalyFlag = temperatureResult.spO2AnomalyFlag;

      const factors: RecoveryScoreBreakdown["factors"] = {
        hrv,
        sleep,
        rhr,
        respiratoryRate,
        bodyTemperature,
      };

      // Weighted composite score
      const rawScore =
        hrv.score * WEIGHTS.hrv +
        sleep.score * WEIGHTS.sleep +
        rhr.score * WEIGHTS.rhr +
        respiratoryRate.score * WEIGHTS.respiratoryRate +
        bodyTemperature.score * WEIGHTS.bodyTemperature;
      const score = Math.round(clamp(rawScore, 0, 100));

      // Weakest factor (lowest score)
      const weakestFactor = (
        Object.entries(factors) as [
          keyof RecoveryScoreBreakdown["factors"],
          RecoveryFactor,
        ][]
      ).sort(([, a], [, b]) => a.score - b.score)[0][0];

      const state = scoreToState(score);
      const primaryInsight = this.buildPrimaryInsight(factors, score);

      // Suggestions for the weakest factor
      const suggestions: RecoverySuggestion[] = [SUGGESTIONS[weakestFactor]];

      // Data confidence: # of factors with real data (not neutral fallbacks)
      const validFactors = Object.values(factors).filter(
        (f) => f.dataPoints > 0
      ).length;
      const dataConfidence = clamp(55 + validFactors * 8, 55, 95);
      const insufficientData = dataConfidence < 65 || validFactors < 2;

      const result: RecoveryScoreResult = {
        score,
        state,
        stateDisplay: STATE_DISPLAY[state],
        breakdown: { factors, weakestFactor },
        primaryInsight,
        suggestions,
        dataConfidence,
        insufficientData,
        spO2AnomalyFlag,
        computedAt: new Date(),
      };

      _cache.set(userId, { result, timestamp: Date.now() });
      return result;
    } catch {
      // Safe default on any unhandled error
      const fallback: RecoveryScoreResult = {
        score: 50,
        state: "holding_steady",
        stateDisplay: STATE_DISPLAY.holding_steady,
        breakdown: {
          factors: {
            hrv: neutralFactor({ en: "Heart Rate Variability", ar: "تقلب معدل ضربات القلب" }, WEIGHTS.hrv),
            sleep: neutralFactor({ en: "Sleep Quality", ar: "جودة النوم" }, WEIGHTS.sleep),
            rhr: neutralFactor({ en: "Resting Heart Rate", ar: "معدل ضربات القلب أثناء الراحة" }, WEIGHTS.rhr),
            respiratoryRate: neutralFactor({ en: "Respiratory Rate", ar: "معدل التنفس" }, WEIGHTS.respiratoryRate),
            bodyTemperature: neutralFactor({ en: "Body Temperature", ar: "درجة حرارة الجسم" }, WEIGHTS.bodyTemperature),
          },
          weakestFactor: "hrv",
        },
        primaryInsight: {
          en: "Keep logging vitals to see your recovery score.",
          ar: "استمر في تسجيل العلامات الحيوية لرؤية درجة تعافيك.",
        },
        suggestions: [SUGGESTIONS.hrv],
        dataConfidence: 55,
        insufficientData: true,
        spO2AnomalyFlag: false,
        computedAt: new Date(),
      };
      return fallback;
    }
  }
}

export const recoveryScoreService = new RecoveryScoreService();
