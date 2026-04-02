import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { useMedicationAlarm } from "@/contexts/MedicationAlarmContext";

export function NotificationListenerSetup() {
  const { triggerAlarm } = useMedicationAlarm();

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

    // Listen for incoming notifications (foreground)
    const sub = Notifications.addNotificationReceivedListener((notification) => {
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

    return () => sub.remove();
  }, [triggerAlarm]);

  return null;
}
