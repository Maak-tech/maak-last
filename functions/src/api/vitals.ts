/**
 * Vitals API Handler
 * Orchestrates vital ingestion: validation, persistence, alerting, audit
 */

import { Timestamp } from "firebase-admin/firestore";
import { https } from "firebase-functions";
import type { CallableContext } from "firebase-functions/v1/https";
import { getAuditLogsCollection, getVitalsCollection } from "../db/collections";
import {
  checkVitalBenchmark,
  createAlertMessage,
  type VitalType,
} from "../modules/alerts/engine";
import {
  createVitalReading,
  type VitalInput,
  validateVitalInput,
} from "../modules/vitals/ingest";
import { createTraceId } from "../observability/correlation";
import { logger } from "../observability/logger";
import { getAuthContext } from "../security/authContext";
import { assertCanWritePatient } from "../security/rbac";

export type IngestVitalRequest = {
  userId: string;
  type: VitalType;
  value: number;
  unit: string;
  systolic?: number;
  diastolic?: number;
  source?: "manual" | "device" | "healthkit" | "googlefit" | "oura" | "garmin";
  deviceId?: string;
  timestamp?: string; // ISO 8601 format
};

export type IngestVitalResponse = {
  success: boolean;
  vitalId?: string;
  alert?: {
    severity: "critical" | "warning";
    direction: "low" | "high";
    message: string;
  };
  errors?: Array<{ field: string; message: string }>;
};

/**
 * Ingest vital reading
 * HTTP callable function (v1 API for compatibility)
 */
export async function ingestVital(
  data: IngestVitalRequest,
  context: CallableContext
): Promise<IngestVitalResponse> {
  const traceId = createTraceId();

  logger.info("Vital ingestion started", {
    traceId,
    uid: context.auth?.uid,
    patientId: data.userId,
    fn: "ingestVital",
  });

  try {
    // 1. Extract and enrich auth context
    const authContext = await getAuthContext(context);
    if (!authContext) {
      logger.warn("Unauthenticated vital ingestion attempt", {
        traceId,
        fn: "ingestVital",
      });
      throw new https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    // 2. Check permissions (RBAC)
    try {
      await assertCanWritePatient({
        actor: authContext,
        patientId: data.userId,
      });
    } catch (error) {
      logger.warn("Permission denied for vital ingestion", {
        traceId,
        uid: authContext.uid,
        patientId: data.userId,
        fn: "ingestVital",
      });
      throw error;
    }

    // 3. Validate input (pure function from ingest module)
    const vitalInput: VitalInput = {
      userId: data.userId,
      type: data.type,
      value: data.value,
      unit: data.unit,
      systolic: data.systolic,
      diastolic: data.diastolic,
      source: data.source,
      deviceId: data.deviceId,
      timestamp: data.timestamp ? new Date(data.timestamp) : undefined,
    };

    const validation = validateVitalInput(vitalInput);
    if (!validation.isValid) {
      logger.warn("Invalid vital input", {
        traceId,
        uid: authContext.uid,
        patientId: data.userId,
        fn: "ingestVital",
      });
      return {
        success: false,
        errors: validation.errors,
      };
    }

    // 4. Create normalized vital reading (pure function)
    const vitalReading = createVitalReading(vitalInput);

    // 5. Persist to Firestore
    const vitalsCollection = getVitalsCollection();
    const vitalDoc = await vitalsCollection.add({
      ...vitalReading,
      timestamp: Timestamp.fromDate(vitalReading.timestamp as Date),
      createdAt: Timestamp.now(),
    });

    const vitalId = vitalDoc.id;

    logger.info("Vital persisted", {
      traceId,
      uid: authContext.uid,
      patientId: data.userId,
      vitalId,
      fn: "ingestVital",
    });

    // 6. Check alert thresholds (pure function from alert engine)
    const alertCheck = checkVitalBenchmark(data.type, data.value);
    let alertInfo: IngestVitalResponse["alert"] | undefined;

    if (alertCheck.isAlert && alertCheck.severity && alertCheck.direction) {
      const alertMessage = createAlertMessage(
        data.type,
        data.value,
        vitalReading.unit,
        alertCheck.severity,
        alertCheck.direction
      );

      alertInfo = {
        severity: alertCheck.severity,
        direction: alertCheck.direction,
        message: alertMessage.message,
      };

      logger.info("Vital alert detected", {
        traceId,
        uid: authContext.uid,
        patientId: data.userId,
        vitalId,
        fn: "ingestVital",
      });

      // Note: Alert notification is handled by checkVitalBenchmarks Firestore trigger
      // This keeps the ingestion API fast and decouples alerting
    }

    // 7. Record audit event
    try {
      const auditCollection = getAuditLogsCollection();
      await auditCollection.add({
        userId: authContext.uid,
        action: "create",
        resourceType: "vital",
        resourceId: vitalId,
        targetUserId: data.userId,
        familyId: authContext.familyId,
        timestamp: Timestamp.now(),
      });

      logger.debug("Audit event recorded", {
        traceId,
        uid: authContext.uid,
        patientId: data.userId,
        vitalId,
        fn: "ingestVital",
      });
    } catch (auditError) {
      // Log audit failure but don't fail the request
      logger.error("Failed to record audit event", auditError as Error, {
        traceId,
        uid: authContext.uid,
        patientId: data.userId,
        vitalId,
        fn: "ingestVital",
      });
    }

    // 8. Return success response
    logger.info("Vital ingestion completed", {
      traceId,
      uid: authContext.uid,
      patientId: data.userId,
      vitalId,
      fn: "ingestVital",
    });

    // Note: Alert checking and notifications are now handled by the
    // checkVitalBenchmarks Firestore trigger via the vitals pipeline

    return {
      success: true,
      vitalId,
      alert: alertInfo,
    };
  } catch (error) {
    logger.error("Vital ingestion failed", error as Error, {
      traceId,
      uid: context.auth?.uid,
      patientId: data.userId,
      fn: "ingestVital",
    });

    // Re-throw HttpsErrors
    if (error instanceof https.HttpsError) {
      throw error;
    }

    // Wrap other errors
    throw new https.HttpsError("internal", "Failed to ingest vital reading");
  }
}
