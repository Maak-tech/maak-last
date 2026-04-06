/**
 * FCM / Push Token service — Firebase-free replacement.
 *
 * - getFCMToken():             unchanged — uses expo-notifications directly (no Firebase)
 * - saveFCMToken():            replaced Firebase CF `saveFCMToken` with POST /api/notifications/push-token
 * - sendPushNotificationHTTP() replaced Firebase CF HTTP endpoint with POST /api/notifications/send
 * - sendPushNotification():    delegates to sendPushNotificationHTTP (same payload)
 * - initializeFCM():           simplified — no Firebase auth check
 * - isFCMAvailable():          unchanged
 */

import { Platform } from "react-native";
import { api } from "@/lib/apiClient";

export interface FCMTokenResult {
  success: boolean;
  token?: string;
  error?: string;
}

export const fcmService = {
  // Get Expo push token for current device
  async getFCMToken(): Promise<FCMTokenResult> {
    try {
      if (Platform.OS === "web") {
        return { success: false, error: "Push notifications not supported on web" };
      }

      const Constants = await import("expo-constants");
      const isExpoGo = Constants.default.appOwnership === "expo";

      if (isExpoGo) {
        return { success: false, error: "Push notifications not available in Expo Go" };
      }

      const Notifications = await import("expo-notifications");

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        return { success: false, error: "Notification permissions not granted" };
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.default.expoConfig?.extra?.eas?.projectId,
      });

      if (!tokenData?.data) {
        return { success: false, error: "Failed to get push token" };
      }

      return { success: true, token: tokenData.data };
    } catch (error: unknown) {
      console.error('❌ Error getting FCM token:', error instanceof Error ? error.message : String(error));
      return { success: false, error: String(error) };
    }
  },

  // Register push token with the Nuralix API (replaces Firebase CF `saveFCMToken`)
  async saveFCMToken(token: string, _userId?: string): Promise<boolean> {
    try {
      const Constants = await import("expo-constants");

      await api.post("/api/notifications/push-token", {
        token,
        platform: Platform.OS as "ios" | "android" | "web",
        deviceId: Constants.default.sessionId,
        deviceName: `${Platform.OS} Device`,
      });

      return true;
    } catch (err: unknown) {
      console.warn('[fcm] saveFCMToken failed:', err instanceof Error ? err.message : String(err));
      return false;
    }
  },

  // Send push notification to specific users via the Nuralix API
  // (replaces Firebase CF HTTP endpoint at maak-5caad.cloudfunctions.net/sendPushNotificationHttp)
  async sendPushNotificationHTTP(
    userIds: string[],
    notification: {
      title: string;
      body: string;
      data?: Record<string, unknown>;
      sound?: string;
      priority?: 'normal' | 'high';
    }
  ): Promise<boolean> {
    try {
      const result = await api.post<{ sent: number }>("/api/notifications/send", {
        userIds,
        notification,
      });
      return (result.sent ?? 0) > 0;
    } catch (err: unknown) {
      console.warn('[fcm] sendPushNotificationHTTP failed:', err instanceof Error ? err.message : String(err));
      return false;
    }
  },

  // Send push notification to specific users (same as HTTP variant — kept for API compat)
  async sendPushNotification(
    userIds: string[],
    notification: {
      title: string;
      body: string;
      data?: Record<string, unknown>;
      sound?: string;
      priority?: 'normal' | 'high';
    }
  ): Promise<boolean> {
    return this.sendPushNotificationHTTP(userIds, notification);
  },

  // Initialize push notifications for the current user
  async initializeFCM(_userId: string): Promise<boolean> {
    try {
      const tokenResult = await this.getFCMToken();

      if (!tokenResult.success || !tokenResult.token) {
        console.warn('[fcmService] Push token not available — falling back to local notifications');
        return false;
      }

      return this.saveFCMToken(tokenResult.token);
    } catch (err: unknown) {
      console.warn('[fcm] initializeFCM failed:', err instanceof Error ? err.message : String(err));
      return false;
    }
  },

  // Check if push notifications are available on this device
  async isFCMAvailable(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        return false;
      }

      const Constants = await import('expo-constants');
      const isExpoGo = Constants.default.appOwnership === 'expo';

      return !isExpoGo;
    } catch (error: unknown) {
      console.error('Error checking FCM availability:', error instanceof Error ? error.message : String(error));
      return false;
    }
  },
};
