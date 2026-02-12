import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { smartNotificationService } from "@/lib/services/smartNotificationService";
import type { Medication } from "@/types";
import { useNotifications } from "./useNotifications";

type UseSmartNotificationsOptions = {
  medications?: Medication[];
  enabled?: boolean;
  checkInterval?: number; // Minutes between checks
};

export const useSmartNotifications = (
  options: UseSmartNotificationsOptions = {}
) => {
  const {
    medications = [],
    enabled = true,
    checkInterval = 360, // Default: check every 6 hours (reduced frequency)
  } = options;

  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCheckTimeRef = useRef<number>(0);
  const isCheckingRef = useRef<boolean>(false); // Prevent concurrent checks
  const { ensureInitialized } = useNotifications();

  const { user } = useAuth();

  const checkAndScheduleNotifications = useCallback(async () => {
    if (!enabled || Platform.OS === "web" || !user?.id) {
      return;
    }

    // Prevent concurrent scheduling
    if (isCheckingRef.current) {
      return;
    }

    // Rate limiting: Don't check more than once per 2 hours (increased from 1 hour)
    const now = Date.now();
    const timeSinceLastCheck = now - lastCheckTimeRef.current;
    const minIntervalMs = 2 * 60 * 60 * 1000; // 2 hours minimum between checks

    if (timeSinceLastCheck < minIntervalMs && lastCheckTimeRef.current > 0) {
      return;
    }

    isCheckingRef.current = true;

    try {
      // Ensure notifications are initialized
      const isReady = await ensureInitialized();
      if (!isReady) {
        return;
      }

      lastCheckTimeRef.current = now;

      // Generate comprehensive notifications including daily check-ins
      const context = smartNotificationService.getTimeContext();
      const smartNotifications =
        await smartNotificationService.generateComprehensiveNotifications(
          user.id,
          medications,
          context
        );

      // Filter out immediate notifications unless they're critical/high priority
      // This prevents flooding the user with notifications on every check
      const filteredNotifications = smartNotifications.filter(
        (notification) => {
          const isImmediate =
            notification.scheduledTime.getTime() <= Date.now() + 60_000; // Within 1 minute
          const isImportant =
            notification.priority === "critical" ||
            notification.priority === "high";

          // Only allow immediate notifications if they're important
          return !isImmediate || isImportant;
        }
      );

      if (filteredNotifications.length > 0) {
        const _result =
          await smartNotificationService.scheduleSmartNotifications(
            filteredNotifications
          );
      }
    } catch (_error) {
      // Silently handle errors
    } finally {
      isCheckingRef.current = false;
    }
  }, [medications, enabled, ensureInitialized, user?.id]);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") {
      return;
    }

    // Initial check
    checkAndScheduleNotifications();

    // Set up periodic checks
    checkIntervalRef.current = setInterval(
      () => {
        checkAndScheduleNotifications();
      },
      checkInterval * 60 * 1000
    ); // Convert minutes to milliseconds

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [checkAndScheduleNotifications, enabled, checkInterval]);

  return {
    checkAndScheduleNotifications,
  };
};

/**
 * Hook for scheduling daily interactive notifications
 */
export const useDailyNotificationScheduler = (enabled = true) => {
  const { user } = useAuth();
  const { ensureInitialized } = useNotifications();
  const lastScheduledDate = useRef<string | null>(null);
  const schedulingInProgressRef = useRef(false);
  const dailyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getDailyScheduleKey = useCallback(
    (userId: string) => `smart_notifications_last_scheduled:${userId}`,
    []
  );

  const scheduleDailyNotifications = useCallback(async () => {
    if (!(enabled && user?.id) || Platform.OS === "web") {
      return;
    }

    if (schedulingInProgressRef.current) {
      return;
    }

    schedulingInProgressRef.current = true;

    try {
      // Ensure notifications are initialized
      const isReady = await ensureInitialized();
      if (!isReady) {
        return;
      }

      // Check if we've already scheduled for today
      const today = new Date().toDateString();
      const storageKey = getDailyScheduleKey(user.id);
      const persistedDate = await AsyncStorage.getItem(storageKey);
      const effectiveLastDate = lastScheduledDate.current || persistedDate;

      if (effectiveLastDate === today) {
        lastScheduledDate.current = today;
        return; // Already scheduled for today
      }

      // Schedule daily notifications
      await smartNotificationService.scheduleDailyNotifications(user.id);

      // Mark as scheduled for today regardless of count to avoid repeated
      // immediate "missed activity" prompts during the same day.
      lastScheduledDate.current = today;
      await AsyncStorage.setItem(storageKey, today);
    } catch (_error) {
      // Intentionally ignored: scheduler retries on next cycle.
    } finally {
      schedulingInProgressRef.current = false;
    }
  }, [enabled, user?.id, ensureInitialized, getDailyScheduleKey]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Schedule initial notifications
    scheduleDailyNotifications();

    // Schedule refresh for tomorrow at 2 AM
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);

    const timeUntilTomorrow = tomorrow.getTime() - now.getTime();

    const timeoutId = setTimeout(() => {
      scheduleDailyNotifications();

      // Set up daily scheduling (every 24 hours)
      dailyIntervalRef.current = setInterval(
        scheduleDailyNotifications,
        24 * 60 * 60 * 1000
      );
    }, timeUntilTomorrow);

    return () => {
      clearTimeout(timeoutId);
      if (dailyIntervalRef.current) {
        clearInterval(dailyIntervalRef.current);
        dailyIntervalRef.current = null;
      }
    };
  }, [enabled, scheduleDailyNotifications]);

  return {
    scheduleDailyNotifications,
  };
};
