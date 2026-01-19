import i18n from "@/lib/i18n";
import type { Medication, MedicationReminder } from "@/types";
import { medicationRefillService } from "./medicationRefillService";

export interface UserStats {
  currentStreak: number;
  longestStreak: number;
  daysSinceLastActivity: number;
  daysSinceLastSymptom: number;
  daysSinceLastMedicationLog: number;
  recentCompliance: number;
  achievements: Achievement[];
  userProfile?: UserProfile;
  lastVitalChecks?: VitalCheckHistory;
  healthConditions?: string[];
}

export interface UserProfile {
  conditions?: string[];
  age?: number;
  medications?: string[];
  allergies?: string[];
  mentalHealth?: string[];
}

export interface VitalCheckHistory {
  lastBloodPressure?: Date;
  lastHeartRate?: Date;
  lastTemperature?: Date;
  lastWeight?: Date;
  lastBloodSugar?: Date;
  lastRespiratoryRate?: Date;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  type: "streak" | "compliance" | "consistency" | "milestone";
  unlockedAt: Date;
}

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
  notificationPreferences?: {
    maxPerDay: number;
    frequency: "low" | "medium" | "high";
    enabledCategories: string[];
  };
}

export interface SmartNotification {
  id: string;
  title: string;
  body: string;
  type:
    | "medication"
    | "refill"
    | "health_tip"
    | "reminder"
    | "alert"
    | "wellness_checkin"
    | "streak_reminder"
    | "activity_alert"
    | "achievement"
    | "family_update"
    | "medication_confirmation";
  priority: "low" | "normal" | "high" | "critical";
  scheduledTime: Date;
  data?: Record<string, any>;
  quickActions?: {
    label: string;
    action: string;
    icon?: string;
  }[];
}

class SmartNotificationService {
  private static readonly DEDUPE_WINDOW_MS = 30 * 60 * 1000;

  private getDedupeWindowId(date: Date): number {
    return Math.floor(
      date.getTime() / SmartNotificationService.DEDUPE_WINDOW_MS
    );
  }

  private extractTriggerDateFromScheduledRequest(request: any): Date | null {
    try {
      const trigger = request?.trigger;
      if (!trigger) return null;

      const rawDate = (trigger as any).date ?? (trigger as any).value;
      if (!rawDate) return null;

      const parsed = new Date(rawDate);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private getSchedulingKeyFromSmartNotification(
    notification: SmartNotification
  ): string {
    const userId =
      typeof notification.data?.userId === "string" &&
      notification.data.userId.length > 0
        ? notification.data.userId
        : "unknown";

    const medicationName =
      typeof (notification.data as any)?.medicationName === "string"
        ? (notification.data as any).medicationName
        : undefined;
    const reminderTime =
      typeof (notification.data as any)?.reminderTime === "string"
        ? (notification.data as any).reminderTime
        : undefined;
    if (medicationName && reminderTime) {
      return `medication_reminder:${userId}:${medicationName}:${reminderTime}`;
    }

    const dataType =
      typeof notification.data?.type === "string" &&
      notification.data.type.length > 0
        ? notification.data.type
        : notification.title;

    const windowId = this.getDedupeWindowId(notification.scheduledTime);
    return `${dataType}:${userId}:${windowId}`;
  }

  private getSchedulingKeyFromScheduledRequest(request: any): string | null {
    try {
      const content = request?.content;
      if (!content) return null;

      const data = content?.data ?? {};
      const userId =
        typeof data.userId === "string" && data.userId.length > 0
          ? data.userId
          : "unknown";

      const medicationName =
        typeof data.medicationName === "string"
          ? data.medicationName
          : undefined;
      const reminderTime =
        typeof data.reminderTime === "string" ? data.reminderTime : undefined;
      if (medicationName && reminderTime) {
        return `medication_reminder:${userId}:${medicationName}:${reminderTime}`;
      }

      const dataType =
        typeof data.type === "string" && data.type.length > 0
          ? data.type
          : typeof content.title === "string"
            ? content.title
            : "";

      const triggerDate =
        this.extractTriggerDateFromScheduledRequest(request) ?? new Date();
      const windowId = this.getDedupeWindowId(triggerDate);
      return `${dataType}:${userId}:${windowId}`;
    } catch {
      return null;
    }
  }

  private async getUserNotificationSettings(
    userId: string
  ): Promise<any | null> {
    try {
      const { userService } = await import("./userService");
      const user = await userService.getUser(userId);
      return user?.preferences?.notifications ?? null;
    } catch {
      return null;
    }
  }

  private normalizeNotificationSettings(settings: any | null): any | null {
    if (settings === null || settings === undefined) return null;
    if (typeof settings === "boolean") {
      return { enabled: settings };
    }
    if (typeof settings === "object") {
      return settings;
    }
    return null;
  }

  private isAllowedByUserPreferences(
    notification: SmartNotification,
    rawSettings: any | null
  ): boolean {
    const settings = this.normalizeNotificationSettings(rawSettings);
    if (!settings) return true;

    if (settings.enabled === false) return false;

    const dataType =
      typeof notification.data?.type === "string" ? notification.data.type : "";

    if (
      settings.wellnessCheckins === false &&
      (notification.type === "wellness_checkin" ||
        dataType.includes("checkin") ||
        dataType.includes("reflection") ||
        dataType.includes("wellness"))
    ) {
      return false;
    }

    if (
      settings.medicationReminders === false &&
      (notification.type === "medication" ||
        notification.type === "medication_confirmation" ||
        dataType.includes("medication") ||
        dataType.includes("refill"))
    ) {
      return false;
    }

    if (
      settings.symptomAlerts === false &&
      (notification.type === "alert" || dataType.includes("symptom"))
    ) {
      return false;
    }

    if (
      settings.familyUpdates === false &&
      (notification.type === "family_update" || dataType.includes("family"))
    ) {
      return false;
    }

    return true;
  }
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
  generateRefillNotifications(medications: Medication[]): SmartNotification[] {
    const predictions =
      medicationRefillService.getRefillPredictions(medications);
    const notifications: SmartNotification[] = [];

    predictions.predictions.forEach((prediction) => {
      if (prediction.needsRefill) {
        // Schedule notification based on urgency
        const now = new Date();
        let scheduledTime = new Date(now);

        // For critical/high urgency, notify immediately
        // For medium/low, schedule for next morning
        if (
          prediction.urgency === "critical" ||
          prediction.urgency === "high"
        ) {
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

      if (
        condition.toLowerCase().includes("rain") ||
        condition.toLowerCase().includes("storm")
      ) {
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
   * Generate comprehensive smart notifications including all phases
   */
  async generateComprehensiveNotifications(
    userId: string,
    medications: Medication[],
    context?: Partial<NotificationContext>
  ): Promise<SmartNotification[]> {
    const notifications: SmartNotification[] = [];

    // Get user stats once for all phases
    const userStats = await this.getUserStats(userId);
    const userRole = await this.getUserRole(userId);

    // Get notification preferences (default to reasonable limits - reduced to prevent notification overload)
    const maxNotifications = context?.notificationPreferences?.maxPerDay || 3;

    // Core daily check-ins (2-3 most important)
    const dailyNotifications =
      await this.generateDailyInteractiveNotifications(userId);
    // Prioritize morning check-in and evening reflection
    const priorityDaily = dailyNotifications.filter(
      (n) =>
        n.id.includes("morning-checkin") || n.id.includes("evening-reflection")
    );
    notifications.push(...priorityDaily.slice(0, 2));

    // Medication reminders (if applicable)
    if (medications.length > 0) {
      const existingNotifications = this.generateSmartNotifications(
        medications,
        context
      );
      notifications.push(...existingNotifications.slice(0, 2)); // Max 2 medication notifications

      // Medication confirmation check-ins (ask if they took scheduled medication)
      const confirmationNotifications =
        this.generateMedicationConfirmationNotifications(
          medications,
          userStats
        );
      notifications.push(...confirmationNotifications.slice(0, 1)); // Max 1 confirmation notification
    }

    // Key wellness reminders (1-2 based on context)
    if (context?.timeOfDay === "morning") {
      // Morning hydration reminder
      const hydrationNotification: SmartNotification = {
        id: `morning-hydration-${Date.now()}`,
        title: "💧 Good Morning Hydration",
        body: "Start your day with a glass of water for better energy and health.",
        type: "reminder",
        priority: "low",
        scheduledTime: new Date(),
        data: { type: "morning_hydration" },
        quickActions: [
          { label: "💧 Drank Water", action: "log_water_intake" },
          { label: "☕ Coffee First", action: "log_coffee_intake" },
          { label: "⏰ Remind Later", action: "snooze_hydration" },
        ],
      };
      notifications.push(hydrationNotification);
    }

    // Midday wellness check (only if we have room)
    if (
      notifications.length < maxNotifications &&
      context?.timeOfDay === "afternoon"
    ) {
      const middayNotification: SmartNotification = {
        id: `midday-wellness-${Date.now()}`,
        title: "⚡ Afternoon Energy Check",
        body: "How's your energy holding up? A quick check helps maintain your wellness streak.",
        type: "reminder",
        priority: "low",
        scheduledTime: new Date(),
        data: { type: "midday_check" },
        quickActions: [
          { label: "⚡ Feeling Good", action: "log_energy_good" },
          { label: "😴 Need Boost", action: "log_energy_low" },
          { label: "💧 Drink Water", action: "log_hydration" },
        ],
      };
      notifications.push(middayNotification);
    }

    // Condition-specific reminders (only for users with conditions)
    if (userStats.healthConditions && userStats.healthConditions.length > 0) {
      const conditionReminders =
        this.generateConditionSpecificReminders(userStats);
      notifications.push(...conditionReminders.slice(0, 1)); // Max 1 condition reminder
    }

    // Achievement celebrations (only recent ones)
    const achievementCelebrations =
      this.generateAchievementCelebrations(userStats);
    notifications.push(...achievementCelebrations.slice(0, 1)); // Max 1 achievement

    // Remove duplicates and apply final limit (ids often include Date.now(), so dedupe via stable key instead)
    const uniqueNotifications = notifications.filter(
      (notification, index, self) => {
        const key = this.getSchedulingKeyFromSmartNotification(notification);
        return (
          index ===
          self.findIndex(
            (n) => this.getSchedulingKeyFromSmartNotification(n) === key
          )
        );
      }
    );

    return uniqueNotifications.slice(0, maxNotifications);
  }

  /**
   * Enhanced scheduling with optimization, prioritization, and smart suppression
   */
  async scheduleSmartNotifications(
    notifications: SmartNotification[]
  ): Promise<{ scheduled: number; failed: number; suppressed: number }> {
    let scheduled = 0;
    let failed = 0;
    let suppressed = 0;

    try {
      // Safety check for notifications array
      if (!(notifications && Array.isArray(notifications))) {
        return { scheduled: 0, failed: 0, suppressed: 0 };
      }

      const Notifications = await import("expo-notifications");
      const { Platform } = await import("react-native");

      if (Platform.OS === "web") {
        return { scheduled: 0, failed: notifications.length, suppressed: 0 };
      }

      // Respect user preferences (best-effort)
      const inferredUserId = notifications.find(
        (n) => typeof n.data?.userId === "string"
      )?.data?.userId as string | undefined;
      const rawSettings = inferredUserId
        ? await this.getUserNotificationSettings(inferredUserId)
        : null;
      const settings = this.normalizeNotificationSettings(rawSettings);

      if (settings?.enabled === false) {
        return { scheduled: 0, failed: 0, suppressed: notifications.length };
      }

      const preferenceFiltered = notifications.filter((n) =>
        this.isAllowedByUserPreferences(n, settings)
      );

      // Step 0: Clear existing notifications that match what we're about to schedule (prevents duplicates on reopen)
      await this.clearExistingNotificationsOfTypes(
        preferenceFiltered,
        Notifications
      );

      // Step 1: Optimize and prioritize notifications
      const optimizedNotifications =
        await this.optimizeNotificationSchedule(preferenceFiltered);

      // Step 2: Suppress overlapping/duplicate notifications
      const filteredNotifications = this.suppressDuplicateNotifications(
        optimizedNotifications
      );
      suppressed = preferenceFiltered.length - filteredNotifications.length;

      // Step 3: Schedule with intelligent timing
      for (const notification of filteredNotifications) {
        try {
          await this.scheduleOptimizedNotification(notification, Notifications);
          scheduled++;
        } catch (error) {
          failed++;
        }
      }
    } catch (error) {
      failed = notifications.length;
    }

    return { scheduled, failed, suppressed };
  }

  /**
   * Clear existing notifications of the same types to prevent duplicates
   */
  private async clearExistingNotificationsOfTypes(
    newNotifications: SmartNotification[],
    Notifications: any
  ): Promise<void> {
    try {
      // Safety check for newNotifications
      if (!(newNotifications && Array.isArray(newNotifications))) {
        return;
      }

      // Get all currently scheduled notifications
      const scheduledNotifications =
        await Notifications.getAllScheduledNotificationsAsync();

      // Safety check for scheduledNotifications
      if (!(scheduledNotifications && Array.isArray(scheduledNotifications))) {
        return;
      }

      const newNotificationTypes = new Set(newNotifications.map((n) => n.type));
      const newUserIds = new Set(
        newNotifications.map((n) => n.data?.userId).filter(Boolean)
      );
      const keysToSchedule = new Set(
        newNotifications.map((n) =>
          this.getSchedulingKeyFromSmartNotification(n)
        )
      );

      const identifiersToCancel: string[] = [];

      for (const scheduled of scheduledNotifications) {
        const identifier = scheduled?.identifier;
        if (typeof identifier !== "string" || identifier.length === 0) continue;

        const scheduledKey =
          this.getSchedulingKeyFromScheduledRequest(scheduled);
        if (scheduledKey && keysToSchedule.has(scheduledKey)) {
          identifiersToCancel.push(identifier);
          continue;
        }

        // Legacy cleanup: if we're scheduling wellness check-ins, cancel any existing check-ins for the same user
        if (newNotificationTypes.has("wellness_checkin")) {
          const notificationData = scheduled?.content?.data || {};
          const notificationType = notificationData.type;
          const scheduledUserId = notificationData.userId;

          if (
            typeof notificationType === "string" &&
            notificationType.includes("checkin") &&
            (!scheduledUserId || newUserIds.has(scheduledUserId))
          ) {
            identifiersToCancel.push(identifier);
          }
        }
      }

      for (const id of identifiersToCancel) {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch {
          // Silently handle individual cancellation error
        }
      }
    } catch (error) {
      // Silently handle errors when clearing notifications
    }
  }

  /**
   * Optimize notification scheduling with intelligent timing
   */
  private async optimizeNotificationSchedule(
    notifications: SmartNotification[]
  ): Promise<SmartNotification[]> {
    const optimized: SmartNotification[] = [];
    const now = new Date();

    // Group notifications by priority
    const critical = notifications.filter((n) => n.priority === "critical");
    const high = notifications.filter((n) => n.priority === "high");
    const normal = notifications.filter((n) => n.priority === "normal");
    const low = notifications.filter((n) => n.priority === "low");

    // Critical/high should NOT be pulled earlier than intended; only nudge truly-immediate items
    critical.forEach((notification) => {
      const scheduledTime =
        notification.scheduledTime.getTime() <= now.getTime() + 60_000
          ? new Date(now.getTime() + 1000)
          : notification.scheduledTime;
      optimized.push({ ...notification, scheduledTime });
    });

    high.forEach((notification, index) => {
      const staggerMs = Math.min(index * 30_000, 5 * 60_000);
      const base =
        notification.scheduledTime.getTime() <= now.getTime() + 60_000
          ? new Date(now.getTime() + 30_000)
          : notification.scheduledTime;
      optimized.push({
        ...notification,
        scheduledTime: new Date(base.getTime() + staggerMs),
      });
    });

    // Optimize normal priority timing
    const normalOptimized = this.optimizeNormalPriorityTiming(normal);
    optimized.push(...normalOptimized);

    // Schedule low priority during optimal times
    const lowOptimized = this.optimizeLowPriorityTiming(low);
    optimized.push(...lowOptimized);

    return optimized;
  }

  /**
   * Optimize timing for normal priority notifications
   */
  private optimizeNormalPriorityTiming(
    notifications: SmartNotification[]
  ): SmartNotification[] {
    const optimized: SmartNotification[] = [];
    const userPreferences = this.getUserNotificationPreferences();

    notifications.forEach((notification, index) => {
      let scheduledTime = notification.scheduledTime;

      // Adjust timing based on user preferences
      if (userPreferences.quietHours) {
        scheduledTime = this.adjustForQuietHours(
          scheduledTime,
          userPreferences.quietHours
        );
      }

      // Stagger notifications to avoid overwhelming user
      const staggerDelay = index * 60_000; // 1 minute between each
      scheduledTime = new Date(scheduledTime.getTime() + staggerDelay);

      // Ensure minimum delay from now
      const minDelay = 5 * 60 * 1000; // 5 minutes minimum
      if (scheduledTime.getTime() - Date.now() < minDelay) {
        scheduledTime = new Date(Date.now() + minDelay + staggerDelay);
      }

      optimized.push({
        ...notification,
        scheduledTime,
      });
    });

    return optimized;
  }

  /**
   * Optimize timing for low priority notifications
   */
  private optimizeLowPriorityTiming(
    notifications: SmartNotification[]
  ): SmartNotification[] {
    const optimized: SmartNotification[] = [];

    notifications.forEach((notification) => {
      // Schedule low priority notifications during optimal times:
      // - Morning (9-11 AM)
      // - Afternoon (2-4 PM)
      // - Evening (7-9 PM)
      const optimalTimes = this.getOptimalNotificationTimes();
      const bestTime = this.findBestAvailableTime(
        notification.scheduledTime,
        optimalTimes
      );

      optimized.push({
        ...notification,
        scheduledTime: bestTime,
      });
    });

    return optimized;
  }

  /**
   * Suppress duplicate and overlapping notifications
   */
  private suppressDuplicateNotifications(
    notifications: SmartNotification[]
  ): SmartNotification[] {
    const filtered: SmartNotification[] = [];
    const seen = new Set<string>();

    // Sort by priority (critical first) and then by time
    const sorted = notifications.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
      const priorityDiff =
        priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return a.scheduledTime.getTime() - b.scheduledTime.getTime();
    });

    for (const notification of sorted) {
      // Create a unique key based on type, user context, and time window
      const timeWindow = Math.floor(
        notification.scheduledTime.getTime() / (30 * 60 * 1000)
      ); // 30-minute windows
      const key = `${notification.type}-${notification.data?.userId || "general"}-${timeWindow}`;

      // Suppress if we've seen a similar notification in the same time window
      if (seen.has(key)) {
        // Keep critical notifications even if duplicates
        if (notification.priority === "critical") {
          filtered.push(notification);
        }
      } else {
        seen.add(key);
        filtered.push(notification);
      }
    }

    return filtered;
  }

  /**
   * Schedule a single optimized notification
   */
  private async scheduleOptimizedNotification(
    notification: SmartNotification,
    Notifications: any
  ): Promise<void> {
    // Safety check for notification
    if (!(notification && notification.title && notification.body)) {
      return;
    }

    const content = {
      title: notification.title,
      body: notification.body,
      sound: this.getNotificationSound(notification),
      data: notification.data || {},
      priority: this.getNotificationPriority(notification),
      ...this.getAdditionalContent(notification),
    };

    const now = Date.now();
    const scheduledTime = notification.scheduledTime.getTime();
    const isImmediate = scheduledTime <= now + 60_000; // Within 1 minute
    const isImportant =
      notification.priority === "critical" || notification.priority === "high";

    // Prevent immediate low-priority notifications from being scheduled too frequently
    // Only schedule immediately if it's important or scheduled for future
    if (isImmediate && !isImportant) {
      // For low-priority immediate notifications, delay them by at least 5 minutes
      const delayedTime = new Date(now + 5 * 60 * 1000);
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: delayedTime,
        },
      });
    } else if (isImmediate && isImportant) {
      // Important notifications: schedule ~immediately but as a DATE trigger so they can be deduped/cancelled
      const soon = new Date(now + 1000);
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: soon,
        },
      });
    } else {
      // Schedule for future time
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notification.scheduledTime,
        },
      });
    }
  }

  /**
   * Get appropriate sound for notification type
   */
  private getNotificationSound(notification: SmartNotification): string {
    switch (notification.priority) {
      case "critical":
        return "alarm";
      case "high":
        return "reminder";
      default:
        return "default";
    }
  }

  /**
   * Get notification priority for native system
   */
  private getNotificationPriority(
    notification: SmartNotification
  ): "max" | "high" | "default" | "low" | "min" {
    switch (notification.priority) {
      case "critical":
        return "max";
      case "high":
        return "high";
      default:
        return "default";
    }
  }

  /**
   * Add quick actions to notification content
   */
  private getAdditionalContent(notification: SmartNotification): any {
    if (!notification.quickActions || notification.quickActions.length === 0) {
      return {};
    }

    // Convert quick actions to native notification actions
    // This depends on your notification library capabilities
    return {
      // Example for Expo Notifications:
      categoryIdentifier: `category_${notification.type}`,
      // Quick actions would be defined at the category level
    };
  }

  /**
   * Get user notification preferences
   */
  private getUserNotificationPreferences(): {
    quietHours?: { start: string; end: string };
    preferredTimes?: string[];
  } {
    // This would load from user preferences
    // For now, return default preferences
    return {
      quietHours: { start: "22:00", end: "08:00" }, // 10 PM to 8 AM
      preferredTimes: ["09:00", "14:00", "19:00"], // 9 AM, 2 PM, 7 PM
    };
  }

  /**
   * Adjust notification time to avoid quiet hours
   */
  private adjustForQuietHours(
    time: Date,
    quietHours: { start: string; end: string }
  ): Date {
    const timeString = time.toTimeString().slice(0, 5); // HH:MM format

    if (this.isInQuietHours(timeString, quietHours)) {
      // Move to next available time after quiet hours end
      const nextDay = new Date(time);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(
        Number.parseInt(quietHours.end.split(":")[0]),
        Number.parseInt(quietHours.end.split(":")[1]),
        0,
        0
      );
      return nextDay;
    }

    return time;
  }

  /**
   * Check if time is within quiet hours
   */
  private isInQuietHours(
    time: string,
    quietHours: { start: string; end: string }
  ): boolean {
    const timeMinutes = this.timeToMinutes(time);
    const startMinutes = this.timeToMinutes(quietHours.start);
    const endMinutes = this.timeToMinutes(quietHours.end);

    if (startMinutes < endMinutes) {
      // Same day quiet hours (e.g., 10 PM to 6 AM next day)
      return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
    }
    // Overnight quiet hours (e.g., 10 PM to 8 AM)
    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  }

  /**
   * Convert HH:MM time string to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Get optimal notification times for the day
   */
  private getOptimalNotificationTimes(): Date[] {
    const today = new Date();
    const times = ["09:00", "14:00", "19:00"]; // Optimal times

    return times.map((time) => {
      const [hours, minutes] = time.split(":").map(Number);
      const date = new Date(today);
      date.setHours(hours, minutes, 0, 0);
      return date;
    });
  }

  /**
   * Find the best available time for a notification
   */
  private findBestAvailableTime(
    requestedTime: Date,
    optimalTimes: Date[]
  ): Date {
    // Find the next optimal time after the requested time
    const futureOptimalTimes = optimalTimes.filter(
      (time) => time > requestedTime
    );

    if (futureOptimalTimes.length > 0) {
      return futureOptimalTimes[0]; // Next optimal time today
    }
    // No more optimal times today, schedule for tomorrow morning
    const tomorrow = new Date(requestedTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow
    return tomorrow;
  }

  /**
   * Generate daily wellness check-in notifications
   */
  generateDailyWellnessCheckin(
    userId: string,
    userStats: UserStats
  ): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const t = i18n.t.bind(i18n); // Translation function

    // Morning check-in (9 AM)
    const morningCheckinTime = new Date();
    morningCheckinTime.setHours(9, 0, 0, 0);

    if (morningCheckinTime > new Date()) {
      // Only schedule future notifications
      notifications.push({
        id: `morning-checkin-${userId}-${Date.now()}`,
        title: "🌅 Good Morning Check-in",
        body: "How are you feeling this morning? Let's start the day with a quick health check.",
        type: "wellness_checkin",
        priority: "normal",
        scheduledTime: morningCheckinTime,
        data: {
          type: "morning_checkin",
          userId,
          checkinType: "morning",
        },
        quickActions: [
          { label: "😊 Feeling Great", action: "log_mood_good" },
          { label: "🤒 Have Symptoms", action: "log_symptoms" },
          { label: "💊 Check Meds", action: "check_medications" },
          { label: "🚨 Need Help", action: "emergency" },
        ],
      });
    }

    // Midday energy check (12 PM)
    const middayCheckinTime = new Date();
    middayCheckinTime.setHours(12, 0, 0, 0);

    if (middayCheckinTime > new Date()) {
      notifications.push({
        id: `midday-checkin-${userId}-${Date.now()}`,
        title: "☀️ Midday Energy Check",
        body: "How's your energy level halfway through the day? Take a moment to check in.",
        type: "wellness_checkin",
        priority: "low",
        scheduledTime: middayCheckinTime,
        data: {
          type: "midday_checkin",
          userId,
          checkinType: "midday",
        },
        quickActions: [
          { label: "⚡ High Energy", action: "log_energy_high" },
          { label: "😴 Feeling Tired", action: "log_energy_low" },
          { label: "🤒 Not Feeling Well", action: "log_symptoms" },
          { label: "💊 Take Meds", action: "check_medications" },
        ],
      });
    }

    // Afternoon wellness check (3 PM)
    const afternoonCheckinTime = new Date();
    afternoonCheckinTime.setHours(15, 0, 0, 0);

    if (afternoonCheckinTime > new Date()) {
      notifications.push({
        id: `afternoon-checkin-${userId}-${Date.now()}`,
        title: "🌤️ Afternoon Wellness Check",
        body: "How are you doing this afternoon? A quick check helps us track your health patterns.",
        type: "wellness_checkin",
        priority: "low",
        scheduledTime: afternoonCheckinTime,
        data: {
          type: "afternoon_checkin",
          userId,
          checkinType: "afternoon",
        },
        quickActions: [
          { label: "😊 All Good", action: "log_afternoon_good" },
          { label: "🤒 Symptoms", action: "log_symptoms" },
          { label: "💧 Drink Water", action: "log_hydration" },
          { label: "🧘‍♀️ Quick Break", action: "log_mindfulness" },
        ],
      });
    }

    // Evening reflection (8 PM)
    const eveningReflectionTime = new Date();
    eveningReflectionTime.setHours(20, 0, 0, 0);

    if (eveningReflectionTime > new Date()) {
      notifications.push({
        id: `evening-reflection-${userId}-${Date.now()}`,
        title: "🌙 Evening Reflection",
        body: "How was your day? Let's reflect on your health and prepare for tomorrow.",
        type: "wellness_checkin",
        priority: "low",
        scheduledTime: eveningReflectionTime,
        data: {
          type: "evening_reflection",
          userId,
          currentStreak: userStats.currentStreak,
        },
        quickActions: [
          { label: "😊 Great Day", action: "log_evening_good" },
          { label: "📝 Log Details", action: "log_evening_details" },
          { label: "💊 Meds Taken", action: "confirm_medications" },
          { label: "😴 Sleep Check", action: "log_sleep_quality" },
        ],
      });
    }

    // Bedtime preparation (10 PM)
    const bedtimeCheckinTime = new Date();
    bedtimeCheckinTime.setHours(22, 0, 0, 0);

    if (bedtimeCheckinTime > new Date()) {
      notifications.push({
        id: `bedtime-checkin-${userId}-${Date.now()}`,
        title: "😴 Bedtime Preparation",
        body: "Getting ready for bed? Let's make sure you're set up for a good night's rest.",
        type: "wellness_checkin",
        priority: "low",
        scheduledTime: bedtimeCheckinTime,
        data: {
          type: "bedtime_checkin",
          userId,
          checkinType: "bedtime",
        },
        quickActions: [
          { label: "💊 Night Meds", action: "confirm_night_medications" },
          { label: "📝 Tomorrow Prep", action: "prepare_tomorrow" },
          { label: "😌 Relax", action: "log_relaxation" },
          { label: "📱 Screen Off", action: "screen_time_reminder" },
        ],
      });
    }

    return notifications;
  }

  /**
   * Generate medication-specific check-in notifications
   */
  generateMedicationCheckins(
    medications: Medication[],
    userStats: UserStats
  ): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const t = i18n.t.bind(i18n);

    // Group medications by timing
    const morningMeds = medications.filter((med) =>
      med.reminders?.some((reminder) => {
        const hour = Number.parseInt(reminder.time.split(":")[0]);
        return hour >= 6 && hour < 12; // 6 AM to 12 PM
      })
    );
    const afternoonMeds = medications.filter((med) =>
      med.reminders?.some((reminder) => {
        const hour = Number.parseInt(reminder.time.split(":")[0]);
        return hour >= 12 && hour < 18; // 12 PM to 6 PM
      })
    );
    const eveningMeds = medications.filter((med) =>
      med.reminders?.some((reminder) => {
        const hour = Number.parseInt(reminder.time.split(":")[0]);
        return hour >= 18 && hour < 22; // 6 PM to 10 PM
      })
    );
    const nightMeds = medications.filter((med) =>
      med.reminders?.some((reminder) => {
        const hour = Number.parseInt(reminder.time.split(":")[0]);
        return hour >= 22 || hour < 6; // 10 PM to 6 AM
      })
    );

    // Morning medication check-in (8:30 AM)
    if (morningMeds.length > 0) {
      const morningMedTime = new Date();
      morningMedTime.setHours(8, 30, 0, 0);

      if (morningMedTime > new Date()) {
        notifications.push({
          id: `morning-med-checkin-${Date.now()}`,
          title: "🌅 Morning Medication Time",
          body: `Time for your morning medications. You have ${morningMeds.length} medication(s) scheduled.`,
          type: "medication",
          priority: "high",
          scheduledTime: morningMedTime,
          data: {
            type: "medication_checkin",
            timing: "morning",
            medications: morningMeds.map((m) => ({ id: m.id, name: m.name })),
          },
          quickActions: [
            { label: "✅ All Taken", action: "confirm_morning_meds" },
            { label: "⏰ Set Reminder", action: "remind_morning_meds" },
            { label: "📝 Log Details", action: "log_medication_taken" },
            { label: "🤒 Feeling Off", action: "report_medication_issue" },
          ],
        });
      }
    }

    // Afternoon medication check-in (2:30 PM)
    if (afternoonMeds.length > 0) {
      const afternoonMedTime = new Date();
      afternoonMedTime.setHours(14, 30, 0, 0);

      if (afternoonMedTime > new Date()) {
        notifications.push({
          id: `afternoon-med-checkin-${Date.now()}`,
          title: "☀️ Afternoon Medication Reminder",
          body: `Don't forget your afternoon medications! ${afternoonMeds.length} medication(s) waiting.`,
          type: "medication",
          priority: "high",
          scheduledTime: afternoonMedTime,
          data: {
            type: "medication_checkin",
            timing: "afternoon",
            medications: afternoonMeds.map((m) => ({ id: m.id, name: m.name })),
          },
          quickActions: [
            { label: "✅ Taken", action: "confirm_afternoon_meds" },
            { label: "⏰ 15 Min Reminder", action: "remind_afternoon_meds" },
            { label: "💊 Check Schedule", action: "view_medication_schedule" },
            { label: "🤒 Side Effects", action: "report_side_effects" },
          ],
        });
      }
    }

    // Evening medication check-in (6:30 PM)
    if (eveningMeds.length > 0) {
      const eveningMedTime = new Date();
      eveningMedTime.setHours(18, 30, 0, 0);

      if (eveningMedTime > new Date()) {
        notifications.push({
          id: `evening-med-checkin-${Date.now()}`,
          title: "🌆 Evening Medication Time",
          body: `Evening medication reminder: ${eveningMeds.length} medication(s) to take before dinner.`,
          type: "medication",
          priority: "high",
          scheduledTime: eveningMedTime,
          data: {
            type: "medication_checkin",
            timing: "evening",
            medications: eveningMeds.map((m) => ({ id: m.id, name: m.name })),
          },
          quickActions: [
            { label: "✅ All Done", action: "confirm_evening_meds" },
            { label: "🍽️ After Dinner", action: "remind_after_dinner" },
            { label: "📱 Set Alarm", action: "set_medication_alarm" },
            { label: "❓ Need Help", action: "medication_assistance" },
          ],
        });
      }
    }

    // Night medication check-in (9:30 PM)
    if (nightMeds.length > 0) {
      const nightMedTime = new Date();
      nightMedTime.setHours(21, 30, 0, 0);

      if (nightMedTime > new Date()) {
        notifications.push({
          id: `night-med-checkin-${Date.now()}`,
          title: "🌙 Night Medication Reminder",
          body: `Bedtime medications: ${nightMeds.length} medication(s) before sleep.`,
          type: "medication",
          priority: "high",
          scheduledTime: nightMedTime,
          data: {
            type: "medication_checkin",
            timing: "night",
            medications: nightMeds.map((m) => ({ id: m.id, name: m.name })),
          },
          quickActions: [
            { label: "✅ Night Meds Taken", action: "confirm_night_meds" },
            { label: "😴 Almost Sleep", action: "remind_before_bed" },
            { label: "📋 Check List", action: "view_night_medications" },
            { label: "💤 Skip Tonight", action: "skip_night_medication" },
          ],
        });
      }
    }

    // Weekly medication review (Sunday 10 AM)
    const today = new Date();
    if (today.getDay() === 0) {
      // Sunday
      const weeklyReviewTime = new Date();
      weeklyReviewTime.setHours(10, 0, 0, 0);

      if (weeklyReviewTime > new Date() && medications.length > 0) {
        notifications.push({
          id: `weekly-med-review-${Date.now()}`,
          title: "📅 Weekly Medication Review",
          body: "Time for your weekly medication check! Let's review your schedule and refill needs.",
          type: "medication",
          priority: "normal",
          scheduledTime: weeklyReviewTime,
          data: {
            type: "medication_review",
            totalMedications: medications.length,
          },
          quickActions: [
            {
              label: "📋 Review Schedule",
              action: "review_medication_schedule",
            },
            { label: "🛒 Check Refills", action: "check_refills_needed" },
            { label: "💊 Update Meds", action: "update_medications" },
            { label: "📞 Call Pharmacist", action: "contact_pharmacist" },
          ],
        });
      }
    }

    return notifications;
  }

  /**
   * Generate medication confirmation notifications that ask if user took their scheduled medication
   */
  generateMedicationConfirmationNotifications(
    medications: Medication[],
    userStats: UserStats
  ): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const t = i18n.t.bind(i18n);

    // Group medications by timing (similar to checkins but for confirmations)
    const morningMeds = medications.filter((med) =>
      med.reminders?.some(
        (reminder: MedicationReminder) =>
          reminder.time.includes("morning") ||
          reminder.time.includes("08") ||
          reminder.time.includes("09")
      )
    );
    const afternoonMeds = medications.filter((med) =>
      med.reminders?.some(
        (reminder: MedicationReminder) =>
          reminder.time.includes("afternoon") ||
          reminder.time.includes("14") ||
          reminder.time.includes("15")
      )
    );
    const eveningMeds = medications.filter((med) =>
      med.reminders?.some(
        (reminder: MedicationReminder) =>
          reminder.time.includes("evening") ||
          reminder.time.includes("18") ||
          reminder.time.includes("19") ||
          reminder.time.includes("20")
      )
    );
    const nightMeds = medications.filter((med) =>
      med.reminders?.some(
        (reminder: MedicationReminder) =>
          reminder.time.includes("night") ||
          reminder.time.includes("bedtime") ||
          reminder.time.includes("22") ||
          reminder.time.includes("23")
      )
    );

    const now = new Date();

    // Morning medication confirmation (30 minutes after scheduled time)
    if (morningMeds.length > 0) {
      const morningConfirmationTime = new Date();
      morningConfirmationTime.setHours(9, 0, 0, 0); // 30 minutes after 8:30

      if (
        morningConfirmationTime > now &&
        morningConfirmationTime.getTime() - now.getTime() < 24 * 60 * 60 * 1000
      ) {
        notifications.push({
          id: `morning-med-confirmation-${Date.now()}`,
          title: "💊 Did you take your morning medication?",
          body: `We noticed it's been a while since your morning medication time. Did you take your ${morningMeds.length} scheduled medication(s)?`,
          type: "medication_confirmation",
          priority: "normal",
          scheduledTime: morningConfirmationTime,
          data: {
            type: "medication_confirmation",
            timing: "morning",
            medications: morningMeds.map((m) => ({ id: m.id, name: m.name })),
            scheduledTime: new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              8,
              30,
              0,
              0
            ),
          },
          quickActions: [
            { label: "✅ Yes, I took it", action: "medication_taken_yes" },
            { label: "❌ No, I missed it", action: "medication_taken_no" },
            { label: "⏰ Remind me later", action: "remind_later" },
            { label: "📝 Log manually", action: "log_medication_manually" },
          ],
        });
      }
    }

    // Afternoon medication confirmation (30 minutes after scheduled time)
    if (afternoonMeds.length > 0) {
      const afternoonConfirmationTime = new Date();
      afternoonConfirmationTime.setHours(15, 0, 0, 0); // 30 minutes after 2:30

      if (
        afternoonConfirmationTime > now &&
        afternoonConfirmationTime.getTime() - now.getTime() <
          24 * 60 * 60 * 1000
      ) {
        notifications.push({
          id: `afternoon-med-confirmation-${Date.now()}`,
          title: "💊 Afternoon medication check-in",
          body: `Did you take your afternoon medication(s)? Keeping track helps us ensure you're staying on schedule.`,
          type: "medication_confirmation",
          priority: "normal",
          scheduledTime: afternoonConfirmationTime,
          data: {
            type: "medication_confirmation",
            timing: "afternoon",
            medications: afternoonMeds.map((m) => ({ id: m.id, name: m.name })),
            scheduledTime: new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              14,
              30,
              0,
              0
            ),
          },
          quickActions: [
            { label: "✅ Yes, taken", action: "medication_taken_yes" },
            { label: "❌ Not yet", action: "medication_taken_no" },
            { label: "⏰ 15 min reminder", action: "remind_15min" },
            { label: "📱 Set alarm", action: "set_medication_alarm" },
          ],
        });
      }
    }

    // Evening medication confirmation (30 minutes after scheduled time)
    if (eveningMeds.length > 0) {
      const eveningConfirmationTime = new Date();
      eveningConfirmationTime.setHours(19, 0, 0, 0); // 30 minutes after 6:30

      if (
        eveningConfirmationTime > now &&
        eveningConfirmationTime.getTime() - now.getTime() < 24 * 60 * 60 * 1000
      ) {
        notifications.push({
          id: `evening-med-confirmation-${Date.now()}`,
          title: "🌆 Evening medication reminder",
          body: `Have you taken your evening medication yet? Let's make sure you're all set for the night.`,
          type: "medication_confirmation",
          priority: "normal",
          scheduledTime: eveningConfirmationTime,
          data: {
            type: "medication_confirmation",
            timing: "evening",
            medications: eveningMeds.map((m) => ({ id: m.id, name: m.name })),
            scheduledTime: new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              18,
              30,
              0,
              0
            ),
          },
          quickActions: [
            { label: "✅ All done", action: "medication_taken_yes" },
            { label: "❌ Still need to take", action: "medication_taken_no" },
            { label: "🍽️ After dinner", action: "remind_after_dinner" },
            { label: "📋 Check schedule", action: "view_medication_schedule" },
          ],
        });
      }
    }

    // Night medication confirmation (30 minutes after scheduled time)
    if (nightMeds.length > 0) {
      const nightConfirmationTime = new Date();
      nightConfirmationTime.setHours(22, 0, 0, 0); // 30 minutes after 9:30

      if (
        nightConfirmationTime > now &&
        nightConfirmationTime.getTime() - now.getTime() < 24 * 60 * 60 * 1000
      ) {
        notifications.push({
          id: `night-med-confirmation-${Date.now()}`,
          title: "🌙 Bedtime medication check",
          body: "Time for your bedtime medication check-in. Did you take your night medication(s)?",
          type: "medication_confirmation",
          priority: "normal",
          scheduledTime: nightConfirmationTime,
          data: {
            type: "medication_confirmation",
            timing: "night",
            medications: nightMeds.map((m) => ({ id: m.id, name: m.name })),
            scheduledTime: new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              21,
              30,
              0,
              0
            ),
          },
          quickActions: [
            { label: "✅ Taken before bed", action: "medication_taken_yes" },
            { label: "❌ Not yet", action: "medication_taken_no" },
            { label: "😴 Almost sleep", action: "remind_before_bed" },
            { label: "💤 Skip tonight", action: "skip_night_medication" },
          ],
        });
      }
    }

    return notifications;
  }

  /**
   * Generate vital signs monitoring check-ins
   */
  generateVitalSignsCheckins(userStats: UserStats): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const t = i18n.t.bind(i18n);
    const vitals = userStats.lastVitalChecks || {};

    // Blood pressure check (for hypertension patients or weekly check)
    const lastBP = vitals.lastBloodPressure;
    const daysSinceBP = lastBP
      ? Math.floor(
          (new Date().getTime() - lastBP.getTime()) / (24 * 60 * 60 * 1000)
        )
      : 30;

    if (
      daysSinceBP >= 7 ||
      userStats.healthConditions?.includes("hypertension")
    ) {
      const bpCheckTime = new Date();
      bpCheckTime.setHours(10, 0, 0, 0); // 10 AM

      if (bpCheckTime > new Date()) {
        notifications.push({
          id: `bp-checkin-${Date.now()}`,
          title: "❤️ Blood Pressure Check",
          body:
            daysSinceBP >= 14
              ? "It's been over 2 weeks since your last blood pressure reading. Time for a check!"
              : "Weekly blood pressure monitoring helps track your cardiovascular health.",
          type: "reminder",
          priority: daysSinceBP >= 14 ? "high" : "normal",
          scheduledTime: bpCheckTime,
          data: {
            type: "vital_checkin",
            vitalType: "blood_pressure",
            daysSince: daysSinceBP,
          },
          quickActions: [
            { label: "📏 Check Now", action: "check_blood_pressure" },
            { label: "⏰ Remind Later", action: "remind_bp_check" },
            { label: "📊 View History", action: "view_bp_history" },
            { label: "👨‍⚕️ Consult Doctor", action: "schedule_bp_consult" },
          ],
        });
      }
    }

    // Weight monitoring (monthly for general wellness)
    const lastWeight = vitals.lastWeight;
    const daysSinceWeight = lastWeight
      ? Math.floor(
          (new Date().getTime() - lastWeight.getTime()) / (24 * 60 * 60 * 1000)
        )
      : 60;

    if (daysSinceWeight >= 30) {
      const weightCheckTime = new Date();
      weightCheckTime.setHours(8, 0, 0, 0); // 8 AM

      if (weightCheckTime > new Date()) {
        notifications.push({
          id: `weight-checkin-${Date.now()}`,
          title: "⚖️ Monthly Weight Check",
          body: "It's time for your monthly weight measurement. Regular monitoring helps track your health progress.",
          type: "reminder",
          priority: "low",
          scheduledTime: weightCheckTime,
          data: {
            type: "vital_checkin",
            vitalType: "weight",
            daysSince: daysSinceWeight,
          },
          quickActions: [
            { label: "⚖️ Weigh Now", action: "log_weight" },
            { label: "📅 Next Month", action: "skip_weight_check" },
            { label: "📈 View Trend", action: "view_weight_trend" },
            { label: "🎯 Set Goal", action: "set_weight_goal" },
          ],
        });
      }
    }

    // Temperature check (for elderly or when feeling unwell)
    if (userStats.userProfile?.age && userStats.userProfile.age > 65) {
      const lastTemp = vitals.lastTemperature;
      const daysSinceTemp = lastTemp
        ? Math.floor(
            (new Date().getTime() - lastTemp.getTime()) / (24 * 60 * 60 * 1000)
          )
        : 30;

      if (daysSinceTemp >= 7) {
        const tempCheckTime = new Date();
        tempCheckTime.setHours(9, 0, 0, 0); // 9 AM

        if (tempCheckTime > new Date()) {
          notifications.push({
            id: `temperature-checkin-${Date.now()}`,
            title: "🌡️ Temperature Check",
            body: "A quick temperature reading helps ensure you're staying healthy, especially as we age.",
            type: "reminder",
            priority: "low",
            scheduledTime: tempCheckTime,
            data: {
              type: "vital_checkin",
              vitalType: "temperature",
              daysSince: daysSinceTemp,
            },
            quickActions: [
              { label: "🌡️ Take Reading", action: "log_temperature" },
              { label: "😊 Feeling Normal", action: "temperature_normal" },
              { label: "🤒 Fever Concern", action: "report_fever" },
              { label: "📞 Call Doctor", action: "contact_doctor_temp" },
            ],
          });
        }
      }
    }

    // Blood sugar check (for diabetic patients)
    if (userStats.healthConditions?.includes("diabetes")) {
      const lastBloodSugar = vitals.lastBloodSugar;
      const daysSinceBloodSugar = lastBloodSugar
        ? Math.floor(
            (new Date().getTime() - lastBloodSugar.getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : 7;

      if (daysSinceBloodSugar >= 2) {
        const bloodSugarTime = new Date();
        bloodSugarTime.setHours(8, 0, 0, 0); // 8 AM

        if (bloodSugarTime > new Date()) {
          notifications.push({
            id: `blood-sugar-checkin-${Date.now()}`,
            title: "🩸 Blood Sugar Check",
            body: "Regular blood sugar monitoring is crucial for diabetes management. Time for your daily check!",
            type: "reminder",
            priority: daysSinceBloodSugar >= 7 ? "high" : "normal",
            scheduledTime: bloodSugarTime,
            data: {
              type: "vital_checkin",
              vitalType: "blood_sugar",
              daysSince: daysSinceBloodSugar,
            },
            quickActions: [
              { label: "🩸 Test Now", action: "log_blood_sugar" },
              { label: "⏰ Set Reminder", action: "remind_blood_sugar" },
              { label: "📊 View Levels", action: "view_blood_sugar_history" },
              { label: "🍎 After Meal", action: "log_post_meal_sugar" },
            ],
          });
        }
      }
    }

    return notifications;
  }

  /**
   * Generate hydration and nutrition check-in notifications
   */
  generateHydrationNutritionCheckins(
    userStats: UserStats
  ): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const t = i18n.t.bind(i18n);

    // Morning hydration reminder (9:30 AM)
    const morningHydrationTime = new Date();
    morningHydrationTime.setHours(9, 30, 0, 0);

    if (morningHydrationTime > new Date()) {
      notifications.push({
        id: `morning-hydration-${Date.now()}`,
        title: "💧 Start Your Day Hydrated",
        body: "Begin your morning right with a glass of water. Hydration is key to feeling your best!",
        type: "reminder",
        priority: "low",
        scheduledTime: morningHydrationTime,
        data: {
          type: "hydration_checkin",
          timing: "morning",
        },
        quickActions: [
          { label: "💧 Drank Water", action: "log_water_intake" },
          { label: "☕ Coffee First", action: "log_coffee_intake" },
          { label: "⏰ Set Reminder", action: "remind_hydration" },
          { label: "🥤 Water Goal", action: "set_hydration_goal" },
        ],
      });
    }

    // Mid-morning hydration break (11 AM)
    const midMorningHydrationTime = new Date();
    midMorningHydrationTime.setHours(11, 0, 0, 0);

    if (midMorningHydrationTime > new Date()) {
      notifications.push({
        id: `midmorning-hydration-${Date.now()}`,
        title: "💦 Hydration Break",
        body: "Take a moment for a refreshing drink. Staying hydrated boosts energy and focus!",
        type: "reminder",
        priority: "low",
        scheduledTime: midMorningHydrationTime,
        data: {
          type: "hydration_checkin",
          timing: "midmorning",
        },
        quickActions: [
          { label: "💧 Water Break", action: "log_water_break" },
          { label: "🧃 Fruit Juice", action: "log_healthy_drink" },
          { label: "🚫 Skip Today", action: "skip_hydration_reminder" },
          { label: "📊 Track Progress", action: "view_hydration_stats" },
        ],
      });
    }

    // Lunch nutrition reminder (12:30 PM)
    const lunchNutritionTime = new Date();
    lunchNutritionTime.setHours(12, 30, 0, 0);

    if (lunchNutritionTime > new Date()) {
      notifications.push({
        id: `lunch-nutrition-${Date.now()}`,
        title: "🍽️ Balanced Lunch Reminder",
        body: "Lunchtime! Aim for a balanced meal with proteins, veggies, and whole grains for sustained energy.",
        type: "reminder",
        priority: "low",
        scheduledTime: lunchNutritionTime,
        data: {
          type: "nutrition_checkin",
          mealType: "lunch",
        },
        quickActions: [
          { label: "🥗 Healthy Lunch", action: "log_healthy_lunch" },
          { label: "🍕 Quick Meal", action: "log_quick_meal" },
          { label: "📝 Plan Meal", action: "plan_nutrition" },
          { label: "🏃 Light Exercise", action: "post_meal_walk" },
        ],
      });
    }

    // Afternoon hydration reminder (3:30 PM)
    const afternoonHydrationTime = new Date();
    afternoonHydrationTime.setHours(15, 30, 0, 0);

    if (afternoonHydrationTime > new Date()) {
      notifications.push({
        id: `afternoon-hydration-${Date.now()}`,
        title: "💧 Afternoon Hydration",
        body: "Beat the afternoon slump with proper hydration. Your body and mind will thank you!",
        type: "reminder",
        priority: "low",
        scheduledTime: afternoonHydrationTime,
        data: {
          type: "hydration_checkin",
          timing: "afternoon",
        },
        quickActions: [
          { label: "💧 Hydrated", action: "log_afternoon_water" },
          { label: "🍵 Herbal Tea", action: "log_tea_intake" },
          { label: "⚡ Energy Boost", action: "log_energy_drink" },
          { label: "🎯 Daily Goal", action: "check_hydration_goal" },
        ],
      });
    }

    // Evening snack reminder (5 PM)
    const eveningSnackTime = new Date();
    eveningSnackTime.setHours(17, 0, 0, 0);

    if (eveningSnackTime > new Date()) {
      notifications.push({
        id: `evening-snack-${Date.now()}`,
        title: "🍎 Healthy Evening Snack",
        body: "A nutritious evening snack can help maintain energy levels until dinner and prevent overeating.",
        type: "reminder",
        priority: "low",
        scheduledTime: eveningSnackTime,
        data: {
          type: "nutrition_checkin",
          mealType: "snack",
        },
        quickActions: [
          { label: "🍎 Fruit/Veggies", action: "log_healthy_snack" },
          { label: "🥜 Nuts/Seeds", action: "log_protein_snack" },
          { label: "🍪 Treat Snack", action: "log_treat_snack" },
          { label: "⏭️ Dinner Soon", action: "skip_evening_snack" },
        ],
      });
    }

    // Dinner nutrition reminder (6:30 PM)
    const dinnerNutritionTime = new Date();
    dinnerNutritionTime.setHours(18, 30, 0, 0);

    if (dinnerNutritionTime > new Date()) {
      notifications.push({
        id: `dinner-nutrition-${Date.now()}`,
        title: "🍽️ Mindful Dinner Time",
        body: "Dinner time! Focus on nutrient-rich foods and mindful eating for better digestion and sleep.",
        type: "reminder",
        priority: "low",
        scheduledTime: dinnerNutritionTime,
        data: {
          type: "nutrition_checkin",
          mealType: "dinner",
        },
        quickActions: [
          { label: "🥗 Balanced Dinner", action: "log_balanced_dinner" },
          { label: "🍜 Light Meal", action: "log_light_dinner" },
          { label: "📝 Food Journal", action: "log_meal_details" },
          { label: "🏃 Evening Walk", action: "post_dinner_walk" },
        ],
      });
    }

    // Pre-bed hydration check (9 PM)
    const preBedHydrationTime = new Date();
    preBedHydrationTime.setHours(21, 0, 0, 0);

    if (preBedHydrationTime > new Date()) {
      notifications.push({
        id: `prebed-hydration-${Date.now()}`,
        title: "💧 Pre-Bed Hydration Check",
        body: "Stay hydrated but not too close to bedtime. One last drink if needed, then focus on rest.",
        type: "reminder",
        priority: "low",
        scheduledTime: preBedHydrationTime,
        data: {
          type: "hydration_checkin",
          timing: "prebed",
        },
        quickActions: [
          { label: "💧 Final Drink", action: "log_final_water" },
          { label: "😴 No More Water", action: "log_no_more_drinks" },
          { label: "📊 Daily Summary", action: "view_hydration_summary" },
          { label: "🎯 Tomorrow Goal", action: "set_tomorrow_hydration" },
        ],
      });
    }

    return notifications;
  }

  /**
   * Generate exercise and activity check-in notifications
   */
  generateExerciseActivityCheckins(userStats: UserStats): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const t = i18n.t.bind(i18n);

    // Morning movement reminder (8 AM)
    const morningExerciseTime = new Date();
    morningExerciseTime.setHours(8, 0, 0, 0);

    if (morningExerciseTime > new Date()) {
      notifications.push({
        id: `morning-movement-${Date.now()}`,
        title: "🌅 Start Your Day with Movement",
        body: "A little morning movement can boost your energy and set a positive tone for the day!",
        type: "reminder",
        priority: "low",
        scheduledTime: morningExerciseTime,
        data: {
          type: "exercise_checkin",
          timing: "morning",
        },
        quickActions: [
          { label: "🏃 Quick Walk", action: "log_morning_walk" },
          { label: "🧘 Stretch", action: "log_morning_stretch" },
          { label: "💪 Light Exercise", action: "log_morning_exercise" },
          { label: "😴 Rest Day", action: "skip_morning_movement" },
        ],
      });
    }

    // Midday activity break (1 PM)
    const middayActivityTime = new Date();
    middayActivityTime.setHours(13, 0, 0, 0);

    if (middayActivityTime > new Date()) {
      notifications.push({
        id: `midday-activity-${Date.now()}`,
        title: "🚶 Midday Movement Break",
        body: "Take a break from your screen and get moving! Even 5 minutes of activity can refresh your mind.",
        type: "reminder",
        priority: "low",
        scheduledTime: middayActivityTime,
        data: {
          type: "exercise_checkin",
          timing: "midday",
        },
        quickActions: [
          { label: "🚶 Short Walk", action: "log_short_walk" },
          { label: "🪑 Desk Stretches", action: "log_desk_stretches" },
          { label: "💃 Dance Break", action: "log_dance_break" },
          { label: "⏰ 5 Min Break", action: "quick_movement_break" },
        ],
      });
    }

    // Evening activity reminder (6 PM)
    const eveningActivityTime = new Date();
    eveningActivityTime.setHours(18, 0, 0, 0);

    if (eveningActivityTime > new Date()) {
      notifications.push({
        id: `evening-activity-${Date.now()}`,
        title: "🌆 Evening Activity Time",
        body: "Wind down your day with some gentle movement. A evening walk or stretch can improve sleep quality.",
        type: "reminder",
        priority: "low",
        scheduledTime: eveningActivityTime,
        data: {
          type: "exercise_checkin",
          timing: "evening",
        },
        quickActions: [
          { label: "🚶 Evening Walk", action: "log_evening_walk" },
          { label: "🧘 Gentle Yoga", action: "log_evening_yoga" },
          { label: "🏊 Light Swim", action: "log_swimming" },
          { label: "😌 Rest Instead", action: "choose_rest_evening" },
        ],
      });
    }

    // Weekly exercise goal check (Saturday 10 AM)
    const today = new Date();
    if (today.getDay() === 6) {
      // Saturday
      const weeklyExerciseTime = new Date();
      weeklyExerciseTime.setHours(10, 0, 0, 0);

      if (weeklyExerciseTime > new Date()) {
        notifications.push({
          id: `weekly-exercise-review-${Date.now()}`,
          title: "🎯 Weekly Movement Review",
          body: "How did your movement goals go this week? Let's celebrate progress and plan for next week!",
          type: "reminder",
          priority: "low",
          scheduledTime: weeklyExerciseTime,
          data: {
            type: "exercise_review",
            timing: "weekly",
          },
          quickActions: [
            { label: "✅ Goals Met", action: "log_exercise_success" },
            { label: "📈 Progress Made", action: "log_exercise_progress" },
            { label: "🎯 Set New Goals", action: "set_exercise_goals" },
            { label: "📊 View Stats", action: "view_exercise_stats" },
          ],
        });
      }
    }

    // Sedentary reminder (every 2 hours during work hours)
    const now = new Date();
    const hour = now.getHours();
    const isWorkHours = hour >= 9 && hour <= 17;

    if (isWorkHours && Math.random() < 0.3) {
      // 30% chance during work hours
      const sedentaryTime = new Date(
        now.getTime() + Math.random() * 2 * 60 * 60 * 1000
      ); // Random time in next 2 hours

      notifications.push({
        id: `sedentary-reminder-${Date.now()}`,
        title: "🪑 Time to Move!",
        body: "You've been sitting for a while. A quick stretch or walk can improve circulation and focus.",
        type: "reminder",
        priority: "low",
        scheduledTime: sedentaryTime,
        data: {
          type: "sedentary_reminder",
          timing: "random",
        },
        quickActions: [
          { label: "🚶 Stand & Stretch", action: "log_stand_stretch" },
          { label: "💃 Quick Dance", action: "log_quick_dance" },
          { label: "🏃 Lap Around", action: "log_quick_walk" },
          { label: "⏰ Remind Later", action: "snooze_sedentary" },
        ],
      });
    }

    // Post-meal movement reminders (after lunch and dinner)
    const postLunchTime = new Date();
    postLunchTime.setHours(13, 30, 0, 0); // 1:30 PM

    if (postLunchTime > new Date()) {
      notifications.push({
        id: `post-lunch-walk-${Date.now()}`,
        title: "🚶 Post-Lunch Movement",
        body: "A short walk after lunch can aid digestion and boost afternoon energy levels.",
        type: "reminder",
        priority: "low",
        scheduledTime: postLunchTime,
        data: {
          type: "post_meal_movement",
          meal: "lunch",
        },
        quickActions: [
          { label: "🚶 10-Min Walk", action: "log_post_lunch_walk" },
          { label: "🧘 Light Stretch", action: "log_post_meal_stretch" },
          { label: "💺 Stay Seated", action: "skip_post_meal_movement" },
          { label: "⏰ 15 Min Later", action: "remind_post_meal_later" },
        ],
      });
    }

    return notifications;
  }

  /**
   * Generate context-aware notifications based on weather, time, and location
   */
  generateContextAwareNotifications(
    context: NotificationContext,
    userStats: UserStats
  ): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const t = i18n.t.bind(i18n);

    // Weather-based notifications
    if (context.weather) {
      const { condition, temperature } = context.weather;

      // Hot weather hydration reminder
      if (temperature > 28) {
        // Above 28°C/82°F
        const heatTime = new Date();
        heatTime.setHours(11, 0, 0, 0); // 11 AM

        if (heatTime > new Date()) {
          notifications.push({
            id: `heat-hydration-${Date.now()}`,
            title: "☀️ Stay Hydrated in the Heat",
            body: `It's ${Math.round(temperature)}°C outside! Extra hydration is crucial in hot weather.`,
            type: "reminder",
            priority: "normal",
            scheduledTime: heatTime,
            data: {
              type: "weather_advice",
              weatherType: "heat",
              temperature,
            },
            quickActions: [
              { label: "💧 Drink Water", action: "log_heat_hydration" },
              { label: "🧊 Cold Drink", action: "log_cold_drink" },
              { label: "🏠 Stay Cool", action: "log_heat_precautions" },
              { label: "⚠️ Heat Alert", action: "report_heat_concern" },
            ],
          });
        }
      }

      // Rainy weather indoor activity suggestion
      if (
        condition.toLowerCase().includes("rain") ||
        condition.toLowerCase().includes("storm")
      ) {
        const rainTime = new Date();
        rainTime.setHours(16, 0, 0, 0); // 4 PM

        if (rainTime > new Date()) {
          notifications.push({
            id: `rainy-activity-${Date.now()}`,
            title: "🌧️ Rainy Day Activities",
            body: "Rainy weather outside! Consider indoor activities that keep you moving and healthy.",
            type: "reminder",
            priority: "low",
            scheduledTime: rainTime,
            data: {
              type: "weather_advice",
              weatherType: "rain",
              condition,
            },
            quickActions: [
              { label: "🏠 Indoor Walk", action: "log_indoor_walk" },
              { label: "🧘 Home Yoga", action: "log_home_yoga" },
              { label: "💃 Dance Party", action: "log_dance_party" },
              { label: "📺 Active Rest", action: "choose_rest_indoor" },
            ],
          });
        }
      }

      // Cold weather warmth reminder
      if (temperature < 5) {
        // Below 5°C/41°F
        const coldTime = new Date();
        coldTime.setHours(7, 30, 0, 0); // 7:30 AM

        if (coldTime > new Date()) {
          notifications.push({
            id: `cold-weather-${Date.now()}`,
            title: "❄️ Cold Weather Health Tips",
            body: `It's chilly at ${Math.round(temperature)}°C! Stay warm and protect your health in cold weather.`,
            type: "reminder",
            priority: "normal",
            scheduledTime: coldTime,
            data: {
              type: "weather_advice",
              weatherType: "cold",
              temperature,
            },
            quickActions: [
              { label: "🧥 Dress Warm", action: "log_warm_clothing" },
              { label: "☕ Warm Drink", action: "log_warm_drink" },
              { label: "🏠 Stay Indoors", action: "log_cold_precautions" },
              { label: "🤒 Cold Symptoms", action: "report_cold_symptoms" },
            ],
          });
        }
      }
    }

    // Time-of-day specific notifications
    const hour = new Date().getHours();

    // Late night wellness check
    if (hour >= 22 || hour <= 2) {
      const lateNightTime = new Date();
      lateNightTime.setHours(23, 0, 0, 0); // 11 PM

      if (lateNightTime > new Date()) {
        notifications.push({
          id: `late-night-wellness-${Date.now()}`,
          title: "🌙 Late Night Wellness",
          body: "It's getting late. Make sure you're set up for a good night's rest and tomorrow's health.",
          type: "reminder",
          priority: "low",
          scheduledTime: lateNightTime,
          data: {
            type: "time_context",
            timeContext: "late_night",
          },
          quickActions: [
            { label: "💊 Night Meds", action: "confirm_night_medications" },
            { label: "😴 Sleep Prep", action: "log_sleep_prep" },
            { label: "📱 Screen Off", action: "log_screen_time" },
            { label: "🧘 Wind Down", action: "log_wind_down" },
          ],
        });
      }
    }

    // Weekend wellness boost
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Weekend
      const weekendTime = new Date();
      weekendTime.setHours(10, 0, 0, 0); // 10 AM

      if (weekendTime > new Date()) {
        notifications.push({
          id: `weekend-wellness-${Date.now()}`,
          title: "🎉 Weekend Wellness Boost",
          body: "It's the weekend! Use this time to focus on your health and recharge for the week ahead.",
          type: "reminder",
          priority: "low",
          scheduledTime: weekendTime,
          data: {
            type: "time_context",
            timeContext: "weekend",
          },
          quickActions: [
            { label: "🚶 Long Walk", action: "log_weekend_walk" },
            { label: "🥗 Healthy Meal", action: "log_weekend_meal" },
            { label: "😴 Extra Rest", action: "log_weekend_rest" },
            { label: "📝 Health Review", action: "review_weekend_health" },
          ],
        });
      }
    }

    // Work/school day energy check
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 8 && hour <= 18) {
      // Weekday work hours
      const workDayTime = new Date();
      workDayTime.setHours(14, 0, 0, 0); // 2 PM

      if (workDayTime > new Date()) {
        notifications.push({
          id: `workday-energy-${Date.now()}`,
          title: "⚡ Afternoon Energy Check",
          body: "How's your energy holding up today? Take a moment to assess and recharge if needed.",
          type: "reminder",
          priority: "low",
          scheduledTime: workDayTime,
          data: {
            type: "time_context",
            timeContext: "workday_afternoon",
          },
          quickActions: [
            { label: "⚡ High Energy", action: "log_work_energy_high" },
            { label: "😴 Need Boost", action: "log_work_energy_low" },
            { label: "💧 Water Break", action: "log_work_hydration" },
            { label: "🚶 Quick Walk", action: "log_work_walk" },
          ],
        });
      }
    }

    // Seasonal health reminders (simplified - could be expanded)
    const month = new Date().getMonth();
    if (month >= 11 || month <= 2) {
      // Winter months
      const winterTime = new Date();
      winterTime.setHours(9, 0, 0, 0); // 9 AM

      if (winterTime > new Date()) {
        notifications.push({
          id: `winter-health-${Date.now()}`,
          title: "❄️ Winter Wellness Check",
          body: "Winter can affect our health. Stay warm, hydrated, and maintain your wellness routines.",
          type: "reminder",
          priority: "low",
          scheduledTime: winterTime,
          data: {
            type: "seasonal_context",
            season: "winter",
          },
          quickActions: [
            { label: "🧥 Warm Layers", action: "log_winter_clothing" },
            { label: "💧 Indoor Humidity", action: "log_indoor_humidity" },
            { label: "🛏️ Sleep Check", action: "log_winter_sleep" },
            { label: "🍊 Vitamin Boost", action: "log_vitamin_intake" },
          ],
        });
      }
    }

    return notifications;
  }

  /**
   * Generate sleep quality check-in notifications
   */
  generateSleepCheckins(userStats: UserStats): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const t = i18n.t.bind(i18n);

    // Pre-bedtime wind-down reminder (9 PM)
    const windDownTime = new Date();
    windDownTime.setHours(21, 0, 0, 0);

    if (windDownTime > new Date()) {
      notifications.push({
        id: `bedtime-winddown-${Date.now()}`,
        title: "😌 Wind Down Time",
        body: "Start your bedtime routine. Quality sleep starts with proper preparation.",
        type: "reminder",
        priority: "low",
        scheduledTime: windDownTime,
        data: {
          type: "sleep_checkin",
          phase: "wind_down",
        },
        quickActions: [
          { label: "📱 Screen Off", action: "log_screen_off" },
          { label: "🧘 Relaxation", action: "log_relaxation_technique" },
          { label: "📖 Reading", action: "log_bedtime_reading" },
          { label: "🛁 Bath Time", action: "log_bath_routine" },
        ],
      });
    }

    // Sleep quality reflection (next morning 8 AM)
    const sleepReflectionTime = new Date();
    sleepReflectionTime.setDate(sleepReflectionTime.getDate() + 1); // Tomorrow
    sleepReflectionTime.setHours(8, 0, 0, 0);

    if (sleepReflectionTime > new Date()) {
      notifications.push({
        id: `sleep-reflection-${Date.now()}`,
        title: "🌅 How Did You Sleep?",
        body: "Take a moment to reflect on last night's sleep. Quality rest is essential for health.",
        type: "reminder",
        priority: "low",
        scheduledTime: sleepReflectionTime,
        data: {
          type: "sleep_checkin",
          phase: "reflection",
        },
        quickActions: [
          { label: "😴 Great Sleep", action: "log_sleep_great" },
          { label: "😐 Okay Sleep", action: "log_sleep_okay" },
          { label: "😪 Poor Sleep", action: "log_sleep_poor" },
          { label: "📊 Sleep Tracker", action: "view_sleep_patterns" },
        ],
      });
    }

    // Sleep schedule reminder (10 PM)
    const sleepScheduleTime = new Date();
    sleepScheduleTime.setHours(22, 0, 0, 0);

    if (sleepScheduleTime > new Date()) {
      notifications.push({
        id: `sleep-schedule-${Date.now()}`,
        title: "⏰ Consistent Sleep Schedule",
        body: "Maintaining consistent sleep times helps regulate your body's natural rhythms.",
        type: "reminder",
        priority: "low",
        scheduledTime: sleepScheduleTime,
        data: {
          type: "sleep_checkin",
          phase: "schedule",
        },
        quickActions: [
          { label: "💤 Ready for Bed", action: "log_bedtime_ready" },
          { label: "⏰ Set Alarm", action: "set_wake_alarm" },
          { label: "📝 Sleep Goals", action: "set_sleep_goals" },
          { label: "📊 Track Sleep", action: "view_sleep_stats" },
        ],
      });
    }

    // Mid-week sleep check (Wednesday 9 PM)
    const today = new Date();
    if (today.getDay() === 3) {
      // Wednesday
      const midWeekSleepTime = new Date();
      midWeekSleepTime.setHours(21, 30, 0, 0);

      if (midWeekSleepTime > new Date()) {
        notifications.push({
          id: `midweek-sleep-check-${Date.now()}`,
          title: "📊 Mid-Week Sleep Review",
          body: "How has your sleep been this week? Consistent rest patterns support better health outcomes.",
          type: "reminder",
          priority: "low",
          scheduledTime: midWeekSleepTime,
          data: {
            type: "sleep_checkin",
            phase: "weekly_review",
          },
          quickActions: [
            { label: "✅ Sleep On Track", action: "log_sleep_on_track" },
            { label: "🔄 Needs Adjustment", action: "log_sleep_needs_work" },
            { label: "📈 View Trends", action: "view_sleep_trends" },
            { label: "🎯 Set Goals", action: "set_sleep_improvements" },
          ],
        });
      }
    }

    // Caffeine cutoff reminder (2 PM)
    const caffeineCutoffTime = new Date();
    caffeineCutoffTime.setHours(14, 0, 0, 0);

    if (caffeineCutoffTime > new Date()) {
      notifications.push({
        id: `caffeine-cutoff-${Date.now()}`,
        title: "☕ Caffeine Cutoff Time",
        body: "For better sleep quality, consider stopping caffeine intake in the early afternoon.",
        type: "reminder",
        priority: "low",
        scheduledTime: caffeineCutoffTime,
        data: {
          type: "sleep_checkin",
          phase: "caffeine_cutoff",
        },
        quickActions: [
          { label: "✅ No More Caffeine", action: "log_caffeine_cutoff" },
          { label: "☕ Last Cup", action: "log_final_caffeine" },
          { label: "💧 Water Instead", action: "log_water_instead" },
          { label: "⏰ Different Time", action: "adjust_caffeine_time" },
        ],
      });
    }

    return notifications;
  }

  /**
   * Generate streak maintenance reminders
   */
  generateStreakReminders(userStats: UserStats): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const t = i18n.t.bind(i18n); // Translation function

    // Streak celebration for 3+ days
    if (userStats.currentStreak >= 3 && userStats.currentStreak % 3 === 0) {
      notifications.push({
        id: `streak-celebration-${Date.now()}`,
        title: t("streakCelebrationTitle", { streak: userStats.currentStreak }),
        body: t("streakCelebrationBody", { streak: userStats.currentStreak }),
        type: "streak_reminder",
        priority: "low",
        scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        data: {
          type: "streak_celebration",
          streak: userStats.currentStreak,
        },
      });
    }

    // Streak at risk warning (1 day without activity)
    if (userStats.daysSinceLastActivity === 1) {
      notifications.push({
        id: `streak-risk-${Date.now()}`,
        title: t("streakRiskTitle"),
        body: t("streakRiskBody", { streak: userStats.currentStreak }),
        type: "streak_reminder",
        priority: "normal",
        scheduledTime: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
        data: {
          type: "streak_risk",
          currentStreak: userStats.currentStreak,
          daysSinceActivity: userStats.daysSinceLastActivity,
        },
        quickActions: [
          { label: t("quickActionQuickLog"), action: "quick_log" },
          { label: t("quickActionCheckMeds"), action: "check_medications" },
          { label: t("quickActionRemindLater"), action: "remind_later" },
        ],
      });
    }

    // Streak recovery encouragement (2+ days without activity)
    if (userStats.daysSinceLastActivity >= 2 && userStats.currentStreak >= 5) {
      notifications.push({
        id: `streak-recovery-${Date.now()}`,
        title: t("streakRecoveryTitle"),
        body: t("streakRecoveryBody", {
          days: userStats.daysSinceLastActivity,
          longest: userStats.longestStreak,
        }),
        type: "streak_reminder",
        priority: "normal",
        scheduledTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        data: {
          type: "streak_recovery",
          daysSinceActivity: userStats.daysSinceLastActivity,
          longestStreak: userStats.longestStreak,
        },
      });
    }

    return notifications;
  }

  /**
   * Generate missed activity alerts
   */
  generateMissedActivityAlerts(userStats: UserStats): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const t = i18n.t.bind(i18n); // Translation function

    // No symptoms logged in 2 days
    if (userStats.daysSinceLastSymptom >= 2) {
      notifications.push({
        id: `missed-symptoms-${Date.now()}`,
        title: t("missedSymptomsTitle"),
        body: t("missedSymptomsBody", { days: userStats.daysSinceLastSymptom }),
        type: "activity_alert",
        priority: "normal",
        scheduledTime: new Date(),
        data: {
          type: "missed_symptoms",
          daysSince: userStats.daysSinceLastSymptom,
        },
        quickActions: [
          { label: t("quickActionHaveSymptoms"), action: "log_symptoms" },
          { label: t("quickActionFeelingGreat"), action: "log_no_symptoms" },
          { label: t("quickActionTomorrow"), action: "remind_tomorrow" },
        ],
      });
    }

    // Medication compliance dip
    if (
      userStats.recentCompliance < 80 &&
      userStats.daysSinceLastMedicationLog >= 1
    ) {
      notifications.push({
        id: `medication-compliance-${Date.now()}`,
        title: t("medicationComplianceTitle"),
        body: t("medicationComplianceBody", {
          compliance: Math.round(userStats.recentCompliance),
        }),
        type: "activity_alert",
        priority: "high",
        scheduledTime: new Date(),
        data: {
          type: "compliance_alert",
          complianceRate: userStats.recentCompliance,
          daysSinceLog: userStats.daysSinceLastMedicationLog,
        },
        quickActions: [
          {
            label: t("quickActionConfirmMedication"),
            action: "confirm_medication",
          },
          { label: t("quickActionUpdateStatus"), action: "update_medications" },
          {
            label: t("quickActionContactCaregiver"),
            action: "contact_caregiver",
          },
        ],
      });
    }

    // Weekly health summary reminder (if no activity in 7 days)
    if (userStats.daysSinceLastActivity >= 7) {
      notifications.push({
        id: `weekly-summary-${Date.now()}`,
        title: t("weeklySummaryTitle"),
        body: t("weeklySummaryBody"),
        type: "activity_alert",
        priority: "normal",
        scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        data: {
          type: "weekly_summary",
          daysSinceActivity: userStats.daysSinceLastActivity,
        },
      });
    }

    return notifications;
  }

  /**
   * Generate achievement celebration notifications
   */
  generateAchievementNotifications(
    achievements: Achievement[]
  ): SmartNotification[] {
    const t = i18n.t.bind(i18n); // Translation function

    return achievements
      .filter((achievement) => {
        // Only show achievements unlocked in the last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return achievement.unlockedAt > oneDayAgo;
      })
      .map((achievement) => ({
        id: `achievement-${achievement.id}-${Date.now()}`,
        title: t("achievementUnlockedTitle", {
          title: `🏆 ${achievement.title}`,
        }),
        body: t("achievementUnlockedBody", {
          description: achievement.description,
        }),
        type: "achievement",
        priority: "low",
        scheduledTime: new Date(),
        data: {
          type: "achievement_unlocked",
          achievementId: achievement.id,
          achievementType: achievement.type,
        },
      }));
  }

  /**
   * Generate daily interactive notifications for a user
   */
  async generateDailyInteractiveNotifications(
    userId: string
  ): Promise<SmartNotification[]> {
    const notifications: SmartNotification[] = [];

    try {
      // Get user stats (you'll need to implement this service method)
      const userStats = await this.getUserStats(userId);

      // Generate all notification types
      notifications.push(
        ...this.generateDailyWellnessCheckin(userId, userStats)
      );
      notifications.push(...this.generateStreakReminders(userStats));
      notifications.push(...this.generateMissedActivityAlerts(userStats));
      notifications.push(
        ...this.generateAchievementNotifications(userStats.achievements)
      );

      // Limit to prevent notification overload (max 5 per day)
      return notifications.slice(0, 5);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get user stats for notification generation
   */
  private async getUserStats(userId: string): Promise<UserStats> {
    try {
      // Calculate real user statistics
      const [symptoms, medications, moodEntries, userProfile, vitalSigns] =
        await Promise.all([
          this.getUserSymptoms(userId),
          this.getUserMedications(userId),
          this.getUserMoods(userId),
          this.getUserProfile(userId),
          this.getUserVitalSigns(userId),
        ]);

      // Calculate streaks and activity metrics
      const stats = this.calculateUserStats(symptoms, medications, moodEntries);

      // Calculate vital check history
      const lastVitalChecks = this.calculateVitalCheckHistory(vitalSigns);

      // Check for new achievements
      const achievements = this.checkForAchievements(stats);

      return {
        ...stats,
        userProfile,
        lastVitalChecks,
        achievements,
      };
    } catch (error) {
      // Return default stats for new users (0 days inactive, no activity yet)
      return {
        currentStreak: 0,
        longestStreak: 0,
        daysSinceLastActivity: 0, // New users have no activity yet
        daysSinceLastSymptom: 0, // New users have no symptoms logged yet
        daysSinceLastMedicationLog: 0, // New users have no medication logs yet
        recentCompliance: 100,
        achievements: [],
      };
    }
  }

  /**
   * Calculate comprehensive user statistics
   */
  private calculateUserStats(
    symptoms: any[],
    medications: Medication[],
    moodEntries: any[]
  ): Omit<UserStats, "achievements"> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Calculate days since last activity (symptoms, moods, or medication logs)
    const lastSymptomDate =
      symptoms.length > 0
        ? new Date(
            Math.max(...symptoms.map((s) => new Date(s.timestamp).getTime()))
          )
        : new Date(0);

    const lastMoodDate =
      moodEntries.length > 0
        ? new Date(
            Math.max(...moodEntries.map((m) => new Date(m.timestamp).getTime()))
          )
        : new Date(0);

    const lastActivityDate = new Date(
      Math.max(
        lastSymptomDate.getTime(),
        lastMoodDate.getTime(),
        // Assume medication logs are tracked separately
        oneWeekAgo.getTime() // Placeholder - you'll need actual medication log dates
      )
    );

    const daysSinceLastActivity = Math.floor(
      (now.getTime() - lastActivityDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Calculate medication compliance (last 7 days)
    const recentMedications = medications.filter((med) => {
      const startDate = new Date(med.startDate);
      return startDate >= oneWeekAgo && startDate <= now;
    });

    const medicationCompliance =
      recentMedications.length > 0
        ? (recentMedications.filter((med) => med.isActive).length /
            recentMedications.length) *
          100
        : 100;

    // Calculate streaks (simplified - consecutive days with activity)
    const activityDates = new Set([
      ...symptoms.map((s) => new Date(s.timestamp).toDateString()),
      ...moodEntries.map((m) => new Date(m.timestamp).toDateString()),
    ]);

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    // Check last 30 days for streaks
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() - i);
      const dateString = checkDate.toDateString();

      if (activityDates.has(dateString)) {
        tempStreak++;
        if (i === 0) currentStreak = tempStreak; // Current streak if today has activity
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 0;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return {
      currentStreak: Math.max(currentStreak, tempStreak),
      longestStreak,
      daysSinceLastActivity,
      daysSinceLastSymptom:
        symptoms.length > 0
          ? Math.floor(
              (now.getTime() - lastSymptomDate.getTime()) /
                (24 * 60 * 60 * 1000)
            )
          : 0, // New users have no symptoms logged yet
      daysSinceLastMedicationLog: 0, // New users have no medication logs yet
      recentCompliance: medicationCompliance,
    };
  }

  /**
   * Check for newly unlocked achievements
   */
  private checkForAchievements(
    stats: Omit<UserStats, "achievements">
  ): Achievement[] {
    const achievements: Achievement[] = [];

    // Streak achievements
    if (stats.currentStreak >= 7 && stats.currentStreak < 14) {
      achievements.push({
        id: `streak-7-${Date.now()}`,
        title: "Week Warrior",
        description: "Maintained a 7-day health tracking streak!",
        type: "streak",
        unlockedAt: new Date(),
      });
    } else if (stats.currentStreak >= 30) {
      achievements.push({
        id: `streak-30-${Date.now()}`,
        title: "Monthly Champion",
        description: "30 consecutive days of health tracking excellence!",
        type: "streak",
        unlockedAt: new Date(),
      });
    }

    // Consistency achievements
    if (stats.recentCompliance >= 95) {
      achievements.push({
        id: `compliance-95-${Date.now()}`,
        title: "Medication Master",
        description: "95% or higher medication compliance this week!",
        type: "compliance",
        unlockedAt: new Date(),
      });
    }

    // Recovery achievements
    if (stats.daysSinceLastActivity <= 1 && stats.daysSinceLastSymptom > 7) {
      achievements.push({
        id: `recovery-${Date.now()}`,
        title: "Health Hero",
        description: "Returned to consistent health tracking!",
        type: "consistency",
        unlockedAt: new Date(),
      });
    }

    return achievements;
  }

  /**
   * Calculate vital check history
   */
  private calculateVitalCheckHistory(vitalSigns: any[]): VitalCheckHistory {
    const history: VitalCheckHistory = {};

    if (vitalSigns.length === 0) return history;

    // Group by vital type and find most recent
    const vitalGroups = vitalSigns.reduce(
      (acc, vital) => {
        if (!acc[vital.type]) acc[vital.type] = [];
        acc[vital.type].push(vital);
        return acc;
      },
      {} as Record<string, any[]>
    );

    // Find latest date for each vital type
    Object.keys(vitalGroups).forEach((vitalType) => {
      const vitals = vitalGroups[vitalType];
      const latestVital = vitals.sort(
        (a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];

      switch (vitalType) {
        case "bloodPressure":
          history.lastBloodPressure = new Date(latestVital.timestamp);
          break;
        case "heartRate":
          history.lastHeartRate = new Date(latestVital.timestamp);
          break;
        case "temperature":
          history.lastTemperature = new Date(latestVital.timestamp);
          break;
        case "weight":
          history.lastWeight = new Date(latestVital.timestamp);
          break;
        case "bloodSugar":
          history.lastBloodSugar = new Date(latestVital.timestamp);
          break;
        case "respiratoryRate":
          history.lastRespiratoryRate = new Date(latestVital.timestamp);
          break;
      }
    });

    return history;
  }

  /**
   * Get user profile information
   */
  private async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      // Try to get from user service first
      const { userService } = await import("./userService");
      const user = await userService.getUser(userId);

      if (user) {
        return {
          conditions: [], // We'll need to add this to user profile
          age: this.calculateAge(user.createdAt), // Rough estimate
          medications: [], // We'll need to add this
          allergies: [], // We'll need to add this
          mentalHealth: [], // We'll need to add this
        };
      }
    } catch (error) {}

    return {
      conditions: [],
      age: 0,
      medications: [],
      allergies: [],
      mentalHealth: [],
    };
  }

  /**
   * Calculate approximate age from account creation
   */
  private calculateAge(createdAt: Date): number {
    const now = new Date();
    const accountAge = now.getTime() - createdAt.getTime();
    // Rough estimate: assume adults create accounts
    return Math.max(
      25,
      Math.floor(accountAge / (365.25 * 24 * 60 * 60 * 1000))
    );
  }

  /**
   * Get user vital signs
   * Note: This would need to be implemented to fetch historical vital signs from your database
   * For now, returning empty array as this requires database integration
   */
  private async getUserVitalSigns(userId: string): Promise<any[]> {
    try {
      // TODO: Implement method to get historical vital signs from database
      // This would query your vitals collection for the user's historical data
      // For now, return empty array to avoid errors
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Get user role
   */
  private async getUserRole(userId: string): Promise<string> {
    try {
      const { userService } = await import("./userService");
      const user = await userService.getUser(userId);
      return user?.role || "member";
    } catch {
      return "member";
    }
  }

  /**
   * Get family members for a user
   */
  private async getFamilyMembers(userId: string): Promise<any[]> {
    try {
      // This would need to be implemented based on your family service
      // For now, return mock data
      return [
        {
          id: "member1",
          name: "Family Member 1",
          healthScore: 85,
          alertsCount: 0,
          lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
        {
          id: "member2",
          name: "Family Member 2",
          healthScore: 72,
          alertsCount: 1,
          lastActivity: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        },
      ];
    } catch {
      return [];
    }
  }

  /**
   * Calculate family health statistics
   */
  private async calculateFamilyHealthStats(familyMembers: any[]): Promise<{
    membersNeedingAttention: number;
    criticalAlerts: number;
    upcomingMedications: number;
    achievements: any[];
  }> {
    let membersNeedingAttention = 0;
    let criticalAlerts = 0;
    let upcomingMedications = 0;
    const achievements: any[] = [];

    familyMembers.forEach((member) => {
      // Count members needing attention (low health score or recent alerts)
      if (member.healthScore < 75 || member.alertsCount > 0) {
        membersNeedingAttention++;
      }

      // Count critical alerts
      if (member.alertsCount > 0) {
        criticalAlerts += member.alertsCount;
      }

      // Check for achievements (simplified)
      if (member.healthScore >= 90) {
        achievements.push({
          memberId: member.id,
          memberName: member.name,
          title: "Health Champion",
          type: "achievement",
        });
      }
    });

    // Simulate upcoming medications (would need real data)
    upcomingMedications = Math.floor(Math.random() * 3); // 0-2 for demo

    return {
      membersNeedingAttention,
      criticalAlerts,
      upcomingMedications,
      achievements,
    };
  }

  /**
   * Get caregiver coordination needs
   */
  private async getCaregiverCoordinationNeeds(userId: string): Promise<{
    emergencyContacts: number;
    careHandoffNeeded: boolean;
    nextHandoffTime?: Date;
    upcomingAppointments: number;
  }> {
    try {
      // This would need to be implemented based on your alert and scheduling services
      // For now, return mock data
      const now = new Date();
      const nextHandoffTime = new Date(now);
      nextHandoffTime.setHours(18, 0, 0, 0); // 6 PM today

      return {
        emergencyContacts: 0, // No emergencies currently
        careHandoffNeeded: now.getHours() >= 17, // After 5 PM
        nextHandoffTime,
        upcomingAppointments: Math.floor(Math.random() * 2), // 0-1 for demo
      };
    } catch {
      return {
        emergencyContacts: 0,
        careHandoffNeeded: false,
        upcomingAppointments: 0,
      };
    }
  }

  /**
   * Helper methods to get user data (implement based on your existing services)
   */
  private async getUserSymptoms(userId: string): Promise<any[]> {
    try {
      // Use your existing symptom service
      const { symptomService } = await import("./symptomService");
      return await symptomService.getUserSymptoms(userId, 30); // Last 30 days
    } catch {
      return [];
    }
  }

  private async getUserMedications(userId: string): Promise<Medication[]> {
    try {
      // Use your existing medication service
      const { medicationService } = await import("./medicationService");
      return await medicationService.getUserMedications(userId);
    } catch {
      return [];
    }
  }

  private async getUserMoods(userId: string): Promise<any[]> {
    try {
      // Use your existing mood service
      const { moodService } = await import("./moodService");
      return await moodService.getUserMoods(userId, 30); // Last 30 days
    } catch {
      return [];
    }
  }

  /**
   * Generate condition-specific health reminders
   */
  generateConditionSpecificReminders(
    userStats: UserStats
  ): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const t = i18n.t.bind(i18n);

    if (!(userStats.healthConditions && userStats.lastVitalChecks)) {
      return notifications;
    }

    const conditions = userStats.healthConditions;
    const vitals = userStats.lastVitalChecks;

    // Diabetes management
    if (conditions.includes("diabetes")) {
      const lastBloodSugarCheck = vitals.lastBloodSugar;
      const daysSinceBloodSugar = lastBloodSugarCheck
        ? Math.floor(
            (new Date().getTime() - lastBloodSugarCheck.getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : 30;

      if (daysSinceBloodSugar >= 2) {
        notifications.push({
          id: `diabetes-blood-sugar-${Date.now()}`,
          title: t("diabetesBloodSugarTitle", "🩸 Blood Sugar Check"),
          body: t(
            "diabetesBloodSugarBody",
            "Regular blood sugar monitoring is key to managing diabetes. Time for your daily check?"
          ),
          type: "reminder",
          priority: daysSinceBloodSugar >= 7 ? "high" : "normal",
          scheduledTime: new Date(),
          data: {
            type: "condition_reminder",
            condition: "diabetes",
            vitalType: "blood_sugar",
            daysSince: daysSinceBloodSugar,
          },
          quickActions: [
            {
              label: t("quickActionLogReading", "📝 Log Reading"),
              action: "log_blood_sugar",
            },
            {
              label: t("quickActionRemindLater", "⏰ Remind Later"),
              action: "remind_later",
            },
          ],
        });
      }
    }

    // Hypertension management
    if (conditions.includes("hypertension")) {
      const lastBPCheck = vitals.lastBloodPressure;
      const daysSinceBP = lastBPCheck
        ? Math.floor(
            (new Date().getTime() - lastBPCheck.getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : 30;

      if (daysSinceBP >= 7) {
        notifications.push({
          id: `hypertension-bp-${Date.now()}`,
          title: t("hypertensionBPTitle", "❤️ Blood Pressure Check"),
          body: t(
            "hypertensionBPBody",
            "Keeping track of your blood pressure helps manage hypertension. Let's check it today."
          ),
          type: "reminder",
          priority: daysSinceBP >= 14 ? "high" : "normal",
          scheduledTime: new Date(),
          data: {
            type: "condition_reminder",
            condition: "hypertension",
            vitalType: "blood_pressure",
            daysSince: daysSinceBP,
          },
          quickActions: [
            {
              label: t("quickActionCheckNow", "📏 Check Now"),
              action: "check_blood_pressure",
            },
            {
              label: t("quickActionSetReminder", "⏰ Set Reminder"),
              action: "schedule_bp_check",
            },
          ],
        });
      }
    }

    // Asthma/Respiratory conditions
    if (conditions.some((c) => ["asthma", "copd", "bronchitis"].includes(c))) {
      const lastRespiratoryCheck = vitals.lastRespiratoryRate;
      const daysSinceRespiratory = lastRespiratoryCheck
        ? Math.floor(
            (new Date().getTime() - lastRespiratoryCheck.getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : 30;

      if (daysSinceRespiratory >= 3) {
        notifications.push({
          id: `respiratory-check-${Date.now()}`,
          title: t("respiratoryCheckTitle", "🫁 Respiratory Check"),
          body: t(
            "respiratoryCheckBody",
            "Monitoring your breathing rate helps manage respiratory conditions. Let's do a quick check."
          ),
          type: "reminder",
          priority: "normal",
          scheduledTime: new Date(),
          data: {
            type: "condition_reminder",
            condition: "respiratory",
            vitalType: "respiratory_rate",
            daysSince: daysSinceRespiratory,
          },
          quickActions: [
            {
              label: t("quickActionLogSymptoms", "📝 Log Symptoms"),
              action: "log_respiratory_symptoms",
            },
            {
              label: t("quickActionFeelingGood", "😊 Feeling Good"),
              action: "respiratory_feeling_good",
            },
          ],
        });
      }
    }

    // Mental health conditions
    if (
      userStats.userProfile?.mentalHealth?.includes("anxiety") ||
      userStats.userProfile?.mentalHealth?.includes("depression")
    ) {
      const daysSinceMoodLog = userStats.daysSinceLastSymptom; // Assuming mood is tracked as symptoms

      if (daysSinceMoodLog >= 2) {
        notifications.push({
          id: `mental-health-check-${Date.now()}`,
          title: t("mentalHealthCheckTitle", "😊 Mental Health Check"),
          body: t(
            "mentalHealthCheckBody",
            "Taking a moment for your mental well-being is important. How are you feeling today?"
          ),
          type: "reminder",
          priority: "low",
          scheduledTime: new Date(),
          data: {
            type: "condition_reminder",
            condition: "mental_health",
            daysSince: daysSinceMoodLog,
          },
          quickActions: [
            {
              label: t("quickActionLogMood", "📝 Log Mood"),
              action: "log_mood",
            },
            {
              label: t("quickActionTalkToZeina", "🤖 Talk to Zeina"),
              action: "open_zeina",
            },
            {
              label: t("quickActionRemindTomorrow", "⏰ Tomorrow"),
              action: "remind_tomorrow",
            },
          ],
        });
      }
    }

    return notifications;
  }

  /**
   * Generate vital sign check prompts
   */
  generateVitalSignPrompts(userStats: UserStats): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const t = i18n.t.bind(i18n);

    if (!userStats.lastVitalChecks) return notifications;

    const vitals = userStats.lastVitalChecks;

    // Weight tracking (general wellness)
    if (userStats.userProfile?.age && userStats.userProfile.age > 50) {
      const lastWeightCheck = vitals.lastWeight;
      const daysSinceWeight = lastWeightCheck
        ? Math.floor(
            (new Date().getTime() - lastWeightCheck.getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : 30;

      if (daysSinceWeight >= 30) {
        // Monthly weight check
        notifications.push({
          id: `weight-check-${Date.now()}`,
          title: t("weightCheckTitle", "⚖️ Monthly Weight Check"),
          body: t(
            "weightCheckBody",
            "Regular weight monitoring is important for overall health. Let's check your weight this month."
          ),
          type: "reminder",
          priority: "low",
          scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          data: {
            type: "vital_prompt",
            vitalType: "weight",
            daysSince: daysSinceWeight,
          },
          quickActions: [
            {
              label: t("quickActionLogWeight", "📝 Log Weight"),
              action: "log_weight",
            },
            {
              label: t("quickActionSkipThisMonth", "⏭️ Skip This Month"),
              action: "skip_weight_check",
            },
          ],
        });
      }
    }

    // Temperature monitoring (for elderly or immunocompromised)
    if (userStats.userProfile?.age && userStats.userProfile.age > 65) {
      const lastTempCheck = vitals.lastTemperature;
      const daysSinceTemp = lastTempCheck
        ? Math.floor(
            (new Date().getTime() - lastTempCheck.getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : 30;

      if (daysSinceTemp >= 7) {
        notifications.push({
          id: `temperature-check-${Date.now()}`,
          title: t("temperatureCheckTitle", "🌡️ Temperature Check"),
          body: t(
            "temperatureCheckBody",
            "Regular temperature monitoring helps catch potential issues early. Time for a quick check?"
          ),
          type: "reminder",
          priority: "low",
          scheduledTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
          data: {
            type: "vital_prompt",
            vitalType: "temperature",
            daysSince: daysSinceTemp,
          },
          quickActions: [
            {
              label: t("quickActionTakeTemperature", "🌡️ Take Reading"),
              action: "log_temperature",
            },
            {
              label: t("quickActionFeelingNormal", "😊 Feeling Normal"),
              action: "temperature_normal",
            },
          ],
        });
      }
    }

    return notifications;
  }

  /**
   * Generate medication adherence nudges
   */
  generateMedicationAdherenceNudges(userStats: UserStats): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const t = i18n.t.bind(i18n);

    if (
      !userStats.userProfile?.medications ||
      userStats.recentCompliance >= 80
    ) {
      return notifications;
    }

    // Low compliance nudge
    if (userStats.recentCompliance < 60) {
      notifications.push({
        id: `adherence-encouragement-${Date.now()}`,
        title: t("adherenceEncouragementTitle", "💪 Medication Adherence Help"),
        body: t(
          "adherenceEncouragementBody",
          "We noticed your medication compliance is below 60%. Would you like help setting up reminders or organizing your medications?"
        ),
        type: "reminder",
        priority: "high",
        scheduledTime: new Date(),
        data: {
          type: "adherence_nudge",
          complianceRate: userStats.recentCompliance,
          severity: "critical",
        },
        quickActions: [
          {
            label: t("quickActionSetupReminders", "⏰ Setup Reminders"),
            action: "setup_medication_reminders",
          },
          {
            label: t("quickActionOrganizeMeds", "📦 Organize Meds"),
            action: "organize_medications",
          },
          {
            label: t("quickActionTalkToCaregiver", "👨‍⚕️ Talk to Caregiver"),
            action: "contact_caregiver",
          },
        ],
      });
    }

    // Moderate compliance encouragement
    else if (userStats.recentCompliance < 80) {
      notifications.push({
        id: `adherence-motivation-${Date.now()}`,
        title: t("adherenceMotivationTitle", "🎯 Stay on Track"),
        body: t(
          "adherenceMotivationBody",
          `You're at ${Math.round(userStats.recentCompliance)}% medication compliance. Let's work together to improve this!`
        ),
        type: "reminder",
        priority: "normal",
        scheduledTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        data: {
          type: "adherence_nudge",
          complianceRate: userStats.recentCompliance,
          severity: "moderate",
        },
        quickActions: [
          {
            label: t("quickActionViewSchedule", "📅 View Schedule"),
            action: "view_medication_schedule",
          },
          {
            label: t("quickActionLogMeds", "💊 Log Today's Meds"),
            action: "log_today_medications",
          },
          {
            label: t("quickActionSetGoal", "🎯 Set Goal"),
            action: "set_adherence_goal",
          },
        ],
      });
    }

    // Specific medication reminders for complex regimens
    if (userStats.userProfile.medications.length > 3) {
      notifications.push({
        id: `complex-regimen-help-${Date.now()}`,
        title: t("complexRegimenTitle", "📋 Medication Organization Help"),
        body: t(
          "complexRegimenBody",
          "With multiple medications, organization is key. Would you like help organizing your medication schedule?"
        ),
        type: "reminder",
        priority: "low",
        scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        data: {
          type: "adherence_nudge",
          complexity: "high",
          medicationCount: userStats.userProfile.medications.length,
        },
        quickActions: [
          {
            label: t("quickActionCreateSchedule", "📅 Create Schedule"),
            action: "create_medication_schedule",
          },
          {
            label: t("quickActionPillOrganizer", "📦 Pill Organizer"),
            action: "setup_pill_organizer",
          },
          {
            label: t("quickActionRemindLater", "⏰ Remind Later"),
            action: "remind_later",
          },
        ],
      });
    }

    return notifications;
  }

  /**
   * Generate family health update notifications
   */
  async generateFamilyHealthUpdates(
    userId: string,
    userRole: string
  ): Promise<SmartNotification[]> {
    const notifications: SmartNotification[] = [];
    const t = i18n.t.bind(i18n);

    if (userRole !== "admin") return notifications;

    try {
      // Get family member data
      const familyMembers = await this.getFamilyMembers(userId);
      const familyStats = await this.calculateFamilyHealthStats(familyMembers);

      // Family health summary for admins
      if (familyStats.membersNeedingAttention > 0) {
        notifications.push({
          id: `family-health-summary-${Date.now()}`,
          title: t("familyHealthSummaryTitle", "👨‍👩‍👧‍👦 Family Health Update"),
          body: t(
            "familyHealthSummaryBody",
            "{{count}} family member(s) may need attention. Check the Family tab for details.",
            {
              count: familyStats.membersNeedingAttention,
            }
          ),
          type: "family_update",
          priority: familyStats.criticalAlerts > 0 ? "high" : "normal",
          scheduledTime: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour from now
          data: {
            type: "family_health_summary",
            membersNeedingAttention: familyStats.membersNeedingAttention,
            criticalAlerts: familyStats.criticalAlerts,
          },
          quickActions: [
            {
              label: t("quickActionViewFamily", "👨‍👩‍👧‍👦 View Family"),
              action: "open_family_tab",
            },
            {
              label: t("quickActionCheckAlerts", "🚨 Check Alerts"),
              action: "view_alerts",
            },
          ],
        });
      }

      // Medication coordination alerts
      if (familyStats.upcomingMedications > 0) {
        notifications.push({
          id: `family-medication-coordination-${Date.now()}`,
          title: t(
            "familyMedicationCoordinationTitle",
            "💊 Family Medication Time"
          ),
          body: t(
            "familyMedicationCoordinationBody",
            "{{count}} family member(s) have medications due soon. Help coordinate their care.",
            {
              count: familyStats.upcomingMedications,
            }
          ),
          type: "family_update",
          priority: "normal",
          scheduledTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
          data: {
            type: "family_medication_coordination",
            upcomingMedications: familyStats.upcomingMedications,
          },
          quickActions: [
            {
              label: t("quickActionViewSchedule", "📅 View Schedule"),
              action: "view_medication_schedule",
            },
            {
              label: t("quickActionSendReminders", "📱 Send Reminders"),
              action: "send_medication_reminders",
            },
          ],
        });
      }

      // Family member milestone celebrations
      familyStats.achievements.forEach((achievement) => {
        notifications.push({
          id: `family-member-achievement-${achievement.memberId}-${Date.now()}`,
          title: t("familyMemberAchievementTitle", "🎉 Family Achievement"),
          body: t(
            "familyMemberAchievementBody",
            "{{name}} reached a health milestone: {{achievement}}",
            {
              name: achievement.memberName,
              achievement: achievement.title,
            }
          ),
          type: "achievement",
          priority: "low",
          scheduledTime: new Date(),
          data: {
            type: "family_member_achievement",
            memberId: achievement.memberId,
            achievement: achievement.title,
          },
        });
      });
    } catch (error) {}

    return notifications;
  }

  /**
   * Generate caregiver coordination alerts
   */
  async generateCaregiverCoordinationAlerts(
    userId: string,
    userRole: string
  ): Promise<SmartNotification[]> {
    const notifications: SmartNotification[] = [];
    const t = i18n.t.bind(i18n);

    if (userRole !== "admin") return notifications;

    try {
      const coordinationNeeds =
        await this.getCaregiverCoordinationNeeds(userId);

      // Emergency coordination
      if (coordinationNeeds.emergencyContacts > 0) {
        notifications.push({
          id: `emergency-coordination-${Date.now()}`,
          title: t(
            "emergencyCoordinationTitle",
            "🚨 Emergency Coordination Needed"
          ),
          body: t(
            "emergencyCoordinationBody",
            "{{count}} family member(s) have triggered emergency alerts. Immediate attention required.",
            {
              count: coordinationNeeds.emergencyContacts,
            }
          ),
          type: "family_update",
          priority: "critical",
          scheduledTime: new Date(), // Immediate
          data: {
            type: "emergency_coordination",
            emergencyContacts: coordinationNeeds.emergencyContacts,
          },
          quickActions: [
            {
              label: t("quickActionEmergencyResponse", "🚑 Respond Now"),
              action: "emergency_response",
            },
            {
              label: t("quickActionCallEmergency", "📞 Call Emergency"),
              action: "call_emergency_contacts",
            },
          ],
        });
      }

      // Care handoff coordination
      if (coordinationNeeds.careHandoffNeeded) {
        notifications.push({
          id: `care-handoff-${Date.now()}`,
          title: t("careHandoffTitle", "🤝 Care Coordination"),
          body: t(
            "careHandoffBody",
            "Time for care handoff. Update family members on recent health developments."
          ),
          type: "family_update",
          priority: "normal",
          scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          data: {
            type: "care_handoff_coordination",
            handoffTime: coordinationNeeds.nextHandoffTime,
          },
          quickActions: [
            {
              label: t("quickActionUpdateCareNotes", "📝 Update Notes"),
              action: "update_care_notes",
            },
            {
              label: t("quickActionScheduleHandoff", "📅 Schedule Handoff"),
              action: "schedule_care_handoff",
            },
          ],
        });
      }

      // Appointment coordination
      if (coordinationNeeds.upcomingAppointments > 0) {
        notifications.push({
          id: `appointment-coordination-${Date.now()}`,
          title: t(
            "appointmentCoordinationTitle",
            "📅 Appointment Coordination"
          ),
          body: t(
            "appointmentCoordinationBody",
            "{{count}} upcoming appointments need coordination. Review and confirm attendance.",
            {
              count: coordinationNeeds.upcomingAppointments,
            }
          ),
          type: "family_update",
          priority: "normal",
          scheduledTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
          data: {
            type: "appointment_coordination",
            upcomingAppointments: coordinationNeeds.upcomingAppointments,
          },
          quickActions: [
            {
              label: t("quickActionViewAppointments", "📅 View Appointments"),
              action: "view_appointments",
            },
            {
              label: t("quickActionConfirmAttendance", "✅ Confirm Attendance"),
              action: "confirm_appointments",
            },
          ],
        });
      }
    } catch (error) {}

    return notifications;
  }

  /**
   * Generate achievement celebration notifications
   */
  generateAchievementCelebrations(userStats: UserStats): SmartNotification[] {
    const achievements: SmartNotification[] = [];
    const t = i18n.t.bind(i18n);

    // Check for newly unlocked achievements (within last 24 hours)
    const newAchievements = userStats.achievements.filter((achievement) => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return achievement.unlockedAt > oneDayAgo;
    });

    newAchievements.forEach((achievement) => {
      let achievementType = "";
      let emoji = "🏆";

      // Determine achievement type and emoji
      if (achievement.type === "streak") {
        achievementType = t("achievementTypeStreak", "Streak");
        emoji = "🔥";
      } else if (achievement.type === "compliance") {
        achievementType = t("achievementTypeCompliance", "Compliance");
        emoji = "💊";
      } else if (achievement.type === "consistency") {
        achievementType = t("achievementTypeConsistency", "Consistency");
        emoji = "📅";
      } else if (achievement.type === "milestone") {
        achievementType = t("achievementTypeMilestone", "Milestone");
        emoji = "🎯";
      }

      achievements.push({
        id: `achievement-${achievement.id}-${Date.now()}`,
        title: `${emoji} ${t("achievementUnlockedTitle", "Achievement Unlocked!")}`,
        body: `${achievement.title}: ${achievement.description}`,
        type: "achievement",
        priority: "low",
        scheduledTime: new Date(),
        data: {
          type: "achievement_unlocked",
          achievementId: achievement.id,
          achievementType: achievement.type,
          title: achievement.title,
        },
        quickActions: [
          {
            label: t("quickActionShareAchievement", "📤 Share"),
            action: "share_achievement",
          },
          {
            label: t("quickActionViewProgress", "📊 View Progress"),
            action: "view_achievements",
          },
        ],
      });
    });

    return achievements;
  }

  /**
   * Schedule daily notifications for a user
   */
  async scheduleDailyNotifications(
    userId: string
  ): Promise<{ scheduled: number; failed: number; suppressed: number }> {
    const notifications =
      await this.generateDailyInteractiveNotifications(userId);

    // Keep daily volume reasonable by default: prioritize morning + evening only
    const prioritized = notifications.filter(
      (n) =>
        n.id.includes("morning-checkin") || n.id.includes("evening-reflection")
    );

    return await this.scheduleSmartNotifications(
      prioritized.length > 0 ? prioritized : notifications
    );
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

/**
 * Handle notification response actions with comprehensive quick actions
 */
export class NotificationResponseHandler {
  static async handleQuickAction(
    action: string,
    data: any,
    userId: string
  ): Promise<void> {
    try {
      switch (action) {
        // Phase 1: Daily Wellness Check-ins
        case "log_mood_good":
          await NotificationResponseHandler.logMood(userId, "happy", 4);
          await NotificationResponseHandler.showFeedback(
            "Mood logged successfully!"
          );
          break;

        case "log_symptoms":
          await NotificationResponseHandler.navigateToScreen("symptoms");
          break;

        case "check_medications":
          await NotificationResponseHandler.navigateToScreen("medications");
          break;

        case "emergency":
          await NotificationResponseHandler.handleEmergency(userId);
          break;

        case "log_evening_good":
          await NotificationResponseHandler.logEveningCheckin(userId, "good");
          await NotificationResponseHandler.showFeedback(
            "Evening check-in completed!"
          );
          break;

        case "log_evening_details":
          await NotificationResponseHandler.navigateToScreen(
            "profile",
            "mood-logging"
          );
          break;

        case "confirm_medications":
          await NotificationResponseHandler.confirmMedicationTaken(userId);
          await NotificationResponseHandler.showFeedback(
            "Medications confirmed!"
          );
          break;

        // Phase 1: Streak & Activity Management
        case "quick_log":
          await NotificationResponseHandler.quickHealthLog(userId);
          await NotificationResponseHandler.showFeedback(
            "Quick health log completed!"
          );
          break;

        case "remind_later":
          await NotificationResponseHandler.rescheduleNotification(
            data,
            4 * 60 * 60 * 1000
          ); // 4 hours later
          break;

        case "log_no_symptoms":
          await NotificationResponseHandler.logNoSymptoms(userId);
          await NotificationResponseHandler.showFeedback("No symptoms logged!");
          break;

        case "remind_tomorrow":
          await NotificationResponseHandler.rescheduleNotification(
            data,
            24 * 60 * 60 * 1000
          ); // Tomorrow
          break;

        // Phase 2: Condition-Specific Actions
        case "log_blood_sugar":
          await NotificationResponseHandler.navigateToScreen(
            "vitals",
            "blood-sugar"
          );
          break;

        case "check_blood_pressure":
          await NotificationResponseHandler.navigateToScreen(
            "vitals",
            "blood-pressure"
          );
          break;

        case "log_respiratory_symptoms":
          await NotificationResponseHandler.navigateToScreen(
            "symptoms",
            "respiratory"
          );
          break;

        case "log_mood":
          await NotificationResponseHandler.navigateToScreen(
            "profile",
            "mood-logging"
          );
          break;

        case "open_zeina":
          await NotificationResponseHandler.navigateToScreen("zeina");
          break;

        case "log_weight":
          await NotificationResponseHandler.navigateToScreen(
            "vitals",
            "weight"
          );
          break;

        case "log_temperature":
          await NotificationResponseHandler.navigateToScreen(
            "vitals",
            "temperature"
          );
          break;

        case "log_blood_pressure":
          await NotificationResponseHandler.navigateToScreen(
            "vitals",
            "blood-pressure"
          );
          break;

        // Phase 2: Medication Adherence Actions
        case "confirm_medication":
          await NotificationResponseHandler.confirmMedicationTaken(userId);
          await NotificationResponseHandler.showFeedback(
            "Medication confirmed!"
          );
          break;

        // Medication confirmation responses
        case "medication_taken_yes":
          await NotificationResponseHandler.logMedicationAdherence(
            userId,
            data,
            true
          );
          await NotificationResponseHandler.showFeedback(
            "Great! Medication adherence logged."
          );
          break;

        case "medication_taken_no":
          await NotificationResponseHandler.logMedicationAdherence(
            userId,
            data,
            false
          );
          await NotificationResponseHandler.showFeedback(
            "Noted. Consider setting a reminder for next time."
          );
          break;

        case "update_medications":
          await NotificationResponseHandler.navigateToScreen("medications");
          break;

        case "contact_caregiver":
          await NotificationResponseHandler.contactCaregiver(userId);
          break;

        case "setup_medication_reminders":
          await NotificationResponseHandler.navigateToScreen(
            "medications",
            "reminders"
          );
          break;

        case "organize_medications":
          await NotificationResponseHandler.navigateToScreen(
            "medications",
            "organize"
          );
          break;

        case "view_medication_schedule":
          await NotificationResponseHandler.navigateToScreen(
            "medications",
            "schedule"
          );
          break;

        case "log_today_medications":
          await NotificationResponseHandler.navigateToScreen(
            "medications",
            "log-today"
          );
          break;

        case "set_adherence_goal":
          await NotificationResponseHandler.navigateToScreen(
            "profile",
            "goals"
          );
          break;

        case "create_medication_schedule":
          await NotificationResponseHandler.navigateToScreen(
            "medications",
            "create-schedule"
          );
          break;

        case "setup_pill_organizer":
          await NotificationResponseHandler.navigateToScreen(
            "medications",
            "pill-organizer"
          );
          break;

        // Phase 3: Family & Caregiver Actions
        case "open_family_tab":
          await NotificationResponseHandler.navigateToScreen("family");
          break;

        case "view_alerts":
          await NotificationResponseHandler.navigateToScreen(
            "family",
            "alerts"
          );
          break;

        case "send_medication_reminders":
          await NotificationResponseHandler.sendFamilyMedicationReminders(
            userId
          );
          await NotificationResponseHandler.showFeedback(
            "Reminders sent to family!"
          );
          break;

        case "emergency_response":
          await NotificationResponseHandler.handleEmergencyResponse(userId);
          break;

        case "call_emergency_contacts":
          await NotificationResponseHandler.callEmergencyContacts(userId);
          break;

        case "update_care_notes":
          await NotificationResponseHandler.navigateToScreen(
            "family",
            "care-notes"
          );
          break;

        case "schedule_care_handoff":
          await NotificationResponseHandler.navigateToScreen(
            "family",
            "care-handoff"
          );
          break;

        case "view_appointments":
          await NotificationResponseHandler.navigateToScreen(
            "family",
            "appointments"
          );
          break;

        case "confirm_appointments":
          await NotificationResponseHandler.confirmFamilyAppointments(userId);
          await NotificationResponseHandler.showFeedback(
            "Appointments confirmed!"
          );
          break;

        // Phase 3: Achievement Actions
        case "share_achievement":
          await NotificationResponseHandler.shareAchievement(data);
          break;

        case "view_achievements":
          await NotificationResponseHandler.navigateToScreen(
            "profile",
            "achievements"
          );
          break;

        // New simplified quick actions
        case "log_water_intake":
          await NotificationResponseHandler.logHydration(userId, "water");
          await NotificationResponseHandler.showFeedback(
            "Water intake logged!"
          );
          break;

        case "log_coffee_intake":
          await NotificationResponseHandler.logHydration(userId, "coffee");
          await NotificationResponseHandler.showFeedback("Coffee logged!");
          break;

        case "snooze_hydration":
          await NotificationResponseHandler.rescheduleNotification(
            data,
            60 * 60 * 1000
          ); // 1 hour
          break;

        case "log_energy_good":
          await NotificationResponseHandler.logEnergyLevel(userId, "good");
          await NotificationResponseHandler.showFeedback(
            "Energy level logged!"
          );
          break;

        case "log_energy_low":
          await NotificationResponseHandler.logEnergyLevel(userId, "low");
          await NotificationResponseHandler.showFeedback(
            "Energy boost logged!"
          );
          break;

        case "log_hydration":
          await NotificationResponseHandler.logHydration(userId, "water");
          await NotificationResponseHandler.showFeedback("Hydration logged!");
          break;

        default:
      }

      // Log action for analytics
      await NotificationResponseHandler.logNotificationAction(
        action,
        data,
        userId
      );
    } catch (error) {
      await NotificationResponseHandler.showFeedback(
        "Action could not be completed. Please try again."
      );
    }
  }

  private static async logMood(
    userId: string,
    mood: string,
    intensity: number
  ): Promise<void> {
    try {
      const { moodService } = await import("./moodService");
      await moodService.addMood({
        userId,
        mood: mood as any,
        intensity: intensity as 1 | 2 | 3 | 4 | 5,
        timestamp: new Date(),
        notes: "Logged via notification",
      });
    } catch (error) {}
  }

  private static async handleEmergency(userId: string): Promise<void> {
    try {
      // Trigger emergency alert
      const { alertService } = await import("./alertService");
      await alertService.createAlert({
        userId,
        type: "emergency",
        severity: "high",
        message: "Emergency alert triggered via notification",
        timestamp: new Date(),
        resolved: false,
      });
    } catch (error) {}
  }

  private static async logEveningCheckin(
    userId: string,
    status: string
  ): Promise<void> {
    try {
      const { moodService } = await import("./moodService");
      await moodService.addMood({
        userId,
        mood: status === "good" ? "content" : "neutral",
        intensity: (status === "good" ? 4 : 3) as 1 | 2 | 3 | 4 | 5,
        timestamp: new Date(),
        notes: "Evening check-in via notification",
      });
    } catch (error) {}
  }

  private static async confirmMedicationTaken(userId: string): Promise<void> {
    try {
      // This would need to be implemented based on your medication logging system
    } catch (error) {}
  }

  private static async logMedicationAdherence(
    userId: string,
    data: any,
    taken: boolean
  ): Promise<void> {
    try {
      // Log medication adherence to Firestore
      const { db } = await import("@/lib/firebase");
      const { collection, addDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );

      if (data?.medications && Array.isArray(data.medications)) {
        // Log adherence for each medication in the confirmation
        for (const med of data.medications) {
          await addDoc(collection(db, "medication_adherence"), {
            userId,
            medicationId: med.id,
            medicationName: med.name,
            taken,
            timestamp: serverTimestamp(),
            scheduledTime: data.scheduledTime || serverTimestamp(),
            timing: data.timing || "unspecified",
            confirmationType: "notification_response",
          });
        }
      }

      // If medication was missed, consider sending a gentle reminder or follow-up
      if (!taken) {
        // Could add logic here to schedule a follow-up reminder
      }
    } catch (error) {}
  }

  private static async quickHealthLog(userId: string): Promise<void> {
    try {
      const { symptomService } = await import("./symptomService");
      await symptomService.addSymptom({
        userId,
        type: "General",
        severity: 1,
        timestamp: new Date(),
        description: "Quick health check via notification - feeling good",
        location: "General",
      });
    } catch (error) {}
  }

  private static async logNoSymptoms(userId: string): Promise<void> {
    try {
      // Log that user checked in with no symptoms
    } catch (error) {}
  }

  private static async contactCaregiver(userId: string): Promise<void> {
    try {
      // This would integrate with your family/caregiver contact system
      // Could open phone dialer, send message, etc.
    } catch (error) {}
  }

  // Phase 4: Enhanced Action Handlers
  private static async navigateToScreen(
    screen: string,
    subScreen?: string
  ): Promise<void> {
    try {
      // This would integrate with your navigation system
      // For now, we'll use a global navigation reference
      // Example implementation:
      // import { router } from 'expo-router';
      // router.push(`/${screen}${subScreen ? `/${subScreen}` : ''}`);
      // Or use a navigation ref if using React Navigation
      // navigationRef.current?.navigate(screen, { subScreen });
    } catch (error) {}
  }

  private static async showFeedback(message: string): Promise<void> {
    try {
      // This would show a toast, alert, or in-app notification
      // Example implementation:
      // import { Alert } from 'react-native';
      // Alert.alert('Success', message);
      // Or use a toast library
      // toast.show({ message, type: 'success' });
    } catch (error) {}
  }

  private static async rescheduleNotification(
    data: any,
    delayMs: number
  ): Promise<void> {
    try {
      // This would reschedule the notification using your notification service
      // Example:
      // const newTime = new Date(Date.now() + delayMs);
      // await notificationService.rescheduleNotification(data.id, newTime);
    } catch (error) {}
  }

  private static async sendFamilyMedicationReminders(
    userId: string
  ): Promise<void> {
    try {
      // This would send notifications to all family members about upcoming medications
      // Implementation would depend on your family notification system
    } catch (error) {}
  }

  private static async handleEmergencyResponse(userId: string): Promise<void> {
    try {
      // This would open emergency response interface
      // Could include: calling emergency contacts, viewing emergency protocols, etc.

      await NotificationResponseHandler.navigateToScreen(
        "emergency",
        "response"
      );
    } catch (error) {}
  }

  private static async callEmergencyContacts(userId: string): Promise<void> {
    try {
      // This would initiate calls to emergency contacts
      // Implementation would depend on device capabilities and contact permissions
    } catch (error) {}
  }

  private static async confirmFamilyAppointments(
    userId: string
  ): Promise<void> {
    try {
      // This would mark family appointments as confirmed
      // Implementation would depend on your appointment system
    } catch (error) {}
  }

  private static async shareAchievement(data: any): Promise<void> {
    try {
      // This would open share dialog for the achievement
      // Could share to social media, family chat, etc.

      const shareMessage = `🏆 I just unlocked a health achievement: ${data.title}!`;
      // Use Expo Sharing or React Native Share
      // await Sharing.shareAsync(shareMessage);
    } catch (error) {}
  }

  // Simplified helper methods for quick actions
  private static async logHydration(
    userId: string,
    type: string
  ): Promise<void> {
    try {
      // Implement hydration logging logic
    } catch (error) {}
  }

  private static async logEnergyLevel(
    userId: string,
    level: string
  ): Promise<void> {
    try {
      // Implement energy logging logic
    } catch (error) {}
  }

  private static async logNotificationAction(
    action: string,
    data: any,
    userId: string
  ): Promise<void> {
    try {
      // Log notification interactions for analytics
      // This could be sent to your analytics service
      // Example:
      // analytics.track('notification_action', {
      //   action,
      //   notification_type: data?.type,
      //   user_id: userId
      // });
    } catch (error) {}
  }
}

export const smartNotificationService = new SmartNotificationService();
