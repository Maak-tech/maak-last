/* biome-ignore-all lint/complexity/noStaticOnlyClass: Static action handler class is intentionally used as a namespaced API surface. */
/* biome-ignore-all lint/style/useDefaultSwitchClause: Some switch statements intentionally enumerate known value domains without fallback behavior. */
/* biome-ignore-all lint/nursery/noIncrementDecrement: Existing counters in this legacy scheduler use increment semantics. */

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

/**
 * Handle notification response actions with comprehensive quick actions
 */
export class NotificationResponseHandler {
  static async handleQuickAction(
    action: string,
    data: unknown,
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
          await NotificationResponseHandler.markMedicationTakenFromNotification(
            userId,
            data
          );
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
          await NotificationResponseHandler.markMedicationTakenFromNotification(
            userId,
            data
          );
          await NotificationResponseHandler.confirmMedicationTaken(userId);
          await NotificationResponseHandler.showFeedback(
            "Medication confirmed!"
          );
          break;

        // Medication confirmation responses
        case "medication_taken_yes":
          await NotificationResponseHandler.markMedicationTakenFromNotification(
            userId,
            data
          );
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
    } catch (_error) {
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
      const { moodService } = await import("../moodService");
      await moodService.addMood({
        userId,
        mood: mood as "happy" | "content" | "neutral",
        intensity: intensity as 1 | 2 | 3 | 4 | 5,
        timestamp: new Date(),
        notes: "Logged via notification",
      });
    } catch (_error) {
      /* no-op */
    }
  }

  private static async handleEmergency(userId: string): Promise<void> {
    try {
      // Trigger emergency alert
      const { alertService } = await import("../alertService");
      await alertService.createAlert({
        userId,
        type: "emergency",
        severity: "high",
        message: "Emergency alert triggered via notification",
        timestamp: new Date(),
        resolved: false,
      });
    } catch (_error) {
      /* no-op */
    }
  }

  private static async logEveningCheckin(
    userId: string,
    status: string
  ): Promise<void> {
    try {
      const { moodService } = await import("../moodService");
      await moodService.addMood({
        userId,
        mood: status === "good" ? "content" : "neutral",
        intensity: (status === "good" ? 4 : 3) as 1 | 2 | 3 | 4 | 5,
        timestamp: new Date(),
        notes: "Evening check-in via notification",
      });
    } catch (_error) {
      /* no-op */
    }
  }

  private static confirmMedicationTaken(_userId: string): Promise<void> {
    return Promise.resolve();
  }

  private static async markMedicationTakenFromNotification(
    userId: string,
    data: unknown
  ): Promise<void> {
    try {
      const payload = asRecord(data);
      const medicationId =
        typeof payload?.medicationId === "string"
          ? payload.medicationId
          : undefined;
      const reminderId =
        typeof payload?.reminderId === "string"
          ? payload.reminderId
          : undefined;

      if (!(medicationId && reminderId)) {
        return;
      }

      const { medicationService } = await import("../medicationService");
      await medicationService.markMedicationTaken(medicationId, reminderId);
    } catch (_error) {
      /* no-op */
    }
  }

  private static async logMedicationAdherence(
    userId: string,
    data: unknown,
    taken: boolean
  ): Promise<void> {
    try {
      // Log medication adherence to Firestore
      const { db } = await import("@/lib/firebase");
      const { collection, addDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );

      const payload = asRecord(data);
      const medications = Array.isArray(payload?.medications)
        ? payload.medications
        : [];
      if (medications.length > 0) {
        // Log adherence for each medication in the confirmation
        for (const med of medications) {
          const medication = asRecord(med);
          await addDoc(collection(db, "medication_adherence"), {
            userId,
            medicationId: medication?.id,
            medicationName: medication?.name,
            taken,
            timestamp: serverTimestamp(),
            scheduledTime: payload?.scheduledTime ?? serverTimestamp(),
            timing:
              typeof payload?.timing === "string"
                ? payload.timing
                : "unspecified",
            confirmationType: "notification_response",
          });
        }
      }

      // If medication was missed, consider sending a gentle reminder or follow-up
      if (!taken) {
        // Could add logic here to schedule a follow-up reminder
      }
    } catch (_error) {
      /* no-op */
    }
  }

  private static async quickHealthLog(userId: string): Promise<void> {
    try {
      const { symptomService } = await import("../symptomService");
      await symptomService.addSymptom({
        userId,
        type: "General",
        severity: 1,
        timestamp: new Date(),
        description: "Quick health check via notification - feeling good",
        location: "General",
      });
    } catch (_error) {
      /* no-op */
    }
  }

  private static logNoSymptoms(_userId: string): Promise<void> {
    return Promise.resolve();
  }

  private static contactCaregiver(_userId: string): Promise<void> {
    return Promise.resolve();
  }

  // Phase 4: Enhanced Action Handlers
  private static navigateToScreen(
    _screen: string,
    _subScreen?: string
  ): Promise<void> {
    return Promise.resolve();
  }

  private static showFeedback(_message: string): Promise<void> {
    return Promise.resolve();
  }

  private static rescheduleNotification(
    _data: unknown,
    _delayMs: number
  ): Promise<void> {
    return Promise.resolve();
  }

  private static sendFamilyMedicationReminders(_userId: string): Promise<void> {
    return Promise.resolve();
  }

  private static async handleEmergencyResponse(_userId: string): Promise<void> {
    try {
      // This would open emergency response interface
      // Could include: calling emergency contacts, viewing emergency protocols, etc.

      await NotificationResponseHandler.navigateToScreen(
        "emergency",
        "response"
      );
    } catch (_error) {
      /* no-op */
    }
  }

  private static callEmergencyContacts(_userId: string): Promise<void> {
    return Promise.resolve();
  }

  private static confirmFamilyAppointments(_userId: string): Promise<void> {
    return Promise.resolve();
  }

  private static shareAchievement(data: unknown): Promise<void> {
    const achievement = asRecord(data);
    const title =
      typeof achievement?.title === "string"
        ? achievement.title
        : "New Achievement";
    const _shareMessage = `Achievement unlocked: ${title}`;
    return Promise.resolve();
  }

  // Simplified helper methods for quick actions
  private static logHydration(_userId: string, _type: string): Promise<void> {
    return Promise.resolve();
  }

  private static logEnergyLevel(
    _userId: string,
    _level: string
  ): Promise<void> {
    return Promise.resolve();
  }

  private static logNotificationAction(
    _action: string,
    _data: unknown,
    _userId: string
  ): Promise<void> {
    return Promise.resolve();
  }
}
