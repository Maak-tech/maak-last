/**
 * Zeina Analysis Storage
 * Handles persisting Zeina analysis results to Firestore
 */

import * as admin from 'firebase-admin';
import { logger } from '../../observability/logger';
import type { ZeinaAnalysisResult } from './analyze';

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
  analysisResult: ZeinaAnalysisResult,
  traceId?: string
): Promise<void> {
  logger.info('Enriching alert with Zeina analysis', {
    traceId,
    alertId,
    riskScore: analysisResult.riskScore,
    fn: 'zeina.enrichAlertWithAnalysis',
  });

  try {
    const db = admin.firestore();

    await db.collection('alerts').doc(alertId).update({
      // Zeina analysis results
      zeinaAnalysis: {
        riskScore: analysisResult.riskScore,
        riskLevel: analysisResult.riskLevel,
        summary: analysisResult.summary,
        recommendedActions: analysisResult.recommendedActions,
        analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
        version: analysisResult.analysisMetadata.version,
      },
      // Update main alert timestamp
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info('Alert enriched successfully', {
      traceId,
      alertId,
      fn: 'zeina.enrichAlertWithAnalysis',
    });

  } catch (error) {
    logger.error('Failed to enrich alert with analysis', error as Error, {
      traceId,
      alertId,
      fn: 'zeina.enrichAlertWithAnalysis',
    });
    throw error;
  }
}
