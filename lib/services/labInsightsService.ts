/**
 * Lab Insights Service
 *
 * Analyses stored lab results: flags out-of-range values, tracks biomarker
 * trends over time, and generates an AI narrative interpretation.
 * Premium Individual+ feature.
 */

import { api } from "@/lib/apiClient";
import openaiService from "@/lib/services/openaiService";
import type { LabResult, LabResultValue } from "@/types";

export type BiomarkerTrend = {
  name: string;
  unit: string;
  values: Array<{
    date: Date;
    value: number;
    status: LabResultValue["status"];
  }>;
  trend: "rising" | "falling" | "stable";
  latest: LabResultValue & { testDate: Date };
  isFlagged: boolean;
  isCritical: boolean;
};

export type LabInsightsSummary = {
  flaggedCount: number;
  criticalCount: number;
  biomarkers: BiomarkerTrend[];
  flaggedBiomarkers: BiomarkerTrend[];
  aiNarrative: string;
  aiNarrativeAr: string;
  generatedAt: Date;
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, { data: LabInsightsSummary; at: number }>();

function isCacheValid(userId: string): boolean {
  const entry = cache.get(userId);
  if (!entry) return false;
  return Date.now() - entry.at < CACHE_TTL_MS;
}

// ─── Biomarker name normalisation ─────────────────────────────────────────────
// Maps common variant spellings / abbreviations → canonical display name.
// All keys must be lowercase.
const BIOMARKER_ALIASES: Record<string, string> = {
  // Haemoglobin A1c
  "hba1c": "HbA1c",
  "hba1 c": "HbA1c",
  "a1c": "HbA1c",
  "glycated hemoglobin": "HbA1c",
  "glycated haemoglobin": "HbA1c",
  "hemoglobin a1c": "HbA1c",
  "haemoglobin a1c": "HbA1c",
  // Glucose
  "glucose": "Blood Glucose",
  "blood glucose": "Blood Glucose",
  "fasting glucose": "Fasting Glucose",
  "fasting blood glucose": "Fasting Glucose",
  "blood sugar": "Blood Glucose",
  // Cholesterol family
  "cholesterol": "Total Cholesterol",
  "total cholesterol": "Total Cholesterol",
  "ldl": "LDL Cholesterol",
  "ldl-c": "LDL Cholesterol",
  "ldl cholesterol": "LDL Cholesterol",
  "low-density lipoprotein": "LDL Cholesterol",
  "hdl": "HDL Cholesterol",
  "hdl-c": "HDL Cholesterol",
  "hdl cholesterol": "HDL Cholesterol",
  "high-density lipoprotein": "HDL Cholesterol",
  "triglycerides": "Triglycerides",
  "triglyceride": "Triglycerides",
  "tg": "Triglycerides",
  // Kidney markers
  "creatinine": "Creatinine",
  "serum creatinine": "Creatinine",
  "egfr": "eGFR",
  "estimated gfr": "eGFR",
  "gfr": "eGFR",
  "bun": "BUN",
  "blood urea nitrogen": "BUN",
  "urea": "BUN",
  // Liver markers
  "alt": "ALT",
  "alanine aminotransferase": "ALT",
  "sgpt": "ALT",
  "ast": "AST",
  "aspartate aminotransferase": "AST",
  "sgot": "AST",
  "alp": "ALP",
  "alkaline phosphatase": "ALP",
  "ggt": "GGT",
  "gamma-glutamyl transferase": "GGT",
  "bilirubin": "Bilirubin",
  "total bilirubin": "Bilirubin",
  // Blood count
  "hemoglobin": "Hemoglobin",
  "haemoglobin": "Hemoglobin",
  "hgb": "Hemoglobin",
  "hb": "Hemoglobin",
  "wbc": "WBC",
  "white blood cell": "WBC",
  "white blood cells": "WBC",
  "leukocytes": "WBC",
  "rbc": "RBC",
  "red blood cell": "RBC",
  "red blood cells": "RBC",
  "erythrocytes": "RBC",
  "platelets": "Platelets",
  "platelet count": "Platelets",
  "plt": "Platelets",
  "hematocrit": "Hematocrit",
  "haematocrit": "Hematocrit",
  "hct": "Hematocrit",
  "mcv": "MCV",
  // Thyroid
  "tsh": "TSH",
  "thyroid-stimulating hormone": "TSH",
  "thyroid stimulating hormone": "TSH",
  "t3": "T3",
  "t4": "T4",
  "free t3": "Free T3",
  "free t4": "Free T4",
  "ft3": "Free T3",
  "ft4": "Free T4",
  // Iron
  "iron": "Iron",
  "serum iron": "Iron",
  "ferritin": "Ferritin",
  "transferrin": "Transferrin",
  "tibc": "TIBC",
  // Electrolytes
  "sodium": "Sodium",
  "potassium": "Potassium",
  "chloride": "Chloride",
  "calcium": "Calcium",
  "magnesium": "Magnesium",
  "phosphorus": "Phosphorus",
  "phosphate": "Phosphorus",
  // Other common
  "vitamin d": "Vitamin D",
  "25-oh vitamin d": "Vitamin D",
  "25-hydroxyvitamin d": "Vitamin D",
  "vitamin b12": "Vitamin B12",
  "cobalamin": "Vitamin B12",
  "folate": "Folate",
  "folic acid": "Folate",
  "uric acid": "Uric Acid",
  "crp": "CRP",
  "c-reactive protein": "CRP",
  "esr": "ESR",
  "psa": "PSA",
  "prostate-specific antigen": "PSA",
  "inr": "INR",
  "pt": "Prothrombin Time",
  "prothrombin time": "Prothrombin Time",
  "aptt": "APTT",
  "d-dimer": "D-Dimer",
};

/** Returns a canonical display name for a biomarker, preserving original capitalisation only as fallback */
function normalizeBiomarkerName(raw: string): string {
  const key = raw.toLowerCase().trim();
  if (BIOMARKER_ALIASES[key]) return BIOMARKER_ALIASES[key];
  // Title-case the raw name as fallback
  return raw
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function computeTrend(values: number[]): BiomarkerTrend["trend"] {
  if (values.length < 2) return "stable";
  const first = values[0];
  const last = values[values.length - 1];
  const diff = last - first;
  const pct = Math.abs(diff) / (Math.abs(first) || 1);
  if (pct < 0.05) return "stable";
  return diff > 0 ? "rising" : "falling";
}

export async function analyzeLabResults(
  userId: string,
  forceRefresh = false
): Promise<LabInsightsSummary> {
  if (!forceRefresh && isCacheValid(userId)) {
    // biome-ignore lint/style/noNonNullAssertion: checked above
    return cache.get(userId)!.data;
  }

  try {
    const raw = await api.get<Record<string, unknown>[]>(
      "/api/health/lab-results?limit=200&orderBy=testDate:asc"
    );

    if (!raw || raw.length === 0) {
      return {
        flaggedCount: 0,
        criticalCount: 0,
        biomarkers: [],
        flaggedBiomarkers: [],
        aiNarrative:
          "No lab results found. Add your lab results to get AI insights.",
        aiNarrativeAr:
          "لم يتم العثور على نتائج مختبر. أضف نتائجك للحصول على رؤى الذكاء الاصطناعي.",
        generatedAt: new Date(),
      };
    }

    const results: LabResult[] = raw.map((data) => {
      return {
        ...(data as Omit<LabResult, "id">),
        id: (data.id as string) ?? "",
        testDate: data.testDate ? new Date(data.testDate as string) : new Date(),
      };
    });

    // Group by biomarker name across all results
    const biomarkerMap = new Map<
      string,
      Array<{
        date: Date;
        value: number;
        unit: string;
        status: LabResultValue["status"];
        rawName: string;
      }>
    >();

    for (const result of results) {
      for (const val of result.results ?? []) {
        const numVal =
          typeof val.value === "number"
            ? val.value
            : Number.parseFloat(String(val.value));
        if (Number.isNaN(numVal)) continue;

        // Use normalized canonical name as grouping key so aliases merge correctly
        const key = normalizeBiomarkerName(val.name);
        if (!biomarkerMap.has(key)) biomarkerMap.set(key, []);
        biomarkerMap.get(key)!.push({
          date: result.testDate,
          value: numVal,
          unit: val.unit ?? "",
          status: val.status,
          rawName: key, // store canonical name
        });
      }
    }

    const biomarkers: BiomarkerTrend[] = [];

    for (const [, entries] of biomarkerMap.entries()) {
      const sorted = [...entries].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );
      const latest = sorted[sorted.length - 1];
      const isFlagged = sorted.some(
        (e) =>
          e.status === "low" || e.status === "high" || e.status === "critical"
      );
      const isCritical = sorted.some((e) => e.status === "critical");
      const trend = computeTrend(sorted.map((e) => e.value));

      // rawName is already canonical (set during grouping)
      const displayName = latest.rawName;

      // Find the matching LabResultValue for the latest entry.
      // Both sides are normalised so aliases like "A1c" correctly match "HbA1c".
      const latestLabVal = results
        .flatMap((r) => r.results ?? [])
        .find(
          (v) =>
            normalizeBiomarkerName(v.name) === latest.rawName
        ) ?? {
        name: displayName,
        value: latest.value,
        unit: latest.unit,
        status: latest.status,
      };

      biomarkers.push({
        name: displayName,
        unit: latest.unit,
        values: sorted.map((e) => ({
          date: e.date,
          value: e.value,
          status: e.status,
        })),
        trend,
        latest: { ...latestLabVal, testDate: latest.date },
        isFlagged,
        isCritical,
      });
    }

    const flaggedBiomarkers = biomarkers.filter((b) => b.isFlagged);
    const flaggedCount = flaggedBiomarkers.length;
    const criticalCount = biomarkers.filter((b) => b.isCritical).length;

    // Generate AI narrative for flagged values
    let aiNarrative =
      flaggedCount === 0
        ? "All lab values are within normal ranges. Great job maintaining your health!"
        : `${flaggedCount} biomarker(s) have values outside the normal range. Review your results with your doctor.`;
    let aiNarrativeAr =
      flaggedCount === 0
        ? "جميع قيم المختبر ضمن النطاق الطبيعي. عمل رائع في الحفاظ على صحتك!"
        : `${flaggedCount} مؤشر (مؤشرات) لها قيم خارج النطاق الطبيعي. راجع نتائجك مع طبيبك.`;

    if (flaggedCount > 0) {
      try {
        const flaggedSummary = flaggedBiomarkers
          .slice(0, 5)
          .map((b) => {
            const trendStr =
              b.trend === "rising"
                ? "trending up"
                : b.trend === "falling"
                  ? "trending down"
                  : "stable";
            const historyStr =
              b.values.length >= 2
                ? ` (${b.values.length} readings over time)`
                : "";
            return `${b.name}: ${b.latest.value} ${b.unit} — ${b.latest.status ?? "flagged"}, ${trendStr}${historyStr}`;
          })
          .join("\n");

        const prompt = `A patient has the following flagged lab results:\n${flaggedSummary}\n\nProvide a concise 2-3 sentence plain-language interpretation. For each flagged marker, note whether the trend is improving or worsening. Focus on what the pattern suggests about their health and give 1-2 practical lifestyle recommendations. Do NOT provide specific medical diagnoses, drug names, or treatment plans. Respond strictly with JSON: {"narrative": "...", "narrativeAr": "..."}`;

        const response = await openaiService.generateHealthInsights(prompt);
        if (response?.narrative && typeof response.narrative === "string") {
          aiNarrative = response.narrative;
        }
        if (response?.narrativeAr && typeof response.narrativeAr === "string") {
          aiNarrativeAr = response.narrativeAr;
        }
      } catch {
        // Use default narrative
      }
    }

    const summary: LabInsightsSummary = {
      flaggedCount,
      criticalCount,
      biomarkers,
      flaggedBiomarkers,
      aiNarrative,
      aiNarrativeAr,
      generatedAt: new Date(),
    };

    cache.set(userId, { data: summary, at: Date.now() });

    // Best-effort cache via REST API
    api.post("/api/health/lab-insights/cache", {
      userId,
      flaggedCount,
      criticalCount,
      aiNarrative,
      aiNarrativeAr,
      generatedAt: new Date().toISOString(),
    }).catch(() => {});

    return summary;
  } catch (_error) {
    return {
      flaggedCount: 0,
      criticalCount: 0,
      biomarkers: [],
      flaggedBiomarkers: [],
      aiNarrative: "Unable to analyse lab results at this time.",
      aiNarrativeAr: "تعذر تحليل نتائج المختبر في الوقت الحالي.",
      generatedAt: new Date(),
    };
  }
}

export function invalidateLabInsightsCache(userId: string): void {
  cache.delete(userId);
}

export const labInsightsService = {
  analyzeLabResults,
  invalidateLabInsightsCache,
};
