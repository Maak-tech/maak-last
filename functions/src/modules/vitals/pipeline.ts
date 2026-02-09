/**
 * Vitals Processing Pipeline
 * Orchestrates the complete flow from vital reading to notifications
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { createTraceId } from "../../observability/correlation";
import { logger } from "../../observability/logger";
import { sendToMany } from "../../services/notifications";
import { shouldSendNotification } from "../../services/notifications/preferences";
import { getRecentVitalsSummary } from "../../services/zeina";
import {
  type AlertInfo,
  analyze as zeinaAnalyze,
} from "../../services/zeina/adapter";
import { enrichAlertWithAnalysis } from "../../services/zeina/store";
import {
  type AlertDirection,
  type AlertSeverity,
  checkVitalBenchmark,
  createAlertMessage,
  type VitalType,
} from "../alerts/engine";
import { getFamilyMemberIds } from "../family/familyMembers";
import {
  createVitalReading,
  type VitalInput,
  validateVitalInput,
} from "./ingest";

/**
 * Vital reading for processing
 */
export type VitalReading = {
  userId: string;
  type: VitalType;
  value: number;
  unit: string;
  systolic?: number;
  diastolic?: number;
  source?: "manual" | "device" | "healthkit" | "googlefit" | "oura" | "garmin";
  deviceId?: string;
  timestamp?: Date;
  vitalId?: string; // If already persisted
};

/**
 * Pipeline processing options
 */
export type ProcessVitalOptions = {
  traceId?: string;
  reading: VitalReading;
  skipPersistence?: boolean; // If reading is already in Firestore
  skipNotifications?: boolean; // For testing or specific use cases
  openaiApiKey?: string; // OpenAI API key for Zeina analysis
};

/**
 * Pipeline processing result
 */
export type ProcessVitalResult = {
  success: boolean;
  vitalId: string;
  alertId?: string;
  notificationsSent?: number;
  error?: string;
};

/**
 * Write audit record
 */
async function writeAuditRecord(
  traceId: string,
  eventType: string,
  patientId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const db = getFirestore();
    await db.collection("audit").add({
      traceId,
      eventType,
      patientId,
      ...metadata,
      createdAt: Timestamp.now(),
    });

    logger.debug("Audit record written", {
      traceId,
      patientId,
      eventType,
      fn: "writeAuditRecord",
    });
  } catch (error) {
    logger.warn("Failed to write audit record", error as Error, {
      traceId,
      patientId,
      eventType,
      fn: "writeAuditRecord",
    });
    // Don't fail pipeline if audit fails
  }
}

/**
 * Process a vital reading through the complete pipeline
 *
 * Steps:
 * 1. Validate and normalize reading
 * 2. Persist to Firestore (if not already persisted)
 * 3. Check vital benchmarks
 * 4. Create alert if threshold exceeded
 * 5. Enrich with Zeina analysis (optional)
 * 6. Determine recipients and check preferences
 * 7. Send notifications
 * 8. Write audit record
 *
 * @param options - Processing options
 * @returns Processing result
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestration intentionally spans validation, persistence, enrichment, and notification flows.
export async function processVitalReading(
  options: ProcessVitalOptions
): Promise<ProcessVitalResult> {
  const traceId = options.traceId || createTraceId();
  const { reading, skipPersistence, skipNotifications, openaiApiKey } = options;

  logger.info("Starting vital processing pipeline", {
    traceId,
    patientId: reading.userId,
    vitalType: reading.type,
    fn: "processVitalReading",
  });

  try {
    let vitalId = reading.vitalId;
    const db = getFirestore();

    // Step 1: Validate and normalize (if not already persisted)
    if (!skipPersistence) {
      logger.debug("Validating vital reading", {
        traceId,
        patientId: reading.userId,
        vitalType: reading.type,
        fn: "processVitalReading",
      });

      const vitalInput: VitalInput = {
        userId: reading.userId,
        type: reading.type,
        value: reading.value,
        unit: reading.unit,
        systolic: reading.systolic,
        diastolic: reading.diastolic,
        source: reading.source,
        deviceId: reading.deviceId,
        timestamp: reading.timestamp,
      };

      const validation = validateVitalInput(vitalInput);
      if (!validation.isValid) {
        logger.warn("Invalid vital reading", {
          traceId,
          patientId: reading.userId,
          errors: validation.errors,
          fn: "processVitalReading",
        });

        return {
          success: false,
          vitalId: "",
          error: `Validation failed: ${validation.errors.map((e) => e.message).join(", ")}`,
        };
      }

      // Step 2: Persist to Firestore
      logger.debug("Persisting vital reading", {
        traceId,
        patientId: reading.userId,
        vitalType: reading.type,
        fn: "processVitalReading",
      });

      const normalizedReading = createVitalReading(vitalInput);
      const vitalDoc = await db.collection("vitals").add({
        ...normalizedReading,
        timestamp: normalizedReading.timestamp,
        createdAt: Timestamp.now(),
      });

      vitalId = vitalDoc.id;

      logger.info("Vital persisted", {
        traceId,
        patientId: reading.userId,
        vitalId,
        fn: "processVitalReading",
      });

      // Write audit for vital creation
      await writeAuditRecord(traceId, "vital_created", reading.userId, {
        vitalId,
        vitalType: reading.type,
      });
    }

    if (!vitalId) {
      throw new Error("No vitalId available for processing");
    }

    // Step 3: Check vital benchmarks
    logger.debug("Checking vital benchmarks", {
      traceId,
      patientId: reading.userId,
      vitalId,
      fn: "processVitalReading",
    });

    const checkResult = checkVitalBenchmark(reading.type, reading.value);

    if (!checkResult.isAlert) {
      logger.info("Vital within normal range, no alert", {
        traceId,
        patientId: reading.userId,
        vitalId,
        fn: "processVitalReading",
      });

      return {
        success: true,
        vitalId,
      };
    }

    // Alert triggered - proceed with alert creation
    logger.info("Vital alert triggered", {
      traceId,
      patientId: reading.userId,
      vitalId,
      severity: checkResult.severity,
      fn: "processVitalReading",
    });

    // Get user info for alert message
    const userDoc = await db.collection("users").doc(reading.userId).get();
    const userData = userDoc.data();

    if (!userData) {
      logger.warn("User not found, cannot create alert", {
        traceId,
        patientId: reading.userId,
        vitalId,
        fn: "processVitalReading",
      });

      return {
        success: true,
        vitalId,
        error: "User not found",
      };
    }

    const userName =
      userData.firstName && userData.lastName
        ? `${userData.firstName} ${userData.lastName}`
        : userData.email || "User";

    // Step 4: Create alert message and document
    logger.debug("Creating alert document", {
      traceId,
      patientId: reading.userId,
      vitalId,
      fn: "processVitalReading",
    });

    const alertMessage = createAlertMessage(
      reading.type,
      reading.value,
      reading.unit,
      checkResult.severity as AlertSeverity,
      checkResult.direction as AlertDirection
    );

    const alertDoc = await db.collection("alerts").add({
      userId: reading.userId,
      type: "vital",
      severity: checkResult.severity as string,
      title: alertMessage.title,
      body: alertMessage.message,
      data: {
        vitalId,
        vitalType: reading.type,
        value: reading.value,
        unit: reading.unit,
        direction: checkResult.direction as string,
      },
      isAcknowledged: false,
      timestamp: Timestamp.now(),
      createdAt: Timestamp.now(),
    });

    const alertId = alertDoc.id;

    logger.info("Alert document created", {
      traceId,
      patientId: reading.userId,
      vitalId,
      alertId,
      fn: "processVitalReading",
    });

    // Write audit for alert creation
    await writeAuditRecord(traceId, "alert_created", reading.userId, {
      alertId,
      vitalId,
      severity: checkResult.severity,
    });

    // Step 5: Enrich with Zeina analysis (optional, non-blocking)
    try {
      logger.debug("Starting Zeina analysis", {
        traceId,
        alertId,
        patientId: reading.userId,
        fn: "processVitalReading",
      });

      const recentVitals = await getRecentVitalsSummary(reading.userId, 24);

      const alertInfo: AlertInfo = {
        type: "vital",
        severity: (checkResult.severity || "warning") as
          | "critical"
          | "warning"
          | "info",
        title: alertMessage.title,
        body: alertMessage.message,
        data: {
          vitalType: reading.type,
          value: reading.value,
          unit: reading.unit,
          direction: (checkResult.direction || "high") as "low" | "high",
        },
      };

      const analysis = await zeinaAnalyze({
        patientId: reading.userId,
        alert: alertInfo,
        recentVitalsSummary: recentVitals,
        traceId,
        openaiApiKey,
      });

      await enrichAlertWithAnalysis(alertId, analysis, traceId);

      logger.info("Zeina analysis completed", {
        traceId,
        alertId,
        riskScore: analysis.riskScore,
        fn: "processVitalReading",
      });
    } catch (zeinaError) {
      logger.warn("Zeina analysis failed, continuing", zeinaError as Error, {
        traceId,
        alertId,
        patientId: reading.userId,
        fn: "processVitalReading",
      });
    }

    // Step 6: Determine recipients and check preferences
    if (skipNotifications) {
      logger.info("Skipping notifications as requested", {
        traceId,
        alertId,
        patientId: reading.userId,
        fn: "processVitalReading",
      });

      return {
        success: true,
        vitalId,
        alertId,
        notificationsSent: 0,
      };
    }

    logger.debug("Determining notification recipients", {
      traceId,
      alertId,
      patientId: reading.userId,
      fn: "processVitalReading",
    });

    // Get family members (exclude patient)
    const familyIds = await getFamilyMemberIds(reading.userId, true, traceId);

    if (familyIds.length === 0) {
      logger.info("No family members to notify", {
        traceId,
        alertId,
        patientId: reading.userId,
        fn: "processVitalReading",
      });

      return {
        success: true,
        vitalId,
        alertId,
        notificationsSent: 0,
      };
    }

    // Filter by notification preferences
    const recipientIds: string[] = [];
    for (const familyId of familyIds) {
      const shouldSend = await shouldSendNotification(familyId, "vital");
      if (shouldSend) {
        recipientIds.push(familyId);
      }
    }

    if (recipientIds.length === 0) {
      logger.info("All family members have notifications disabled", {
        traceId,
        alertId,
        patientId: reading.userId,
        fn: "processVitalReading",
      });

      return {
        success: true,
        vitalId,
        alertId,
        notificationsSent: 0,
      };
    }

    // Step 7: Send notifications
    logger.debug("Sending notifications", {
      traceId,
      alertId,
      patientId: reading.userId,
      recipientCount: recipientIds.length,
      fn: "processVitalReading",
    });

    const notificationResult = await sendToMany(recipientIds, {
      traceId,
      title: alertMessage.title,
      body: `${userName}'s ${alertMessage.message}`,
      data: {
        alertId,
        vitalId,
        vitalType: reading.type,
        value: reading.value.toString(),
        unit: reading.unit,
        severity: checkResult.severity as string,
        userId: reading.userId,
      },
      type: "vital_alert",
      priority: checkResult.severity === "critical" ? "high" : "normal",
      color: checkResult.severity === "critical" ? "#EF4444" : "#F59E0B",
      clickAction: "OPEN_VITALS",
    });

    logger.info("Notifications sent", {
      traceId,
      alertId,
      patientId: reading.userId,
      sent: notificationResult.sent,
      failed: notificationResult.failed,
      fn: "processVitalReading",
    });

    // Step 8: Write audit for notifications
    await writeAuditRecord(traceId, "notifications_sent", reading.userId, {
      alertId,
      recipientCount: recipientIds.length,
      sent: notificationResult.sent,
      failed: notificationResult.failed,
    });

    logger.info("Vital processing pipeline completed", {
      traceId,
      patientId: reading.userId,
      vitalId,
      alertId,
      notificationsSent: notificationResult.sent,
      fn: "processVitalReading",
    });

    return {
      success: true,
      vitalId,
      alertId,
      notificationsSent: notificationResult.sent,
    };
  } catch (error) {
    logger.error("Vital processing pipeline failed", error as Error, {
      traceId,
      patientId: reading.userId,
      fn: "processVitalReading",
    });

    // Write audit for failure
    await writeAuditRecord(traceId, "vital_processing_failed", reading.userId, {
      error: (error as Error).message,
    });

    return {
      success: false,
      vitalId: reading.vitalId || "",
      error: (error as Error).message,
    };
  }
}
