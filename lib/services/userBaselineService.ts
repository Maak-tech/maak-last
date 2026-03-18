/**
 * User Baseline Service
 *
 * Computes and stores a personalised health baseline for each user by
 * aggregating data across ALL health dimensions:
 *   - Vital signs (heart rate, BP, SpO2, temperature, glucose, weight)
 *   - Sleep (from wearable integrations — duration, quality)
 *   - Movement / steps (from wearable integrations)
 *   - Mood (average intensity, dominant mood category)
 *   - Symptoms (frequency, dominant types, average severity)
 *   - Medication compliance (adherence %)
 *   - Women's health (average cycle length, period length, PMS patterns)
 *   - Allergies & Medical history context (risk modifiers, not averaged)
 *
 * Baseline stored in: users/{userId}/health_baseline/current
 * Recomputed when > 24h stale or when explicitly requested.
 *
 * Usage:
 *   const baseline = await userBaselineService.getBaseline(userId);
 *   const changes  = await userBaselineService.detectDeviations(userId, baseline);
 */

import { api } from "@/lib/apiClient";
import type { Allergy, MedicalHistory, Mood, Symptom } from "@/types";
import { allergyService } from "./allergyService";
import { medicalHistoryService } from "./medicalHistoryService";
import { medicationService } from "./medicationService";
import { moodService } from "./moodService";
import { symptomService } from "./symptomService";

// ─── Types ─────────────────────────────────────────────────────────────────

export type VitalBaseline = {
  type: string;
  average: number;
  min: number;
  max: number;
  stdDev: number;
  sampleCount: number;
  unit?: string;
};

export type BaselineRiskContext = {
  hasCardiacHistory: boolean;
  hasDiabetes: boolean;
  hasHypertension: boolean;
  hasRespiratoryCondition: boolean;
  hasSevereAllergy: boolean;
  /** Names of high-severity allergies */
  severeAllergens: string[];
  /** Active long-term conditions */
  chronicConditions: string[];
};

export type UserHealthBaseline = {
  userId: string;
  computedAt: Date;
  /** How many days of data were used */
  dataWindowDays: number;
  /**
   * Adaptive window actually used (may be shorter than dataWindowDays when
   * insufficient data exists — e.g. a new user who only has 8 days of readings).
   */
  adaptiveWindowDays?: number;
  /** Schema version — increment when baseline fields are added */
  version?: number;
  /**
   * Confidence in the baseline (0–1). Matures from ~0.3 after 7 days of data
   * up to 1.0 after 21+ days. Used by vhiCycle to gate risk score publishing.
   */
  baselineConfidence?: number;

  vitals: VitalBaseline[];

  /** Average mood intensity (1–5) over the window */
  averageMoodIntensity: number;
  /** Most frequent mood polarity: "positive" | "neutral" | "negative" */
  dominantMoodPolarity: "positive" | "neutral" | "negative";
  /** How many mood entries in the window */
  moodSampleCount: number;

  /** Average daily symptom count */
  averageDailySymptomCount: number;
  /** Average symptom severity (1–5) */
  averageSymptomSeverity: number;
  /** Top 3 most frequent symptom types */
  commonSymptomTypes: string[];
  /** Total symptom samples */
  symptomSampleCount: number;

  /** Medication adherence % (0–100) */
  medicationAdherence: number;

  /** Average sleep duration in hours (from vitals tagged as sleep or wearable) */
  averageSleepHours: number | null;

  /** Average daily step count (from vitals tagged as steps) */
  averageDailySteps: number | null;

  /** Women's health context (null if no cycle data) */
  womenHealth: {
    averageCycleLength: number;
    averagePeriodLength: number;
    pmsSymptoms: string[];
  } | null;

  /** Risk modifiers from allergies + medical history */
  riskContext: BaselineRiskContext;
};

export type BaselineDeviation = {
  dimension:
    | "vital"
    | "mood"
    | "symptoms"
    | "sleep"
    | "steps"
    | "medication"
    | "women_health";
  metric: string;
  baselineValue: number;
  currentValue: number;
  /** Change from baseline as a ratio (positive = higher than baseline) */
  changeRatio: number;
  severity: "mild" | "moderate" | "significant";
  direction: "above" | "below";
  insight: string;
  insightAr: string;
  actionable: boolean;
  recommendation?: string;
  recommendationAr?: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((s, v) => s + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function moodPolarity(mood: Mood): "positive" | "neutral" | "negative" {
  const positiveMoods = new Set([
    "veryHappy",
    "happy",
    "excited",
    "content",
    "grateful",
    "energetic",
    "hopeful",
    "calm",
    "peaceful",
    "proud",
    "loved",
  ]);
  const negativeMoods = new Set([
    "sad",
    "verySad",
    "anxious",
    "veryAnxious",
    "angry",
    "frustrated",
    "depressed",
    "scared",
    "hopeless",
    "exhausted",
    "overwhelmed",
    "guilty",
    "lonely",
    "disgusted",
  ]);
  if (positiveMoods.has(mood.mood)) return "positive";
  if (negativeMoods.has(mood.mood)) return "negative";
  return "neutral";
}

function topN<T>(items: T[], key: (item: T) => string, n: number): string[] {
  const freq: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    freq[k] = (freq[k] ?? 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

async function fetchVitalSamples(
  userId: string,
  days: number
): Promise<Array<{ type: string; value: number; unit?: string; timestamp: Date }>> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const raw = await api.get<Record<string, unknown>[]>(
    `/api/health/vitals?from=${since.toISOString()}&limit=500`
  );
  return (raw ?? []).map((v) => ({
    type: v.type as string,
    value: v.value as number,
    unit: v.unit as string | undefined,
    timestamp: v.recordedAt ? new Date(v.recordedAt as string) : new Date(),
  }));
}

function buildVitalBaselines(
  samples: Array<{ type: string; value: number; unit?: string }>
): VitalBaseline[] {
  const grouped: Record<string, { values: number[]; unit?: string }> = {};
  for (const s of samples) {
    if (!grouped[s.type]) grouped[s.type] = { values: [], unit: s.unit };
    grouped[s.type].values.push(s.value);
  }
  return Object.entries(grouped)
    .filter(([, g]) => g.values.length >= 3)
    .map(([type, g]) => ({
      type,
      average: mean(g.values),
      min: Math.min(...g.values),
      max: Math.max(...g.values),
      stdDev: stdDev(g.values),
      sampleCount: g.values.length,
      unit: g.unit,
    }));
}

async function fetchMedicationAdherence(
  userId: string,
  days: number
): Promise<number> {
  try {
    const medications = await medicationService.getUserMedications(userId);
    const activeMeds = medications.filter((m) => m.isActive);
    if (activeMeds.length === 0) return 100;

    let totalReminders = 0;
    let takenReminders = 0;
    const since = new Date();
    since.setDate(since.getDate() - days);

    for (const med of activeMeds) {
      for (const reminder of med.reminders) {
        const takenAtRaw = reminder.takenAt as Date | string | undefined;
        if (!takenAtRaw) continue;
        const takenDate =
          takenAtRaw instanceof Date
            ? takenAtRaw
            : takenAtRaw
              ? new Date(takenAtRaw)
              : null;
        if (!takenDate || takenDate < since) continue;
        totalReminders++;
        if (reminder.taken) takenReminders++;
      }
    }

    if (totalReminders === 0) return 100;
    return Math.round((takenReminders / totalReminders) * 100);
  } catch {
    return 100;
  }
}

async function fetchPeriodBaseline(
  userId: string
): Promise<UserHealthBaseline["womenHealth"]> {
  try {
    const { periodService } = await import("./periodService");
    const cycle = await periodService.getCycleInfo(userId);
    if (!(cycle && cycle.averageCycleLength)) return null;
    return {
      averageCycleLength: cycle.averageCycleLength,
      averagePeriodLength: cycle.averagePeriodLength ?? 5,
      pmsSymptoms: [],
    };
  } catch {
    return null;
  }
}

async function buildRiskContext(
  userId: string,
  allergies: Allergy[],
  history: MedicalHistory[]
): Promise<BaselineRiskContext> {
  const conditions = history
    .filter((h) => !h.isFamily)
    .map((h) => h.condition.toLowerCase());

  const severeAllergies = allergies.filter(
    (a) => a.severity === "severe" || a.severity === "severe-life-threatening"
  );

  return {
    hasCardiacHistory: conditions.some((c) =>
      c.match(/heart|cardiac|arrhythmia|hypertension|coronary/)
    ),
    hasDiabetes: conditions.some((c) =>
      c.match(/diabetes|diabetic|glucose|insulin/)
    ),
    hasHypertension: conditions.some((c) =>
      c.match(/hypertension|blood pressure/)
    ),
    hasRespiratoryCondition: conditions.some((c) =>
      c.match(/asthma|copd|respiratory|lung|pneumonia/)
    ),
    hasSevereAllergy: severeAllergies.length > 0,
    severeAllergens: severeAllergies.map((a) => a.name),
    chronicConditions: history
      .filter((h) => !h.isFamily && h.severity !== "mild")
      .map((h) => h.condition)
      .slice(0, 10),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────

const BASELINE_CACHE_HOURS = 24;
const DATA_WINDOW_DAYS = 30;
const BASELINE_SCHEMA_VERSION = 2;

// Minimum readings required for a fully-confident baseline
const MIN_READINGS_FULL_CONFIDENCE = 42; // ~2 readings/day × 21 days

/**
 * Compute a confidence score (0–1) for the baseline based on sample counts.
 *
 * - Below 7 readings → < 0.3 (insufficient)
 * - 7–41 readings  → 0.3–0.99 (maturing)
 * - 42+ readings   → 1.0 (fully confident, same threshold used by vhiCycle)
 */
export function computeBaselineConfidence(totalReadings: number): number {
  if (totalReadings <= 0) return 0;
  return Math.min(1, totalReadings / MIN_READINGS_FULL_CONFIDENCE);
}

export const userBaselineService = {
  /**
   * Compute and persist a fresh baseline for the user.
   * Call this on first open, then at most once per 24h.
   */
  async computeBaseline(userId: string): Promise<UserHealthBaseline> {
    const [
      vitalsRaw,
      symptoms,
      moods,
      allergies,
      history,
      adherence,
      periodBase,
    ] = await Promise.all([
      fetchVitalSamples(userId, DATA_WINDOW_DAYS).catch(() => []),
      symptomService.getUserSymptoms(userId, 500).catch(() => [] as Symptom[]),
      moodService.getUserMoods(userId, 200).catch(() => [] as Mood[]),
      allergyService.getUserAllergies(userId).catch(() => [] as Allergy[]),
      medicalHistoryService
        .getUserMedicalHistory(userId)
        .catch(() => [] as MedicalHistory[]),
      fetchMedicationAdherence(userId, DATA_WINDOW_DAYS),
      fetchPeriodBaseline(userId),
    ]);

    // Vitals
    const vitalBaselines = buildVitalBaselines(vitalsRaw);
    const sleepSamples = vitalsRaw.filter(
      (v) => v.type === "sleep" || v.type === "sleepDuration"
    );
    const stepSamples = vitalsRaw.filter(
      (v) => v.type === "steps" || v.type === "stepCount"
    );
    const averageSleepHours =
      sleepSamples.length >= 3 ? mean(sleepSamples.map((v) => v.value)) : null;
    const averageDailySteps =
      stepSamples.length >= 3 ? mean(stepSamples.map((v) => v.value)) : null;

    // Mood
    const polarities = moods.map(moodPolarity);
    const posCount = polarities.filter((p) => p === "positive").length;
    const negCount = polarities.filter((p) => p === "negative").length;
    const dominantMoodPolarity: "positive" | "neutral" | "negative" =
      posCount > negCount + 5
        ? "positive"
        : negCount > posCount + 5
          ? "negative"
          : "neutral";
    const averageMoodIntensity =
      moods.length > 0 ? mean(moods.map((m) => m.intensity)) : 3;

    // Symptoms
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DATA_WINDOW_DAYS);
    const recentSymptoms = symptoms.filter((s) => s.timestamp >= cutoff);
    const uniqueDays = new Set(
      recentSymptoms.map((s) => s.timestamp.toDateString())
    ).size;
    const averageDailySymptomCount =
      uniqueDays > 0 ? recentSymptoms.length / Math.max(uniqueDays, 1) : 0;
    const averageSymptomSeverity =
      recentSymptoms.length > 0
        ? mean(recentSymptoms.map((s) => s.severity))
        : 0;
    const commonSymptomTypes = topN(recentSymptoms, (s) => s.type, 3);

    // Risk context
    const riskContext = await buildRiskContext(userId, allergies, history);

    // Total readings across all vital types (proxy for data richness)
    const totalReadings = vitalsRaw.length + recentSymptoms.length + moods.length;
    const baselineConfidence = computeBaselineConfidence(totalReadings);
    // Adaptive window: how many days back we actually have readings
    const oldestReading = vitalsRaw.length > 0
      ? vitalsRaw.reduce((oldest, v) => (v.timestamp < oldest ? v.timestamp : oldest), vitalsRaw[0].timestamp)
      : null;
    const adaptiveWindowDays = oldestReading
      ? Math.min(DATA_WINDOW_DAYS, Math.ceil((Date.now() - oldestReading.getTime()) / 86_400_000))
      : DATA_WINDOW_DAYS;

    const baseline: UserHealthBaseline = {
      userId,
      computedAt: new Date(),
      dataWindowDays: DATA_WINDOW_DAYS,
      adaptiveWindowDays,
      version: BASELINE_SCHEMA_VERSION,
      baselineConfidence,
      vitals: vitalBaselines,
      averageMoodIntensity,
      dominantMoodPolarity,
      moodSampleCount: moods.length,
      averageDailySymptomCount,
      averageSymptomSeverity,
      commonSymptomTypes,
      symptomSampleCount: recentSymptoms.length,
      medicationAdherence: adherence,
      averageSleepHours,
      averageDailySteps,
      womenHealth: periodBase,
      riskContext,
    };

    // Persist to API (best-effort)
    try {
      await api.patch("/api/user/baseline", {
        ...baseline,
        computedAt: baseline.computedAt.toISOString(),
      });
    } catch {
      // Non-critical — proceed with in-memory baseline
    }

    return baseline;
  },

  /**
   * Load the cached baseline for a user.
   * Returns null if no baseline exists or it's older than BASELINE_CACHE_HOURS.
   */
  async getCachedBaseline(userId: string): Promise<UserHealthBaseline | null> {
    try {
      const row = await api.get<{ data: Record<string, unknown>; computedAt: string } | null>(
        "/api/user/baseline"
      );
      if (!row?.data) return null;
      const data = row.data;
      const computedAt = row.computedAt ? new Date(row.computedAt) : new Date(data.computedAt as string);
      const ageHours = (Date.now() - computedAt.getTime()) / 3_600_000;
      if (ageHours > BASELINE_CACHE_HOURS) return null;
      return { ...data, computedAt } as UserHealthBaseline;
    } catch {
      return null;
    }
  },

  /**
   * Get baseline: return cached if fresh, otherwise recompute.
   */
  async getBaseline(userId: string): Promise<UserHealthBaseline> {
    const cached = await this.getCachedBaseline(userId);
    if (cached) return cached;
    return this.computeBaseline(userId);
  },

  /**
   * Compare the user's CURRENT health state (last 7 days) against their baseline
   * and return a list of meaningful deviations.
   */
  async detectDeviations(
    userId: string,
    baseline: UserHealthBaseline,
    isArabic = false
  ): Promise<BaselineDeviation[]> {
    const deviations: BaselineDeviation[] = [];
    const RECENT_DAYS = 7;

    try {
      // ── 1. Vital deviations ────────────────────────────────────────────
      const recentVitals = await fetchVitalSamples(userId, RECENT_DAYS).catch(
        () => []
      );
      const recentByType: Record<string, number[]> = {};
      for (const v of recentVitals) {
        if (!recentByType[v.type]) recentByType[v.type] = [];
        recentByType[v.type].push(v.value);
      }

      for (const baseVital of baseline.vitals) {
        const recent = recentByType[baseVital.type];
        if (!recent || recent.length < 2) continue;
        const recentAvg = mean(recent);
        const changeRatio =
          (recentAvg - baseVital.average) / (baseVital.average || 1);
        const threshold = Math.max(
          0.1,
          baseVital.stdDev / (baseVital.average || 1)
        );
        const absChange = Math.abs(changeRatio);

        if (absChange < threshold * 1.5) continue; // within 1.5 std devs — noise

        const direction: "above" | "below" =
          changeRatio > 0 ? "above" : "below";
        const severity: BaselineDeviation["severity"] =
          absChange > threshold * 3
            ? "significant"
            : absChange > threshold * 2
              ? "moderate"
              : "mild";

        const vitalLabel = baseVital.type
          .replace(/([A-Z])/g, " $1")
          .toLowerCase();
        const changePct = Math.round(Math.abs(changeRatio) * 100);

        deviations.push({
          dimension: "vital",
          metric: baseVital.type,
          baselineValue: Math.round(baseVital.average * 10) / 10,
          currentValue: Math.round(recentAvg * 10) / 10,
          changeRatio,
          severity,
          direction,
          insight: `Your ${vitalLabel} is ${changePct}% ${direction} your 30-day average (${Math.round(baseVital.average)} ${baseVital.unit ?? ""})`,
          insightAr: `${vitalLabel} لديك ${changePct}% ${direction === "above" ? "أعلى من" : "أقل من"} متوسطك لـ 30 يومًا`,
          actionable: severity !== "mild",
          recommendation:
            severity !== "mild"
              ? `Monitor your ${vitalLabel} closely over the next 48 hours.`
              : undefined,
          recommendationAr:
            severity !== "mild"
              ? `راقب ${vitalLabel} عن كثب خلال الـ 48 ساعة القادمة.`
              : undefined,
        });
      }

      // ── 2. Mood deviation ─────────────────────────────────────────────
      const recentMoods = await moodService
        .getUserMoods(userId, 30)
        .catch(() => [] as Mood[]);
      const recentMoodWindow = recentMoods.filter((m) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - RECENT_DAYS);
        return m.timestamp >= cutoff;
      });

      if (recentMoodWindow.length >= 3 && baseline.moodSampleCount >= 5) {
        const recentIntensity = mean(recentMoodWindow.map((m) => m.intensity));
        const moodChange = recentIntensity - baseline.averageMoodIntensity;
        const absMoodChange = Math.abs(moodChange);

        if (absMoodChange >= 0.8) {
          const isDecline = moodChange < 0;
          deviations.push({
            dimension: "mood",
            metric: "moodIntensity",
            baselineValue: Math.round(baseline.averageMoodIntensity * 10) / 10,
            currentValue: Math.round(recentIntensity * 10) / 10,
            changeRatio: moodChange / (baseline.averageMoodIntensity || 1),
            severity: absMoodChange >= 1.5 ? "significant" : "moderate",
            direction: isDecline ? "below" : "above",
            insight: isDecline
              ? `Your mood has been lower than usual this week (${Math.round(recentIntensity * 10) / 10}/5 vs your average ${Math.round(baseline.averageMoodIntensity * 10) / 10}/5).`
              : "Your mood has been notably positive this week!",
            insightAr: isDecline
              ? "حالتك المزاجية أقل من المعتاد هذا الأسبوع."
              : "حالتك المزاجية إيجابية بشكل ملحوظ هذا الأسبوع!",
            actionable: isDecline,
            recommendation: isDecline
              ? "Prioritise rest, social connection, and activities you enjoy. Consider tracking what may be affecting your mood."
              : undefined,
            recommendationAr: isDecline
              ? "أعطِ الأولوية للراحة والتواصل الاجتماعي والأنشطة التي تستمتع بها."
              : undefined,
          });
        }
      }

      // ── 3. Symptom deviation ──────────────────────────────────────────
      const recentSymptoms = await symptomService
        .getUserSymptoms(userId, 100)
        .catch(() => [] as Symptom[]);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - RECENT_DAYS);
      const recentSymWindow = recentSymptoms.filter(
        (s) => s.timestamp >= cutoff
      );
      const recentSeverityAvg =
        recentSymWindow.length > 0
          ? mean(recentSymWindow.map((s) => s.severity))
          : 0;

      if (
        baseline.symptomSampleCount >= 5 &&
        recentSymWindow.length >= 3 &&
        baseline.averageSymptomSeverity > 0
      ) {
        const severityChange =
          (recentSeverityAvg - baseline.averageSymptomSeverity) /
          (baseline.averageSymptomSeverity || 1);
        if (Math.abs(severityChange) >= 0.25) {
          const isWorse = severityChange > 0;
          deviations.push({
            dimension: "symptoms",
            metric: "symptomSeverity",
            baselineValue:
              Math.round(baseline.averageSymptomSeverity * 10) / 10,
            currentValue: Math.round(recentSeverityAvg * 10) / 10,
            changeRatio: severityChange,
            severity:
              Math.abs(severityChange) > 0.5 ? "significant" : "moderate",
            direction: isWorse ? "above" : "below",
            insight: isWorse
              ? `Your symptoms have been ${Math.round(Math.abs(severityChange) * 100)}% more severe than your usual pattern this week.`
              : "Your symptoms are milder than usual this week — a positive sign!",
            insightAr: isWorse
              ? `أعراضك أشد بنسبة ${Math.round(Math.abs(severityChange) * 100)}% من نمطك المعتاد هذا الأسبوع.`
              : "أعراضك أخف من المعتاد هذا الأسبوع — مؤشر إيجابي!",
            actionable: isWorse,
            recommendation: isWorse
              ? "Log any new triggers or lifestyle changes. If worsening persists, consider consulting your healthcare provider."
              : undefined,
            recommendationAr: isWorse
              ? "سجّل أي محفزات أو تغييرات في نمط الحياة. إذا استمر التدهور، استشر مزودك الصحي."
              : undefined,
          });
        }
      }

      // ── 4. Medication adherence deviation ─────────────────────────────
      const recentAdherence = await fetchMedicationAdherence(
        userId,
        RECENT_DAYS
      );
      if (
        baseline.medicationAdherence >= 70 &&
        recentAdherence < baseline.medicationAdherence - 20
      ) {
        deviations.push({
          dimension: "medication",
          metric: "adherence",
          baselineValue: baseline.medicationAdherence,
          currentValue: recentAdherence,
          changeRatio: (recentAdherence - baseline.medicationAdherence) / 100,
          severity: recentAdherence < 50 ? "significant" : "moderate",
          direction: "below",
          insight: `Your medication adherence dropped to ${recentAdherence}% this week (your usual is ${baseline.medicationAdherence}%).`,
          insightAr: `انخفض الالتزام بالأدوية إلى ${recentAdherence}% هذا الأسبوع (معدلك المعتاد ${baseline.medicationAdherence}%).`,
          actionable: true,
          recommendation:
            "Set daily reminders or use pill organiser to get back on track.",
          recommendationAr:
            "اضبط تذكيرات يومية أو استخدم منظم الحبوب للعودة إلى المسار الصحيح.",
        });
      }

      // ── 5. Sleep deviation ────────────────────────────────────────────
      if (baseline.averageSleepHours !== null) {
        const recentSleepSamples = recentVitals.filter(
          (v) => v.type === "sleep" || v.type === "sleepDuration"
        );
        if (recentSleepSamples.length >= 3) {
          const recentSleep = mean(recentSleepSamples.map((v) => v.value));
          const sleepChange =
            (recentSleep - baseline.averageSleepHours) /
            (baseline.averageSleepHours || 1);
          if (Math.abs(sleepChange) >= 0.15) {
            const isLess = sleepChange < 0;
            deviations.push({
              dimension: "sleep",
              metric: "sleepDuration",
              baselineValue: Math.round(baseline.averageSleepHours * 10) / 10,
              currentValue: Math.round(recentSleep * 10) / 10,
              changeRatio: sleepChange,
              severity:
                Math.abs(sleepChange) > 0.3 ? "significant" : "moderate",
              direction: isLess ? "below" : "above",
              insight: isLess
                ? `You're sleeping ${Math.round(Math.abs(baseline.averageSleepHours - recentSleep) * 10) / 10} hours less than your usual ${Math.round(baseline.averageSleepHours * 10) / 10}h average.`
                : `You're sleeping more than usual — your body may be recovering.`,
              insightAr: isLess
                ? `تنام ${Math.round(Math.abs(baseline.averageSleepHours - recentSleep) * 10) / 10} ساعات أقل من معدلك المعتاد.`
                : "تنام أكثر من المعتاد — قد يتعافى جسمك.",
              actionable: isLess,
              recommendation: isLess
                ? "Aim for 7–9 hours of sleep. Poor sleep affects immune function, mood, and cardiovascular health."
                : undefined,
              recommendationAr: isLess
                ? "استهدف 7–9 ساعات من النوم. يؤثر قلة النوم على المناعة والمزاج وصحة القلب."
                : undefined,
            });
          }
        }
      }

      // ── 6. Activity / steps deviation ─────────────────────────────────
      if (baseline.averageDailySteps !== null) {
        const recentStepSamples = recentVitals.filter(
          (v) => v.type === "steps" || v.type === "stepCount"
        );
        if (recentStepSamples.length >= 3) {
          const recentSteps = mean(recentStepSamples.map((v) => v.value));
          const stepsChange =
            (recentSteps - baseline.averageDailySteps) /
            (baseline.averageDailySteps || 1);
          if (Math.abs(stepsChange) >= 0.2) {
            const isLess = stepsChange < 0;
            deviations.push({
              dimension: "steps",
              metric: "dailySteps",
              baselineValue: Math.round(baseline.averageDailySteps),
              currentValue: Math.round(recentSteps),
              changeRatio: stepsChange,
              severity:
                Math.abs(stepsChange) > 0.4 ? "significant" : "moderate",
              direction: isLess ? "below" : "above",
              insight: isLess
                ? `Your daily steps dropped ${Math.round(Math.abs(stepsChange) * 100)}% below your usual ${Math.round(baseline.averageDailySteps).toLocaleString()} steps.`
                : `You're more active than usual — ${Math.round(recentSteps).toLocaleString()} steps vs your average ${Math.round(baseline.averageDailySteps).toLocaleString()}.`,
              insightAr: isLess
                ? `خطواتك اليومية انخفضت ${Math.round(Math.abs(stepsChange) * 100)}% عن معدلك المعتاد.`
                : "أنت أكثر نشاطًا من المعتاد هذا الأسبوع!",
              actionable: isLess,
              recommendation: isLess
                ? "Try adding a 10-minute walk to your day — even small increases in activity improve health outcomes."
                : undefined,
              recommendationAr: isLess
                ? "حاول إضافة 10 دقائق من المشي إلى يومك — حتى زيادات النشاط الصغيرة تحسن نتائج الصحة."
                : undefined,
            });
          }
        }
      }
    } catch {
      // Partial deviations returned
    }

    // Sort by severity (significant first)
    const order: Record<string, number> = {
      significant: 0,
      moderate: 1,
      mild: 2,
    };
    deviations.sort(
      (a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3)
    );

    return deviations;
  },

  /**
   * Check for significant baseline deviations and send a local push notification
   * if the user hasn't been notified in the last 8 hours.
   *
   * Called by the vitalSyncService after every vital save, and by the daily
   * briefing scheduled job — fire-and-forget, never throws.
   */
  async checkAndNotifySignificantDeviations(
    userId: string,
    isArabic = false
  ): Promise<void> {
    try {
      // Rate-limit: check last notification time
      const notifRow = await api
        .get<{ lastNotificationAt: string | null } | null>("/api/user/baseline/last-notification")
        .catch(() => null);
      if (notifRow?.lastNotificationAt) {
        const lastNotifAt = new Date(notifRow.lastNotificationAt);
        const hoursAgo = (Date.now() - lastNotifAt.getTime()) / 3_600_000;
        if (hoursAgo < 8) return; // Don't spam
      }

      const baseline = await this.getBaseline(userId);
      const deviations = await this.detectDeviations(userId, baseline, isArabic);
      const significant = deviations.filter((d) => d.severity === "significant");
      if (significant.length === 0) return;

      const top = significant[0];
      const { pushNotificationService } = await import("./pushNotificationService");
      await pushNotificationService.sendToUser(userId, {
        title: isArabic ? "تغيير في نمطك الصحي" : "Health Pattern Change",
        body: isArabic ? top.insightAr : top.insight,
        data: {
          type: "vital_alert" as const,
          clickAction: top.dimension === "medication" ? "medications" : "analytics",
        },
        priority: "high",
      });

      // Record notification time
      await api.post("/api/user/baseline/last-notification", {}).catch(() => {});
    } catch {
      // Non-critical — silently ignore
    }
  },

  /**
   * Uses healthInsightScoringService z-scores for more statistically robust
   * vital anomaly detection. Returns vitals with z-score > 2.0 from a larger
   * sample window (30 days) compared to the recent latest value.
   *
   * This complements detectDeviations() which uses ratio-based thresholds.
   */
  async getZScoreVitalAnomalies(userId: string): Promise<
    Array<{
      type: string;
      zScore: number;
      latest: number;
      baseline: number;
      unit?: string;
    }>
  > {
    try {
      const vitalsRaw = await fetchVitalSamples(userId, 30);
      const { getVitalAnomalySignals } = await import(
        "./healthInsightScoringService"
      );
      // Convert to VitalSample shape expected by scoring service
      const scoringSamples = vitalsRaw.map((v) => ({
        id: `${v.type}_${v.timestamp.getTime()}`,
        type: v.type,
        value: v.value,
        unit: v.unit,
        timestamp: v.timestamp,
        source: undefined as string | undefined,
      }));
      return getVitalAnomalySignals(scoringSamples);
    } catch {
      return [];
    }
  },
};
