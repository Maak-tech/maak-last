<<<<<<< Updated upstream
import { userService } from './userService';
import { fcmService } from './fcmService';
import { User } from '@/types';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
=======
/**
 * Push notification service — Firebase-free replacement.
 *
 * All server-side dispatch is now handled by:
 *   fcmService.sendPushNotificationHTTP()  →  POST /api/notifications/send
 *
 * When push is unavailable (Expo Go, web), the service falls back to
 * expo-notifications.scheduleNotificationAsync() for local delivery.
 *
 * Removed:
 *   - Firebase Functions imports (FirebaseApp, getFunctions, httpsCallable)
 *   - getAuthenticatedFunctions() helper
 *   - All direct Cloud Function callable references
 */

import Constants from "expo-constants";
import { Platform } from "react-native";
import { fcmService } from "./fcmService";
import { userService } from "./userService";
import { api } from "@/lib/apiClient";
>>>>>>> Stashed changes

export interface PushNotificationData {
  title: string;
  body: string;
  data?: {
    type: 'fall_alert' | 'medication_reminder' | 'symptom_alert' | 'medication_alert' | 'emergency_alert';
    alertId?: string;
    userId?: string;
    medicationId?: string;
    medicationName?: string;
    symptomType?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    clickAction?: string;
  };
  sound?: 'default' | 'alarm' | 'reminder' | 'emergency';
  priority?: 'normal' | 'high';
  imageUrl?: string;
  badge?: number;
  color?: string;
  tag?: string;
  notificationType?: 'fall' | 'medication' | 'symptom' | 'family' | 'general';
}

<<<<<<< Updated upstream
// Helper to get authenticated functions instance
async function getAuthenticatedFunctions() {
  const { auth, app } = await import('@/lib/firebase');
  
  // Wait for auth to be ready
  const currentUser = auth.currentUser;
  if (currentUser) {
    // Force token refresh to ensure we have a valid token
    try {
      await currentUser.getIdToken(true);
      console.log('🔑 Auth token refreshed for push notification');
    } catch (e) {
      console.warn('⚠️ Could not refresh token:', e);
    }
  }
  
  // Return the functions instance (it will use the current auth state)
  return getFunctions(app, 'us-central1');
=======
// Schedule a local notification as fallback when Expo push is unavailable.
async function scheduleLocalNotification(
  notification: PushNotificationData
): Promise<void> {
  const Notifications = await import("expo-notifications");
  const isMedicationReminder =
    notification.data?.type === "medication_reminder";

  const content: Parameters<typeof Notifications.scheduleNotificationAsync>[0]["content"] = {
    title: notification.title,
    body: notification.body,
    data: notification.data,
    sound: notification.sound || "default",
    badge: notification.badge || 1,
  };

  // Android channel / category (typed loosely for expo-notifications version compat)
  if (isMedicationReminder) {
    (content as Record<string, unknown>).channelId = "medication";
    (content as Record<string, unknown>).categoryIdentifier = "MEDICATION";
  }

  await Notifications.scheduleNotificationAsync({ content, trigger: null });
>>>>>>> Stashed changes
}

export const pushNotificationService = {
  // Send notification to a specific user
  async sendToUser(
    userId: string,
    notification: PushNotificationData
  ): Promise<void> {
    try {
      const isFCMAvailable = await fcmService.isFCMAvailable();

      if (isFCMAvailable) {
<<<<<<< Updated upstream
        console.log('📱 Attempting FCM notification for user:', userId);
        // Use HTTP endpoint to bypass auth issues
=======
>>>>>>> Stashed changes
        const success = await fcmService.sendPushNotificationHTTP([userId], {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: notification.sound || 'default',
          priority: notification.priority || 'normal',
        });

<<<<<<< Updated upstream
        if (success) {
          console.log('✅ FCM notification sent to user:', userId);
          return;
        } else {
          console.log('⚠️ FCM failed, falling back to local notification');
        }
      }

      // Fallback to local notifications (for Expo Go or when FCM fails)
      console.log('📱 Using local notification fallback for user:', userId);
      const Notifications = await import('expo-notifications');

      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: notification.sound || 'default',
          priority: notification.priority === 'high' ? 'high' : 'normal',
          badge: notification.badge || 1,
          color: notification.color || '#2563EB',
        },
        trigger: null, // Send immediately
      });

      console.log(
        '📱 Local notification sent to user:',
        userId,
        'Title:',
        notification.title
      );
    } catch (error) {
      console.error('Error sending notification to user:', error);
=======
        if (success) return;
      }

      // Fallback: local notification (Expo Go / web)
      await scheduleLocalNotification(notification);
    } catch {
      // Silently handle
>>>>>>> Stashed changes
    }
  },

  // Send notification to all family members
  async sendToFamily(
    familyId: string,
    notification: PushNotificationData,
    excludeUserId?: string
  ): Promise<void> {
    try {
      const familyMembers = await userService.getFamilyMembers(familyId);
      const membersToNotify = familyMembers.filter(
        (member) => member.id !== excludeUserId
      );

<<<<<<< Updated upstream
      if (membersToNotify.length === 0) {
        console.log('📱 No family members to notify');
        return;
      }
=======
      if (!membersToNotify.length) return;
>>>>>>> Stashed changes

      const isFCMAvailable = await fcmService.isFCMAvailable();

      if (isFCMAvailable) {
<<<<<<< Updated upstream
        console.log(
          '📱 Attempting FCM notification to family members:',
          membersToNotify.length
        );
        const userIds = membersToNotify.map((member) => member.id);

        // Use HTTP endpoint to bypass auth issues
=======
        const userIds = membersToNotify.map((m) => m.id);
>>>>>>> Stashed changes
        const success = await fcmService.sendPushNotificationHTTP(userIds, {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: notification.sound || 'default',
          priority: notification.priority || 'normal',
        });
<<<<<<< Updated upstream

        if (success) {
          console.log(
            '✅ FCM notifications sent to family:',
            familyId,
            'Members:',
            membersToNotify.length
          );
          return;
        } else {
          console.log(
            '⚠️ FCM failed for family, falling back to local notifications'
          );
        }
      }

      // Fallback to local notifications (one per family member)
      console.log('📱 Using local notification fallback for family members');
      const notificationPromises = membersToNotify.map((member) =>
        this.sendToUser(member.id, notification)
      );

      await Promise.all(notificationPromises);

      console.log(
        '📱 Local notifications sent to family:',
        familyId,
        'Members:',
        membersToNotify.length
      );
    } catch (error) {
      console.error('Error sending notifications to family:', error);
    }
  },

  // Enhanced fall alert notification with Cloud Function support
=======
        if (success) return;
      }

      // Fallback: send individually via local notifications
      await Promise.all(
        membersToNotify.map((m) => this.sendToUser(m.id, notification))
      );
    } catch {
      // Silently handle
    }
  },

  // Send notification to family admins only
  async sendToAdmins(
    familyId: string,
    notification: PushNotificationData,
    excludeUserId?: string
  ): Promise<void> {
    try {
      const familyMembers = await userService.getFamilyMembers(familyId);
      const adminsToNotify = familyMembers.filter(
        (m) => m.role === "admin" && m.id !== excludeUserId
      );

      if (!adminsToNotify.length) return;

      const isFCMAvailable = await fcmService.isFCMAvailable();

      if (isFCMAvailable) {
        const userIds = adminsToNotify.map((m) => m.id);
        const success = await fcmService.sendPushNotificationHTTP(userIds, {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: notification.sound || "default",
          priority: notification.priority || "normal",
        });
        if (success) return;
      }

      await Promise.all(
        adminsToNotify.map((m) => this.sendToUser(m.id, notification))
      );
    } catch {
      // Silently handle
    }
  },

  // Send emergency fall alert to family members
  /* biome-ignore lint/nursery/useMaxParams: Alert dispatch API intentionally accepts explicit fields for existing call sites. */
>>>>>>> Stashed changes
  async sendFallAlert(
    userId: string,
    alertId: string,
    userName: string,
    familyId?: string,
    location?: string
  ): Promise<void> {
<<<<<<< Updated upstream
    try {
      // Try Cloud Function first for better reliability
      const isFCMAvailable = await fcmService.isFCMAvailable();
      
      if (isFCMAvailable && familyId) {
        console.log('🚨 Sending fall alert via Cloud Function');
        
        // Check if user is authenticated
        const { auth } = await import('@/lib/firebase');
        const currentUser = auth.currentUser;
        console.log('🔐 Current auth user:', currentUser ? currentUser.uid : 'NOT AUTHENTICATED');
        
        // Use the main sendPushNotification function with authenticated context
        const functions = await getAuthenticatedFunctions();
        const sendPushFunc = httpsCallable(functions, 'sendPushNotification');
        
        // Get family members
        const familyMembers = await userService.getFamilyMembers(familyId);
        const memberIds = familyMembers
          .filter(m => m.id !== userId)
          .map(m => m.id);
        
        const result = await sendPushFunc({
          userIds: memberIds,
          notification: {
            title: '🚨 Emergency: Fall Detected',
            body: `${userName} may have fallen and needs immediate help!`,
            data: {
              type: 'fall_alert',
              alertId,
              userId,
              severity: 'critical',
              clickAction: 'OPEN_ALERT_DETAILS',
            },
            sound: 'emergency',
            priority: 'high',
            color: '#EF4444',
            badge: 1,
          },
          notificationType: 'fall',
          senderId: currentUser?.uid || userId, // Include senderId as fallback
        });
        
        console.log('🚨 Fall alert sent via Cloud Function:', result.data);
        return;
      }
    } catch (error) {
      console.error('Cloud Function failed, using fallback:', error);
    }
    
    // Fallback to direct notification
=======
>>>>>>> Stashed changes
    const notification: PushNotificationData = {
      title: '🚨 Emergency: Fall Detected',
      body: `${userName} may have fallen and needs immediate help!${location ? ` Location: ${location}` : ''}`,
      data: {
        type: 'fall_alert',
        alertId,
        userId,
        severity: 'critical',
        clickAction: 'OPEN_ALERT_DETAILS',
      },
      sound: 'alarm',
      priority: 'high',
      color: '#EF4444',
      badge: 1,
      notificationType: 'fall',
    };

    if (familyId) {
      // Try bulk dispatch first
      const isFCMAvailable = await fcmService.isFCMAvailable();
      if (isFCMAvailable) {
        const familyMembers = await userService.getFamilyMembers(familyId);
        const memberIds = familyMembers
          .filter((m) => m.id !== userId)
          .map((m) => m.id);

        if (memberIds.length) {
          const success = await fcmService.sendPushNotificationHTTP(
            memberIds,
            {
              title: notification.title,
              body: notification.body,
              data: notification.data,
              sound: "alarm",
              priority: "high",
            }
          );
          if (success) return;
        }
      }

      await this.sendToFamily(familyId, notification, userId);
    } else {
      await this.sendToUser(userId, notification);
    }
  },

  // Send medication reminder to a user
  async sendMedicationReminder(
    userId: string,
    medicationId: string,
    medicationName: string,
    dosage: string
  ): Promise<void> {
<<<<<<< Updated upstream
    try {
      // Try Cloud Function first
      const isFCMAvailable = await fcmService.isFCMAvailable();
      
      if (isFCMAvailable) {
        console.log('💊 Sending medication reminder via Cloud Function');
        // Use the configured functions instance with authenticated context
        const functions = await getAuthenticatedFunctions();
        const sendPushFunc = httpsCallable(functions, 'sendPushNotification');
        
        // Get current user for senderId
        const { auth } = await import('@/lib/firebase');
        const currentUser = auth.currentUser;
        
        await sendPushFunc({
          userIds: [userId],
          notification: {
            title: '💊 Medication Reminder',
            body: `Time to take ${medicationName} (${dosage})`,
            data: {
              type: 'medication_reminder',
              medicationId,
              medicationName,
              clickAction: 'OPEN_MEDICATIONS',
            },
            sound: 'default',
            priority: 'high',
            color: '#10B981',
          },
          notificationType: 'medication',
          senderId: currentUser?.uid || userId, // Include senderId as fallback
        });
        return;
      }
    } catch (error) {
      console.error('Cloud Function failed, using fallback:', error);
    }
    
    // Fallback to local notification
=======
>>>>>>> Stashed changes
    const notification: PushNotificationData = {
      title: '💊 Medication Reminder',
      body: `Time to take ${medicationName} (${dosage})`,
      data: {
        type: 'medication_reminder',
        medicationId,
        medicationName,
        clickAction: 'OPEN_MEDICATIONS',
      },
      sound: 'default',
      priority: 'high',
      color: '#10B981',
      notificationType: 'medication',
    };

    await this.sendToUser(userId, notification);
  },

  // Send medication alert (missed dose) to family
  async sendMedicationAlert(
    userId: string,
    medicationName: string,
    familyId?: string
  ): Promise<void> {
    const notification: PushNotificationData = {
      title: '⚠️ Missed Medication',
      body: `${medicationName} was not taken as scheduled. Please check on the patient.`,
      data: {
        type: 'medication_alert',
        userId,
        severity: 'medium',
      },
      sound: 'default',
      priority: 'normal',
      color: '#F59E0B',
    };

    if (familyId) {
      await this.sendToFamily(familyId, notification, userId);
    } else {
      await this.sendToUser(userId, notification);
    }
  },

  // Send emergency alert notification
  async sendEmergencyAlert(
    userId: string,
    message: string,
    alertId: string,
    familyId?: string
  ): Promise<void> {
    const notification: PushNotificationData = {
      title: '🚨 Emergency Alert',
      body: message,
      data: {
        type: 'emergency_alert',
        alertId,
        userId,
        severity: 'critical',
      },
      sound: 'default',
      priority: 'high',
    };

    if (familyId) {
      await this.sendToFamily(familyId, notification, userId);
    } else {
      await this.sendToUser(userId, notification);
    }
  },

  // Send symptom alert to family
  async sendSymptomAlert(
    userId: string,
    userName: string,
    symptomType: string,
    severity: number,
    familyId?: string
  ): Promise<void> {
<<<<<<< Updated upstream
    // Only send for high severity symptoms
    if (severity < 4 || !familyId) return;
    
    try {
      // Try Cloud Function first
      const isFCMAvailable = await fcmService.isFCMAvailable();
      
      if (isFCMAvailable) {
        console.log('⚠️ Sending symptom alert via Cloud Function');
        // Use the configured functions instance with authenticated context
        const functions = await getAuthenticatedFunctions();
        const sendPushFunc = httpsCallable(functions, 'sendPushNotification');
        
        // Get family members
        const familyMembers = await userService.getFamilyMembers(familyId!);
        const memberIds = familyMembers
          .filter(m => m.id !== userId)
          .map(m => m.id);
        
        const severityText = severity === 5 ? 'very severe' : 'severe';
        
        // Get current user for senderId
        const { auth } = await import('@/lib/firebase');
        const currentUser = auth.currentUser;
        
        await sendPushFunc({
          userIds: memberIds,
          notification: {
            title: '⚠️ Health Alert',
            body: `${userName} is experiencing ${severityText} ${symptomType}`,
            data: {
              type: 'symptom_alert',
              symptomType,
              severity: severity === 5 ? 'critical' : 'high',
              userId,
              clickAction: 'OPEN_SYMPTOMS',
            },
            priority: severity === 5 ? 'high' : 'normal',
            color: severity === 5 ? '#EF4444' : '#F59E0B',
          },
          notificationType: 'symptom',
          senderId: currentUser?.uid || userId, // Include senderId as fallback
        });
        return;
      }
    } catch (error) {
      console.error('Cloud Function failed, using fallback:', error);
    }
    
    // Fallback to direct notification
    const severityText = severity === 5 ? 'very severe' : 'severe';
=======
    if (severity < 4 || !familyId) return;

    const severityText = severity === 5 ? "very severe" : "severe";
    const severityEmoji = severity === 5 ? "🚨" : "⚠️";

>>>>>>> Stashed changes
    const notification: PushNotificationData = {
      title: '⚠️ Health Alert',
      body: `${userName} is experiencing ${severityText} ${symptomType}`,
      data: {
        type: 'symptom_alert',
        symptomType,
        severity: severity === 5 ? 'critical' : 'high',
        userId,
        clickAction: 'OPEN_SYMPTOMS',
      },
      priority: severity === 5 ? 'high' : 'normal',
      color: severity === 5 ? '#EF4444' : '#F59E0B',
      notificationType: 'symptom',
    };

<<<<<<< Updated upstream
    await this.sendToFamily(familyId, notification, userId);
=======
    await this.sendToAdmins(familyId, notification, userId);
  },

  // Send a non-critical family update to admins
  async sendFamilyUpdateToAdmins(options: {
    familyId: string;
    title: string;
    body: string;
    actorUserId?: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const isFCMAvailable = await fcmService.isFCMAvailable();

      if (isFCMAvailable) {
        const familyMembers = await userService.getFamilyMembers(
          options.familyId
        );
        const adminIds = familyMembers
          .filter((m) => m.role === "admin" && m.id !== options.actorUserId)
          .map((m) => m.id);

        if (adminIds.length) {
          const success = await fcmService.sendPushNotificationHTTP(adminIds, {
            title: options.title,
            body: options.body,
            data: { type: "family_update", ...options.data },
            priority: "normal",
            sound: "default",
          });
          if (success) return;
        }
      }
    } catch {
      // Silently fallback
    }

    // Fallback: local notification broadcast to admins
    const notification: PushNotificationData = {
      title: options.title,
      body: options.body,
      data: {
        type: "caregiver_alert",
        ...options.data,
      },
      priority: "normal",
      sound: "default",
      notificationType: "family",
    };

    await this.sendToAdmins(options.familyId, notification, options.actorUserId);
>>>>>>> Stashed changes
  },

  // Test notification
  async sendTestNotification(
    userId: string,
    userName: string = 'Test User'
  ): Promise<void> {
<<<<<<< Updated upstream
    const notification: PushNotificationData = {
      title: '🔔 Test Notification',
      body: `Hello ${userName}! Push notifications are working correctly.`,
      data: {
        type: 'fall_alert',
        userId,
        severity: 'low',
      },
      sound: 'default',
      priority: 'normal',
      badge: 1,
      color: '#2563EB',
    };

    await this.sendToUser(userId, notification);
=======
    await this.sendToUser(userId, {
      title: "🔔 Test Notification",
      body: `Hello ${userName}! Push notifications are working correctly.`,
      data: { type: "fall_alert", userId, severity: "low" },
      sound: "default",
      priority: "normal",
      badge: 1,
      color: "#2563EB",
    });
>>>>>>> Stashed changes
  },

  // Register push token with the API (replaces Firebase CF `saveFCMToken`)
  async saveFCMToken(
    token: string,
    _userId?: string,
    deviceInfo?: {
      deviceId?: string;
      platform?: string;
      deviceName?: string;
    }
  ): Promise<void> {
    try {
<<<<<<< Updated upstream
      // Use the configured functions instance with authenticated context
      const functions = await getAuthenticatedFunctions();
      const saveFCMTokenFunc = httpsCallable(functions, 'saveFCMToken');
      
      await saveFCMTokenFunc({
=======
      await api.post("/api/notifications/push-token", {
>>>>>>> Stashed changes
        token,
        platform: (deviceInfo?.platform ?? Platform.OS) as "ios" | "android" | "web",
        deviceId: deviceInfo?.deviceId ?? Constants.sessionId,
        deviceName: deviceInfo?.deviceName ?? `${Platform.OS} Device`,
      });
<<<<<<< Updated upstream
      
      console.log('✅ FCM token saved via Cloud Function');
    } catch (error) {
      console.error('Error saving FCM token:', error);
      // Fallback to direct save
=======
    } catch {
      // Silently handle — fallback to fcmService direct save
>>>>>>> Stashed changes
      await fcmService.saveFCMToken(token);
    }
  },
};
