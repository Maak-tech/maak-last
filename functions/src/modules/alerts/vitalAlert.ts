/**
 * Vital Alert Orchestrator
 * Handles vital alert creation, Zeina enrichment, and notification to family admins
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../../observability/logger';
import { createTraceId } from '../../observability/correlation';
import { createAlertMessage, type AlertSeverity, type AlertDirection, type VitalType } from './engine';
import { analyze as zeinaAnalyze, type AlertInfo } from '../../services/zeina/analyze';
import { enrichAlertWithAnalysis } from '../../services/zeina/store';
import { getRecentVitalsSummary } from '../vitals/recentSummary';
import { getFamilyAdmins } from '../family/admins';
import { sendPushNotificationInternal } from '../../services/notifications';

/**
 * Send vital alert to family admins
 * Includes optional Zeina AI analysis enrichment
 * 
 * NOTE: This function is now deprecated in favor of the unified vitals pipeline
 * (modules/vitals/pipeline.ts). Kept for backward compatibility with direct calls.
 * @deprecated Use processVitalReading from modules/vitals/pipeline.ts instead
 * 
 * @param userId - Patient user ID
 * @param userName - Patient display name
 * @param vitalType - Type of vital (heartRate, bloodPressure, etc.)
 * @param value - Vital reading value
 * @param unit - Unit of measurement
 * @param severity - Alert severity (critical or warning)
 * @param direction - Direction of threshold breach (low or high)
 */
export async function sendVitalAlertToAdmins(
  userId: string,
  userName: string,
  vitalType: string,
  value: number,
  unit: string,
  severity: "critical" | "warning",
  direction: "low" | "high"
): Promise<void> {
  const traceId = createTraceId();
  
  try {
    logger.info("Sending vital alert to admins", {
      traceId,
      patientId: userId,
      fn: "sendVitalAlertToAdmins",
    });

    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();

    if (!userData?.familyId) {
      logger.debug("No family for user, skipping alert", {
        traceId,
        patientId: userId,
        fn: "sendVitalAlertToAdmins",
      });
      return;
    }

    const adminIds = await getFamilyAdmins(userData.familyId, traceId);
    if (adminIds.length === 0) {
      logger.debug("No admins found for family", {
        traceId,
        familyId: userData.familyId,
        fn: "sendVitalAlertToAdmins",
      });
      return;
    }

    // Don't alert the user themselves if they're an admin
    const adminIdsToAlert = adminIds.filter((id) => id !== userId);

    if (adminIdsToAlert.length === 0) {
      logger.debug("No admins to alert after filtering", {
        traceId,
        familyId: userData.familyId,
        fn: "sendVitalAlertToAdmins",
      });
      return;
    }

    // Use engine to create alert message
    const alertMessage = createAlertMessage(
      vitalType as VitalType,
      value,
      unit,
      severity as AlertSeverity,
      direction as AlertDirection
    );

    // Create alert document in Firestore
    const alertDoc = await db.collection("alerts").add({
      userId,
      type: "vital",
      severity,
      title: alertMessage.title,
      body: alertMessage.message,
      data: {
        vitalType,
        value,
        unit,
        direction,
      },
      isAcknowledged: false,
      timestamp: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });

    const alertId = alertDoc.id;

    logger.info("Alert document created", {
      traceId,
      alertId,
      patientId: userId,
      fn: "sendVitalAlertToAdmins",
    });

    // Optional: Zeina AI Analysis enrichment
    // This is non-blocking - if it fails, alert still goes out
    try {
      logger.debug("Starting Zeina analysis", {
        traceId,
        alertId,
        patientId: userId,
        fn: "sendVitalAlertToAdmins",
      });

      // Get recent vitals summary for better analysis
      const recentVitals = await getRecentVitalsSummary(userId, 24, traceId);

      // Prepare alert info for Zeina
      const alertInfo: AlertInfo = {
        type: "vital",
        severity,
        title: alertMessage.title,
        body: alertMessage.message,
        data: {
          vitalType,
          value,
          unit,
          direction,
        },
      };

      // Run Zeina analysis
      const analysis = await zeinaAnalyze({
        patientId: userId,
        alert: alertInfo,
        recentVitalsSummary: recentVitals,
        traceId,
      });

      // Enrich alert with analysis
      await enrichAlertWithAnalysis(alertId, analysis, traceId);

      logger.info("Zeina analysis completed and stored", {
        traceId,
        alertId,
        riskScore: analysis.riskScore,
        fn: "sendVitalAlertToAdmins",
      });
    } catch (zeinaError) {
      // Don't fail the whole alert if Zeina fails
      logger.warn("Zeina analysis failed, continuing with alert", zeinaError as Error, {
        traceId,
        alertId,
        patientId: userId,
        fn: "sendVitalAlertToAdmins",
      });
    }

    // Send notification to admins
    const notification = {
      title: alertMessage.title,
      body: `${userName}'s ${alertMessage.message}`,
      priority: severity === "critical" ? ("high" as const) : ("normal" as const),
      data: {
        type: "vital_alert",
        vitalType,
        value: value.toString(),
        unit,
        severity,
        direction,
        userId,
        userName,
        alertId, // Include alertId so app can fetch full alert with Zeina analysis
      },
      clickAction: "OPEN_VITALS",
      color: severity === "critical" ? "#EF4444" : "#F59E0B",
    };

    // Send to admins using the internal notification service
    const result = await sendPushNotificationInternal({
      traceId,
      userIds: adminIdsToAlert,
      notification,
      notificationType: "vital",
      requireAuth: false, // System call
      callerUid: "system",
    });

    logger.info("Vital alert sent to admins", {
      traceId,
      alertId,
      patientId: userId,
      familyId: userData.familyId,
      fn: "sendVitalAlertToAdmins",
    });

    // Log the alert (legacy)
    await db.collection("notificationLogs").add({
      type: "vital_alert",
      alertId,
      userId,
      vitalType,
      value,
      severity,
      direction,
      recipientIds: adminIdsToAlert,
      sentAt: FieldValue.serverTimestamp(),
      result,
    });
  } catch (error) {
    logger.error("Error sending vital alert to admins", error as Error, {
      traceId,
      patientId: userId,
      fn: "sendVitalAlertToAdmins",
    });
    // Don't throw - alerts are non-critical
  }
}
