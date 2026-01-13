/**
 * Notification Preferences
 * Handles checking user notification preferences
 */

import * as admin from 'firebase-admin';
import { logger } from '../../observability/logger';

/**
 * Notification type enum
 */
export type NotificationType = 
  | 'fall' 
  | 'medication' 
  | 'symptom' 
  | 'vital' 
  | 'trend' 
  | 'family'
  | string; // Allow other types to maintain compatibility

/**
 * Check if a notification should be sent to a user based on their preferences
 * 
 * @param userId - The user ID to check
 * @param notificationType - Type of notification (fall, medication, symptom, vital, trend, family)
 * @param traceId - Optional correlation ID for logging
 * @returns true if notification should be sent, false otherwise
 */
export async function shouldSendNotification(
  userId: string,
  notificationType: NotificationType,
  traceId?: string
): Promise<boolean> {
  logger.debug('Checking notification preferences', {
    traceId,
    uid: userId,
    notificationType,
    fn: 'shouldSendNotification',
  });

  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      logger.debug('User not found', {
        traceId,
        uid: userId,
        fn: 'shouldSendNotification',
      });
      return false;
    }

    const preferences = userData.preferences || {};
    const notificationSettings = preferences.notifications || {};

    // Check global notification setting
    if (notificationSettings.enabled === false) {
      logger.debug('Notifications disabled globally for user', {
        traceId,
        uid: userId,
        fn: 'shouldSendNotification',
      });
      return false;
    }

    // Check specific notification type
    let shouldSend: boolean;
    switch (notificationType) {
      case 'fall':
        shouldSend = notificationSettings.fallAlerts !== false;
        break;
      case 'medication':
        shouldSend = notificationSettings.medicationReminders !== false;
        break;
      case 'symptom':
        shouldSend = notificationSettings.symptomAlerts !== false;
        break;
      case 'vital':
        shouldSend = notificationSettings.vitalAlerts !== false;
        break;
      case 'trend':
        shouldSend = notificationSettings.trendAlerts !== false;
        break;
      case 'family':
        shouldSend = notificationSettings.familyUpdates !== false;
        break;
      default:
        shouldSend = true;
    }

    logger.debug('Notification preference checked', {
      traceId,
      uid: userId,
      notificationType,
      shouldSend,
      fn: 'shouldSendNotification',
    });

    return shouldSend;
  } catch (error) {
    logger.error('Failed to check notification preferences', error as Error, {
      traceId,
      uid: userId,
      notificationType,
      fn: 'shouldSendNotification',
    });
    // Default to allowing notification on error
    return true;
  }
}
