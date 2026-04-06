import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { useMedicationAlarm } from "@/contexts/MedicationAlarmContext";
import { useAuth } from "@/contexts/AuthContext";
// Import at the top level so TaskManager registers the task definition before
// the OS has a chance to invoke it (required by expo-task-manager).
import { registerBackgroundSync, unregisterBackgroundSync } from "@/lib/tasks/backgroundSync";

// Map notification data.screen values to Expo Router paths
const NOTIFICATION_ROUTE_MAP: Record<string, string> = {
  family_dashboard: "/(tabs)/family",
  vitals: "/(tabs)/vitals",
  medications: "/(tabs)/medications",
  emergency: "/emergency",
  nora: "/(tabs)/nora",
  calendar: "/(tabs)/calendar",
  vhi: "/(tabs)/index",
};

function navigateToScreen(data: Record<string, unknown>): void {
  const screen = data?.screen as string | undefined;
  if (!screen) return;
  const route = NOTIFICATION_ROUTE_MAP[screen];
  if (route) {
    // Small delay to ensure the navigation container is ready
    setTimeout(() => router.push(route as Parameters<typeof router.push>[0]), 100);
  }
}

export function NotificationListenerSetup() {
  const { triggerAlarm } = useMedicationAlarm();
  const { user } = useAuth();
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);
  const foregroundListenerRef = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Configure foreground notification behavior
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Listen for incoming notifications (app in foreground)
    foregroundListenerRef.current = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown>;
      if (data?.type === "medication_alarm" && data?.medicationName) {
        triggerAlarm({
          id: notification.request.identifier,
          medicationName: data.medicationName as string,
          dosage: data.dosage as string | undefined,
          scheduledAt: new Date(),
        });
      }
    });

    // Listen for notification taps (app in background or foreground)
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      navigateToScreen(data);
    });

    // Handle the case where the app was killed and launched via a notification tap
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, unknown>;
      navigateToScreen(data);
    }).catch(() => {
      // Non-fatal: ignore errors reading the last notification response
    });

    return () => {
      foregroundListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, [triggerAlarm]);

  // Register or unregister the background sync task based on auth state.
  // Registration is deferred until the user is authenticated so the task
  // only runs when there is a valid session to flush offline operations with.
  useEffect(() => {
    if (user) {
      registerBackgroundSync();
    } else {
      // Unregister on sign-out so the OS stops invoking the task unnecessarily
      unregisterBackgroundSync();
    }
  }, [user]);

  return null;
}
