import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as functions from "firebase-functions";

// New structure imports
import { logger } from "./observability/logger";
import { createTraceId } from "./observability/correlation";
import { ingestVital } from "./api/vitals";
import { getFamilyMemberIds } from "./modules/family/familyMembers";
import { getFamilyAdmins } from "./modules/family/admins";
import { sendPushNotificationInternal } from "./services/notifications";

// Initialize Firebase Admin
admin.initializeApp();

// Simple HTTP function that works with minimal permissions
export const testHello = functions.https.onRequest((req, res) => {
  res.json({
    success: true,
    message: "Cloud Functions are working!",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
  });
});

// Vitals ingestion endpoint
export const ingestVitalReading = functions.https.onCall(
  async (data: any, context: any) => {
    return ingestVital(data, context);
  }
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
    const {
      userIds,
      notification,
      notificationType = "general",
    } = data;

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
      const allRecipients = Array.from(new Set([...adminIds, ...familyMemberIds]));

      if (allRecipients.length === 0) {
        return { success: true, message: "No family members to notify" };
      }

      // Prepare notification
      const notification = {
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
      const result = await exports.sendPushNotification(
        {
          userIds: allRecipients,
          notification,
          notificationType: "fall",
        },
        { auth: context.auth }
      );

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

// Function to send medication reminder
export const sendMedicationReminder = functions.https.onCall(
  async (data: any, context: any) => {
    const { medicationId, medicationName, dosage, userId } = data;

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    try {
      const notification = {
        title: "💊 Medication Reminder",
        body: `Time to take ${medicationName} (${dosage})`,
        priority: "high",
        sound: "reminder",
        data: {
          type: "medication_reminder",
          medicationId,
          medicationName,
          dosage,
        },
        clickAction: "OPEN_MEDICATIONS",
        color: "#10B981",
      };

      // Send to the user
      const result = await exports.sendPushNotification(
        {
          userIds: [userId],
          notification,
          notificationType: "medication",
        },
        { auth: context.auth }
      );

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
      const notification = {
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
      const result = await exports.sendPushNotification(
        {
          userIds: adminIdsToAlert,
          notification,
          notificationType: "symptom",
        },
        { auth: context.auth }
      );

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
  async (data: any, context: any) => {
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
        const authLogDoc = await db.collection("auth_logs").doc(authLogId).get();
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
        throw new functions.https.HttpsError(
          "not-found",
          "User not found"
        );
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

/**
 * Get admin users for a family
 */
// Export sendVitalAlertToAdmins for backward compatibility
export { sendVitalAlertToAdmins } from "./modules/alerts/vitalAlert";

// Re-export vitals trigger
export { checkVitalBenchmarks } from "./triggers/vitals";

// Re-export symptoms trigger
export { checkSymptomBenchmarks } from "./triggers/symptoms";

// Re-export health trends analysis job
export { analyzeHealthTrends } from "./jobs/healthTrends";