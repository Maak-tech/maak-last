/**
 * Scheduled Medication Reminders Job
 * Checks for medication reminders every hour and sends notifications to users
 */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Scheduler intentionally combines matching, dispatching, and persistence in one operational function. */

import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "../observability/logger";

type MedicationReminder = {
  id: string;
  time: string;
  taken?: boolean;
  notified?: boolean;
  notifiedAt?: unknown;
};

type ReminderPayload = {
  medicationId: string;
  medicationName: string;
  dosage: string;
  userId: string;
  reminderId: string;
  reminderIndex: number;
  reminderTime: string;
};

/**
 * Helper function to check if time is within range
 * @param currentTime - Current time in HH:MM format
 * @param targetTime - Target time in HH:MM format
 * @param rangeMinutes - Range in minutes
 * @return Whether time is within range
 */
function isTimeWithinRange(
  currentTime: string,
  targetTime: string,
  rangeMinutes: number
): boolean {
  const [currentHour, currentMin] = currentTime.split(":").map(Number);
  const [targetHour, targetMin] = targetTime.split(":").map(Number);

  const currentMinutes = currentHour * 60 + currentMin;
  const targetMinutes = targetHour * 60 + targetMin;

  const diff = Math.abs(currentMinutes - targetMinutes);
  return diff <= rangeMinutes;
}

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybeTimestamp = value as { toDate: () => Date };
    const parsed = maybeTimestamp.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

/**
 * Scheduled function to check and send medication reminders
 * Runs every hour
 */
export const scheduledMedicationReminders = onSchedule(
  "every 1 hours",
  async () => {
    const db = getFirestore();
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime =
      `${currentHour.toString().padStart(2, "0")}:` +
      `${currentMinutes.toString().padStart(2, "0")}`;

    try {
      // Get all active medications
      const medicationsSnapshot = await db
        .collection("medications")
        .where("isActive", "==", true)
        .get();

      const remindersToSend: ReminderPayload[] = [];
      const remindersByMedicationId = new Map<string, MedicationReminder[]>();

      for (const doc of medicationsSnapshot.docs) {
        const medication = doc.data();
        const reminders = Array.isArray(medication.reminders)
          ? (medication.reminders as MedicationReminder[])
          : [];
        remindersByMedicationId.set(doc.id, [...reminders]);

        // Check if any reminder matches current time (within 5 minutes)
        for (const [reminderIndex, reminder] of reminders.entries()) {
          const reminderTime = reminder.time;
          const notifiedAtDate = toDate(reminder.notifiedAt);
          const wasNotifiedToday =
            notifiedAtDate?.toDateString() === now.toDateString();

          if (
            isTimeWithinRange(currentTime, reminderTime, 5) &&
            !reminder.taken &&
            !wasNotifiedToday
          ) {
            remindersToSend.push({
              medicationId: doc.id,
              medicationName: medication.name,
              dosage: medication.dosage,
              userId: medication.userId,
              reminderId: reminder.id,
              reminderIndex,
              reminderTime,
            });
          }
        }
      }

      // Send reminders
      // Note: This requires sendMedicationReminder to be exported from index.ts
      // We'll need to import it dynamically to avoid circular dependencies
      const indexModule = (await import("../index.js")) as unknown as {
        sendMedicationReminder: (
          reminder: ReminderPayload,
          context: { auth: { uid: string } }
        ) => Promise<unknown>;
      };

      for (const reminder of remindersToSend) {
        try {
          await indexModule.sendMedicationReminder(reminder, {
            auth: { uid: "system" },
          });

          // Mark reminder as notified in the array payload and write back.
          const medicationReminders =
            remindersByMedicationId.get(reminder.medicationId) ?? [];

          if (reminder.reminderIndex >= 0) {
            const currentReminder = medicationReminders[reminder.reminderIndex];
            if (currentReminder) {
              medicationReminders[reminder.reminderIndex] = {
                ...currentReminder,
                notified: true,
                notifiedAt: now,
              };

              await db
                .collection("medications")
                .doc(reminder.medicationId)
                .update({
                  reminders: medicationReminders,
                });
            }
          }
        } catch (error) {
          logger.error("Error sending reminder", error as Error, {
            fn: "sendScheduledMedicationReminders",
          });
        }
      }

      // Medication reminders sent
    } catch (error) {
      logger.error("Error in scheduled medication reminders", error as Error, {
        fn: "sendScheduledMedicationReminders",
      });
    }
  }
);
