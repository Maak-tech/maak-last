import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { healthTimelineService } from "@/lib/observability";
import type { Medication } from "@/types";
import { coerceToDate } from "@/utils/dateCoercion";
import { offlineService } from "./offlineService";
import { userService } from "./userService";

type ReminderRecord = {
  id?: string;
  takenAt?: unknown;
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
) => ({
  ...reminder,
  id: reminder.id || `${baseId}_reminder_${index}_${Date.now()}`,
  takenAt: coerceToDate(reminder.takenAt) || undefined,
});

const getFamilyMemberIds = async (familyId: string): Promise<string[]> => {
  const familyMembersQuery = query(
    collection(db, "users"),
    where("familyId", "==", familyId)
  );
  const familyMembersSnapshot = await getDocs(familyMembersQuery);
  return familyMembersSnapshot.docs.map((memberDoc) => memberDoc.id);
};

const fetchFamilyMedicationsByMembers = async (
  memberIds: string[]
): Promise<Medication[]> => {
  const medicationPromises = memberIds.map((memberId) =>
    medicationService
      .getUserMedications(memberId)
      .catch(() => [] as Medication[])
  );
  const allMedicationsArrays = await Promise.all(medicationPromises);
  return allMedicationsArrays
    .flat()
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
};

const fetchFamilyMedicationsByInQuery = async (
  memberIds: string[]
): Promise<Medication[]> => {
  const medicationsQuery = query(
    collection(db, "medications"),
    where("userId", "in", memberIds),
    where("isActive", "==", true),
    orderBy("startDate", "desc")
  );

  const querySnapshot = await getDocs(medicationsQuery);
  const medications: Medication[] = [];

  for (const docSnap of querySnapshot.docs) {
    const data = docSnap.data();
    const processedReminders = (data.reminders || []).map(
      (reminder: ReminderRecord, index: number) =>
        normalizeReminder(reminder, docSnap.id, index)
    );

    medications.push({
      id: docSnap.id,
      ...data,
      startDate: data.startDate.toDate(),
      endDate: data.endDate?.toDate(),
      reminders: processedReminders,
    } as Medication);
  }

  return medications;
};

const isFailedPreconditionError = (error: unknown): error is { code: string } =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "failed-precondition";

const loadFamilyMedications = async (
  familyId: string
): Promise<Medication[]> => {
  const memberIds = await getFamilyMemberIds(familyId);
  if (memberIds.length === 0) {
    return [];
  }

  if (memberIds.length > 10) {
    return fetchFamilyMedicationsByMembers(memberIds);
  }

  return fetchFamilyMedicationsByInQuery(memberIds);
};

const loadFamilyMedicationsWithFallback = async (
  familyId: string
): Promise<Medication[]> => {
  try {
    return await loadFamilyMedications(familyId);
  } catch (error: unknown) {
    if (!isFailedPreconditionError(error)) {
      throw error;
    }

    try {
      const memberIds = await getFamilyMemberIds(familyId);
      if (memberIds.length === 0) {
        return [];
      }
      return fetchFamilyMedicationsByMembers(memberIds);
    } catch (fallbackError) {
      throw new Error(
        `Failed to load family medications: ${fallbackError instanceof Error ? fallbackError.message : "Unknown error"}`
      );
    }
  }
};

export const medicationService = {
  // Add new medication (offline-first)
  async addMedication(medicationData: Omit<Medication, "id">): Promise<string> {
    const isOnline = offlineService.isDeviceOnline();

    try {
      // Filter out undefined values to prevent Firebase errors
      const cleanedData = Object.fromEntries(
        Object.entries({
          ...medicationData,
          startDate: Timestamp.fromDate(medicationData.startDate),
          endDate: medicationData.endDate
            ? Timestamp.fromDate(medicationData.endDate)
            : null,
        }).filter(([_, value]) => value !== undefined)
      );

      if (isOnline) {
        const docRef = await addDoc(collection(db, "medications"), cleanedData);
        // Cache the result for offline access
        const newMedication = { id: docRef.id, ...medicationData };
        const currentMedications =
          await offlineService.getOfflineCollection<Medication>("medications");
        await offlineService.storeOfflineData("medications", [
          ...currentMedications,
          newMedication,
        ]);
        return docRef.id;
      }
      // Offline - queue the operation
      const operationId = await offlineService.queueOperation({
        type: "create",
        collection: "medications",
        data: { ...medicationData, userId: medicationData.userId },
      });
      // Store locally for immediate UI update
      const tempId = `offline_${operationId}`;
      const newMedication = { id: tempId, ...medicationData };
      const currentMedications =
        await offlineService.getOfflineCollection<Medication>("medications");
      await offlineService.storeOfflineData("medications", [
        ...currentMedications,
        newMedication,
      ]);
      return tempId;
    } catch (error) {
      // If online but fails, queue for retry
      if (isOnline) {
        const operationId = await offlineService.queueOperation({
          type: "create",
          collection: "medications",
          data: { ...medicationData, userId: medicationData.userId },
        });
        return `offline_${operationId}`;
      }
      throw error;
    }
  },

  // Add new medication for a specific user (for admins)
  async addMedicationForUser(
    medicationData: Omit<Medication, "id">,
    targetUserId: string
  ): Promise<string> {
    // Override the userId to the target user
    const dataWithTargetUser = {
      ...medicationData,
      userId: targetUserId,
    };

    // Filter out undefined values to prevent Firebase errors
    const cleanedData = Object.fromEntries(
      Object.entries({
        ...dataWithTargetUser,
        startDate: Timestamp.fromDate(dataWithTargetUser.startDate),
        endDate: dataWithTargetUser.endDate
          ? Timestamp.fromDate(dataWithTargetUser.endDate)
          : null,
      }).filter(([_, value]) => value !== undefined)
    );

    const docRef = await addDoc(collection(db, "medications"), cleanedData);
    return docRef.id;
  },

  // Get user medications (offline-first)
  async getUserMedications(userId: string): Promise<Medication[]> {
    const isOnline = offlineService.isDeviceOnline();

    try {
      if (isOnline) {
        // Query without orderBy to avoid index requirement, then sort in memory
        const q = query(
          collection(db, "medications"),
          where("userId", "==", userId),
          where("isActive", "==", true)
        );

        const querySnapshot = await getDocs(q);
        const medications: Medication[] = [];

        for (const docSnap of querySnapshot.docs) {
          const data = docSnap.data();
          // Convert reminder takenAt Timestamps to Date objects and ensure IDs exist
          const processedReminders = (data.reminders || []).map(
            (reminder: ReminderRecord, index: number) =>
              normalizeReminder(reminder, docSnap.id, index)
          );

          medications.push({
            id: docSnap.id,
            ...data,
            reminders: processedReminders,
            startDate: data.startDate.toDate(),
            endDate: data.endDate?.toDate() || undefined,
          } as Medication);
        }

        // Sort by startDate descending in memory
        medications.sort(
          (a, b) => b.startDate.getTime() - a.startDate.getTime()
        );

        // Cache for offline access
        await offlineService.storeOfflineData("medications", medications);
        return medications;
      }
      // Offline - use cached data filtered by userId
      const cachedMedications =
        await offlineService.getOfflineCollection<Medication>("medications");
      return cachedMedications
        .filter((m) => m.userId === userId && m.isActive !== false)
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    } catch (error) {
      // If online but fails, try offline cache
      if (isOnline) {
        const cachedMedications =
          await offlineService.getOfflineCollection<Medication>("medications");
        return cachedMedications
          .filter((m) => m.userId === userId && m.isActive !== false)
          .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
      }
      throw error;
    }
  },

  // Update medication
  async updateMedication(
    medicationId: string,
    updates: Partial<Medication>
  ): Promise<void> {
    const updateData: Record<string, unknown> = { ...updates };
    if (updates.startDate) {
      updateData.startDate = Timestamp.fromDate(updates.startDate);
    }
    if (updates.endDate) {
      updateData.endDate = Timestamp.fromDate(updates.endDate);
    }
    await updateDoc(doc(db, "medications", medicationId), updateData);
  },

  // Mark medication as taken
  async markMedicationTaken(
    medicationId: string,
    reminderId: string
  ): Promise<void> {
    const medication = await this.getMedication(medicationId);
    if (!medication) {
      throw new Error("Medication not found");
    }

    const reminder = medication.reminders.find((r) => r.id === reminderId);
    if (!reminder) {
      throw new Error("Reminder not found");
    }

    const newTakenState = !reminder.taken;
    const updatedReminders = medication.reminders.map((currentReminder) =>
      currentReminder.id === reminderId
        ? {
            ...currentReminder,
            taken: newTakenState,
            takenAt: newTakenState ? Timestamp.now() : null,
          }
        : currentReminder
    );

    await updateDoc(doc(db, "medications", medicationId), {
      reminders: updatedReminders,
    });

    await healthTimelineService.addEvent({
      userId: medication.userId,
      eventType: newTakenState ? "medication_taken" : "medication_missed",
      title: newTakenState
        ? `Medication taken: ${medication.name}`
        : `Medication unmarked: ${medication.name}`,
      description: `${medication.dosage} at ${reminder.time}`,
      timestamp: new Date(),
      severity: "info",
      icon: newTakenState ? "check-circle" : "circle",
      metadata: {
        medicationId,
        medicationName: medication.name,
        dosage: medication.dosage,
        reminderId,
        scheduledTime: reminder.time,
      },
      relatedEntityId: medicationId,
      relatedEntityType: "medication",
      actorType: "user",
    });
  },

  // Get single medication
  async getMedication(medicationId: string): Promise<Medication | null> {
    const docRef = doc(db, "medications", medicationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();

    // Convert reminder takenAt Timestamps to Date objects and ensure IDs exist
    const processedReminders = (data.reminders || []).map(
      (reminder: ReminderRecord, index: number) =>
        normalizeReminder(reminder, medicationId, index)
    );

    return {
      id: docSnap.id,
      ...data,
      reminders: processedReminders,
      startDate: data.startDate.toDate(),
      endDate: data.endDate?.toDate() || undefined,
    } as Medication;
  },

  // Delete medication
  async deleteMedication(medicationId: string): Promise<void> {
    await updateDoc(doc(db, "medications", medicationId), {
      isActive: false,
    });
  },

  // Get today's medications
  async getTodaysMedications(userId: string): Promise<Medication[]> {
    const medications = await this.getUserMedications(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    // Filter medications that should be taken today
    return medications.filter((med) => {
      if (!med.isActive) {
        return false;
      }

      // Convert startDate to Date object and normalize
      const startDate =
        med.startDate instanceof Date
          ? new Date(med.startDate)
          : new Date(med.startDate);
      startDate.setHours(0, 0, 0, 0);

      // Convert endDate to Date object and normalize if it exists
      let endDate: Date | null = null;
      if (med.endDate) {
        endDate =
          med.endDate instanceof Date
            ? new Date(med.endDate)
            : new Date(med.endDate);
        endDate.setHours(0, 0, 0, 0);
      }

      // Check if today is within the medication period
      // Medication is valid for today if:
      // - startDate is today or earlier
      // - endDate is null (no end date) or today or later
      const isInPeriod =
        today.getTime() >= startDate.getTime() &&
        (!endDate || today.getTime() <= endDate.getTime());

      return isInPeriod;
    });
  },

  // Get upcoming reminders
  async getUpcomingReminders(
    userId: string,
    hours = 24
  ): Promise<
    {
      medicationId: string;
      medicationName: string;
      reminderId: string;
      time: string;
      taken: boolean;
    }[]
  > {
    const medications = await this.getUserMedications(userId);
    const reminders: UpcomingReminder[] = [];

    for (const med of medications) {
      const medicationReminders = med.reminders || [];
      for (const reminder of medicationReminders) {
        const now = new Date();
        const [hourStr, minuteStr] = reminder.time.split(":");
        const reminderTime = new Date();
        reminderTime.setHours(
          Number.parseInt(hourStr, 10),
          Number.parseInt(minuteStr, 10),
          0,
          0
        );

        // If reminder time has passed today, set it for tomorrow
        if (reminderTime < now) {
          reminderTime.setDate(reminderTime.getDate() + 1);
        }

        // Include reminders within the specified hours
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
      }
    }

    return reminders.sort((a, b) => a.time.localeCompare(b.time));
  },

  // Reset daily reminders (should be called once per day)
  async resetDailyReminders(userId: string): Promise<void> {
    const medications = await this.getUserMedications(userId);
    const today = new Date().toDateString();

    for (const medication of medications) {
      // Check if reminders need to be reset for today
      const needsReset = medication.reminders.some((reminder) => {
        const lastTaken = reminder.takenAt
          ? coerceToDate(reminder.takenAt)?.toDateString() || null
          : null;
        return reminder.taken && lastTaken !== today;
      });

      if (needsReset) {
        // Reset all reminders for this medication
        const resetReminders = medication.reminders.map((reminder) => {
          const { takenAt: _takenAt, ...rest } = reminder;
          return {
            ...rest,
            taken: false,
          };
        });

        await updateDoc(doc(db, "medications", medication.id), {
          reminders: resetReminders,
        });
      }
    }
  },

  // Check if user has permission to access family data (admin or caregiver)
  async checkFamilyAccessPermission(
    userId: string,
    familyId: string
  ): Promise<boolean> {
    try {
      const user = await userService.getUser(userId);
      return (
        user?.familyId === familyId &&
        (user?.role === "admin" || user?.role === "caregiver")
      );
    } catch (_error) {
      return false;
    }
  },

  // Get medications for all family members (for admins and caregivers)
  async getFamilyMedications(
    userId: string,
    familyId: string
  ): Promise<Medication[]> {
    const hasPermission = await this.checkFamilyAccessPermission(
      userId,
      familyId
    );
    if (!hasPermission) {
      throw new Error(
        "Access denied: Only admins and caregivers can access family medical data"
      );
    }

    return loadFamilyMedicationsWithFallback(familyId);
  },

  // Get today's medications for all family members (for admins and caregivers)
  async getFamilyTodaysMedications(
    userId: string,
    familyId: string
  ): Promise<Medication[]> {
    const familyMedications = await this.getFamilyMedications(userId, familyId);

    // Filter for today's medications (active medications with reminders)
    const _today = new Date().toDateString();
    return familyMedications.filter((med) => {
      if (!med.isActive) {
        return false;
      }

      // Check if medication has any reminders for today
      return Array.isArray(med.reminders) && med.reminders.length > 0;
    });
  },

  // Get medications for a specific family member (for admins)
  async getMemberMedications(memberId: string): Promise<Medication[]> {
    const q = query(
      collection(db, "medications"),
      where("userId", "==", memberId),
      where("isActive", "==", true),
      orderBy("startDate", "desc")
    );

    const querySnapshot = await getDocs(q);
    const medications: Medication[] = [];

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      // Convert reminder takenAt Timestamps to Date objects and ensure IDs exist
      const processedReminders = (data.reminders || []).map(
        (reminder: ReminderRecord, index: number) =>
          normalizeReminder(reminder, docSnap.id, index)
      );

      medications.push({
        id: docSnap.id,
        ...data,
        startDate: data.startDate.toDate(),
        endDate: data.endDate?.toDate(),
        reminders: processedReminders,
      } as Medication);
    }

    return medications;
  },

  // Get today's medications for a specific family member (for admins)
  async getMemberTodaysMedications(memberId: string): Promise<Medication[]> {
    const memberMedications = await this.getMemberMedications(memberId);

    // Filter for today's medications (active medications with reminders)
    const _today = new Date().toDateString();
    return memberMedications.filter((med) => {
      if (!med.isActive) {
        return false;
      }

      // Check if medication has any reminders for today
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
      const activeMedications = allMedications.filter(
        (med) => med.isActive
      ).length;

      // Calculate today's compliance
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
            if (!(r.taken && r.takenAt)) {
              return false;
            }
            const takenDate = coerceToDate(r.takenAt);
            if (!takenDate) {
              return false;
            }
            const takenToday = takenDate.toDateString() === today;
            return takenToday;
          }).length
        );
      }, 0);

      const todaysCompliance =
        totalReminders > 0 ? (takenReminders / totalReminders) * 100 : 100;

      // Count upcoming reminders (not taken yet today)
      const upcomingReminders = totalReminders - takenReminders;

      return {
        totalMedications,
        activeMedications,
        todaysCompliance: Math.round(todaysCompliance),
        upcomingReminders,
      };
    } catch (_error) {
      // Silently handle error getting member medication stats:", error);
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
        // Ensure userId is set
        const medicationWithUserId = {
          ...medication,
          userId,
        };

        await this.addMedication(medicationWithUserId);
        result.success += 1;
      } catch (error) {
        result.failed += 1;
        const errorMessage =
          error instanceof Error
            ? error.message
            : `Failed to add ${medication.name}`;
        result.errors.push(errorMessage);
      }
    }

    return result;
  },
};
