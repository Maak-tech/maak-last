/* biome-ignore-all lint/performance/noNamespaceImport: Firebase admin/functions APIs are consumed through existing namespace-style exports in this module. */
/* biome-ignore-all lint/suspicious/noExplicitAny: legacy callable contracts are intentionally permissive at this boundary and validated at runtime. */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: this file aggregates legacy callable handlers pending modularization. */
/* biome-ignore-all lint/complexity/noForEach: existing batch update loops are retained for readability in legacy handlers. */
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as functions from "firebase-functions";
import { onCall } from "firebase-functions/v2/https";
import { ingestVital } from "./api/vitals";
import { getFamilyAdmins } from "./modules/family/admins";
import { getFamilyMemberIds } from "./modules/family/familyMembers";
import { createTraceId } from "./observability/correlation";
// New structure imports
import { logger } from "./observability/logger";
// Import centralized secrets
import {
  PPG_ML_SERVICE_API_KEY,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
} from "./secrets";
import { sendPushNotificationInternal } from "./services/notifications";
import { sendEmergencySmsToContacts } from "./services/notifications/sms";
import type { NotificationPayload } from "./services/notifications/types";

// Initialize Firebase Admin
admin.initializeApp();

// Simple HTTP function that works with minimal permissions
export const testHello = functions.https.onRequest((_req, res) => {
  res.json({
    success: true,
    message: "Cloud Functions are working!",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
  });
});

// Vitals ingestion endpoint
export const ingestVitalReading = functions.https.onCall(
  async (data: any, context: any) => ingestVital(data, context)
);

// Alternative HTTP endpoint for push notifications (no auth required)
export const sendPushNotificationHttp = functions.https.onRequest(
  async (req, res) => {
    // Enable CORS
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    const {
      userIds,
      notification,
      notificationType = "general",
    } = req.body.data || req.body;

    // HTTP Push notification requested

    try {
      const result = await sendPushNotificationInternal({
        traceId: createTraceId(),
        userIds,
        notification,
        notificationType,
        requireAuth: false, // HTTP endpoint doesn't require auth
      });

      res.json({
        result: {
          success: result.success,
          successCount: result.successCount,
          failureCount: result.failureCount,
          skippedCount: result.skippedCount || 0,
          message: result.message,
        },
      });
    } catch (error) {
      logger.error("Error in sendPushNotificationHttp", error as Error, {
        traceId: createTraceId(),
        fn: "sendPushNotificationHttp",
      });
      res.status(500).json({
        error: {
          message: "Failed to send push notification",
          code: "internal",
        },
      });
    }
  }
);

// Enhanced push notification function with preference checking
// Using v1 for now to avoid Cloud Run auth issues
export const sendPushNotification = functions.https.onCall(
  async (data: any, context: any) => {
    const traceId = createTraceId();
    const { userIds, notification, notificationType = "general" } = data;

    if (!(userIds && notification)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing userIds or notification"
      );
    }

    try {
      const result = await sendPushNotificationInternal({
        traceId,
        userIds,
        notification,
        notificationType,
        requireAuth: true,
        callerUid: context.auth?.uid,
      });

      return result;
    } catch (error) {
      logger.error("Error sending push notification", error as Error, {
        traceId,
        uid: context.auth?.uid,
        fn: "sendPushNotification",
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to send push notification"
      );
    }
  }
);

// Note: cleanupInvalidTokens moved to services/notifications/index.ts

// Enhanced FCM token management with device tracking
export const saveFCMToken = functions.https.onCall(
  async (data: any, context: any) => {
    const { token, deviceInfo, userId } = data;

    // Require authentication or userId for production security
    const targetUserId = context.auth?.uid || userId;

    if (!targetUserId) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated or provide userId"
      );
    }

    if (!token) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing FCM token"
      );
    }

    try {
      const db = admin.firestore();
      const userRef = db.collection("users").doc(targetUserId);

      // Get current user data
      const userDoc = await userRef.get();
      const userData = userDoc.data() || {};

      // Support multiple devices
      const currentTokens = userData.fcmTokens || {};
      const deviceId = deviceInfo?.deviceId || "default";

      currentTokens[deviceId] = {
        token,
        updatedAt: FieldValue.serverTimestamp(),
        platform: deviceInfo?.platform || "unknown",
        deviceName: deviceInfo?.deviceName || "Unknown Device",
      };

      await userRef.update({
        fcmToken: token, // Keep single token for backward compatibility
        fcmTokens: currentTokens,
        fcmTokenUpdatedAt: FieldValue.serverTimestamp(),
      });

      return { success: true, message: "FCM token saved successfully" };
    } catch (error) {
      logger.error("Error saving FCM token", error as Error, {
        fn: "saveFCMToken",
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to save FCM token"
      );
    }
  }
);

// Function to create alert server-side (bypasses Firestore permission issues)
export const createAlert = functions.https.onCall(
  async (data: any, context: any) => {
    const traceId = createTraceId();
    const { alertData } = data;

    logger.info("Creating alert via Cloud Function", {
      traceId,
      uid: context.auth?.uid,
      userId: alertData?.userId,
      alertType: alertData?.type,
      fn: "createAlert",
    });

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const db = admin.firestore();

    // Verify the user is creating alert for themselves or is admin
    if (alertData.userId !== context.auth.uid) {
      // Check if user is admin/caregiver in same family
      const callerDoc = await db
        .collection("users")
        .doc(context.auth.uid)
        .get();
      const targetDoc = await db
        .collection("users")
        .doc(alertData.userId)
        .get();

      const callerData = callerDoc.data();
      const targetData = targetDoc.data();

      const isSameFamily =
        callerData?.familyId &&
        targetData?.familyId &&
        callerData.familyId === targetData.familyId &&
        (callerData.role === "admin" || callerData.role === "caregiver");

      if (!isSameFamily) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "You can only create alerts for yourself or family members"
        );
      }
    }

    try {
      // Convert timestamp if it's a Date object or string
      let timestamp: admin.firestore.Timestamp | admin.firestore.FieldValue;
      if (alertData.timestamp) {
        if (alertData.timestamp instanceof Date) {
          timestamp = admin.firestore.Timestamp.fromDate(alertData.timestamp);
        } else if (typeof alertData.timestamp === "string") {
          timestamp = admin.firestore.Timestamp.fromDate(
            new Date(alertData.timestamp)
          );
        } else {
          timestamp = admin.firestore.FieldValue.serverTimestamp();
        }
      } else {
        timestamp = admin.firestore.FieldValue.serverTimestamp();
      }

      // Remove undefined values and prepare alert data
      const cleanedData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(alertData)) {
        if (value !== undefined) {
          cleanedData[key] = value;
        }
      }
      cleanedData.timestamp = timestamp;

      const alertRef = await db.collection("alerts").add(cleanedData);

      logger.info("Alert created successfully", {
        traceId,
        alertId: alertRef.id,
        alertType: alertData.type,
        fn: "createAlert",
      });

      return { success: true, alertId: alertRef.id };
    } catch (error) {
      logger.error("Failed to create alert", error as Error, {
        traceId,
        fn: "createAlert",
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to create alert"
      );
    }
  }
);

// Function to resolve alert server-side (bypasses Firestore permission issues)
export const resolveAlert = functions.https.onCall(
  async (data: any, context: any) => {
    const traceId = createTraceId();
    const { alertId } = data;

    logger.info("Resolving alert via Cloud Function", {
      traceId,
      uid: context.auth?.uid,
      alertId,
      fn: "resolveAlert",
    });

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const db = admin.firestore();
    const resolverId = context.auth.uid;

    try {
      // Get the alert document
      const alertRef = db.collection("alerts").doc(alertId);
      const alertDoc = await alertRef.get();

      if (!alertDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          `Alert ${alertId} does not exist`
        );
      }

      const alertData = alertDoc.data();
      if (!alertData) {
        throw new functions.https.HttpsError(
          "not-found",
          `Alert ${alertId} data not found`
        );
      }

      // Check if already resolved
      if (alertData.resolved) {
        logger.info("Alert already resolved", {
          traceId,
          alertId,
          resolvedBy: alertData.resolvedBy,
          fn: "resolveAlert",
        });
        return { success: true, alreadyResolved: true };
      }

      // Verify the user can resolve this alert
      // User can resolve if:
      // 1. They are the alert owner (alertData.userId === resolverId)
      // 2. They are in the same family (any family member can resolve)
      if (alertData.userId !== resolverId) {
        // Check if user is in same family
        const callerDoc = await db.collection("users").doc(resolverId).get();
        const targetDoc = await db
          .collection("users")
          .doc(alertData.userId)
          .get();

        if (!(callerDoc.exists && targetDoc.exists)) {
          logger.error("User or alert owner not found", undefined, {
            traceId,
            resolverId,
            alertUserId: alertData.userId,
            callerExists: callerDoc.exists,
            targetExists: targetDoc.exists,
            fn: "resolveAlert",
          });
          throw new functions.https.HttpsError(
            "permission-denied",
            "User or alert owner not found"
          );
        }

        const callerData = callerDoc.data();
        const targetData = targetDoc.data();

        // Log family check details for debugging
        logger.info("Checking family membership for alert resolution", {
          traceId,
          resolverId,
          alertUserId: alertData.userId,
          callerFamilyId: callerData?.familyId,
          targetFamilyId: targetData?.familyId,
          callerRole: callerData?.role,
          targetRole: targetData?.role,
          fn: "resolveAlert",
        });

        // Allow any same-family member to resolve alerts
        const isSameFamily =
          callerData?.familyId &&
          targetData?.familyId &&
          callerData.familyId === targetData.familyId;

        if (!isSameFamily) {
          logger.warn("Family membership check failed", {
            traceId,
            resolverId,
            alertUserId: alertData.userId,
            callerFamilyId: callerData?.familyId,
            targetFamilyId: targetData?.familyId,
            isSameFamily: false,
            fn: "resolveAlert",
          });
          throw new functions.https.HttpsError(
            "permission-denied",
            "You can only resolve alerts for yourself or family members"
          );
        }
      }

      // Update the alert
      await alertRef.update({
        resolved: true,
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: resolverId,
      });

      // Verify the update succeeded
      const updatedDoc = await alertRef.get();
      const updatedData = updatedDoc.data();

      if (!updatedData?.resolved) {
        throw new functions.https.HttpsError(
          "internal",
          `Alert ${alertId} was not marked as resolved`
        );
      }

      // Also resolve any active escalations for this alert
      // This bypasses Firestore permission issues since we're in a Cloud Function
      try {
        const escalationsQuery = db
          .collection("escalations")
          .where("alertId", "==", alertId)
          .where("status", "in", ["active", "acknowledged"]);

        const escalationsSnapshot = await escalationsQuery.get();

        if (!escalationsSnapshot.empty) {
          const batch = db.batch();
          escalationsSnapshot.docs.forEach((escalationDoc) => {
            batch.update(escalationDoc.ref, {
              status: "resolved",
              resolvedBy: resolverId,
              resolvedAt: FieldValue.serverTimestamp(),
              nextEscalationAt: null,
            });
          });

          await batch.commit();

          logger.info("Escalations resolved successfully", {
            traceId,
            alertId,
            escalationCount: escalationsSnapshot.docs.length,
            resolvedBy: resolverId,
            fn: "resolveAlert",
          });
        }
      } catch (escalationError: any) {
        // Log but don't fail - alert is already resolved
        logger.warn("Failed to resolve escalations", {
          traceId,
          alertId,
          error: escalationError?.message || "Unknown error",
          fn: "resolveAlert",
        });
      }

      logger.info("Alert resolved successfully", {
        traceId,
        alertId,
        alertType: alertData.type,
        resolvedBy: resolverId,
        fn: "resolveAlert",
      });

      return {
        success: true,
        alertId,
        alertType: alertData.type,
        userId: alertData.userId,
      };
    } catch (error: any) {
      logger.error("Failed to resolve alert", error as Error, {
        traceId,
        alertId,
        resolverId,
        fn: "resolveAlert",
      });

      // Re-throw HttpsError as-is
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        "internal",
        `Failed to resolve alert: ${error.message || "Unknown error"}`
      );
    }
  }
);

// Function to send fall detection alert to family members and admins
export const sendFallAlert = functions.https.onCall(
  async (data: any, context: any) => {
    const traceId = createTraceId();
    const { alertId, userId, userName, location } = data;

    logger.info("Fall alert triggered", {
      traceId,
      uid: context.auth?.uid,
      patientId: userId,
      alertId,
      fn: "sendFallAlert",
    });

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    try {
      const db = admin.firestore();
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();

      if (!userData?.familyId) {
        return { success: true, message: "No family to notify" };
      }

      // Get family admins specifically
      const adminIds = await getFamilyAdmins(userData.familyId);
      // Also get all family members (for emergency situations, notify everyone)
      const familyMemberIds = await getFamilyMemberIds(userId);

      // Combine admins and family members, removing duplicates
      const allRecipients = Array.from(
        new Set([...adminIds, ...familyMemberIds])
      );

      if (allRecipients.length === 0) {
        return { success: true, message: "No family members to notify" };
      }

      // Prepare notification
      const notification: NotificationPayload = {
        title: "🚨 Emergency: Fall Detected",
        body: `${userName} may have fallen and needs help!`,
        imageUrl: "https://your-app-url.com/fall-alert-icon.png",
        priority: "high",
        sound: "emergency",
        data: {
          type: "fall_alert",
          alertId,
          userId,
          userName,
          location: location || "Unknown",
          severity: "high",
        },
        clickAction: "OPEN_ALERT_DETAILS",
        color: "#EF4444",
        badge: 1,
      };

      // Send to all recipients (admins and family members)
      const result = await sendPushNotificationInternal({
        traceId,
        userIds: allRecipients,
        notification,
        notificationType: "fall",
        requireAuth: true,
        callerUid: context.auth?.uid,
      });

      // Log the alert with admin information
      await db.collection("notificationLogs").add({
        type: "fall_alert",
        alertId,
        userId,
        recipientIds: allRecipients,
        adminRecipients: adminIds,
        sentAt: FieldValue.serverTimestamp(),
        result,
      });

      return result;
    } catch (error) {
      logger.error("Error sending fall alert", error as Error, {
        fn: "sendFallAlert",
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to send fall alert"
      );
    }
  }
);

export const sendEmergencySms = onCall(
  {
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER],
  },
  async (request) => {
    const traceId = createTraceId();
    const { userId, message, alertType } = request.data || {};
    const context = request.auth;

    if (!context) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    if (!(userId && message && alertType)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing userId, message, or alertType"
      );
    }

    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User not found");
    }

    const userData = userDoc.data() || {};
    const familyId = userData.familyId as string | undefined;
    const callerUid = context.uid;

    if (callerUid !== userId) {
      if (!familyId) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Caller does not have permission to notify this user"
        );
      }

      const adminIds = await getFamilyAdmins(familyId);
      if (!adminIds.includes(callerUid)) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Caller does not have permission to notify this user"
        );
      }
    }

    const result = await sendEmergencySmsToContacts({
      userId,
      message,
      twilioAccountSid: TWILIO_ACCOUNT_SID.value(),
      twilioAuthToken: TWILIO_AUTH_TOKEN.value(),
      twilioFromNumber: TWILIO_FROM_NUMBER.value(),
    });

    logger.info("Emergency SMS send attempted", {
      traceId,
      uid: userId,
      callerUid,
      alertType,
      sent: result.sent,
      failed: result.failed,
      fn: "sendEmergencySms",
    });

    return result;
  }
);

// Function to send medication reminder
export const sendMedicationReminder = functions.https.onCall(
  async (data: any, context: any) => {
    const {
      medicationId,
      medicationName,
      dosage,
      userId,
      reminderId,
      reminderTime,
    } = data;

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    try {
      const notification: NotificationPayload = {
        title: "💊 Medication Reminder",
        body: `Time to take ${medicationName} (${dosage})`,
        priority: "high",
        sound: "default",
        data: {
          type: "medication_reminder",
          medicationId,
          medicationName,
          dosage,
          reminderId,
          reminderTime,
        },
        clickAction: "OPEN_MEDICATIONS",
        color: "#10B981",
        tag: reminderId ? `medication_reminder_${reminderId}` : undefined,
      };

      // Send to the user
      const result = await sendPushNotificationInternal({
        traceId: createTraceId(),
        userIds: [userId],
        notification,
        notificationType: "medication",
        requireAuth: true,
        callerUid: context.auth?.uid,
      });

      return result;
    } catch (error) {
      logger.error("Error sending medication reminder", error as Error, {
        fn: "sendMedicationReminder",
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to send medication reminder"
      );
    }
  }
);

// Function to send symptom alert to family admins
export const sendSymptomAlert = functions.https.onCall(
  async (data: any, context: any) => {
    const { symptomType, severity, userId, userName } = data;

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    // Only send for high severity symptoms (4 or 5)
    if (severity < 4) {
      return { success: true, message: "Symptom not severe enough for alert" };
    }

    try {
      const db = admin.firestore();
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();

      if (!userData?.familyId) {
        return { success: true, message: "No family to notify" };
      }

      // Get family admins specifically
      const adminIds = await getFamilyAdmins(userData.familyId);
      // Don't alert the user themselves if they're an admin
      const adminIdsToAlert = adminIds.filter((id) => id !== userId);

      if (adminIdsToAlert.length === 0) {
        return { success: true, message: "No admins to notify" };
      }

      const severityText = severity === 5 ? "very severe" : "severe";
      const severityEmoji = severity === 5 ? "🚨" : "⚠️";
      const notification: NotificationPayload = {
        title: `${severityEmoji} Symptom Alert`,
        body: `${userName} is experiencing ${severityText} ${symptomType}`,
        priority: severity === 5 ? "high" : "normal",
        data: {
          type: "symptom_alert",
          symptomType,
          severity: severity.toString(),
          userId,
          userName,
        },
        clickAction: "OPEN_SYMPTOMS",
        color: severity === 5 ? "#EF4444" : "#F59E0B",
      };

      // Send to admins
      const result = await sendPushNotificationInternal({
        traceId: createTraceId(),
        userIds: adminIdsToAlert,
        notification,
        notificationType: "symptom",
        requireAuth: true,
        callerUid: context.auth?.uid,
      });

      // Log the alert
      await db.collection("notificationLogs").add({
        type: "symptom_alert",
        userId,
        symptomType,
        severity,
        recipientIds: adminIdsToAlert,
        adminRecipients: adminIdsToAlert,
        sentAt: FieldValue.serverTimestamp(),
        result,
      });

      return result;
    } catch (error) {
      logger.error("Error sending symptom alert", error as Error, {
        fn: "sendSymptomAlert",
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to send symptom alert"
      );
    }
  }
);

// Re-export scheduled medication reminders job
export { scheduledMedicationReminders } from "./jobs/medicationReminders";

// PPG ML Analysis endpoint
export const analyzePPGWithML = onCall(
  { secrets: [PPG_ML_SERVICE_API_KEY] },
  async (request) => {
    const traceId = createTraceId();
    const { signal, frameRate, userId } = request.data;
    const context = request.auth;

    logger.info("PPG ML analysis requested", {
      traceId,
      uid: context?.uid,
      userId: userId || context?.uid,
      signalLength: signal?.length,
      frameRate,
      fn: "analyzePPGWithML",
    });

    if (!(context || userId)) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    if (!(signal && Array.isArray(signal)) || signal.length < 30) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Valid PPG signal array with at least 30 samples is required"
      );
    }

    if (!frameRate || frameRate <= 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Valid frameRate > 0 is required"
      );
    }

    try {
      // Import ML service (lazy import to avoid startup issues if service unavailable)
      const { analyzePPGWithML: mlAnalyze } = await import(
        "./services/ppgMLService.js"
      );

      const targetUserId = userId || context?.uid;
      const result = await mlAnalyze(
        signal,
        frameRate,
        targetUserId,
        PPG_ML_SERVICE_API_KEY.value()
      );

      logger.info("PPG ML analysis completed", {
        traceId,
        uid: context?.uid,
        success: result.success,
        heartRate: result.heartRate,
        signalQuality: result.signalQuality,
        fn: "analyzePPGWithML",
      });

      return result;
    } catch (error: any) {
      logger.error("Error in PPG ML analysis", error as Error, {
        traceId,
        uid: context?.uid,
        fn: "analyzePPGWithML",
      });

      // Return fallback response instead of throwing error
      // This allows the app to gracefully degrade to traditional processing
      return {
        success: false,
        signalQuality: 0,
        warnings: ["ML service unavailable, using traditional processing"],
        error: error.message || "ML analysis failed",
      };
    }
  }
);

// Function to update notification preferences
export const updateNotificationPreferences = functions.https.onCall(
  async (data: any, context: any) => {
    const { preferences } = data;

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    try {
      const db = admin.firestore();
      await db.collection("users").doc(context.auth.uid).update({
        "preferences.notifications": preferences,
        "preferences.notificationsUpdatedAt": FieldValue.serverTimestamp(),
      });

      return { success: true, message: "Preferences updated successfully" };
    } catch (error) {
      logger.error("Error updating preferences", error as Error, {
        fn: "updateUserPreferences",
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to update preferences"
      );
    }
  }
);

// Function to generate custom token for biometric authentication
export const generateBiometricToken = functions.https.onCall(
  async (data: any, _context: any) => {
    const { userId, authLogId } = data;

    if (!userId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "User ID is required"
      );
    }

    try {
      // Verify that biometric authentication was successful by checking auth_logs
      const db = admin.firestore();

      // Check if there's a recent successful biometric auth log
      if (authLogId) {
        const authLogDoc = await db
          .collection("auth_logs")
          .doc(authLogId)
          .get();
        if (!authLogDoc.exists) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Biometric authentication verification failed"
          );
        }

        const authLogData = authLogDoc.data();
        if (!authLogData?.success || authLogData?.userId !== userId) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Biometric authentication verification failed"
          );
        }

        // Check that the auth log is recent (within last 5 minutes)
        const logTime = authLogData.timestamp?.toMillis() || 0;
        const now = Date.now();
        if (now - logTime > 5 * 60 * 1000) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Biometric authentication expired"
          );
        }
      } else {
        // Fallback: check for most recent successful auth log
        const recentLogs = await db
          .collection("auth_logs")
          .where("userId", "==", userId)
          .where("success", "==", true)
          .orderBy("timestamp", "desc")
          .limit(1)
          .get();

        if (recentLogs.empty) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "No recent biometric authentication found"
          );
        }

        const recentLog = recentLogs.docs[0].data();
        const logTime = recentLog.timestamp?.toMillis() || 0;
        const now = Date.now();
        if (now - logTime > 5 * 60 * 1000) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Biometric authentication expired"
          );
        }
      }

      // Verify user exists
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "User not found");
      }

      // Generate custom token
      const customToken = await admin.auth().createCustomToken(userId);

      return { customToken };
    } catch (error: any) {
      logger.error("Error generating biometric token", error as Error, {
        fn: "generateBiometricToken",
      });
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Failed to generate authentication token"
      );
    }
  }
);

// Vital benchmarks and checking logic moved to modules/alerts/engine.ts

// Re-export health trends analysis job
export { analyzeHealthTrends } from "./jobs/healthTrends";
/**
 * Get admin users for a family
 */
// Removed deprecated sendVitalAlertToAdmins export - use processVitalReading from modules/vitals/pipeline.ts instead

// Re-export symptoms trigger
export { checkSymptomBenchmarks } from "./triggers/symptoms";
// Re-export vitals trigger
export { checkVitalBenchmarks } from "./triggers/vitals";

/**
 * Fitbit Webhook Handler
 * Handles Fitbit subscriber notifications for real-time data updates
 *
 * Fitbit webhook flow:
 * 1. Verification: GET request with verify parameter
 * 2. Updates: POST requests with user data changes
 */
export const fitbitWebhook = functions.https.onRequest(async (req, res) => {
  const traceId = createTraceId();

  // Enable CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    // Fitbit webhook verification (GET request)
    if (req.method === "GET") {
      const verify = req.query.verify as string;

      if (verify) {
        logger.info("Fitbit webhook verification", {
          traceId,
          verify,
          fn: "fitbitWebhook",
        });

        // Return the verification code to complete verification
        res.status(200).type("text/plain").send(verify);
        return;
      }

      // If no verify parameter, return a simple response indicating the endpoint is working
      // This handles manual visits and Fitbit health checks
      logger.info("Fitbit webhook endpoint accessed without verify parameter", {
        traceId,
        fn: "fitbitWebhook",
      });
      res.status(200).json({
        status: "ok",
        message:
          "Fitbit webhook endpoint is active. Verification requires 'verify' query parameter.",
      });
      return;
    }

    // Fitbit webhook data update (POST request)
    if (req.method === "POST") {
      const webhookData = req.body;

      logger.info("Fitbit webhook received", {
        traceId,
        collectionType: webhookData?.collectionType,
        date: webhookData?.date,
        ownerId: webhookData?.ownerId,
        fn: "fitbitWebhook",
      });

      // Fitbit webhook payload structure:
      // {
      //   "collectionType": "activities" | "body" | "foods" | "sleep",
      //   "date": "2024-01-15",
      //   "ownerId": "fitbit_user_id",
      //   "ownerType": "user",
      //   "subscriptionId": "subscription_id"
      // }

      if (!(webhookData?.ownerId && webhookData?.collectionType)) {
        res.status(400).json({ error: "Invalid webhook payload" });
        return;
      }

      const db = admin.firestore();

      // Find user by Fitbit user ID
      // Note: You'll need to store Fitbit user ID when users connect their Fitbit account
      const usersSnapshot = await db
        .collection("users")
        .where("fitbitUserId", "==", webhookData.ownerId)
        .limit(1)
        .get();

      if (usersSnapshot.empty) {
        logger.warn("Fitbit webhook: User not found", {
          traceId,
          fitbitUserId: webhookData.ownerId,
          fn: "fitbitWebhook",
        });

        // Still return 200 to acknowledge receipt
        res.status(200).json({
          success: true,
          message: "Webhook received but user not found",
        });
        return;
      }

      const userDoc = usersSnapshot.docs[0];
      const userId = userDoc.id;

      // Store webhook event for processing
      await db.collection("fitbitWebhooks").add({
        userId,
        fitbitUserId: webhookData.ownerId,
        collectionType: webhookData.collectionType,
        date: webhookData.date,
        subscriptionId: webhookData.subscriptionId,
        receivedAt: FieldValue.serverTimestamp(),
        processed: false,
      });

      logger.info("Fitbit webhook stored", {
        traceId,
        userId,
        collectionType: webhookData.collectionType,
        fn: "fitbitWebhook",
      });

      // Return success immediately (process asynchronously)
      res.status(200).json({
        success: true,
        message: "Webhook received and queued for processing",
      });

      // TODO: Trigger background job to sync Fitbit data for this user
      // This could be done via a Cloud Task or Pub/Sub trigger

      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    logger.error("Error processing Fitbit webhook", error as Error, {
      traceId,
      fn: "fitbitWebhook",
    });

    // Return 200 to prevent Fitbit from retrying
    // Log error for manual investigation
    res.status(200).json({
      success: false,
      error: "Webhook received but processing failed",
    });
  }
});

/**
 * Withings Webhook Handler
 * Handles Withings notification service for real-time data updates
 *
 * Withings webhook flow:
 * 1. Verification: GET request with verify parameter (if required)
 * 2. Updates: POST requests with user data changes
 *
 * Withings notification payload structure:
 * {
 *   "userid": "withings_user_id",
 *   "appli": application_id,
 *   "startdate": timestamp,
 *   "enddate": timestamp
 * }
 */
export const withingsWebhook = functions.https.onRequest(async (req, res) => {
  const traceId = createTraceId();

  // Enable CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    // Withings webhook verification (GET request)
    if (req.method === "GET") {
      // Withings may send verification requests
      logger.info("Withings webhook verification", {
        traceId,
        query: req.query,
        fn: "withingsWebhook",
      });

      res.status(200).json({
        status: "ok",
        message: "Withings webhook endpoint is active",
      });
      return;
    }

    // Withings webhook data update (POST request)
    if (req.method === "POST") {
      const webhookData = req.body;

      logger.info("Withings webhook received", {
        traceId,
        userid: webhookData?.userid,
        appli: webhookData?.appli,
        startdate: webhookData?.startdate,
        enddate: webhookData?.enddate,
        fn: "withingsWebhook",
      });

      // Withings notification payload structure:
      // {
      //   "userid": "withings_user_id",
      //   "appli": application_id,
      //   "startdate": timestamp,
      //   "enddate": timestamp
      // }

      if (!webhookData?.userid) {
        res
          .status(400)
          .json({ error: "Invalid webhook payload: missing userid" });
        return;
      }

      const db = admin.firestore();

      // Find user by Withings user ID
      // Note: You'll need to store Withings user ID when users connect their Withings account
      // The userid is stored in the tokens when OAuth completes
      const usersSnapshot = await db
        .collection("users")
        .where("withingsUserId", "==", webhookData.userid.toString())
        .limit(1)
        .get();

      if (usersSnapshot.empty) {
        logger.warn("Withings webhook: User not found", {
          traceId,
          withingsUserId: webhookData.userid,
          fn: "withingsWebhook",
        });

        // Still return 200 to acknowledge receipt
        res.status(200).json({
          success: true,
          message: "Webhook received but user not found",
        });
        return;
      }

      const userDoc = usersSnapshot.docs[0];
      const userId = userDoc.id;

      // Store webhook event for processing
      await db.collection("withingsWebhooks").add({
        userId,
        withingsUserId: webhookData.userid.toString(),
        appli: webhookData.appli,
        startdate: webhookData.startdate,
        enddate: webhookData.enddate,
        receivedAt: FieldValue.serverTimestamp(),
        processed: false,
      });

      logger.info("Withings webhook stored", {
        traceId,
        userId,
        withingsUserId: webhookData.userid,
        fn: "withingsWebhook",
      });

      // Return success immediately (process asynchronously)
      res.status(200).json({
        success: true,
        message: "Webhook received and queued for processing",
      });

      // TODO: Trigger background job to sync Withings data for this user
      // This could be done via a Cloud Task or Pub/Sub trigger

      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    logger.error("Error processing Withings webhook", error as Error, {
      traceId,
      fn: "withingsWebhook",
    });

    // Return 200 to prevent Withings from retrying
    // Log error for manual investigation
    res.status(200).json({
      success: false,
      error: "Webhook received but processing failed",
    });
  }
});
