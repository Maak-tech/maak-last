<<<<<<< Updated upstream
import { Platform } from 'react-native';
import { httpsCallable, Functions } from 'firebase/functions';
import { functions as defaultFunctions } from '@/lib/firebase';
=======
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
>>>>>>> Stashed changes

export interface FCMTokenResult {
  success: boolean;
  token?: string;
  error?: string;
}

<<<<<<< Updated upstream
// Helper to get functions with current auth context
async function getAuthenticatedFunctions(): Promise<Functions> {
  const { auth, app } = await import('@/lib/firebase');
  const { getFunctions, connectFunctionsEmulator } = await import('firebase/functions');
  
  // Get fresh functions instance
  const functionsInstance = getFunctions(app, 'us-central1');
  
  // Wait for auth to be ready
  const currentUser = auth.currentUser;
  if (currentUser) {
    // Force token refresh to ensure we have a valid token
    try {
      const token = await currentUser.getIdToken(true);
      console.log('🔑 Auth token refreshed for functions call');
      console.log('🔐 Current user UID:', currentUser.uid);
      console.log('🔐 Token exists:', !!token);
      
      // Wait a bit to ensure the token is propagated
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (e) {
      console.warn('⚠️ Could not refresh token:', e);
    }
  } else {
    console.warn('⚠️ No authenticated user when getting functions');
  }
  
  // Return the functions instance (it will use the current auth state)
  return functionsInstance;
}

=======
>>>>>>> Stashed changes
export const fcmService = {
  // Get Expo push token for current device
  async getFCMToken(): Promise<FCMTokenResult> {
    try {
<<<<<<< Updated upstream
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
=======
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
>>>>>>> Stashed changes

      console.log('📱 FCM Token obtained:', tokenData.data);
      return { success: true, token: tokenData.data };
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      return { success: false, error: String(error) };
    }
  },

<<<<<<< Updated upstream
  // Save FCM token to user document via Cloud Function
  async saveFCMToken(token: string, userId?: string): Promise<boolean> {
    try {
      // Check if user is authenticated
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      
      if (!currentUser && !userId) {
        console.error('❌ No authenticated user and no userId provided');
        return false;
      }
      
      // Get a fresh ID token to ensure authentication
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken(true); // Force refresh
          console.log('🔑 Got fresh auth token:', idToken ? 'Yes' : 'No');
        } catch (tokenError) {
          console.error('⚠️ Could not refresh auth token:', tokenError);
        }
      }
      
      console.log('🔐 Saving FCM token for user:', currentUser?.uid || userId);
      console.log('🔐 Auth state:', currentUser ? 'Authenticated' : 'Not authenticated');
      
      // Use authenticated functions instance
      const functions = await getAuthenticatedFunctions();
      const saveFCMTokenFn = httpsCallable(functions, 'saveFCMToken');
      await saveFCMTokenFn({ 
        token, 
        userId: userId || currentUser?.uid 
=======
  // Register push token with the Nuralix API (replaces Firebase CF `saveFCMToken`)
  async saveFCMToken(token: string, _userId?: string): Promise<boolean> {
    try {
      const Constants = await import("expo-constants");

      await api.post("/api/notifications/push-token", {
        token,
        platform: Platform.OS as "ios" | "android" | "web",
        deviceId: Constants.default.sessionId,
        deviceName: `${Platform.OS} Device`,
>>>>>>> Stashed changes
      });

      console.log('✅ FCM token saved to user document');
      return true;
<<<<<<< Updated upstream
    } catch (error) {
      console.error('❌ Error saving FCM token:', error);
      console.log('🔍 Full error object:', JSON.stringify(error, null, 2));
      
      // If authentication fails, try direct Firestore write as fallback
      const errorString = error?.toString() || '';
      const errorCode = (error as any)?.code || '';
      const isAuthError = errorString.includes('unauthenticated') || 
                          errorCode === 'unauthenticated' || 
                          errorCode === 'functions/unauthenticated';
      
      console.log('🔍 Error code:', errorCode);
      console.log('🔍 Error string:', errorString);
      console.log('🔍 Is auth error:', isAuthError);
      
      if (isAuthError && (userId || currentUser?.uid)) {
        console.log('🔄 Trying direct Firestore write as fallback...');
        try {
          const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          
          const targetUserId = userId || currentUser?.uid || '';
          console.log('📝 Writing to user document:', targetUserId);
          
          const userRef = doc(db, 'users', targetUserId);
          await updateDoc(userRef, {
            fcmToken: token,
            fcmTokenUpdatedAt: serverTimestamp()
          });
          
          console.log('✅ FCM token saved directly to Firestore');
          return true;
        } catch (firestoreError) {
          console.error('❌ Direct Firestore write also failed:', firestoreError);
        }
      }
      
=======
    } catch {
>>>>>>> Stashed changes
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
      data?: Record<string, any>;
      sound?: string;
      priority?: 'normal' | 'high';
    }
  ): Promise<boolean> {
    try {
<<<<<<< Updated upstream
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      
      const response = await fetch(
        'https://us-central1-maak-5caad.cloudfunctions.net/sendPushNotificationHttp',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userIds,
            notification,
            senderId: currentUser?.uid || 'unknown',
          }),
        }
      );
      
      const result = await response.json();
      
      if (result.result?.success) {
        console.log(`✅ Push notification sent via HTTP: ${result.result.message}`);
        return true;
      } else {
        console.error('❌ HTTP push notification failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Error sending push notification via HTTP:', error);
      return false;
    }
  },
  
  // Send push notification to specific users via Cloud Function
=======
      const result = await api.post<{ sent: number }>("/api/notifications/send", {
        userIds,
        notification,
      });
      return (result.sent ?? 0) > 0;
    } catch {
      return false;
    }
  },

  // Send push notification to specific users (same as HTTP variant — kept for API compat)
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    try {
      // Check if user is authenticated
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        console.warn('⚠️ No authenticated user for push notification, attempting anyway');
      } else {
        console.log('🔐 Sending push notification as user:', currentUser.uid);
      }
      
      // Use authenticated functions instance
      const functions = await getAuthenticatedFunctions();
      const sendPushNotificationFn = httpsCallable(
        functions,
        'sendPushNotification'
      );
      
      // Log what we're sending
      const payload = {
        userIds,
        notification,
        senderId: currentUser?.uid || 'no-user', // Always include senderId
      };
      console.log('📤 Sending to function with payload:', {
        userIdsCount: userIds.length,
        senderId: payload.senderId,
        notificationType: notification.data?.type || 'unknown',
      });
      
      const result = await sendPushNotificationFn(payload);

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
=======
    return this.sendPushNotificationHTTP(userIds, notification);
>>>>>>> Stashed changes
  },

  // Initialize push notifications for the current user
  async initializeFCM(_userId: string): Promise<boolean> {
    try {
<<<<<<< Updated upstream
      // Wait a bit to ensure auth is fully ready
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        console.log('⏳ Waiting for auth to be ready...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
=======
>>>>>>> Stashed changes
      const tokenResult = await this.getFCMToken();

      if (!tokenResult.success || !tokenResult.token) {
        console.log(
          '📱 FCM token not available, falling back to local notifications'
        );
        return false;
      }

<<<<<<< Updated upstream
      const saved = await this.saveFCMToken(tokenResult.token, userId);

      if (saved) {
        console.log('✅ FCM initialized successfully for user:', userId);
        return true;
      } else {
        console.log('❌ Failed to save FCM token');
        return false;
      }
    } catch (error) {
      console.error('❌ Error initializing FCM:', error);
=======
      return this.saveFCMToken(tokenResult.token);
    } catch {
>>>>>>> Stashed changes
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
    } catch (error) {
      console.error('Error checking FCM availability:', error);
      return false;
    }
  },
};
