/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Legacy notification orchestration combines initialization, permissions, dedupe, and scheduling logic. */
/* biome-ignore-all lint/suspicious/noExplicitAny: Expo notification module types are loaded dynamically across platforms in this legacy hook. */
/* biome-ignore-all lint/suspicious/noEvolvingTypes: Dynamic imports in legacy hook intentionally initialize module vars before assignment. */
/* biome-ignore-all lint/suspicious/noImplicitAnyLet: Dynamic module variables are intentionally assigned after guarded imports. */
/* biome-ignore-all lint/nursery/noShadow: Legacy local names intentionally mirror imported modules during dynamic imports. */
/* biome-ignore-all lint/correctness/useExhaustiveDependencies: Hook dependencies are intentionally stable to avoid reinitialization loops. */
/* biome-ignore-all lint/correctness/noUnusedVariables: Several catch/error placeholders are intentional in best-effort notification flows. */
/* biome-ignore-all lint/nursery/noIncrementDecrement: Legacy loops/counters retained for predictable scheduling behavior. */
/* biome-ignore-all lint/complexity/noUselessCatch: Rethrow catch blocks preserve explicit error-boundary intent in legacy flow. */
/* biome-ignore-all lint/suspicious/noGlobalIsNan: Legacy validation logic retained in this file for now. */
import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { userService } from "@/lib/services/userService";
import { logger } from "@/lib/utils/logger";

// Track scheduled medication notification IDs to prevent duplicates
const scheduledMedicationNotifications: Map<string, string> = new Map();

export const useNotifications = () => {
  const { user } = useAuth();
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
            logger.warn(
              "Notification init skipped due to bundle loading error",
              { errorMessage },
              "useNotifications"
            );
            // Don't throw - allow initialization to continue gracefully
            return;
          }
          logger.warn(
            "Failed to import notification modules",
            { errorMessage },
            "useNotifications"
          );
          throw importError;
        }

        // Set notification handler with error boundary
        try {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
            }),
          });

          // Configure medication reminder actions
          try {
            await Notifications.setNotificationCategoryAsync("MEDICATION", [
              {
                identifier: "medication_taken_yes",
                buttonTitle: "Taken",
                options: { opensAppToForeground: false },
              },
              {
                identifier: "medication_taken_no",
                buttonTitle: "Snooze",
                options: { opensAppToForeground: false },
              },
            ]);
          } catch {
            // Silently handle category setup error
          }
        } catch (handlerError) {
          logger.warn(
            "Failed to set notification handler",
            handlerError,
            "useNotifications"
          );
          // Continue with initialization even if handler fails
        }

        // Register for push notifications with timeout
        const registrationPromise = registerForPushNotificationsAsync(
          Notifications,
          Device
        );
        let registrationTimeout: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          registrationTimeout = setTimeout(
            () => reject(new Error("Registration timeout")),
            5000
          );
        });

        try {
          await Promise.race([registrationPromise, timeoutPromise]);
        } catch (registrationError) {
          logger.warn(
            "Notification registration failed",
            registrationError,
            "useNotifications"
          );
          // Continue with initialization even if registration fails
        } finally {
          if (registrationTimeout) {
            clearTimeout(registrationTimeout);
          }
        }

        // Add listeners with error handling
        try {
          const { emitMedicationAlarm } = await import(
            "../lib/medicationAlarmEmitter"
          );

          notificationListener.current =
            Notifications.addNotificationReceivedListener((notification) => {
              const data = notification.request.content.data;
              if (data?.type === "medication_reminder") {
                emitMedicationAlarm({
                  medicationId: data.medicationId,
                  medicationName: data.medicationName || "Medication",
                  dosage: data.dosage,
                  reminderId: data.reminderId,
                  reminderTime: data.reminderTime,
                });
                // Haptic feedback when app is in foreground
                try {
                  const Haptics = require("expo-haptics");
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Warning
                  );
                } catch {
                  // Haptics not available
                }
              }
            });

          responseListener.current =
            Notifications.addNotificationResponseReceivedListener(
              (response) => {
                const { actionIdentifier, notification } = response;
                const data = notification.request.content.data;

                if (data?.type === "medication_reminder") {
                  emitMedicationAlarm({
                    medicationId: data.medicationId,
                    medicationName: data.medicationName || "Medication",
                    dosage: data.dosage,
                    reminderId: data.reminderId,
                    reminderTime: data.reminderTime,
                  });
                }

                if (actionIdentifier && data?.type) {
                  const {
                    NotificationResponseHandler,
                  } = require("../lib/services/smartNotificationService");
                  NotificationResponseHandler.handleQuickAction(
                    actionIdentifier,
                    data,
                    user?.id || ""
                  );
                }
              }
            );
        } catch (listenerError) {
          logger.warn(
            "Failed to attach notification listeners",
            listenerError,
            "useNotifications"
          );
          // Silently handle listener error
        }

        isInitialized.current = true;
      } catch (error) {
        logger.warn(
          "Notification initialization failed",
          error,
          "useNotifications"
        );
        // Silently handle initialization error
      } finally {
        initializationInProgress.current = false;
      }
    };

    // Store the promise so we can await it later
    initializationPromise.current = initializeNotifications();

    // Delay initialization to prevent race conditions
    const initTimeout = setTimeout(async () => {
      try {
        await initializationPromise.current;
        // Clean up duplicate notifications after initialization
        if (isInitialized.current) {
          try {
            const Notifications = await import("expo-notifications");
            const allScheduled =
              await Notifications.getAllScheduledNotificationsAsync();

            // Group medication notifications by medication+time
            const medicationGroups: Map<string, any[]> = new Map();

            for (const notification of allScheduled) {
              const data = notification.content?.data;
              if (data?.type === "medication_reminder") {
                const key = `${data.medicationName}_${data.reminderTime}`;
                const group = medicationGroups.get(key) || [];
                group.push(notification);
                medicationGroups.set(key, group);
              }
            }

            // For each group, keep only the first notification and cancel the rest
            for (const [, notifications] of medicationGroups) {
              if (notifications.length > 1) {
                for (let i = 1; i < notifications.length; i++) {
                  try {
                    await Notifications.cancelScheduledNotificationAsync(
                      notifications[i].identifier
                    );
                  } catch {
                    // Silently handle individual cancellation error
                  }
                }
              }
            }
          } catch {
            // Silently handle duplicate cleanup error
          }
        }
      } catch {
        // Silently handle initialization error
      }
    }, 3000); // Increased delay to ensure initialization completes

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
    async (
      medicationName: string,
      dosage: string,
      reminderTime: string,
      options?: { medicationId?: string; reminderId?: string }
    ) => {
      if (Platform.OS === "web") {
        return { success: false, error: "Not supported on web" };
      }

      try {
        // Check user notification preferences before scheduling
        if (user) {
          try {
            const userData = await userService.getUser(user.id);
            const notificationSettings = userData?.preferences
              ?.notifications as any;

            // Check if notifications are globally disabled
            if (notificationSettings?.enabled === false) {
              return {
                success: false,
                error: "Notifications are disabled in settings",
                skipped: true,
              };
            }

            // Check if medication reminders are disabled
            if (notificationSettings?.medicationReminders === false) {
              return {
                success: false,
                error: "Medication reminders are disabled in settings",
                skipped: true,
              };
            }
          } catch (prefError) {
            // If we can't check preferences, continue (fail open for safety)
            // But log it for debugging
          }
        }

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
        const hour = Number.parseInt(hourStr, 10);
        const minute = Number.parseInt(minuteStr, 10);

        if (isNaN(hour) || isNaN(minute)) {
          return { success: false, error: "Invalid time format" };
        }

        // Create a unique key for this medication+time combination to prevent duplicates
        const notificationKey = `med_${
          options?.medicationId ||
          medicationName.toLowerCase().replace(/\s+/g, "_")
        }_${options?.reminderId || reminderTime}`;

        // Cancel any existing notification with the same key to prevent duplicates
        const existingNotificationId =
          scheduledMedicationNotifications.get(notificationKey);
        if (existingNotificationId) {
          try {
            await Notifications.cancelScheduledNotificationAsync(
              existingNotificationId
            );
          } catch {
            // Silently handle cancellation error
          }
        }

        // Also scan and cancel any duplicate notifications for this medication/time
        try {
          const allScheduled =
            await Notifications.getAllScheduledNotificationsAsync();
          const duplicates = allScheduled.filter((n: any) => {
            const data = n.content?.data;
            if (data?.type !== "medication_reminder") {
              return false;
            }
            if (
              options?.reminderId &&
              data?.reminderId === options.reminderId
            ) {
              return true;
            }
            if (
              options?.medicationId &&
              data?.medicationId === options.medicationId
            ) {
              return data?.reminderTime === reminderTime;
            }
            return (
              data?.medicationName === medicationName &&
              data?.reminderTime === reminderTime
            );
          });

          for (const dup of duplicates) {
            try {
              await Notifications.cancelScheduledNotificationAsync(
                dup.identifier
              );
            } catch {
              // Silently handle individual cancellation error
            }
          }
        } catch {
          // Silently handle scan error
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
          trigger.channelId = "medication";
        }

        const notificationConfig = {
          content: {
            title: `💊 ${i18n.t("medicationAlarmTitle")}`,
            body: i18n.t("medicationAlarmBody", {
              medicationName,
              dosage: dosage ? ` (${dosage})` : "",
            }),
            sound: "default",
            channelId: "medication",
            categoryIdentifier: "MEDICATION",
            data: {
              type: "medication_reminder",
              medicationId: options?.medicationId,
              reminderId: options?.reminderId,
              medicationName,
              dosage,
              reminderTime,
            },
          },
          trigger,
        };

        const notificationId =
          await Notifications.scheduleNotificationAsync(notificationConfig);

        // Store the notification ID to prevent future duplicates
        scheduledMedicationNotifications.set(notificationKey, notificationId);

        return { success: true, notificationId };
      } catch (error) {
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

  // Cancel a specific medication's notifications
  const cancelMedicationNotifications = useCallback(
    async (medicationName: string, reminderTime?: string) => {
      if (Platform.OS === "web") {
        return;
      }

      try {
        const Notifications = await import("expo-notifications");
        const allScheduled =
          await Notifications.getAllScheduledNotificationsAsync();

        const toCancel = allScheduled.filter((n: any) => {
          const data = n.content?.data;
          if (data?.type !== "medication_reminder") {
            return false;
          }
          if (data?.medicationName !== medicationName) {
            return false;
          }
          if (reminderTime && data?.reminderTime !== reminderTime) {
            return false;
          }
          return true;
        });

        for (const notification of toCancel) {
          try {
            await Notifications.cancelScheduledNotificationAsync(
              notification.identifier
            );
            // Also remove from our tracking map
            const key = `med_${medicationName.toLowerCase().replace(/\s+/g, "_")}_${notification.content?.data?.reminderTime || ""}`;
            scheduledMedicationNotifications.delete(key);
          } catch {
            // Silently handle individual cancellation error
          }
        }
      } catch {
        // Silently handle error
      }
    },
    []
  );

  // Clear all duplicate medication notifications (keeps only one per medication+time)
  const clearDuplicateMedicationNotifications = useCallback(async () => {
    if (Platform.OS === "web") {
      return { cleared: 0 };
    }

    try {
      const Notifications = await import("expo-notifications");
      const allScheduled =
        await Notifications.getAllScheduledNotificationsAsync();

      // Group medication notifications by medication+time
      const medicationGroups: Map<string, any[]> = new Map();

      for (const notification of allScheduled) {
        const data = notification.content?.data;
        if (data?.type === "medication_reminder") {
          const key = `${data.medicationName}_${data.reminderTime}`;
          const group = medicationGroups.get(key) || [];
          group.push(notification);
          medicationGroups.set(key, group);
        }
      }

      let cleared = 0;

      // For each group, keep only the most recent notification and cancel the rest
      for (const [, notifications] of medicationGroups) {
        if (notifications.length > 1) {
          // Keep the first one, cancel the rest
          for (let i = 1; i < notifications.length; i++) {
            try {
              await Notifications.cancelScheduledNotificationAsync(
                notifications[i].identifier
              );
              cleared++;
            } catch {
              // Silently handle individual cancellation error
            }
          }
        }
      }

      return { cleared };
    } catch {
      return { cleared: 0 };
    }
  }, []);

  // Cancel all medication notifications
  const cancelAllMedicationNotifications = useCallback(async () => {
    if (Platform.OS === "web") {
      return { cancelled: 0 };
    }

    try {
      const Notifications = await import("expo-notifications");
      const allScheduled =
        await Notifications.getAllScheduledNotificationsAsync();

      let cancelled = 0;
      for (const notification of allScheduled) {
        const data = notification.content?.data;
        if (data?.type === "medication_reminder") {
          try {
            await Notifications.cancelScheduledNotificationAsync(
              notification.identifier
            );
            cancelled++;
          } catch {
            // Silently handle individual cancellation error
          }
        }
      }

      // Clear the tracking map
      scheduledMedicationNotifications.clear();

      return { cancelled };
    } catch {
      return { cancelled: 0 };
    }
  }, []);

  // Cancel all scheduled notifications (use with caution)
  const cancelAllNotifications = useCallback(async () => {
    if (Platform.OS === "web") {
      return { cancelled: 0 };
    }

    try {
      const Notifications = await import("expo-notifications");
      await Notifications.cancelAllScheduledNotificationsAsync();

      // Clear the tracking map
      scheduledMedicationNotifications.clear();

      return { cancelled: -1 }; // -1 indicates all were cancelled
    } catch {
      return { cancelled: 0 };
    }
  }, []);

  return {
    scheduleNotification,
    scheduleMedicationReminder,
    scheduleRecurringMedicationReminder,
    cancelMedicationNotifications,
    clearDuplicateMedicationNotifications,
    cancelAllMedicationNotifications,
    cancelAllNotifications,
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
      await Notifications.setNotificationChannelAsync("medication", {
        name: "Medication Alarms",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 1000, 500, 1000, 500, 1000],
        enableVibrate: true,
        lightColor: "#10B981",
        sound: "default",
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
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
