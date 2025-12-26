import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";

export const useNotifications = () => {
  const notificationListener = useRef<any>(undefined);
  const responseListener = useRef<any>(undefined);
  const isInitialized = useRef(false);
  const initializationInProgress = useRef(false);
  const initializationPromise = useRef<Promise<void> | null>(null);

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

        // Import modules with better error handling for bundle loading errors
        let Notifications, Device;
        try {
          [Notifications, Device] = await Promise.all([
            import("expo-notifications"),
            import("expo-device"),
          ]);
        } catch (importError) {
          const errorMessage =
            importError instanceof Error
              ? importError.message
              : String(importError);
          
          // Check if it's a bundle loading error
          if (
            errorMessage.toLowerCase().includes("loadbundle") ||
            errorMessage.toLowerCase().includes("bundle") ||
            errorMessage.toLowerCase().includes("server")
          ) {
            // Don't throw - allow initialization to continue gracefully
            return;
          }
          throw importError;
        }

        // Set notification handler with error boundary
        try {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
            }),
          });
        } catch (handlerError) {
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
          // Continue with initialization even if registration fails
        }

        // Add listeners with error handling
        try {
          notificationListener.current =
            Notifications.addNotificationReceivedListener(() => {
              // Notification received handler
            });

          responseListener.current =
            Notifications.addNotificationResponseReceivedListener(() => {
              // Notification response handler
            });
        } catch (listenerError) {
          // Silently handle listener error
        }

        isInitialized.current = true;
      } catch (error) {
        // Silently handle initialization error
      } finally {
        initializationInProgress.current = false;
      }
    };

    // Store the promise so we can await it later
    initializationPromise.current = initializeNotifications();

    // Delay initialization to prevent race conditions
    const initTimeout = setTimeout(() => {
      initializationPromise.current?.catch(() => {
        // Silently handle initialization error
      });
    }, 2000);

    return () => {
      clearTimeout(initTimeout);
      initializationInProgress.current = false;

      if (notificationListener.current) {
        try {
          notificationListener.current.remove();
        } catch (error) {
          // Silently handle listener removal error
        }
      }
      if (responseListener.current) {
        try {
          responseListener.current.remove();
        } catch (error) {
          // Silently handle listener removal error
        }
      }
    };
  }, []);

  const scheduleNotification = useCallback(
    async (title: string, body: string, trigger: Date) => {
      if (Platform.OS === "web") {
        return;
      }

      if (!isInitialized.current) {
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
          trigger: trigger
            ? {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: trigger,
              }
            : null,
        });
      } catch (error) {
        // Silently handle scheduling error
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
        return { success: false, error: "Not supported on web" };
      }

      try {
        // Wait for initialization to complete if it's in progress
        if (!isInitialized.current && initializationPromise.current) {
          try {
            await initializationPromise.current;
          } catch {
            // Silently handle initialization wait error
          }
        }

        // If still not initialized after waiting, try to initialize now
        if (!isInitialized.current) {
          try {
            const Notifications = await import("expo-notifications");
            const Device = await import("expo-device");

            try {
              Notifications.setNotificationHandler({
                handleNotification: async () => ({
                  shouldShowAlert: true,
                  shouldShowBanner: true,
                  shouldShowList: true,
                  shouldPlaySound: true,
                  shouldSetBadge: false,
                }),
              });
              await registerForPushNotificationsAsync(Notifications, Device);
              isInitialized.current = true;
            } catch (initError) {
              return {
                success: false,
                error: "Failed to initialize notifications",
              };
            }
          } catch (importError) {
            // Handle errors during import (e.g., PushNotificationIOS issues)
            return {
              success: false,
              error: "Notification system unavailable. Please restart the app.",
            };
          }
        }

        // Import notification modules with error handling
        let Notifications;
        let Platform;
        try {
          Notifications = await import("expo-notifications");
          Platform = (await import("react-native")).Platform;
        } catch (importError) {
          // Handle errors during import (e.g., PushNotificationIOS issues)
          const errorMessage =
            importError instanceof Error
              ? importError.message
              : String(importError);

          // Check if it's the PushNotificationIOS error
          if (
            errorMessage.includes("NativeEventEmitter") ||
            errorMessage.includes("default")
          ) {
            return {
              success: false,
              error:
                "Notification system error. Please restart the app to fix this issue.",
            };
          }

          return {
            success: false,
            error: "Failed to load notification system. Please try again.",
          };
        }

        // Check notification permissions before scheduling
        const permissionResult = await Notifications.getPermissionsAsync();
        const { status } = permissionResult;
        if (status !== "granted") {

          // Request permissions with proper iOS options
          const requestOptions =
            Platform.OS === "ios"
              ? {
                  ios: {
                    allowAlert: true,
                    allowBadge: true,
                    allowSound: true,
                    allowAnnouncements: false,
                  },
                }
              : undefined;

          const requestResult =
            await Notifications.requestPermissionsAsync(requestOptions);
          const newStatus = requestResult.status;
          if (newStatus !== "granted") {
            const errorMessage =
              newStatus === "denied"
                ? "Notification permissions were denied. Please enable them in Settings > Notifications."
                : `Notification permissions not granted (status: ${newStatus}). Please enable them in Settings.`;
            return { success: false, error: errorMessage };
          }
        }

        const [hourStr, minuteStr] = reminderTime.split(":");
        const hour = Number.parseInt(hourStr);
        const minute = Number.parseInt(minuteStr);

        if (isNaN(hour) || isNaN(minute)) {
          return { success: false, error: "Invalid time format" };
        }

        // Schedule recurring daily notification
        // For daily recurring notifications, we need to use a Date trigger for the first occurrence
        // Calculate the next occurrence of this time
        const now = new Date();
        const triggerDate = new Date();
        triggerDate.setHours(hour, minute, 0, 0);

        // If the time has already passed today, schedule for tomorrow
        if (triggerDate <= now) {
          triggerDate.setDate(triggerDate.getDate() + 1);
        }

        // Build trigger object - Expo requires explicit type or channelId
        // For daily recurring notifications, use Date trigger with repeats
        const trigger: any = {
          type: "date",
          date: triggerDate,
          repeats: true,
        };

        // For Android, also add channelId
        if (Platform.OS === "android") {
          trigger.channelId = "default";
        }

        const notificationConfig = {
          content: {
            title: "💊 Medication Reminder",
            body: `Time to take ${medicationName}${dosage ? ` (${dosage})` : ""}`,
            sound: "default",
            data: {
              type: "medication_reminder",
              medicationName,
              dosage,
              reminderTime,
            },
          },
          trigger,
        };

        const notificationId =
          await Notifications.scheduleNotificationAsync(notificationConfig);

        // Verify the notification was scheduled by getting all scheduled notifications
        try {
          const scheduledNotifications =
            await Notifications.getAllScheduledNotificationsAsync();
          scheduledNotifications.find(
            (n) => n.identifier === notificationId
          );
        } catch {
          // Silently handle verification error
        }

        return { success: true, notificationId };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Provide more helpful error messages
        let userFriendlyError = errorMessage;
        if (errorMessage.toLowerCase().includes("permission")) {
          userFriendlyError =
            "Notification permissions not granted. Please enable notifications in Settings.";
        } else if (
          errorMessage.toLowerCase().includes("trigger") ||
          errorMessage.toLowerCase().includes("invalid")
        ) {
          userFriendlyError = `Invalid reminder time format: ${reminderTime}`;
        }

        return {
          success: false,
          error: userFriendlyError,
          rawError: errorMessage,
        };
      }
    },
    []
  );

  // Helper function to ensure notifications are ready
  const ensureInitialized = useCallback(async () => {
    if (Platform.OS === "web") {
      return false;
    }

    if (isInitialized.current) {
      return true;
    }

    if (initializationPromise.current) {
      try {
        await initializationPromise.current;
        return isInitialized.current;
      } catch {
        return false;
      }
    }

    return false;
  }, []);

  // Check and request notification permissions
  const checkAndRequestPermissions = useCallback(async () => {
    if (Platform.OS === "web") {
      return { granted: false, status: "unsupported" };
    }

    try {
      const Notifications = await import("expo-notifications");
      const { Platform } = await import("react-native");

      const { status } = await Notifications.getPermissionsAsync();

      if (status === "granted") {
        return { granted: true, status };
      }

      // Request permissions with proper iOS options
      const requestOptions =
        Platform.OS === "ios"
          ? {
              ios: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
                allowAnnouncements: false,
              },
            }
          : undefined;

      const { status: newStatus } =
        await Notifications.requestPermissionsAsync(requestOptions);

      return { granted: newStatus === "granted", status: newStatus };
    } catch (error) {
      return {
        granted: false,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, []);

  return {
    scheduleNotification,
    scheduleMedicationReminder,
    scheduleRecurringMedicationReminder,
    ensureInitialized,
    checkAndRequestPermissions,
    isInitialized: () => isInitialized.current,
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
        return;
      }
    }
  } catch (error) {
    throw error; // Re-throw to be caught by the calling function
  }
}
