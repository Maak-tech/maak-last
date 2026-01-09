import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as functions from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

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
  return Array.isArray(userData.fcmToken)
    ? userData.fcmToken
    : [userData.fcmToken];
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
  const familySnapshot = await db
    .collection("users")
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
    case "vital":
      return notificationSettings.vitalAlerts !== false;
    case "trend":
      return notificationSettings.trendAlerts !== false;
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

    const {
      userIds,
      notification,
      notificationType = "general",
    } = req.body.data || req.body;

    // HTTP Push notification requested

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
        tokens,
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
    const {
      userIds,
      notification,
      notificationType = "general",
    } = data;

    // Require authentication for production security
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    if (!(userIds && notification)) {
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
        // No FCM tokens found or all users opted out
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
            notification.priority === "high"
              ? ("high" as const)
              : ("normal" as const),
          notification: {
            sound: notification.sound || "default",
            priority:
              notification.priority === "high"
                ? ("high" as const)
                : ("default" as const),
            channelId: notificationType,
            tag: notification.tag,
            color: notification.color || "#2563EB",
            icon: "ic_notification",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: notification.sound || "default",
              badge: notification.badge !== undefined ? notification.badge : 1,
              "mutable-content": 1,
              category: notificationType.toUpperCase(),
            },
          },
          headers: {
            "apns-priority": notification.priority === "high" ? "10" : "5",
          },
        },
        tokens,
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

      // Push notifications sent successfully

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
async function cleanupInvalidTokens(invalidTokens: string[]): Promise<void> {
  const db = admin.firestore();
  const batch = db.batch();

  // Find users with these tokens and remove them
  const usersSnapshot = await db
    .collection("users")
    .where("fcmToken", "in", invalidTokens)
    .get();

  usersSnapshot.forEach((doc) => {
    batch.update(doc.ref, {
      fcmToken: FieldValue.delete(),
    });
  });

  await batch.commit();
  // Invalid tokens cleaned up
}

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
      console.error("Error saving FCM token", error);
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
    const { alertId, userId, userName, location } = data;

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
      console.error("Error sending medication reminder:", error);
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
      const medicationsSnapshot = await db
        .collection("medications")
        .where("isActive", "==", true)
        .get();

      const remindersToSend: any[] = [];

      medicationsSnapshot.forEach((doc) => {
        const medication = doc.data();
        const reminders = medication.reminders || [];

        // Check if any reminder matches current time (within 5 minutes)
        reminders.forEach((reminder: any) => {
          const reminderTime = reminder.time;
          if (
            isTimeWithinRange(currentTime, reminderTime, 5) &&
            !reminder.taken
          ) {
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
          await exports.sendMedicationReminder(reminder, {
            auth: { uid: "system" },
          });

          // Mark reminder as notified
          await db
            .collection("medications")
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

      // Medication reminders sent
    } catch (error) {
      console.error("Error in scheduled medication reminders:", error);
    }
  }
);

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
      console.error("Error updating preferences:", error);
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
      console.error("Error generating biometric token:", error);
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

/**
 * Vital benchmarks configuration
 */
const VITAL_BENCHMARKS: Record<string, any> = {
  heartRate: {
    alertThresholds: {
      low: { critical: 40, warning: 50 },
      high: { critical: 150, warning: 120 },
    },
    normalRange: { min: 60, max: 100 },
  },
  restingHeartRate: {
    alertThresholds: {
      low: { critical: 35, warning: 45 },
      high: { critical: 120, warning: 100 },
    },
    normalRange: { min: 50, max: 90 },
  },
  heartRateVariability: {
    alertThresholds: {
      low: { critical: 10, warning: 15 },
      high: { critical: 100, warning: 80 },
    },
    normalRange: { min: 20, max: 60 },
  },
  bloodPressure: {
    alertThresholds: {
      low: { critical: 80, warning: 85 },
      high: { critical: 180, warning: 140 },
    },
    normalRange: { min: 90, max: 120 },
  },
  respiratoryRate: {
    alertThresholds: {
      low: { critical: 8, warning: 10 },
      high: { critical: 30, warning: 24 },
    },
    normalRange: { min: 12, max: 20 },
  },
  oxygenSaturation: {
    alertThresholds: {
      low: { critical: 88, warning: 92 },
      high: { critical: 100, warning: 100 },
    },
    normalRange: { min: 95, max: 100 },
  },
  bodyTemperature: {
    alertThresholds: {
      low: { critical: 35.0, warning: 35.5 },
      high: { critical: 40.0, warning: 38.0 },
    },
    normalRange: { min: 36.1, max: 37.2 },
  },
};

/**
 * Check if vital is below or above benchmark
 */
function checkVitalBenchmark(
  vitalType: string,
  value: number
): { isAlert: boolean; severity: "critical" | "warning" | null; direction: "low" | "high" | null } {
  const benchmark = VITAL_BENCHMARKS[vitalType];
  if (!benchmark) {
    return { isAlert: false, severity: null, direction: null };
  }

  // Check critical low
  if (value <= benchmark.alertThresholds.low.critical) {
    return { isAlert: true, severity: "critical", direction: "low" };
  }

  // Check critical high
  if (value >= benchmark.alertThresholds.high.critical) {
    return { isAlert: true, severity: "critical", direction: "high" };
  }

  // Check warning low
  if (value <= benchmark.alertThresholds.low.warning) {
    return { isAlert: true, severity: "warning", direction: "low" };
  }

  // Check warning high
  if (value >= benchmark.alertThresholds.high.warning) {
    return { isAlert: true, severity: "warning", direction: "high" };
  }

  // Check if outside normal range
  if (value < benchmark.normalRange.min) {
    return { isAlert: true, severity: "warning", direction: "low" };
  }

  if (value > benchmark.normalRange.max) {
    return { isAlert: true, severity: "warning", direction: "high" };
  }

  return { isAlert: false, severity: null, direction: null };
}

/**
 * Get admin users for a family
 */
async function getFamilyAdmins(familyId: string): Promise<string[]> {
  const db = admin.firestore();
  const usersSnapshot = await db
    .collection("users")
    .where("familyId", "==", familyId)
    .where("role", "==", "admin")
    .get();

  return usersSnapshot.docs.map((doc) => doc.id);
}

/**
 * Send alert to admins about vital below benchmark
 */
async function sendVitalAlertToAdmins(
  userId: string,
  userName: string,
  vitalType: string,
  value: number,
  unit: string,
  severity: "critical" | "warning",
  direction: "low" | "high"
): Promise<void> {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();

    if (!userData?.familyId) {
      return; // No family, no admins to alert
    }

    const adminIds = await getFamilyAdmins(userData.familyId);
    if (adminIds.length === 0) {
      return; // No admins to alert
    }

    // Don't alert the user themselves if they're an admin
    const adminIdsToAlert = adminIds.filter((id) => id !== userId);

    if (adminIdsToAlert.length === 0) {
      return;
    }

    const directionText = direction === "low" ? "below" : "above";
    const severityEmoji = severity === "critical" ? "🚨" : "⚠️";

    const notification = {
      title: `${severityEmoji} Vital Sign Alert`,
      body: `${userName}'s ${vitalType} is ${directionText} normal range: ${value} ${unit}`,
      priority: severity === "critical" ? "high" : "normal",
      data: {
        type: "vital_alert",
        vitalType,
        value: value.toString(),
        unit,
        severity,
        direction,
        userId,
        userName,
      },
      clickAction: "OPEN_VITALS",
      color: severity === "critical" ? "#EF4444" : "#F59E0B",
    };

    // Send to admins
    const result = await exports.sendPushNotification(
      {
        userIds: adminIdsToAlert,
        notification,
        notificationType: "vital",
      },
      { auth: { uid: "system" } }
    );

    // Log the alert
    await db.collection("notificationLogs").add({
      type: "vital_alert",
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
    console.error("Error sending vital alert to admins:", error);
    // Don't throw - alerts are non-critical
  }
}

/**
 * Firestore trigger: Check vitals against benchmarks when new vital is created
 */
export const checkVitalBenchmarks = onDocumentCreated(
  "vitals/{vitalId}",
  async (event) => {
    const vitalData = event.data?.data();
    if (!vitalData) {
      return;
    }

    const { userId, type, value } = vitalData;

    if (!userId || !type || typeof value !== "number") {
      return;
    }

    // Check benchmark
    const checkResult = checkVitalBenchmark(type, value);

    if (!checkResult.isAlert) {
      return; // Vital is within normal range
    }

    try {
      // Get user info
      const db = admin.firestore();
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();

      if (!userData) {
        return;
      }

      const userName =
        userData.firstName && userData.lastName
          ? `${userData.firstName} ${userData.lastName}`
          : userData.email || "User";

      const unit = vitalData.unit || "";

      // Send alert to admins
      await sendVitalAlertToAdmins(
        userId,
        userName,
        type,
        value,
        unit,
        checkResult.severity!,
        checkResult.direction!
      );
    } catch (error) {
      console.error("Error in checkVitalBenchmarks:", error);
      // Don't throw - this is a background function
    }
  }
);

/**
 * Firestore trigger: Check symptoms against benchmarks when new symptom is created
 */
export const checkSymptomBenchmarks = onDocumentCreated(
  "symptoms/{symptomId}",
  async (event) => {
    const symptomData = event.data?.data();
    if (!symptomData) {
      return;
    }

    const { userId, severity } = symptomData;

    if (!userId || typeof severity !== "number") {
      return;
    }

    // Alert for severity 4 (severe) or 5 (very severe)
    if (severity < 4) {
      return; // Not severe enough
    }

    try {
      // Get user info
      const db = admin.firestore();
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();

      if (!userData?.familyId) {
        return; // No family, no admins to alert
      }

      const userName =
        userData.firstName && userData.lastName
          ? `${userData.firstName} ${userData.lastName}`
          : userData.email || "User";

      const adminIds = await getFamilyAdmins(userData.familyId);
      const adminIdsToAlert = adminIds.filter((id) => id !== userId);

      if (adminIdsToAlert.length === 0) {
        return;
      }

      const severityText = severity === 5 ? "very severe" : "severe";
      const severityEmoji = severity === 5 ? "🚨" : "⚠️";
      const symptomType = symptomData.type || "symptom";

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
        { auth: { uid: "system" } }
      );

      // Log the alert
      await db.collection("notificationLogs").add({
        type: "symptom_alert",
        userId,
        symptomType,
        severity,
        recipientIds: adminIdsToAlert,
        sentAt: FieldValue.serverTimestamp(),
        result,
      });
    } catch (error) {
      console.error("Error in checkSymptomBenchmarks:", error);
      // Don't throw - this is a background function
    }
  }
);

/**
 * Send trend alert to admins
 */
async function sendTrendAlertToAdmins(
  userId: string,
  userName: string,
  trendType: "vital" | "symptom",
  analysis: {
    type: string;
    trend: string;
    severity: "critical" | "warning";
    message: string;
    changePercent?: number;
    frequency?: number;
  }
): Promise<void> {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();

    if (!userData?.familyId) {
      return; // No family, no admins to alert
    }

    const adminIds = await getFamilyAdmins(userData.familyId);
    // Don't alert the user themselves if they're an admin
    const adminIdsToAlert = adminIds.filter((id) => id !== userId);

    if (adminIdsToAlert.length === 0) {
      return;
    }

    const severityEmoji = analysis.severity === "critical" ? "📈" : "📊";
    const trendEmoji =
      analysis.trend === "increasing"
        ? "📈"
        : analysis.trend === "decreasing"
        ? "📉"
        : "📊";

    const notification = {
      title: `${severityEmoji} ${trendEmoji} Health Trend Alert`,
      body: `${userName}: ${analysis.message}`,
      priority: analysis.severity === "critical" ? "high" : "normal",
      data: {
        type: "trend_alert",
        trendType,
        analysisType: analysis.type,
        trend: analysis.trend,
        severity: analysis.severity,
        userId,
        userName,
        message: analysis.message,
      },
      clickAction: trendType === "vital" ? "OPEN_VITALS" : "OPEN_SYMPTOMS",
      color: analysis.severity === "critical" ? "#EF4444" : "#F59E0B",
    };

    // Send to admins
    const result = await exports.sendPushNotification(
      {
        userIds: adminIdsToAlert,
        notification,
        notificationType: "trend",
      },
      { auth: { uid: "system" } }
    );

    // Log the alert
    await db.collection("notificationLogs").add({
      type: "trend_alert",
      userId,
      trendType,
      analysisType: analysis.type,
      trend: analysis.trend,
      severity: analysis.severity,
      recipientIds: adminIdsToAlert,
      adminRecipients: adminIdsToAlert,
      sentAt: FieldValue.serverTimestamp(),
      result,
    });
  } catch (error) {
    console.error("Error sending trend alert to admins:", error);
    // Don't throw - alerts are non-critical
  }
}

/**
 * Scheduled function to analyze health trends and alert admins
 * Runs daily at 2 AM
 */
export const analyzeHealthTrends = onSchedule(
  "0 2 * * *", // Daily at 2 AM
  async () => {
    const db = admin.firestore();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      // Get all users with families
      const usersSnapshot = await db
        .collection("users")
        .where("familyId", "!=", null)
        .get();

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        if (!userData.familyId) continue;

        const userName =
          userData.firstName && userData.lastName
            ? `${userData.firstName} ${userData.lastName}`
            : userData.email || "User";

        // Analyze vital signs trends (last 7 days)
        const vitalsSnapshot = await db
          .collection("vitals")
          .where("userId", "==", userId)
          .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(sevenDaysAgo))
          .orderBy("timestamp", "asc")
          .get();

        // Group vitals by type
        const vitalsByType: Record<
          string,
          Array<{ value: number; timestamp: Date }>
        > = {};

        vitalsSnapshot.forEach((doc) => {
          const vitalData = doc.data();
          const type = vitalData.type;
          const value = vitalData.value;
          const timestamp = vitalData.timestamp?.toDate() || new Date();

          if (typeof value === "number" && type) {
            if (!vitalsByType[type]) {
              vitalsByType[type] = [];
            }
            vitalsByType[type].push({ value, timestamp });
          }
        });

        // Analyze trends for each vital type
        for (const [vitalType, values] of Object.entries(vitalsByType)) {
          if (values.length < 3) continue; // Need at least 3 data points

          // Simple trend analysis: compare first half vs second half
          const midpoint = Math.floor(values.length / 2);
          const firstHalf = values.slice(0, midpoint);
          const secondHalf = values.slice(midpoint);

          const firstAvg =
            firstHalf.reduce((sum, v) => sum + v.value, 0) / firstHalf.length;
          const secondAvg =
            secondHalf.reduce((sum, v) => sum + v.value, 0) / secondHalf.length;

          const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
          const trend =
            Math.abs(changePercent) < 2
              ? "stable"
              : changePercent > 0
              ? "increasing"
              : "decreasing";

          // Determine severity
          let severity: "critical" | "warning" | null = null;
          const thresholds: Record<
            string,
            { critical: number; warning: number }
          > = {
            heartRate: { critical: 15, warning: 10 },
            restingHeartRate: { critical: 20, warning: 12 },
            bloodPressure: { critical: 15, warning: 10 },
            respiratoryRate: { critical: 25, warning: 15 },
            oxygenSaturation: { critical: 5, warning: 3 },
            bodyTemperature: { critical: 10, warning: 5 },
            weight: { critical: 5, warning: 3 },
          };

          const vitalThresholds = thresholds[vitalType] || {
            critical: 20,
            warning: 10,
          };

          if (trend === "increasing" && changePercent >= vitalThresholds.critical) {
            severity = "critical";
          } else if (
            trend === "increasing" &&
            changePercent >= vitalThresholds.warning
          ) {
            severity = "warning";
          } else if (
            trend === "decreasing" &&
            changePercent <= -vitalThresholds.critical
          ) {
            severity = "critical";
          } else if (
            trend === "decreasing" &&
            changePercent <= -vitalThresholds.warning
          ) {
            severity = "warning";
          }

          if (severity) {
            await sendTrendAlertToAdmins(userId, userName, "vital", {
              type: vitalType,
              trend,
              severity,
              message: `${vitalType} is ${trend} (${changePercent.toFixed(1)}% change) over the past 7 days`,
              changePercent,
            });
          }
        }

        // Analyze symptom trends (last 30 days)
        const symptomsSnapshot = await db
          .collection("symptoms")
          .where("userId", "==", userId)
          .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
          .orderBy("timestamp", "asc")
          .get();

        // Group symptoms by type
        const symptomsByType: Record<
          string,
          Array<{ severity: number; timestamp: Date }>
        > = {};

        symptomsSnapshot.forEach((doc) => {
          const symptomData = doc.data();
          const type = symptomData.type || symptomData.symptomType;
          const severity = symptomData.severity;
          const timestamp = symptomData.timestamp?.toDate() || new Date();

          if (typeof severity === "number" && type) {
            if (!symptomsByType[type]) {
              symptomsByType[type] = [];
            }
            symptomsByType[type].push({ severity, timestamp });
          }
        });

        // Analyze trends for each symptom type
        for (const [symptomType, symptoms] of Object.entries(symptomsByType)) {
          if (symptoms.length < 2) continue;

          const daysSinceFirst =
            (now.getTime() - symptoms[0].timestamp.getTime()) /
            (1000 * 60 * 60 * 24);
          const frequency = (symptoms.length / daysSinceFirst) * 7; // per week

          const averageSeverity =
            symptoms.reduce((sum, s) => sum + s.severity, 0) / symptoms.length;

          // Compare recent vs older symptoms
          const midpoint = Math.floor(symptoms.length / 2);
          const recentCount = symptoms.slice(midpoint).length;
          const olderCount = symptoms.slice(0, midpoint).length;

          const recentFrequency =
            olderCount > 0 ? (recentCount / olderCount) * frequency : frequency;

          const trend =
            recentFrequency > frequency * 1.3
              ? "increasing"
              : recentFrequency < frequency * 0.7
              ? "decreasing"
              : "stable";

          let severity: "critical" | "warning" | null = null;

          if (trend === "increasing") {
            if (frequency >= 5 || averageSeverity >= 4) {
              severity = "critical";
            } else if (frequency >= 3 || averageSeverity >= 3) {
              severity = "warning";
            }
          } else if (averageSeverity >= 4 && frequency >= 2) {
            severity = "warning";
          }

          if (severity) {
            await sendTrendAlertToAdmins(userId, userName, "symptom", {
              type: symptomType,
              trend,
              severity,
              message: `${symptomType} is ${trend === "increasing" ? "becoming more frequent" : trend === "decreasing" ? "decreasing in frequency" : "occurring regularly"} (${frequency.toFixed(1)}x per week, avg severity ${averageSeverity.toFixed(1)}/5)`,
              frequency,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error analyzing health trends:", error);
      // Don't throw - this is a background function
    }
  }
);