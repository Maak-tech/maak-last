import { userService } from './userService';
import { fcmService } from './fcmService';
import { User } from '@/types';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

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
}

export const pushNotificationService = {
  // Send notification to specific user
  async sendToUser(
    userId: string,
    notification: PushNotificationData
  ): Promise<void> {
    try {
      // Try FCM first (for development builds and production)
      const isFCMAvailable = await fcmService.isFCMAvailable();

      if (isFCMAvailable) {
        console.log('📱 Attempting FCM notification for user:', userId);
        // Use HTTP endpoint to bypass auth issues
        const success = await fcmService.sendPushNotificationHTTP([userId], {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: notification.sound || 'default',
          priority: notification.priority || 'normal',
        });

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

      // Filter out the user who triggered the alert (if specified)
      const membersToNotify = familyMembers.filter(
        (member) => member.id !== excludeUserId
      );

      if (membersToNotify.length === 0) {
        console.log('📱 No family members to notify');
        return;
      }

      // Try FCM first for all family members
      const isFCMAvailable = await fcmService.isFCMAvailable();

      if (isFCMAvailable) {
        console.log(
          '📱 Attempting FCM notification to family members:',
          membersToNotify.length
        );
        const userIds = membersToNotify.map((member) => member.id);

        // Use HTTP endpoint to bypass auth issues
        const success = await fcmService.sendPushNotificationHTTP(userIds, {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: notification.sound || 'default',
          priority: notification.priority || 'normal',
        });

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
  async sendFallAlert(
    userId: string,
    alertId: string,
    userName: string,
    familyId?: string,
    location?: string
  ): Promise<void> {
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
      await this.sendToFamily(familyId, notification, userId);
    } else {
      // If no family, send to the user themselves (for testing)
      await this.sendToUser(userId, notification);
    }
  },

  // Send medication reminder
  async sendMedicationReminder(
    userId: string,
    medicationId: string,
    medicationName: string,
    dosage: string
  ): Promise<void> {
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

  // Send medication alert notification (when medication is missed)
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

    await this.sendToFamily(familyId, notification, userId);
  },

  // Test notification functionality
  async sendTestNotification(
    userId: string,
    userName: string = 'Test User'
  ): Promise<void> {
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
  },

  // Save FCM token with device info
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
      // Use the configured functions instance with authenticated context
      const functions = await getAuthenticatedFunctions();
      const saveFCMTokenFunc = httpsCallable(functions, 'saveFCMToken');
      
      await saveFCMTokenFunc({
        token,
        deviceInfo: {
          deviceId: deviceInfo?.deviceId || Constants.sessionId,
          platform: deviceInfo?.platform || Platform.OS,
          deviceName: deviceInfo?.deviceName || `${Platform.OS} Device`,
        },
      });
      
      console.log('✅ FCM token saved via Cloud Function');
    } catch (error) {
      console.error('Error saving FCM token:', error);
      // Fallback to direct save
      await fcmService.saveFCMToken(token);
    }
  },
};
