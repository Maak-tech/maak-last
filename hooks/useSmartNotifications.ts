import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import type { Medication } from "@/types";
import { smartNotificationService } from "@/lib/services/smartNotificationService";
import { useNotifications } from "./useNotifications";

interface UseSmartNotificationsOptions {
  medications?: Medication[];
  enabled?: boolean;
  checkInterval?: number; // Minutes between checks
}

export const useSmartNotifications = (options: UseSmartNotificationsOptions = {}) => {
  const {
    medications = [],
    enabled = true,
    checkInterval = 60, // Default: check every hour
  } = options;

  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { ensureInitialized } = useNotifications();

  const checkAndScheduleNotifications = useCallback(async () => {
    if (!enabled || Platform.OS === "web" || medications.length === 0) {
      return;
    }

    try {
      // Ensure notifications are initialized
      const isReady = await ensureInitialized();
      if (!isReady) {
        return;
      }

      // Check and schedule refill notifications
      await smartNotificationService.checkAndScheduleRefillNotifications(
        medications
      );

      // Generate and schedule context-aware notifications
      const context = smartNotificationService.getTimeContext();
      const smartNotifications =
        smartNotificationService.generateSmartNotifications(medications, context);

      if (smartNotifications.length > 0) {
        await smartNotificationService.scheduleSmartNotifications(
          smartNotifications
        );
      }
    } catch (error) {
      // Silently handle errors
    }
  }, [medications, enabled, ensureInitialized]);

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
