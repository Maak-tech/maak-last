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

// Enhanced push notification function with preference checking
export const sendPushNotification = functions.https.onCall(
  async (data: any, context: any) => {
    const {userIds, notification, notificationType = "general"} = data;

    // Temporarily allow unauthenticated calls for testing
    // TODO: Re-enable authentication in production
    if (!context.auth) {
      console.warn("Warning: Unauthenticated call to sendPushNotification");
      // For testing, we'll allow it but log the warning
      // throw new functions.https.HttpsError(
      //   "unauthenticated",
      //   "User must be authenticated"
      // );
    }

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
    const {token, deviceInfo} = data;

    // Temporarily allow unauthenticated calls for testing
    if (!context.auth) {
      console.warn("Warning: Unauthenticated call to saveFCMToken");
      // For testing purposes, create a fake context
      context = {auth: {uid: "test-user"}};
    }

    if (!token) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing FCM token"
      );
    }

    try {
      const db = admin.firestore();
      const userRef = db.collection("users").doc(context.auth.uid);

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
        userId: context.auth.uid,
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
