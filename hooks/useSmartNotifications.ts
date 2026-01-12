import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import type { Medication } from "@/types";
import { smartNotificationService } from "@/lib/services/smartNotificationService";
import { useNotifications } from "./useNotifications";
import { useAuth } from "@/contexts/AuthContext";

interface UseSmartNotificationsOptions {
  medications?: Medication[];
  enabled?: boolean;
  checkInterval?: number; // Minutes between checks
}

export const useSmartNotifications = (options: UseSmartNotificationsOptions = {}) => {
  const {
    medications = [],
    enabled = true,
    checkInterval = 360, // Default: check every 6 hours (reduced frequency)
  } = options;

  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCheckTimeRef = useRef<number>(0);
  const { ensureInitialized } = useNotifications();

  const { user } = useAuth();

  const checkAndScheduleNotifications = useCallback(async () => {
    if (!enabled || Platform.OS === "web" || !user?.id) {
      return;
    }

    // Rate limiting: Don't check more than once per hour
    const now = Date.now();
    const timeSinceLastCheck = now - lastCheckTimeRef.current;
    const minIntervalMs = 60 * 60 * 1000; // 1 hour minimum between checks
    
    if (timeSinceLastCheck < minIntervalMs && lastCheckTimeRef.current > 0) {
      console.log('Skipping notification check - too soon since last check');
      return;
    }

    try {
      // Ensure notifications are initialized
      const isReady = await ensureInitialized();
      if (!isReady) {
        return;
      }

      lastCheckTimeRef.current = now;

      // Generate comprehensive notifications including daily check-ins
      const context = smartNotificationService.getTimeContext();
      const smartNotifications = await smartNotificationService.generateComprehensiveNotifications(
        user.id,
        medications,
        context
      );

      // Filter out immediate notifications unless they're critical/high priority
      // This prevents flooding the user with notifications on every check
      const filteredNotifications = smartNotifications.filter(notification => {
        const isImmediate = notification.scheduledTime.getTime() <= Date.now() + 60000; // Within 1 minute
        const isImportant = notification.priority === 'critical' || notification.priority === 'high';
        
        // Only allow immediate notifications if they're important
        return !isImmediate || isImportant;
      });

      if (filteredNotifications.length > 0) {
        const result = await smartNotificationService.scheduleSmartNotifications(
          filteredNotifications
        );
      }
    } catch (error) {
      console.error('Error scheduling notifications:', error);
      // Silently handle errors
    }
  }, [medications, enabled, ensureInitialized, user?.id]);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") {
      return;
    }

    // Initial check
    checkAndScheduleNotifications();

    // Set up periodic checks
    checkIntervalRef.current = setInterval(() => {
      checkAndScheduleNotifications();
    }, checkInterval * 60 * 1000); // Convert minutes to milliseconds

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
export const useDailyNotificationScheduler = (enabled: boolean = true) => {
  const { user } = useAuth();
  const { ensureInitialized } = useNotifications();
  const lastScheduledDate = useRef<string | null>(null);

  const scheduleDailyNotifications = useCallback(async () => {
    if (!enabled || !user?.id || Platform.OS === "web") {
      return;
    }

    try {
      // Ensure notifications are initialized
      const isReady = await ensureInitialized();
      if (!isReady) {
        return;
      }

      // Check if we've already scheduled for today
      const today = new Date().toDateString();
      if (lastScheduledDate.current === today) {
        return; // Already scheduled for today
      }

      // Schedule daily notifications
      const result = await smartNotificationService.scheduleDailyNotifications(user.id);

      if (result.scheduled > 0) {
        lastScheduledDate.current = today;
      }

    } catch (error) {
      console.error('Error scheduling daily notifications:', error);
    }
  }, [enabled, user?.id, ensureInitialized]);

  useEffect(() => {
    if (!enabled) return;

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
      const intervalId = setInterval(scheduleDailyNotifications, 24 * 60 * 60 * 1000);

      return () => clearInterval(intervalId);
    }, timeUntilTomorrow);

    return () => clearTimeout(timeoutId);
  }, [enabled, scheduleDailyNotifications]);

  return {
    scheduleDailyNotifications,
  };
};
