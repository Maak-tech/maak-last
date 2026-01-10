import type { Medication } from "@/types";
import { medicationRefillService } from "./medicationRefillService";

export interface NotificationContext {
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  userLocation?: string;
  weather?: {
    condition: string;
    temperature: number;
  };
  healthStatus?: {
    recentSymptoms: number;
    medicationCompliance: number;
  };
}

export interface SmartNotification {
  id: string;
  title: string;
  body: string;
  type: "medication" | "refill" | "health_tip" | "reminder" | "alert";
  priority: "low" | "normal" | "high" | "critical";
  scheduledTime: Date;
  data?: Record<string, any>;
}

class SmartNotificationService {
  /**
   * Get current time context
   */
  getTimeContext(): Pick<NotificationContext, "timeOfDay" | "dayOfWeek"> {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    let timeOfDay: NotificationContext["timeOfDay"];
    if (hour >= 5 && hour < 12) {
      timeOfDay = "morning";
    } else if (hour >= 12 && hour < 17) {
      timeOfDay = "afternoon";
    } else if (hour >= 17 && hour < 22) {
      timeOfDay = "evening";
    } else {
      timeOfDay = "night";
    }

    return { timeOfDay, dayOfWeek };
  }

  /**
   * Generate medication refill notifications
   */
  generateRefillNotifications(
    medications: Medication[]
  ): SmartNotification[] {
    const predictions = medicationRefillService.getRefillPredictions(
      medications
    );
    const notifications: SmartNotification[] = [];

    predictions.predictions.forEach((prediction) => {
      if (prediction.needsRefill) {
        // Schedule notification based on urgency
        const now = new Date();
        let scheduledTime = new Date(now);

        // For critical/high urgency, notify immediately
        // For medium/low, schedule for next morning
        if (prediction.urgency === "critical" || prediction.urgency === "high") {
          scheduledTime = new Date(now);
          scheduledTime.setMinutes(scheduledTime.getMinutes() + 5); // 5 minutes from now
        } else {
          // Schedule for next morning at 9 AM
          scheduledTime.setDate(scheduledTime.getDate() + 1);
          scheduledTime.setHours(9, 0, 0, 0);
        }

        notifications.push({
          id: `refill-${prediction.medicationId}-${Date.now()}`,
          title: "💊 Medication Refill Reminder",
          body: `${prediction.medicationName} is running low. ${
            prediction.daysUntilRefill <= 0
              ? "Refill needed immediately!"
              : `Refill in ${medicationRefillService.formatDaysUntilRefill(
                  prediction.daysUntilRefill
                )}`
          }`,
          type: "refill",
          priority:
            prediction.urgency === "critical"
              ? "critical"
              : prediction.urgency === "high"
                ? "high"
                : "normal",
          scheduledTime,
          data: {
            medicationId: prediction.medicationId,
            medicationName: prediction.medicationName,
            daysUntilRefill: prediction.daysUntilRefill,
            urgency: prediction.urgency,
          },
        });
      }
    });

    return notifications;
  }

  /**
   * Generate context-aware health tips
   */
  generateHealthTips(context: NotificationContext): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const { timeOfDay, dayOfWeek } = context;

    // Morning tips
    if (timeOfDay === "morning") {
      notifications.push({
        id: `health-tip-morning-${Date.now()}`,
        title: "🌅 Good Morning Health Tip",
        body: "Start your day with a glass of water and remember to take your morning medications.",
        type: "health_tip",
        priority: "low",
        scheduledTime: new Date(),
        data: { tipType: "morning" },
      });
    }

    // Weekend tips
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      notifications.push({
        id: `health-tip-weekend-${Date.now()}`,
        title: "🏖️ Weekend Wellness",
        body: "Use this weekend to catch up on any missed health tracking and review your medication schedule.",
        type: "health_tip",
        priority: "low",
        scheduledTime: new Date(),
        data: { tipType: "weekend" },
      });
    }

    // Weather-based tips
    if (context.weather) {
      const { condition, temperature } = context.weather;

      if (condition.toLowerCase().includes("rain") || condition.toLowerCase().includes("storm")) {
        notifications.push({
          id: `health-tip-weather-${Date.now()}`,
          title: "🌧️ Weather Alert",
          body: "Rainy weather ahead. Stay warm and dry, and be extra careful if you have joint pain or arthritis.",
          type: "health_tip",
          priority: "low",
          scheduledTime: new Date(),
          data: { tipType: "weather", condition },
        });
      }

      if (temperature > 30) {
        notifications.push({
          id: `health-tip-heat-${Date.now()}`,
          title: "☀️ Heat Advisory",
          body: "High temperatures expected. Stay hydrated, avoid direct sun exposure, and check on elderly family members.",
          type: "health_tip",
          priority: "normal",
          scheduledTime: new Date(),
          data: { tipType: "heat", temperature },
        });
      }
    }

    return notifications;
  }

  /**
   * Generate medication compliance reminders
   */
  generateComplianceReminders(
    medications: Medication[],
    complianceRate: number
  ): SmartNotification[] {
    const notifications: SmartNotification[] = [];

    // If compliance is low, send encouragement
    if (complianceRate < 70) {
      notifications.push({
        id: `compliance-reminder-${Date.now()}`,
        title: "📊 Medication Compliance",
        body: `Your medication compliance is ${Math.round(complianceRate)}%. Try setting reminders or using the app's tracking features to improve.`,
        type: "reminder",
        priority: "normal",
        scheduledTime: new Date(),
        data: { complianceRate },
      });
    }

    return notifications;
  }

  /**
   * Generate all smart notifications based on context
   */
  generateSmartNotifications(
    medications: Medication[],
    context?: Partial<NotificationContext>
  ): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const fullContext: NotificationContext = {
      ...this.getTimeContext(),
      ...context,
    };

    // Refill notifications
    const refillNotifications = this.generateRefillNotifications(medications);
    notifications.push(...refillNotifications);

    // Health tips (limit to 1 per day)
    const healthTips = this.generateHealthTips(fullContext);
    if (healthTips.length > 0) {
      notifications.push(healthTips[0]); // Only one tip per generation
    }

    return notifications;
  }

  /**
   * Schedule smart notifications using expo-notifications
   */
  async scheduleSmartNotifications(
    notifications: SmartNotification[]
  ): Promise<{ scheduled: number; failed: number }> {
    let scheduled = 0;
    let failed = 0;

    try {
      const Notifications = await import("expo-notifications");
      const { Platform } = await import("react-native");

      if (Platform.OS === "web") {
        return { scheduled: 0, failed: notifications.length };
      }

      for (const notification of notifications) {
        try {
          // Check if notification should be scheduled (not in the past)
          if (notification.scheduledTime <= new Date()) {
            // Schedule immediately if time has passed
            await Notifications.scheduleNotificationAsync({
              content: {
                title: notification.title,
                body: notification.body,
                sound: "default",
                data: notification.data || {},
                priority:
                  notification.priority === "critical" || notification.priority === "high"
                    ? "max"
                    : "default",
              },
              trigger: null, // Send immediately
            });
          } else {
            // Schedule for future time
            await Notifications.scheduleNotificationAsync({
              content: {
                title: notification.title,
                body: notification.body,
                sound: "default",
                data: notification.data || {},
                priority:
                  notification.priority === "critical" || notification.priority === "high"
                    ? "max"
                    : "default",
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: notification.scheduledTime,
              },
            });
          }
          scheduled++;
        } catch (error) {
          failed++;
          // Silently handle individual notification failures
        }
      }
    } catch (error) {
      // Silently handle notification system errors
      failed = notifications.length;
    }

    return { scheduled, failed };
  }

  /**
   * Check and schedule refill notifications for medications
   */
  async checkAndScheduleRefillNotifications(
    medications: Medication[]
  ): Promise<void> {
    const refillNotifications = this.generateRefillNotifications(medications);
    if (refillNotifications.length > 0) {
      await this.scheduleSmartNotifications(refillNotifications);
    }
  }
}

export const smartNotificationService = new SmartNotificationService();
