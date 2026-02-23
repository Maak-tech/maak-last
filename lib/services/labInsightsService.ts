/**
 * Lab Insights Service
 *
 * Analyses stored lab results: flags out-of-range values, tracks biomarker
 * trends over time, and generates an AI narrative interpretation.
 * Premium Individual+ feature.
 */

import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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
    const labResultsRef = collection(db, "users", userId, "lab_results");
    const snap = await getDocs(
      query(labResultsRef, orderBy("testDate", "asc"))
    );

    if (snap.empty) {
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

    const results: LabResult[] = snap.docs.map((d) => {
      const data = d.data() as Omit<LabResult, "id">;
      return {
        ...data,
        id: d.id,
        testDate:
          data.testDate instanceof Timestamp
            ? data.testDate.toDate()
            : new Date(data.testDate as unknown as string),
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

        const key = val.name.toLowerCase().trim();
        if (!biomarkerMap.has(key)) biomarkerMap.set(key, []);
        biomarkerMap.get(key)!.push({
          date: result.testDate,
          value: numVal,
          unit: val.unit,
          status: val.status,
          rawName: val.name,
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

      const displayName =
        latest.rawName.charAt(0).toUpperCase() + latest.rawName.slice(1);

      // Find the matching LabResultValue for the latest entry
      const latestLabVal = results
        .flatMap((r) => r.results ?? [])
        .find(
          (v) =>
            v.name.toLowerCase().trim() === latest.rawName.toLowerCase().trim()
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
          .map(
            (b) =>
              `${b.name}: ${b.latest.value} ${b.unit} (${b.latest.status ?? "flagged"})`
          )
          .join(", ");

        const prompt = `A patient has the following flagged lab results: ${flaggedSummary}.
Provide a brief 2-3 sentence plain-language interpretation. Focus on what these values might mean and general lifestyle recommendations. Do NOT provide specific medical diagnoses or treatment plans. Respond with JSON: {"narrative": "...", "narrativeAr": "..."}`;

        const response = await openaiService.generateHealthInsights(prompt);
        if (response?.narrative && typeof response.narrative === "string") {
          aiNarrative = response.narrative;
        }
        if (
          response?.narrativeAr &&
          typeof response.narrativeAr === "string"
        ) {
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

    // Cache in Firestore for offline access
    try {
      await setDoc(doc(db, "users", userId, "lab_insights", "latest"), {
        flaggedCount,
        criticalCount,
        aiNarrative,
        aiNarrativeAr,
        generatedAt: Timestamp.now(),
      });
    } catch {
      // Non-critical
    }

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
