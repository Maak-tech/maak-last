/**
 * Vitals Firestore Trigger
 * Processes new vital readings and checks against benchmarks
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from '../observability/logger';
import { createTraceId } from '../observability/correlation';
import { processVitalReading } from '../modules/vitals/pipeline';
import type { VitalType } from '../modules/alerts/engine';

/**
 * Firestore trigger: Check vitals against benchmarks when new vital is created
 * Uses the unified vitals processing pipeline
 */
export const checkVitalBenchmarks = onDocumentCreated(
  'vitals/{vitalId}',
  async (event) => {
    const traceId = createTraceId();
    const vitalId = event.params.vitalId;
    
    const vitalData = event.data?.data();
    if (!vitalData) {
      return;
    }

    const { userId, type, value, unit, systolic, diastolic, source, deviceId } = vitalData;

    if (!userId || !type || typeof value !== 'number') {
      logger.debug('Invalid vital data, skipping check', {
        traceId,
        vitalId,
        fn: 'checkVitalBenchmarks',
      });
      return;
    }

    logger.info('Processing vital via pipeline', {
      traceId,
      vitalId,
      patientId: userId,
      fn: 'checkVitalBenchmarks',
    });

    try {
      // Use unified pipeline for processing
      const result = await processVitalReading({
        traceId,
        reading: {
          userId,
          type: type as VitalType,
          value,
          unit: unit || '',
          systolic,
          diastolic,
          source,
          deviceId,
          vitalId, // Already persisted
        },
        skipPersistence: true, // Already in Firestore from the trigger
      });

      if (result.success) {
        logger.info('Vital processing completed via pipeline', {
          traceId,
          vitalId,
          patientId: userId,
          alertId: result.alertId,
          notificationsSent: result.notificationsSent,
          fn: 'checkVitalBenchmarks',
        });
      } else {
        logger.warn('Vital processing failed via pipeline', {
          traceId,
          vitalId,
          patientId: userId,
          error: result.error,
          fn: 'checkVitalBenchmarks',
        });
      }
    } catch (error) {
      logger.error('Error in checkVitalBenchmarks', error as Error, {
        traceId,
        vitalId,
        patientId: userId,
        fn: 'checkVitalBenchmarks',
      });
      // Don't throw - this is a background function
    }
  }
);
