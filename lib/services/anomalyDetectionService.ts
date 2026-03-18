/**
 * Anomaly Detection Service
 *
 * Enhanced anomaly detection that builds on healthAnalytics.ts.
 * Adds: automatic baseline refresh, multivariate detection,
 * contextual enrichment, and anomaly history persistence.
 */

import { api } from "@/lib/apiClient";
import {
  healthAnalytics,
  type PersonalizedBaseline,
} from "@/lib/observability/healthAnalytics";
import { logger } from "@/lib/utils/logger";
import type {
  AnomalousVital,
  AnomalyContext,
  AnomalySeverity,
  AnomalyStats,
  BaselineStatus,
  DangerousCombination,
  MultivariateAnomalyResult,
  VitalAnomaly,
} from "@/types/discoveries";
import { medicationService } from "./medicationService";

// ─── Dangerous Vital Combinations ──────────────────────────────────────────

type CombinationRule = {
  vitals: [string, string];
  condition: (v1: number, v2: number) => boolean;
  severity: AnomalySeverity;
  message: string;
  messageAr: string;
};

const DANGEROUS_COMBINATIONS: CombinationRule[] = [
  {
    vitals: ["heart_rate", "blood_oxygen"],
    condition: (hr, o2) => hr > 100 && o2 < 93,
    severity: "critical",
    message:
      "Elevated heart rate with low oxygen — seek immediate medical attention",
    messageAr:
      "ارتفاع معدل ضربات القلب مع انخفاض الأكسجين — اطلب الرعاية الطبية الفورية",
  },
  {
    vitals: ["systolic_bp", "heart_rate"],
    condition: (bp, hr) => bp > 160 && hr > 110,
    severity: "critical",
    message:
      "High blood pressure with rapid heart rate — rest immediately and monitor",
    messageAr: "ارتفاع ضغط الدم مع تسارع ضربات القلب — استرح فوراً وراقب حالتك",
  },
  {
    vitals: ["blood_glucose", "heart_rate"],
    condition: (bg, hr) => bg < 60 && hr > 100,
    severity: "critical",
    message:
      "Low blood sugar with elevated heart rate — consume fast-acting sugar immediately",
    messageAr:
      "انخفاض السكر مع تسارع ضربات القلب — تناول سكراً سريع المفعول فوراً",
  },
  {
    vitals: ["temperature", "heart_rate"],
    condition: (temp, hr) => temp > 38.5 && hr > 100,
    severity: "warning",
    message:
      "Fever with elevated heart rate — rest, hydrate, and monitor closely",
    messageAr: "حمى مع ارتفاع ضربات القلب — استرح واشرب سوائل وراقب حالتك",
  },
  {
    vitals: ["blood_oxygen", "respiratory_rate"],
    condition: (o2, rr) => o2 < 94 && rr > 24,
    severity: "critical",
    message:
      "Low oxygen with rapid breathing — seek immediate medical attention",
    messageAr: "انخفاض الأكسجين مع سرعة التنفس — اطلب الرعاية الطبية الفورية",
  },
];

// ─── Localized Text ─────────────────────────────────────────────────────────

const getLocalizedText = (key: string, isArabic: boolean): string => {
  const texts: Record<string, { en: string; ar: string }> = {
    monitorClosely: {
      en: "Monitor closely and contact your healthcare provider if this persists.",
      ar: "راقب عن كثب واتصل بمقدم الرعاية الصحية إذا استمر الأمر.",
    },
    seekAttention: {
      en: "Seek immediate medical attention. This reading is significantly abnormal.",
      ar: "اطلب الرعاية الطبية الفورية. هذه القراءة غير طبيعية بشكل ملحوظ.",
    },
    aboveBaseline: {
      en: "above your personal baseline",
      ar: "أعلى من مستواك الأساسي",
    },
    belowBaseline: {
      en: "below your personal baseline",
      ar: "أقل من مستواك الأساسي",
    },
    morning: { en: "Morning", ar: "صباحاً" },
    afternoon: { en: "Afternoon", ar: "ظهراً" },
    evening: { en: "Evening", ar: "مساءً" },
    night: { en: "Night", ar: "ليلاً" },
  };
  return texts[key]?.[isArabic ? "ar" : "en"] || texts[key]?.en || key;
};

// ─── Types ──────────────────────────────────────────────────────────────────

type VitalReading = {
  type: string;
  value: number;
  unit: string;
  timestamp: Date;
  userId: string;
};

// ─── Time-of-Day Baseline Cache ──────────────────────────────────────────────

type TODBaseline = {
  mean: number;
  stddev: number;
  sampleCount: number;
  cachedAt: Date;
};

// ─── Service ────────────────────────────────────────────────────────────────

class AnomalyDetectionService {
  private readingCounts: Map<string, number> = new Map();
  private readonly BASELINE_REFRESH_INTERVAL = 10; // refresh after every N readings

  /** Time-of-day baseline cache — keyed by `userId_vitalType_timeOfDay` */
  private todBaselineCache: Map<string, TODBaseline> = new Map();
  private readonly TOD_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

  // ─── Baseline Management ──────────────────────────────────────────────

  /**
   * Refresh baseline for a vital type by fetching recent vitals from the REST API.
   */
  async refreshBaseline(
    userId: string,
    vitalType: string
  ): Promise<PersonalizedBaseline | null> {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/vitals?from=${ninetyDaysAgo.toISOString()}&limit=500`
      );

      const filtered = (raw ?? []).filter((v) => v.type === vitalType);
      if (filtered.length < 10) {
        return null;
      }

      const readings: VitalReading[] = filtered
        .map((v) => ({
          type: vitalType,
          value:
            typeof v.value === "number"
              ? v.value
              : Number.parseFloat(v.value as string),
          unit: (v.unit as string) || "",
          timestamp: v.recordedAt ? new Date(v.recordedAt as string) : new Date(),
          userId,
        }))
        .filter((r) => !Number.isNaN(r.value));

      return await healthAnalytics.updateBaseline(userId, vitalType, readings);
    } catch (error) {
      logger.error(
        "Failed to refresh baseline",
        { userId, vitalType, error },
        "AnomalyDetection"
      );
      return null;
    }
  }

  /**
   * Ensure baselines exist for all vital types the user has data for
   */
  async ensureBaselinesExist(userId: string): Promise<BaselineStatus[]> {
    try {
      const vitalTypes = [
        "heart_rate",
        "systolic_bp",
        "diastolic_bp",
        "blood_oxygen",
        "temperature",
        "blood_glucose",
        "respiratory_rate",
      ];

      const statuses: BaselineStatus[] = [];

      for (const vitalType of vitalTypes) {
        const baseline = await healthAnalytics.getPersonalizedBaseline(
          userId,
          vitalType
        );

        if (baseline) {
          statuses.push({
            vitalType,
            hasBaseline: true,
            sampleCount: baseline.sampleCount,
            lastUpdated: baseline.lastUpdated,
          });
        } else {
          // Try to create baseline from existing data
          const created = await this.refreshBaseline(userId, vitalType);
          statuses.push({
            vitalType,
            hasBaseline: !!created,
            sampleCount: created?.sampleCount ?? 0,
            lastUpdated: created?.lastUpdated,
          });
        }
      }

      return statuses;
    } catch (error) {
      logger.error(
        "Failed to ensure baselines",
        { userId, error },
        "AnomalyDetection"
      );
      return [];
    }
  }

  /**
   * Track reading count and trigger baseline refresh periodically
   */
  private async maybeRefreshBaseline(
    userId: string,
    vitalType: string
  ): Promise<void> {
    const key = `${userId}_${vitalType}`;
    const count = (this.readingCounts.get(key) || 0) + 1;
    this.readingCounts.set(key, count);

    if (count % this.BASELINE_REFRESH_INTERVAL === 0) {
      // Non-blocking baseline refresh
      this.refreshBaseline(userId, vitalType).catch(() => {});
    }
  }

  // ─── Single-Vital Anomaly Detection ───────────────────────────────────

  /**
   * Check a single vital reading against its personalized baseline
   */
  async detectSingleAnomaly(
    reading: VitalReading
  ): Promise<VitalAnomaly | null> {
    const baseline = await healthAnalytics.getPersonalizedBaseline(
      reading.userId,
      reading.type
    );

    if (!baseline) return null;

    const anomaly = healthAnalytics.detectAnomaly(reading, baseline);
    if (!anomaly.isAnomaly) return null;

    const absZScore = Math.abs(anomaly.zScore);
    const severity: AnomalySeverity = absZScore > 4 ? "critical" : "warning";
    const isArabic = false; // determined by caller

    const direction = anomaly.zScore > 0 ? "above" : "below";
    const deviation = Math.abs(anomaly.deviationFromBaseline).toFixed(1);

    return {
      id: "",
      userId: reading.userId,
      vitalType: reading.type,
      value: reading.value,
      unit: reading.unit,
      zScore: anomaly.zScore,
      severity,
      isMultivariate: false,
      recommendation:
        severity === "critical"
          ? getLocalizedText("seekAttention", isArabic)
          : getLocalizedText("monitorClosely", isArabic),
      recommendationAr:
        severity === "critical"
          ? getLocalizedText("seekAttention", true)
          : getLocalizedText("monitorClosely", true),
      timestamp: reading.timestamp,
      acknowledged: false,
    };
  }

  // ─── Multivariate Anomaly Detection ───────────────────────────────────

  /**
   * Detect anomalies across multiple vitals simultaneously
   */
  async detectMultivariateAnomaly(
    userId: string,
    readings: VitalReading[]
  ): Promise<MultivariateAnomalyResult> {
    const anomalousVitals: AnomalousVital[] = [];
    let compositeRiskScore = 0;

    // Check each reading individually
    for (const reading of readings) {
      const baseline = await healthAnalytics.getPersonalizedBaseline(
        userId,
        reading.type
      );
      if (!baseline) continue;

      const anomaly = healthAnalytics.detectAnomaly(reading, baseline);
      const absZScore = Math.abs(anomaly.zScore);

      // Include vitals with z-score > 1.5 (not just anomalies)
      if (absZScore > 1.5) {
        anomalousVitals.push({
          type: reading.type,
          value: reading.value,
          unit: reading.unit,
          zScore: anomaly.zScore,
          baseline: {
            mean: baseline.mean,
            stddev: baseline.standardDeviation,
          },
        });
        // Weight: higher z-scores contribute more
        compositeRiskScore += Math.min(absZScore * 15, 40);
      }
    }

    // Check dangerous combinations
    let dangerousCombination: DangerousCombination | undefined;
    const readingMap = new Map<string, number>();
    for (const r of readings) {
      readingMap.set(r.type, r.value);
    }

    for (const combo of DANGEROUS_COMBINATIONS) {
      const v1 = readingMap.get(combo.vitals[0]);
      const v2 = readingMap.get(combo.vitals[1]);
      if (v1 !== undefined && v2 !== undefined && combo.condition(v1, v2)) {
        dangerousCombination = {
          vitals: combo.vitals,
          severity: combo.severity,
          message: combo.message,
          messageAr: combo.messageAr,
        };
        compositeRiskScore += combo.severity === "critical" ? 40 : 20;
        break;
      }
    }

    compositeRiskScore = Math.min(compositeRiskScore, 100);

    let severity: "normal" | "warning" | "critical";
    if (
      compositeRiskScore >= 60 ||
      dangerousCombination?.severity === "critical"
    ) {
      severity = "critical";
    } else if (compositeRiskScore >= 30 || anomalousVitals.length >= 2) {
      severity = "warning";
    } else {
      severity = "normal";
    }

    const recommendation = dangerousCombination
      ? dangerousCombination.message
      : severity === "critical"
        ? getLocalizedText("seekAttention", false)
        : severity === "warning"
          ? getLocalizedText("monitorClosely", false)
          : "";

    return {
      isAnomaly: severity !== "normal",
      compositeRiskScore,
      severity,
      anomalousVitals,
      dangerousCombination,
      recommendation,
      recommendationAr: dangerousCombination
        ? dangerousCombination.messageAr
        : severity === "critical"
          ? getLocalizedText("seekAttention", true)
          : severity === "warning"
            ? getLocalizedText("monitorClosely", true)
            : "",
    };
  }

  // ─── Time-of-Day Baselines ────────────────────────────────────────────

  /**
   * Compute mean/stddev for a vital type restricted to a specific time-of-day
   * bucket (morning/afternoon/evening/night), using the last 90 days of data.
   * Results are cached in memory for 6 hours.
   */
  private async computeTimeOfDayBaseline(
    userId: string,
    vitalType: string,
    timeOfDay: "morning" | "afternoon" | "evening" | "night"
  ): Promise<TODBaseline | null> {
    const cacheKey = `${userId}_${vitalType}_${timeOfDay}`;
    const cached = this.todBaselineCache.get(cacheKey);
    if (
      cached &&
      Date.now() - cached.cachedAt.getTime() < this.TOD_CACHE_TTL_MS
    ) {
      return cached;
    }

    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/vitals?from=${ninetyDaysAgo.toISOString()}&limit=500`
      );

      const filtered = (raw ?? []).filter((v) => v.type === vitalType);
      if (filtered.length === 0) return null;

      // Filter readings to the requested time bucket
      const bucketValues: number[] = [];
      for (const v of filtered) {
        const ts: Date = v.recordedAt ? new Date(v.recordedAt as string) : new Date();
        if (this.getTimeOfDay(ts) !== timeOfDay) continue;
        const val =
          typeof v.value === "number"
            ? v.value
            : Number.parseFloat(v.value as string);
        if (!Number.isNaN(val)) bucketValues.push(val);
      }

      // Need at least 5 samples in this bucket to be meaningful
      if (bucketValues.length < 5) return null;

      const mean =
        bucketValues.reduce((a, b) => a + b, 0) / bucketValues.length;
      const variance =
        bucketValues.reduce((s, v) => s + (v - mean) ** 2, 0) /
        bucketValues.length;
      const stddev = Math.sqrt(variance);

      const result: TODBaseline = {
        mean,
        stddev,
        sampleCount: bucketValues.length,
        cachedAt: new Date(),
      };
      this.todBaselineCache.set(cacheKey, result);
      return result;
    } catch {
      return null;
    }
  }

  // ─── Contextual Enrichment ────────────────────────────────────────────

  /**
   * Get time-of-day category for a timestamp
   */
  private getTimeOfDay(
    timestamp: Date
  ): "morning" | "afternoon" | "evening" | "night" {
    const hour = timestamp.getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
  }

  /**
   * Enrich an anomaly with contextual information
   */
  async enrichAnomalyContext(
    userId: string,
    anomaly: Omit<VitalAnomaly, "context">
  ): Promise<AnomalyContext> {
    const timeOfDay = this.getTimeOfDay(anomaly.timestamp);

    // Historical frequency: not available without a dedicated endpoint — default to 0
    const historicalFrequency = 0;

    // Check recent medications
    let recentMedications: string[] | undefined;
    try {
      const meds = await medicationService.getUserMedications(userId);
      const activeMeds = meds.filter((m) => m.isActive);
      if (activeMeds.length > 0) {
        recentMedications = activeMeds.map((m) => m.name).slice(0, 5);
      }
    } catch {
      // Silently fail
    }

    // Determine if this reading is within the normal range for this time of day.
    // A reading is "typical for the time" if it falls within ±1.5 stddev of
    // the time-of-day-specific mean (requires ≥5 historical samples in that bucket).
    let isTypicalForTime = false;
    try {
      const todBaseline = await this.computeTimeOfDayBaseline(
        userId,
        anomaly.vitalType,
        timeOfDay
      );
      if (todBaseline) {
        const deviation = Math.abs(anomaly.value - todBaseline.mean);
        isTypicalForTime = deviation <= 1.5 * todBaseline.stddev;
      }
    } catch {
      // Silently fail — default stays false
    }

    return {
      timeOfDay,
      isTypicalForTime,
      recentMedications,
      historicalFrequency,
    };
  }

  // ─── Main Entry Point ─────────────────────────────────────────────────

  /**
   * Check a new vital reading for anomalies and persist if found.
   * Called from vitalSyncService after saving a vital.
   */
  async checkAndPersistAnomaly(
    userId: string,
    newReading: VitalReading
  ): Promise<VitalAnomaly | null> {
    try {
      // Trigger periodic baseline refresh
      await this.maybeRefreshBaseline(userId, newReading.type);

      // Single-vital anomaly check
      const singleAnomaly = await this.detectSingleAnomaly(newReading);
      if (!singleAnomaly) return null;

      // Fetch recent readings for multivariate check (last 1 hour)
      const oneHourAgo = new Date(
        newReading.timestamp.getTime() - 60 * 60 * 1000
      );
      let recentReadings: VitalReading[] = [newReading];

      try {
        const raw = await api.get<Record<string, unknown>[]>(
          `/api/health/vitals?from=${oneHourAgo.toISOString()}&limit=20`
        );
        const otherReadings = (raw ?? [])
          .map((v) => ({
            type: v.type as string,
            value:
              typeof v.value === "number"
                ? v.value
                : Number.parseFloat(v.value as string),
            unit: (v.unit as string) || "",
            timestamp: v.recordedAt ? new Date(v.recordedAt as string) : new Date(),
            userId,
          }))
          .filter((r) => !Number.isNaN(r.value) && r.type !== newReading.type);

        // Dedupe by type (keep latest)
        const byType = new Map<string, VitalReading>();
        for (const r of otherReadings) {
          const existing = byType.get(r.type);
          if (!existing || r.timestamp > existing.timestamp) {
            byType.set(r.type, r);
          }
        }
        recentReadings = [newReading, ...byType.values()];
      } catch {
        // Fall back to single-vital only
      }

      // Run multivariate check if we have multiple vital types
      let multivariateResult: MultivariateAnomalyResult | undefined;
      if (recentReadings.length > 1) {
        multivariateResult = await this.detectMultivariateAnomaly(
          userId,
          recentReadings
        );
      }

      // Determine final anomaly
      const isMultivariate =
        !!multivariateResult?.isAnomaly &&
        (multivariateResult.anomalousVitals.length > 1 ||
          !!multivariateResult.dangerousCombination);

      const finalSeverity: AnomalySeverity =
        multivariateResult?.severity === "critical"
          ? "critical"
          : singleAnomaly.severity;

      // Enrich with context
      const context = await this.enrichAnomalyContext(userId, singleAnomaly);

      // Build final anomaly record
      const anomaly: VitalAnomaly = {
        ...singleAnomaly,
        id: "",
        severity: finalSeverity,
        isMultivariate,
        contributingFactors: isMultivariate
          ? multivariateResult?.anomalousVitals
              .filter((v) => v.type !== newReading.type)
              .map((v) => v.type)
          : undefined,
        context,
        recommendation: multivariateResult?.dangerousCombination
          ? multivariateResult.dangerousCombination.message
          : singleAnomaly.recommendation,
        recommendationAr: multivariateResult?.dangerousCombination
          ? multivariateResult.dangerousCombination.messageAr
          : singleAnomaly.recommendationAr,
      };

      // Best-effort: record anomaly as a timeline event (no dedicated endpoint yet)
      try {
        await api.post("/api/health/timeline", {
          userId,
          eventType: "vital_abnormal",
          title: "Anomaly detected",
          vitalType: newReading.type,
          value: newReading.value,
          severity: finalSeverity,
          isMultivariate,
          zScore: singleAnomaly.zScore,
          timestamp: anomaly.timestamp.toISOString(),
        });
      } catch {
        // Non-critical — silently skip
      }

      logger.info(
        "Anomaly detected and persisted",
        {
          userId,
          vitalType: newReading.type,
          severity: finalSeverity,
          isMultivariate,
          zScore: singleAnomaly.zScore,
        },
        "AnomalyDetection"
      );

      return anomaly;
    } catch (error) {
      logger.error(
        "Failed to check anomaly",
        { userId, vitalType: newReading.type, error },
        "AnomalyDetection"
      );
      return null;
    }
  }

  // ─── History & Stats ──────────────────────────────────────────────────

  /**
   * Get anomaly history for a user
   */
  async getAnomalyHistory(
    userId: string,
    vitalType?: string,
    days = 30
  ): Promise<VitalAnomaly[]> {
    // No dedicated anomaly history endpoint — return empty array
    return [];
  }

  /**
   * Get summary statistics for anomalies
   */
  async getAnomalyStats(userId: string): Promise<AnomalyStats> {
    try {
      const anomalies = await this.getAnomalyHistory(userId, undefined, 30);
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const sevenDaysMs = 7 * oneDayMs;

      const stats: AnomalyStats = {
        total: anomalies.length,
        byVitalType: {},
        bySeverity: { warning: 0, critical: 0 },
        last24h: 0,
        last7d: 0,
      };

      for (const a of anomalies) {
        stats.byVitalType[a.vitalType] =
          (stats.byVitalType[a.vitalType] || 0) + 1;
        stats.bySeverity[a.severity]++;
        const age = now - a.timestamp.getTime();
        if (age <= oneDayMs) stats.last24h++;
        if (age <= sevenDaysMs) stats.last7d++;
      }

      return stats;
    } catch (error) {
      logger.error(
        "Failed to get anomaly stats",
        { userId, error },
        "AnomalyDetection"
      );
      return {
        total: 0,
        byVitalType: {},
        bySeverity: { warning: 0, critical: 0 },
        last24h: 0,
        last7d: 0,
      };
    }
  }

  /**
   * Acknowledge an anomaly
   */
  async acknowledgeAnomaly(userId: string, anomalyId: string): Promise<void> {
    // No dedicated endpoint for acknowledgement — silently no-op
    try {
      // no-op
    } catch {
      // Silently skip
    }
  }
}

export const anomalyDetectionService = new AnomalyDetectionService();
