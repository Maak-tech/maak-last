/**
 * Medication service — Firebase-free replacement.
 *
 * Replaced Firestore reads/writes on `medications` collection with:
 *   POST  /api/health/medications                    → addMedication / addMedicationForUser
 *   GET   /api/health/medications                    → getUserMedications (own)
 *   GET   /api/health/medications/:id                → getMedication
 *   PATCH /api/health/medications/:id                → updateMedication / deleteMedication / markMedicationTaken
 *   GET   /api/health/medications/user/:userId       → getMemberMedications
 *   GET   /api/health/medications/family/:familyId   → getFamilyMedications
 */

import { Platform } from "react-native";
import { api } from "@/lib/apiClient";
import { healthTimelineService } from "@/lib/observability";
import type { Medication, MedicationReminder } from "@/types";
import { coerceToDate } from "@/utils/dateCoercion";
import { offlineService } from "./offlineService";
import { userService } from "./userService";

type ReminderRecord = {
  id?: string;
  time?: unknown;
  taken?: unknown;
  takenAt?: unknown;
  takenBy?: unknown;
  [key: string]: unknown;
};

type UpcomingReminder = {
  medicationId: string;
  medicationName: string;
  reminderId: string;
  time: string;
  taken: boolean;
};

const normalizeReminder = (
  reminder: ReminderRecord,
  baseId: string,
  index: number
): MedicationReminder => {
  const id = reminder.id || `${baseId}_reminder_${index}_${Date.now()}`;
  const time = typeof reminder.time === "string" ? reminder.time : "";
  const taken = typeof reminder.taken === "boolean" ? reminder.taken : false;
  const takenBy = typeof reminder.takenBy === "string" ? reminder.takenBy : undefined;

  return {
    id,
    time,
    taken,
    takenAt: coerceToDate(reminder.takenAt) || undefined,
    takenBy,
  };
};

const coerceMedicationStartDate = (value: unknown): Date => {
  const parsed = coerceToDate(value);
  if (parsed) return parsed;
  return new Date(0);
};

const coerceMedicationEndDate = (value: unknown): Date | undefined => {
  const parsed = coerceToDate(value);
  return parsed || undefined;
};

const normalizeMedicationForClient = (
  medication: Medication,
  baseId: string
): Medication => ({
  ...medication,
  startDate: coerceMedicationStartDate(medication.startDate),
  endDate: coerceMedicationEndDate(medication.endDate),
  reminders: Array.isArray(medication.reminders)
    ? medication.reminders.map((reminder: ReminderRecord, index: number) =>
        normalizeReminder(reminder, baseId, index)
      )
    : [],
});

const compareMedicationStartDateDesc = (a: Medication, b: Medication) =>
  b.startDate.getTime() - a.startDate.getTime();

const dismissMedicationReminderNotifications = async (options: {
  medicationId?: string;
  medicationName?: string;
  reminderId?: string;
  reminderTime?: string;
}): Promise<void> => {
  if (Platform.OS === "web") return;

  try {
    const Notifications = await import("expo-notifications");
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const notification of presented as any[]) {
      const request = notification.request || notification;
      const content = request?.content || notification.content;
      const data = content?.data;

      if (data?.type !== "medication_reminder") continue;

      const matchesMedication =
        (options.medicationId && data?.medicationId === options.medicationId) ||
        (!options.medicationId &&
          options.medicationName &&
          data?.medicationName === options.medicationName);

      if (!matchesMedication) continue;
      if (options.reminderId && data?.reminderId !== options.reminderId) continue;
      if (options.reminderTime && data?.reminderTime && data?.reminderTime !== options.reminderTime) continue;

      const identifier = notification.identifier || request?.identifier;
      if (identifier) {
        try {
          await Notifications.dismissNotificationAsync(identifier);
        } catch {
          // Silently handle dismissal error
        }
      }
    }
  } catch {
    // Silently handle notification dismissal error
  }
};

/** Normalize a raw API medication row to the client Medication type */
const normalizeMedicationFromApi = (raw: Record<string, unknown>): Medication => {
  const reminders = Array.isArray(raw.reminders) ? raw.reminders : [];
  const id = raw.id as string;
  return {
    id,
    userId: raw.userId as string,
    name: raw.name as string,
    dosage: raw.dosage as string | undefined,
    frequency: raw.frequency as string | undefined,
    instructions: raw.instructions as string | undefined,
    isActive: (raw.isActive as boolean | undefined) ?? true,
    startDate: coerceMedicationStartDate(raw.startDate),
    endDate: coerceMedicationEndDate(raw.endDate),
    reminders: reminders.map((r: ReminderRecord, index: number) =>
      normalizeReminder(r, id, index)
    ),
    tags: raw.tags as string[] | undefined,
    quantity: raw.quantity as number | undefined,
    notes: raw.notes as string | undefined,
  } as Medication;
};

// In-memory cache for getUserMedications to avoid duplicate reads
// when multiple components/services request the same user's medications simultaneously.
const _medCache: {
  data: Map<string, { medications: Medication[]; timestamp: number }>;
  TTL: number;
} = { data: new Map(), TTL: 2 * 60_000 }; // 2-minute TTL

export const medicationService = {
  // Add new medication
  async addMedication(medicationData: Omit<Medication, 'id'>): Promise<string> {
    try {
      if (isOnline) {
        const created = await api.post<Record<string, unknown>>("/api/health/medications", {
          name: medicationData.name,
          userId: medicationData.userId,
          dosage: medicationData.dosage,
          frequency: medicationData.frequency,
          startDate: medicationData.startDate?.toISOString(),
          endDate: medicationData.endDate?.toISOString() ?? null,
          reminders: medicationData.reminders,
          tags: medicationData.tags,
          quantity: medicationData.quantity,
          notes: medicationData.notes,
        });

        const newMedication = { id: created.id as string, ...medicationData };
        const currentMedications = await offlineService.getOfflineCollection<Medication>("medications");
        await offlineService.storeOfflineData("medications", [...currentMedications, newMedication]);
        this.invalidateCache(medicationData.userId);
        return created.id as string;
      }

      // Offline — queue the operation
      const operationId = await offlineService.queueOperation({
        type: "create",
        collection: "medications",
        data: { ...medicationData, userId: medicationData.userId },
      });
      const tempId = `offline_${operationId}`;
      const newMedication = { id: tempId, ...medicationData };
      const currentMedications = await offlineService.getOfflineCollection<Medication>("medications");
      await offlineService.storeOfflineData("medications", [...currentMedications, newMedication]);
      return tempId;
    } catch (error) {
      console.error('Error adding medication:', error);
      throw error;
    }
  },

  // Add new medication for a specific user (for admins)
  async addMedicationForUser(
    medicationData: Omit<Medication, 'id'>,
    targetUserId: string
  ): Promise<string> {
    const created = await api.post<Record<string, unknown>>("/api/health/medications", {
      name: medicationData.name,
      userId: targetUserId,
      dosage: medicationData.dosage,
      frequency: medicationData.frequency,
      startDate: medicationData.startDate?.toISOString(),
      endDate: medicationData.endDate?.toISOString() ?? null,
      reminders: medicationData.reminders,
      tags: medicationData.tags,
      quantity: medicationData.quantity,
      notes: medicationData.notes,
    });
    return created.id as string;
  },

  // Get user medications
  async getUserMedications(userId: string): Promise<Medication[]> {
    // Return cached result if fresh
    const cached = _medCache.data.get(userId);
    if (cached && Date.now() - cached.timestamp < _medCache.TTL) {
      return cached.medications;
    }

    const isOnline = offlineService.isDeviceOnline();

    try {
      if (isOnline) {
        const raw = await api.get<Record<string, unknown>[]>("/api/health/medications");
        const medications = (raw ?? [])
          .map(normalizeMedicationFromApi)
          .sort(compareMedicationStartDateDesc);

        _medCache.data.set(userId, { medications, timestamp: Date.now() });
        await offlineService.storeOfflineData("medications", medications);
        return medications;
      }

      // Offline — use cached data filtered by userId
      const cachedMedications = await offlineService.getOfflineCollection<Medication>("medications");
      return cachedMedications
        .filter((m) => m.userId === userId && m.isActive !== false)
        .map((m) => normalizeMedicationForClient(m, m.id || userId))
        .sort(compareMedicationStartDateDesc);
    } catch (error) {
      // If online but fails, try offline cache
      if (isOnline) {
        const cachedMedications = await offlineService.getOfflineCollection<Medication>("medications");
        return cachedMedications
          .filter((m) => m.userId === userId && m.isActive !== false)
          .map((m) => normalizeMedicationForClient(m, m.id || userId))
          .sort(compareMedicationStartDateDesc);
      }
      throw error;
    }
  },

  // Update medication
  async updateMedication(medicationId: string, updates: Partial<Medication>): Promise<void> {
    await api.patch(`/api/health/medications/${medicationId}`, {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.dosage !== undefined && { dosage: updates.dosage }),
      ...(updates.frequency !== undefined && { frequency: updates.frequency }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
      ...(updates.startDate !== undefined && { startDate: updates.startDate?.toISOString() }),
      ...(updates.endDate !== undefined && { endDate: updates.endDate?.toISOString() ?? null }),
      ...(updates.reminders !== undefined && { reminders: updates.reminders }),
      ...(updates.tags !== undefined && { tags: updates.tags }),
      ...(updates.quantity !== undefined && { quantity: updates.quantity }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
    });
    this.invalidateCache(updates.userId);
  },

  // Mark medication as taken (toggles)
  async markMedicationTaken(medicationId: string, reminderId: string): Promise<void> {
    const medication = await this.getMedication(medicationId);
    if (!medication) throw new Error("Medication not found");

    const reminder = medication.reminders.find((r) => r.id === reminderId);
    if (!reminder) throw new Error("Reminder not found");

    const newTakenState = !reminder.taken;
    const updatedReminders = medication.reminders.map((currentReminder) =>
      currentReminder.id === reminderId
        ? {
            ...currentReminder,
            taken: newTakenState,
            takenAt: newTakenState ? new Date().toISOString() : null,
          }
        : currentReminder
    );

    await api.patch(`/api/health/medications/${medicationId}`, {
      reminders: updatedReminders,
    });
    this.invalidateCache(medication.userId);

    if (newTakenState) {
      dismissMedicationReminderNotifications({
        medicationId,
        medicationName: medication.name,
        reminderId,
        reminderTime: reminder.time,
      }).catch(() => {
        // Silently handle dismissal errors
      });
    } catch (error) {
      console.error('Error marking medication as taken:', error);
      throw error;
    }
  },

  // Get single medication
  async getMedication(medicationId: string): Promise<Medication | null> {
    try {
      const raw = await api.get<Record<string, unknown>>(`/api/health/medications/${medicationId}`);
      if (!raw || (raw as { error?: string }).error) return null;
      return normalizeMedicationFromApi(raw);
    } catch {
      return null;
    }
  },

  // Delete medication (soft-delete via isActive = false)
  async deleteMedication(medicationId: string): Promise<void> {
    await api.patch(`/api/health/medications/${medicationId}`, { isActive: false });
    this.invalidateCache(); // Clear all since we don't have userId here
  },

  // Get today's medications
  async getTodaysMedications(userId: string): Promise<Medication[]> {
    const medications = await this.getUserMedications(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return medications.filter((med) => {
      if (!med.isActive) return false;

      const startDate = new Date(med.startDate);
      startDate.setHours(0, 0, 0, 0);

      let endDate: Date | null = null;
      if (med.endDate) {
        endDate = new Date(med.endDate);
        endDate.setHours(0, 0, 0, 0);
      }

      return (
        today.getTime() >= startDate.getTime() &&
        (!endDate || today.getTime() <= endDate.getTime())
      );
    });
  },

  // Get upcoming reminders
  async getUpcomingReminders(
    userId: string,
    hours = 24
  ): Promise<UpcomingReminder[]> {
    const medications = await this.getUserMedications(userId);
    const reminders: UpcomingReminder[] = [];

      medications.forEach((med) => {
        const medicationReminders = med.reminders || [];
        medicationReminders.forEach((reminder) => {
          const now = new Date();
          const [hourStr, minuteStr] = reminder.time.split(':');
          const reminderTime = new Date();
          reminderTime.setHours(parseInt(hourStr), parseInt(minuteStr), 0, 0);

        // If reminder time has passed today, set it for tomorrow
        if (reminderTime < now) reminderTime.setDate(reminderTime.getDate() + 1);

        const timeDiff = reminderTime.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

          if (hoursDiff <= hours) {
            reminders.push({
              medicationId: med.id,
              medicationName: med.name,
              reminderId: reminder.id,
              time: reminder.time,
              taken: reminder.taken,
            });
          }
        });
      });

      return reminders.sort((a, b) => a.time.localeCompare(b.time));
    } catch (error) {
      console.error('Error getting upcoming reminders:', error);
      throw error;
    }
  },

  // Reset daily reminders (should be called once per day)
  async resetDailyReminders(userId: string): Promise<void> {
    try {
      const medications = await this.getUserMedications(userId);
      const today = new Date().toDateString();

    for (const medication of medications) {
      const needsReset = medication.reminders.some((reminder) => {
        const lastTaken = reminder.takenAt
          ? coerceToDate(reminder.takenAt)?.toDateString() || null
          : null;
        return reminder.taken && lastTaken !== today;
      });

      if (needsReset) {
        const resetReminders = medication.reminders.map((reminder) => {
          const { takenAt: _takenAt, ...rest } = reminder;
          return { ...rest, taken: false };
        });

        await api.patch(`/api/health/medications/${medication.id}`, {
          reminders: resetReminders,
        });
      }
    }
    this.invalidateCache(userId);
  },

  // Check if user has permission to access family data (admin or caregiver)
  async checkFamilyAccessPermission(userId: string, familyId: string): Promise<boolean> {
    try {
      const user = await userService.getUser(userId);
      return (
        user?.familyId === familyId &&
        (user?.role === "admin" || user?.role === "caregiver")
      );
    } catch {
      return false;
    }
  },

  // Get medications for all family members (for admins and caregivers)
  async getFamilyMedications(userId: string, familyId: string): Promise<Medication[]> {
    const hasPermission = await this.checkFamilyAccessPermission(userId, familyId);
    if (!hasPermission) {
      throw new Error("Access denied: Only admins and caregivers can access family medical data");
    }

    const raw = await api.get<Record<string, unknown>[]>(
      `/api/health/medications/family/${familyId}`
    );
    return (raw ?? [])
      .map(normalizeMedicationFromApi)
      .sort(compareMedicationStartDateDesc);
  },

  // Get today's medications for all family members (for admins and caregivers)
  async getFamilyTodaysMedications(userId: string, familyId: string): Promise<Medication[]> {
    const familyMedications = await this.getFamilyMedications(userId, familyId);
    return familyMedications.filter((med) => {
      if (!med.isActive) return false;
      return Array.isArray(med.reminders) && med.reminders.length > 0;
    });
  },

  // Get medications for a specific family member (for admins)
  async getMemberMedications(memberId: string): Promise<Medication[]> {
    const raw = await api.get<Record<string, unknown>[]>(
      `/api/health/medications/user/${memberId}`
    );
    return (raw ?? [])
      .map(normalizeMedicationFromApi)
      .sort(compareMedicationStartDateDesc);
  },

  // Get today's medications for a specific family member (for admins)
  async getMemberTodaysMedications(memberId: string): Promise<Medication[]> {
    const memberMedications = await this.getMemberMedications(memberId);
    return memberMedications.filter((med) => {
      if (!med.isActive) return false;
      return Array.isArray(med.reminders) && med.reminders.length > 0;
    });
  },

  // Get medication stats for a specific family member (for admins)
  async getMemberMedicationStats(memberId: string): Promise<{
    totalMedications: number;
    activeMedications: number;
    todaysCompliance: number;
    upcomingReminders: number;
  }> {
    try {
      const [allMedications, todaysMedications] = await Promise.all([
        this.getMemberMedications(memberId),
        this.getMemberTodaysMedications(memberId),
      ]);

      const totalMedications = allMedications.length;
      const activeMedications = allMedications.filter((med) => med.isActive).length;

      const today = new Date().toDateString();
      const totalReminders = todaysMedications.reduce((sum, med) => {
        const reminders = Array.isArray(med.reminders) ? med.reminders : [];
        return sum + reminders.length;
      }, 0);

      const takenReminders = todaysMedications.reduce((sum, med) => {
        const reminders = Array.isArray(med.reminders) ? med.reminders : [];
        return (
          sum +
          reminders.filter((r) => {
            if (!(r.taken && r.takenAt)) return false;
            const takenDate = coerceToDate(r.takenAt);
            if (!takenDate) return false;
            return takenDate.toDateString() === today;
          }).length
        );
      }, 0);

      const todaysCompliance =
        totalReminders > 0 ? (takenReminders / totalReminders) * 100 : 100;
      const upcomingReminders = totalReminders - takenReminders;

      return {
        totalMedications,
        activeMedications,
        todaysCompliance: Math.round(todaysCompliance),
        upcomingReminders,
      };
    } catch {
      return {
        totalMedications: 0,
        activeMedications: 0,
        todaysCompliance: 100,
        upcomingReminders: 0,
      };
    }
  },

  // Bulk add medications
  async bulkAddMedications(
    medications: Omit<Medication, "id">[],
    userId: string
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const result = { success: 0, failed: 0, errors: [] as string[] };

    for (const medication of medications) {
      try {
        await this.addMedication({ ...medication, userId });
        result.success += 1;
      } catch (error) {
        result.failed += 1;
        const errorMessage =
          error instanceof Error ? error.message : `Failed to add ${medication.name}`;
        result.errors.push(errorMessage);
      }
    }

    return result;
  },
};
