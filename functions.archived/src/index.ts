import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";

// Initialize Firebase Admin
admin.initializeApp();

/**
 * Helper function to get FCM tokens for a user
 * @param {string} userId - The user ID to get tokens for
 * @return {Promise<string[]>} Array of FCM tokens
 */
async function getUserTokens(userId: string): Promise<string[]> {
  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(userId).get();
  const userData = userDoc.data();

  if (!userData?.fcmToken) return [];

  // Support both single token and array of tokens
  return Array.isArray(userData.fcmToken) ?
    userData.fcmToken : [userData.fcmToken];
}

/**
 * Helper function to get family member IDs
 * @param {string} userId - The user ID to get family for
 * @param {boolean} excludeUserId - Whether to exclude the user
 * @return {Promise<string[]>} Array of family member IDs
 */
async function getFamilyMemberIds(
  userId: string,
  excludeUserId = true
): Promise<string[]> {
  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(userId).get();
  const userData = userDoc.data();

  if (!userData?.familyId) return [];

  // Get all family members
  const familySnapshot = await db.collection("users")
    .where("familyId", "==", userData.familyId)
    .get();

  const memberIds: string[] = [];
  familySnapshot.forEach((doc) => {
    if (!excludeUserId || doc.id !== userId) {
      memberIds.push(doc.id);
    }
  });

  return memberIds;
}

/**
 * Helper function to check notification preferences
 * @param {string} userId - The user ID to check
 * @param {string} notificationType - Type of notification
 * @return {Promise<boolean>} Whether to send notification
 */
async function shouldSendNotification(
  userId: string,
  notificationType: string
): Promise<boolean> {
  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(userId).get();
  const userData = userDoc.data();

  if (!userData) return false;

  const preferences = userData.preferences || {};
  const notificationSettings = preferences.notifications || {};

  // Check global notification setting
  if (notificationSettings.enabled === false) return false;

  // Check specific notification type
  switch (notificationType) {
  case "fall":
    return notificationSettings.fallAlerts !== false;
  case "medication":
    return notificationSettings.medicationReminders !== false;
  case "symptom":
    return notificationSettings.symptomAlerts !== false;
  case "family":
    return notificationSettings.familyUpdates !== false;
  default:
    return true;
  }
}

// Simple HTTP function that works with minimal permissions
export const testHello = functions.https.onRequest((req, res) => {
  res.json({
    success: true,
    message: "Cloud Functions are working!",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
  });
});

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

    const {userIds, notification, notificationType = "general", senderId} =
      req.body.data || req.body;

    console.log("HTTP Push notification requested by:", senderId || "unknown");

    try {
      // Re-use the same logic from sendPushNotification
      const tokens: string[] = [];
      const skippedUsers: string[] = [];

      // Get tokens for each user
      for (const userId of userIds) {
        const userTokens = await getUserTokens(userId);
        tokens.push(...userTokens);
      }

      if (tokens.length === 0) {
        res.json({
          result: {
            success: true,
            message: "No tokens to send to",
            skippedCount: skippedUsers.length,
          },
        });
        return;
      }

      // Send notification
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          ...notification.data,
          notificationType,
          timestamp: new Date().toISOString(),
        },
        tokens: tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      res.json({
        result: {
          success: true,
          successCount: response.successCount,
          failureCount: response.failureCount,
          message: `Sent to ${response.successCount}/${tokens.length} devices`,
        },
      });
    } catch (error) {
      console.error("Error in sendPushNotificationHttp:", error);
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
    const {userIds, notification,
      notificationType = "general", senderId} = data;

    // Temporarily bypass authentication for testing
    // TODO: Fix authentication issue and re-enable this check
    console.log("Auth context:",
      context.auth ? "Authenticated" : "Not authenticated");
    console.log("SenderId provided:", senderId || "None");

    // For now, just log and continue
    if (!context.auth && !senderId) {
      console.warn(
        "Warning: No authentication or senderId - allowing for testing");
    }

    const authenticatedUserId = context.auth?.uid || senderId || "testing-user";
    console.log("Push notification requested by:", authenticatedUserId);

    if (!userIds || !notification) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing userIds or notification"
      );
    }

    try {
      const tokens: string[] = [];
      const skippedUsers: string[] = [];

      // Check preferences and get tokens for each user
      for (const userId of userIds) {
        const shouldSend = await shouldSendNotification(
          userId,
          notificationType
        );

        if (shouldSend) {
          const userTokens = await getUserTokens(userId);
          tokens.push(...userTokens);
        } else {
          skippedUsers.push(userId);
        }
      }

      if (tokens.length === 0) {
        console.log("No FCM tokens found or all users opted out", {
          userIds,
          skippedUsers,
        });
        return {
          success: true,
          message: "No tokens to send to",
          skippedCount: skippedUsers.length,
        };
      }

      // Enhanced notification message with better formatting
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: {
          ...notification.data,
          notificationType,
          timestamp: new Date().toISOString(),
          clickAction: notification.clickAction || "FLUTTER_NOTIFICATION_CLICK",
        },
        android: {
          priority:
            notification.priority === "high" ?
              ("high" as const) :
              ("normal" as const),
          notification: {
            sound: notification.sound || "default",
            priority:
              notification.priority === "high" ?
                ("high" as const) :
                ("default" as const),
            channelId: notificationType,
            tag: notification.tag,
            color: notification.color || "#2563EB",
            icon: "ic_notification",
          },
        },
        apns: {
          payload: {
            aps: {
              "sound": notification.sound || "default",
              "badge": notification.badge !== undefined ?
                notification.badge : 1,
              "mutable-content": 1,
              "category": notificationType.toUpperCase(),
            },
          },
          headers: {
            "apns-priority": notification.priority === "high" ? "10" : "5",
          },
        },
        tokens: tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      // Handle failed tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            console.error("Failed to send to token:", resp.error);
          }
        });

        // Clean up invalid tokens
        await cleanupInvalidTokens(failedTokens);
      }

      console.log("Push notifications sent", {
        successCount: response.successCount,
        failureCount: response.failureCount,
        skippedCount: skippedUsers.length,
        totalTokens: tokens.length,
      });

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        skippedCount: skippedUsers.length,
        message: `Sent to ${response.successCount}/${tokens.length} devices`,
      };
    } catch (error) {
      console.error("Error sending push notification", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to send push notification"
      );
    }
  }
);

/**
 * Helper function to clean up invalid tokens
 * @param {string[]} invalidTokens - Array of invalid tokens
 * @return {Promise<void>}
 */
async function cleanupInvalidTokens(
  invalidTokens: string[]
): Promise<void> {
  const db = admin.firestore();
  const batch = db.batch();

  // Find users with these tokens and remove them
  const usersSnapshot = await db.collection("users")
    .where("fcmToken", "in", invalidTokens)
    .get();

  usersSnapshot.forEach((doc) => {
    batch.update(doc.ref, {
      fcmToken: FieldValue.delete(),
    });
  });

  await batch.commit();
  console.log(`Cleaned up ${invalidTokens.length} invalid tokens`);
}

// Enhanced FCM token management with device tracking
export const saveFCMToken = functions.https.onCall(
  async (data: any, context: any) => {
    const {token, deviceInfo, userId} = data;

    // Allow both authenticated and userId-based calls
    const targetUserId = context.auth?.uid || userId;

    // Temporarily allow unauthenticated calls for testing
    // TODO: Re-enable authentication in production
    if (!targetUserId) {
      console.warn("Warning: No user ID for saveFCMToken");
      // For now, just log warning instead of throwing error
      if (!userId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "User ID is required"
        );
      }
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

      console.log("FCM token saved", {
        userId: targetUserId,
        deviceId,
      });

      return {success: true, message: "FCM token saved successfully"};
    } catch (error) {
      console.error("Error saving FCM token", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to save FCM token"
      );
    }
  }
);

// Function to send fall detection alert to family members
export const sendFallAlert = functions.https.onCall(
  async (data: any, context: any) => {
    const {alertId, userId, userName, location} = data;

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    try {
      // Get family members
      const familyMemberIds = await getFamilyMemberIds(userId);

      if (familyMemberIds.length === 0) {
        console.log("No family members to notify");
        return {success: true, message: "No family members to notify"};
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

      // Send to all family members
      const result = await exports.sendPushNotification(
        {
          userIds: familyMemberIds,
          notification,
          notificationType: "fall",
        },
        {auth: context.auth}
      );

      // Log the alert
      const db = admin.firestore();
      await db.collection("notificationLogs").add({
        type: "fall_alert",
        alertId,
        userId,
        recipientIds: familyMemberIds,
        sentAt: FieldValue.serverTimestamp(),
        result,
      });

      return result;
    } catch (error) {
      console.error("Error sending fall alert:", error);
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
    const {medicationId, medicationName, dosage, userId} = data;

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
        {auth: context.auth}
      );

      return result;
    } catch (error) {
      console.error("Error sending medication reminder:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to send medication reminder"
      );
    }
  }
);

// Function to send symptom alert to family
export const sendSymptomAlert = functions.https.onCall(
  async (data: any, context: any) => {
    const {symptomType, severity, userId, userName} = data;

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    // Only send for high severity symptoms (4 or 5)
    if (severity < 4) {
      return {success: true, message: "Symptom not severe enough for alert"};
    }

    try {
      // Get family members
      const familyMemberIds = await getFamilyMemberIds(userId);

      if (familyMemberIds.length === 0) {
        return {success: true, message: "No family members to notify"};
      }

      const severityText = severity === 5 ? "very severe" : "severe";
      const notification = {
        title: "⚠️ Health Alert",
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

      // Send to family members
      const result = await exports.sendPushNotification(
        {
          userIds: familyMemberIds,
          notification,
          notificationType: "symptom",
        },
        {auth: context.auth}
      );

      return result;
    } catch (error) {
      console.error("Error sending symptom alert:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to send symptom alert"
      );
    }
  }
);

// Scheduled function to check and send medication reminders
export const scheduledMedicationReminders = onSchedule(
  "every 1 hours",
  async () => {
    const db = admin.firestore();
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime =
    `${currentHour.toString().padStart(2, "0")}:` +
    `${currentMinutes.toString().padStart(2, "0")}`;

    try {
    // Get all active medications
      const medicationsSnapshot = await db.collection("medications")
        .where("isActive", "==", true)
        .get();

      const remindersToSend: any[] = [];

      medicationsSnapshot.forEach((doc) => {
        const medication = doc.data();
        const reminders = medication.reminders || [];

        // Check if any reminder matches current time (within 5 minutes)
        reminders.forEach((reminder: any) => {
          const reminderTime = reminder.time;
          if (isTimeWithinRange(currentTime, reminderTime, 5) &&
            !reminder.taken) {
            remindersToSend.push({
              medicationId: doc.id,
              medicationName: medication.name,
              dosage: medication.dosage,
              userId: medication.userId,
              reminderId: reminder.id,
            });
          }
        });
      });

      // Send reminders
      for (const reminder of remindersToSend) {
        try {
          await exports.sendMedicationReminder(
            reminder,
            {auth: {uid: "system"}}
          );

          // Mark reminder as notified
          await db.collection("medications")
            .doc(reminder.medicationId)
            .update({
              [`reminders.${reminder.reminderId}.notified`]: true,
              [`reminders.${reminder.reminderId}.notifiedAt`]:
              FieldValue.serverTimestamp(),
            });
        } catch (error) {
          console.error("Error sending reminder:", error);
        }
      }

      console.log(`Sent ${remindersToSend.length} medication reminders`);
    } catch (error) {
      console.error("Error in scheduled medication reminders:", error);
    }
  });

/**
 * Helper function to check if time is within range
 * @param {string} currentTime - Current time in HH:MM format
 * @param {string} targetTime - Target time in HH:MM format
 * @param {number} rangeMinutes - Range in minutes
 * @return {boolean} Whether time is within range
 */
function isTimeWithinRange(
  currentTime: string,
  targetTime: string,
  rangeMinutes: number
): boolean {
  const [currentHour, currentMin] = currentTime.split(":").map(Number);
  const [targetHour, targetMin] = targetTime.split(":").map(Number);

  const currentMinutes = currentHour * 60 + currentMin;
  const targetMinutes = targetHour * 60 + targetMin;

  const diff = Math.abs(currentMinutes - targetMinutes);
  return diff <= rangeMinutes;
}

// Function to update notification preferences
export const updateNotificationPreferences = functions.https.onCall(
  async (data: any, context: any) => {
    const {preferences} = data;

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

      console.log("Notification preferences updated", {
        userId: context.auth.uid,
        preferences,
      });

      return {success: true, message: "Preferences updated successfully"};
    } catch (error) {
      console.error("Error updating preferences:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to update preferences"
      );
    }
  }
);
<<<<<<< Updated upstream:functions/src/index.ts
=======

// Function to generate custom token for biometric authentication
export const generateBiometricToken = onCall(
  async (request) => {
    const { userId, authLogId } = request.data;

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

// Consent revocation → archive roster + audit trail + patient confirmation email
export { onConsentRevoked } from "./triggers/consentRevocation";
// Critical alert → email fallback for org providers
export { criticalAlertEmail } from "./triggers/criticalAlertEmail";
// Re-export medical history trigger
export { checkMedicalHistoryBenchmarks } from "./triggers/medicalHistory";
// Re-export symptoms trigger
export { checkSymptomBenchmarks } from "./triggers/symptoms";
// Re-export vitals trigger
export { checkVitalBenchmarks } from "./triggers/vitals";

// ─── Sprint 3: Integration Surface ────────────────────────────────────────────

// Public REST API (API-key authenticated)
export { nuralixApi } from "./api/publicApi";

// Outbound webhook delivery + retry scheduler
export { retryFailedWebhooks } from "./api/webhookDelivery";

// ─── Sprint 4: Agentic AI Pipeline ────────────────────────────────────────────

// Autonomous health agent (sense → reason → decide → act → verify)
export { agentCycle } from "./jobs/agentCycle";

// ─── Sprint 5: FHIR R4 + SMART on FHIR ───────────────────────────────────────

// FHIR R4 resource server + SMART on FHIR discovery document
export { fhirApi } from "./api/fhirApi";

// SMART on FHIR OAuth 2.0 authorization server
// Routes: /auth/register, /auth/authorize, /auth/token, /auth/token/introspect, /.well-known/jwks.json
export { smartAuth } from "./auth/smartAuth";

// ─── Sprint 6: Care Pathways + Email ──────────────────────────────────────────

export { caregiverDailySummary } from "./jobs/caregiverDailySummary";
export { dailyBriefing } from "./jobs/dailyBriefing";
// Data retention archival job (every Saturday 02:00 UTC)
export { dataRetentionJob } from "./jobs/dataRetention";
// Weekly org admin ops summary (every Friday 06:00 UTC)
export { weeklyOrgSummary } from "./jobs/orgSummaryDigest";
// Care pathway step executor (every 10 minutes)
export { pathwayEngine } from "./jobs/pathwayEngine";
// Weekly patient digest (every Sunday 08:00 UTC)
export { weeklyPatientDigest } from "./jobs/patientDigest";
// Weekly provider digest (every Monday 07:00 UTC)
export { weeklyProviderDigest } from "./jobs/weeklyDigest";
// Email queue processor (Firestore trigger → SendGrid) + hourly retry scheduler
export {
  processEmailQueue,
  retryFailedEmails,
} from "./triggers/emailQueue";

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
>>>>>>> Stashed changes:functions.archived/src/index.ts
