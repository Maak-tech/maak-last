import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";

export const useNotifications = () => {
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();
  const isInitialized = useRef(false);
  const initializationInProgress = useRef(false);

  useEffect(() => {
    if (
      Platform.OS === "web" ||
      isInitialized.current ||
      initializationInProgress.current
    ) {
      return;
    }

    const initializeNotifications = async () => {
      initializationInProgress.current = true;

      try {
        // Add delay to ensure React Native bridge is ready
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const [Notifications, Device] = await Promise.all([
          import("expo-notifications"),
          import("expo-device"),
        ]);

        // Set notification handler with error boundary
        try {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
            }),
          });
        } catch (handlerError) {
          console.warn("Failed to set notification handler:", handlerError);
          // Continue with initialization even if handler fails
        }

        // Register for push notifications with timeout
        const registrationPromise = registerForPushNotificationsAsync(
          Notifications,
          Device
        );
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Registration timeout")), 5000)
        );

        try {
          await Promise.race([registrationPromise, timeoutPromise]);
        } catch (registrationError) {
          console.warn(
            "Push notification registration failed:",
            registrationError
          );
          // Continue with initialization even if registration fails
        }

        // Add listeners with error handling
        try {
          notificationListener.current =
            Notifications.addNotificationReceivedListener(
              (notification: any) => {
                try {
                  console.log("Notification received:", notification);
                } catch (listenerError) {
                  console.warn(
                    "Error in notification listener:",
                    listenerError
                  );
                }
              }
            );

          responseListener.current =
            Notifications.addNotificationResponseReceivedListener(
              (response: any) => {
                try {
                  console.log("Notification response:", response);
                } catch (responseError) {
                  console.warn("Error in response listener:", responseError);
                }
              }
            );
        } catch (listenerError) {
          console.warn("Failed to add notification listeners:", listenerError);
        }

        isInitialized.current = true;
      } catch (error) {
        console.warn("Failed to initialize notifications:", error);
      } finally {
        initializationInProgress.current = false;
      }
    };

    // Delay initialization to prevent race conditions
    const initTimeout = setTimeout(initializeNotifications, 2000);

    return () => {
      clearTimeout(initTimeout);
      initializationInProgress.current = false;

      if (notificationListener.current) {
        try {
          notificationListener.current.remove();
        } catch (error) {
          console.warn("Error removing notification listener:", error);
        }
      }
      if (responseListener.current) {
        try {
          responseListener.current.remove();
        } catch (error) {
          console.warn("Error removing response listener:", error);
        }
      }
    };
  }, []);

  const scheduleNotification = useCallback(
    async (title: string, body: string, trigger: Date) => {
      if (Platform.OS === "web") {
        console.log("Notification scheduled (web):", { title, body, trigger });
        return;
      }

      if (!isInitialized.current) {
        console.warn(
          "Notifications not initialized, cannot schedule notification"
        );
        return;
      }

      try {
        const Notifications = await import("expo-notifications");
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: "default",
          },
          trigger,
        });
      } catch (error) {
        console.warn("Failed to schedule notification:", error);
      }
    },
    []
  );

  const scheduleMedicationReminder = useCallback(
    async (medicationName: string, time: Date) => {
      await scheduleNotification(
        "Medication Reminder",
        `Time to take your ${medicationName}`,
        time
      );
    },
    [scheduleNotification]
  );

  const scheduleRecurringMedicationReminder = useCallback(
    async (medicationName: string, dosage: string, reminderTime: string) => {
      if (Platform.OS === "web") {
        return;
      }

      if (!isInitialized.current) {
        console.warn(
          "Notifications not initialized, cannot schedule medication reminder"
        );
        return;
      }

      try {
        const Notifications = await import("expo-notifications");
        const [hourStr, minuteStr] = reminderTime.split(":");
        const hour = Number.parseInt(hourStr);
        const minute = Number.parseInt(minuteStr);

        // Schedule recurring daily notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "💊 Medication Reminder",
            body: `Time to take ${medicationName}${dosage ? ` (${dosage})` : ""}`,
            sound: "default",
            data: {
              type: "medication_reminder",
              medicationName,
              dosage,
            },
          },
          trigger: {
            hour,
            minute,
            repeats: true,
          },
        });
      } catch (error) {
        console.warn("Failed to schedule recurring medication reminder:", error);
      }
    },
    []
  );

  return {
    scheduleNotification,
    scheduleMedicationReminder,
    scheduleRecurringMedicationReminder,
  };
};

async function registerForPushNotificationsAsync(
  Notifications: any,
  Device: any
) {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.warn("Push notification permissions not granted");
        return;
      }

      console.log("Push notifications registered successfully");
    } else {
      console.warn("Must use physical device for push notifications");
    }
  } catch (error) {
    console.warn("Failed to register for push notifications:", error);
    throw error; // Re-throw to be caught by the calling function
  }
}
