import { type Functions, httpsCallable } from "firebase/functions";
import { type FirebaseApp } from "firebase/app";
import { Platform } from "react-native";

export interface FCMTokenResult {
  success: boolean;
  token?: string;
  error?: string;
}

// Helper to get functions with current auth context
async function getAuthenticatedFunctions(): Promise<Functions> {
  const firebaseModule = await import("@/lib/firebase");
  const { auth } = firebaseModule;
  const app: FirebaseApp = firebaseModule.default;
  const { getFunctions, connectFunctionsEmulator } = await import(
    "firebase/functions"
  );

  // Get fresh functions instance
  const functionsInstance = getFunctions(app, "us-central1");

  // Wait for auth to be ready
  const currentUser = auth.currentUser;
  if (currentUser) {
      // Force token refresh to ensure we have a valid token
      try {
        await currentUser.getIdToken(true);
        // Wait a bit to ensure the token is propagated
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (e) {
        // Silently handle token refresh error
      }
    }

  // Return the functions instance (it will use the current auth state)
  return functionsInstance;
}

export const fcmService = {
  // Get FCM token for current device
  async getFCMToken(): Promise<FCMTokenResult> {
    try {
      if (Platform.OS === "web") {
        return { success: false, error: "FCM not supported on web" };
      }

      // Check if we're in Expo Go
      const Constants = await import("expo-constants");
      const isExpoGo = Constants.default.appOwnership === "expo";

      if (isExpoGo) {
        return { success: false, error: "FCM not available in Expo Go" };
      }

      // Import expo-notifications
      const Notifications = await import("expo-notifications");

      // Check and request permissions first
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        return {
          success: false,
          error: "Notification permissions not granted",
        };
      }

      // Get the push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.default.expoConfig?.extra?.eas?.projectId,
      });

      if (!tokenData?.data) {
        return { success: false, error: "Failed to get push token" };
      }

      return { success: true, token: tokenData.data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  // Save FCM token to user document via Cloud Function
  async saveFCMToken(token: string, userId?: string): Promise<boolean> {
    // Declare currentUser outside try-catch to be accessible in catch block
    let currentUser = null;
    
    try {
      // Check if user is authenticated
      const { auth } = await import("@/lib/firebase");
      currentUser = auth.currentUser;

      if (!(currentUser || userId)) {
        return false;
      }

      // Get a fresh ID token to ensure authentication
      if (currentUser) {
        try {
          await currentUser.getIdToken(true); // Force refresh
        } catch (tokenError) {
          // Silently handle token refresh error
        }
      }

      // Use authenticated functions instance
      const functions = await getAuthenticatedFunctions();
      const saveFCMTokenFn = httpsCallable(functions, "saveFCMToken");
      await saveFCMTokenFn({
        token,
        userId: userId || currentUser?.uid,
      });

      return true;
    } catch (error) {
      // If authentication fails, try direct Firestore write as fallback
      const errorString = error?.toString() || "";
      const errorCode = (error as any)?.code || "";
      const isAuthError =
        errorString.includes("unauthenticated") ||
        errorCode === "unauthenticated" ||
        errorCode === "functions/unauthenticated";

      if (isAuthError && (userId || currentUser?.uid)) {
        try {
          const { doc, updateDoc, serverTimestamp } = await import(
            "firebase/firestore"
          );
          const { db } = await import("@/lib/firebase");

          const targetUserId = userId || currentUser?.uid || "";

          const userRef = doc(db, "users", targetUserId);
          await updateDoc(userRef, {
            fcmToken: token,
            fcmTokenUpdatedAt: serverTimestamp(),
          });

          return true;
        } catch (firestoreError) {
          // Silently handle Firestore write error
        }
      }

      return false;
    }
  },

  // Send push notification via HTTP endpoint (bypasses auth issues)
  async sendPushNotificationHTTP(
    userIds: string[],
    notification: {
      title: string;
      body: string;
      data?: Record<string, any>;
      sound?: string;
      priority?: "normal" | "high";
    }
  ): Promise<boolean> {
    try {
      const { auth } = await import("@/lib/firebase");
      const currentUser = auth.currentUser;

      const response = await fetch(
        "https://us-central1-maak-5caad.cloudfunctions.net/sendPushNotificationHttp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userIds,
            notification,
            senderId: currentUser?.uid || "unknown",
          }),
        }
      );

      const result = await response.json();

      if (result.result?.success) {
        return true;
      }
      return false;
    } catch (error) {
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
      priority?: "normal" | "high";
    }
  ): Promise<boolean> {
    try {
      // Check if user is authenticated
      const { auth } = await import("@/lib/firebase");
      const currentUser = auth.currentUser;

      // Use authenticated functions instance
      const functions = await getAuthenticatedFunctions();
      const sendPushNotificationFn = httpsCallable(
        functions,
        "sendPushNotification"
      );

      const payload = {
        userIds,
        notification,
        senderId: currentUser?.uid || "no-user", // Always include senderId
      };

      const result = await sendPushNotificationFn(payload);

      const response = result.data as {
        success: boolean;
        successCount: number;
        failureCount: number;
        message: string;
      };

      return response.success;
    } catch (error) {
      return false;
    }
  },

  // Initialize FCM for the current user
  async initializeFCM(userId: string): Promise<boolean> {
    try {
      const { auth } = await import("@/lib/firebase");
      let currentUser = auth.currentUser;

      if (!currentUser) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        currentUser = auth.currentUser;
      }

      if (!currentUser) {
        return false;
      }

      const tokenResult = await this.getFCMToken();

      if (!(tokenResult.success && tokenResult.token)) {
        return false;
      }

      const saved = await this.saveFCMToken(tokenResult.token, userId);
      return saved;
    } catch (error) {
      return false;
    }
  },

  // Check if FCM is available
  async isFCMAvailable(): Promise<boolean> {
    try {
      if (Platform.OS === "web") {
        return false;
      }

      const Constants = await import("expo-constants");
      const isExpoGo = Constants.default.appOwnership === "expo";

      // FCM is not available in Expo Go
      return !isExpoGo;
    } catch {
      return false;
    }
  },
};
