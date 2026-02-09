/**
 * Notification Preferences
 * Handles checking user notification preferences
 */

import { getFirestore } from "firebase-admin/firestore";
import { logger } from "../../observability/logger";

/**
 * Check if a notification should be sent to a user based on their preferences
 *
 * @param userId - The user ID to check
 * @param notificationType - Type of notification (fall, medication, symptom, vital, trend, family)
 * @returns true if notification should be sent, false otherwise
 */
export async function shouldSendNotification(
  userId: string,
  notificationType: string
): Promise<boolean> {
  try {
    const db = getFirestore();
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      logger.debug("User not found", {
        uid: userId,
        fn: "shouldSendNotification",
      });
      return false;
    }

    const preferences = userData.preferences || {};
    const notificationSettings = preferences.notifications || {};

    // Check global notification setting
    if (notificationSettings.enabled === false) {
      logger.debug("Notifications disabled globally for user", {
        uid: userId,
        fn: "shouldSendNotification",
      });
      return false;
    }

    // Check specific notification type
    let shouldSend: boolean;
    switch (notificationType) {
      case "fall":
        shouldSend = notificationSettings.fallAlerts !== false;
        break;
      case "medication":
        shouldSend = notificationSettings.medicationReminders !== false;
        break;
      case "symptom":
        shouldSend = notificationSettings.symptomAlerts !== false;
        break;
      case "vital":
        shouldSend = notificationSettings.vitalAlerts !== false;
        break;
      case "trend":
        shouldSend = notificationSettings.trendAlerts !== false;
        break;
      case "family":
        shouldSend = notificationSettings.familyUpdates !== false;
        break;
      default:
        shouldSend = true;
    }

    logger.debug("Notification preference checked", {
      uid: userId,
      notificationType,
      shouldSend,
      fn: "shouldSendNotification",
    });

    return shouldSend;
  } catch (error) {
    logger.error("Failed to check notification preferences", error as Error, {
      uid: userId,
      notificationType,
      fn: "shouldSendNotification",
    });
    // Default to allowing notification on error
    return true;
  }
}
