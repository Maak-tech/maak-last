/**
 * Zeina Analysis Storage
 * Handles persisting Zeina analysis results to Firestore
 */

import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "../../observability/logger";

// Types handled inline for flexibility with legacy format

type LegacyAnalysisResult = {
  riskScore: number;
  summary?: string;
  riskLevel?: string;
  recommendedActions?: unknown[];
  recommendedActionCode?: string;
  analysisMetadata?: {
    version?: string;
  };
  version?: string;
};

function deriveRiskLevel(analysisResult: LegacyAnalysisResult): string {
  if (analysisResult.riskLevel) {
    return analysisResult.riskLevel;
  }
  if (analysisResult.riskScore > 75) {
    return "high";
  }
  if (analysisResult.riskScore > 50) {
    return "moderate";
  }
  return "low";
}

/**
 * Enrich alert document with Zeina analysis
 * Stores analysis results on the alert document without raw chat logs
 *
 * @param alertId - Alert document ID
 * @param analysisResult - Zeina analysis result
 * @param traceId - Optional trace ID for logging
 * @returns Promise that resolves when update is complete
 */
export async function enrichAlertWithAnalysis(
  alertId: string,
  analysisResult: LegacyAnalysisResult, // Supports both old and new format
  traceId?: string
): Promise<void> {
  logger.info("Enriching alert with Zeina analysis", {
    traceId,
    alertId,
    riskScore: analysisResult.riskScore,
    fn: "zeina.enrichAlertWithAnalysis",
  });

  try {
    const db = getFirestore();

    // Extract values safely to support both ZeinaOutput and legacy format
    const riskLevel = deriveRiskLevel(analysisResult);
    const recommendedActions =
      analysisResult.recommendedActions ||
      (analysisResult.recommendedActionCode
        ? [{ code: analysisResult.recommendedActionCode }]
        : []);
    const version =
      analysisResult.analysisMetadata?.version ||
      analysisResult.version ||
      "1.0.0";

    await db
      .collection("alerts")
      .doc(alertId)
      .update({
        // Zeina analysis results
        zeinaAnalysis: {
          riskScore: analysisResult.riskScore,
          riskLevel,
          summary: analysisResult.summary,
          recommendedActions,
          analyzedAt: FieldValue.serverTimestamp(),
          version,
        },
        // Update main alert timestamp
        updatedAt: FieldValue.serverTimestamp(),
      });

    logger.info("Alert enriched successfully", {
      traceId,
      alertId,
      fn: "zeina.enrichAlertWithAnalysis",
    });
  } catch (error) {
    logger.error("Failed to enrich alert with analysis", error as Error, {
      traceId,
      alertId,
      fn: "zeina.enrichAlertWithAnalysis",
    });
    throw error;
  }
}
