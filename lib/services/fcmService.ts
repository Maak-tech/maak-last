import { Platform } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export interface FCMTokenResult {
  success: boolean;
  token?: string;
  error?: string;
}

export const fcmService = {
  // Get FCM token for current device
  async getFCMToken(): Promise<FCMTokenResult> {
    try {
      if (Platform.OS === 'web') {
        return { success: false, error: 'FCM not supported on web' };
      }

      // Check if we're in Expo Go
      const Constants = await import('expo-constants');
      const isExpoGo = Constants.default.appOwnership === 'expo';

      if (isExpoGo) {
        console.log(
          '📱 FCM not available in Expo Go - using local notifications fallback'
        );
        return { success: false, error: 'FCM not available in Expo Go' };
      }

      // For development builds and production
      const { getExpoPushTokenAsync } = await import('expo-notifications');
      const tokenData = await getExpoPushTokenAsync();

      console.log('📱 FCM Token obtained:', tokenData.data);
      return { success: true, token: tokenData.data };
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      return { success: false, error: String(error) };
    }
  },

  // Save FCM token to user document via Cloud Function
  async saveFCMToken(token: string): Promise<boolean> {
    try {
      const saveFCMTokenFn = httpsCallable(functions, 'saveFCMToken');
      const result = await saveFCMTokenFn({ token });

      console.log('✅ FCM token saved to user document');
      return true;
    } catch (error) {
      console.error('❌ Error saving FCM token:', error);
      return false;
    }
  },

  // Send push notification to specific users via Cloud Function
  async sendPushNotification(
    userIds: string[],
    notification: {
      title: string;
      body: string;
      data?: Record<string, any>;
      sound?: string;
      priority?: 'normal' | 'high';
    }
  ): Promise<boolean> {
    try {
      const sendPushNotificationFn = httpsCallable(
        functions,
        'sendPushNotification'
      );
      const result = await sendPushNotificationFn({
        userIds,
        notification,
      });

      const response = result.data as {
        success: boolean;
        successCount: number;
        failureCount: number;
        message: string;
      };

      console.log(`✅ Push notification sent: ${response.message}`);
      return response.success;
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
      return false;
    }
  },

  // Initialize FCM for the current user
  async initializeFCM(userId: string): Promise<boolean> {
    try {
      const tokenResult = await this.getFCMToken();

      if (!tokenResult.success || !tokenResult.token) {
        console.log(
          '📱 FCM token not available, falling back to local notifications'
        );
        return false;
      }

      const saved = await this.saveFCMToken(tokenResult.token);

      if (saved) {
        console.log('✅ FCM initialized successfully for user:', userId);
        return true;
      } else {
        console.log('❌ Failed to save FCM token');
        return false;
      }
    } catch (error) {
      console.error('❌ Error initializing FCM:', error);
      return false;
    }
  },

  // Check if FCM is available
  async isFCMAvailable(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        return false;
      }

      const Constants = await import('expo-constants');
      const isExpoGo = Constants.default.appOwnership === 'expo';

      // FCM is not available in Expo Go
      return !isExpoGo;
    } catch (error) {
      console.error('Error checking FCM availability:', error);
      return false;
    }
  },
};
