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
import type { Medication } from "@/types";
import { offlineService } from "./offlineService";

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
        const currentMedications = await offlineService.getOfflineCollection<Medication>("medications");
        await offlineService.storeOfflineData("medications", [...currentMedications, newMedication]);
        return docRef.id;
      } else {
        // Offline - queue the operation
        const operationId = await offlineService.queueOperation({
          type: "create",
          collection: "medications",
          data: { ...medicationData, userId: medicationData.userId },
        });
        // Store locally for immediate UI update
        const tempId = `offline_${operationId}`;
        const newMedication = { id: tempId, ...medicationData };
        const currentMedications = await offlineService.getOfflineCollection<Medication>("medications");
        await offlineService.storeOfflineData("medications", [...currentMedications, newMedication]);
        return tempId;
      }
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
    try {
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
    } catch (error) {
      // Silently handle error adding medication for user:", error);
      throw error;
    }
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

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // Convert reminder takenAt Timestamps to Date objects
          const processedReminders = (data.reminders || []).map(
            (reminder: any) => ({
              ...reminder,
              takenAt: reminder.takenAt
                ? reminder.takenAt.toDate
                  ? reminder.takenAt.toDate()
                  : new Date(reminder.takenAt)
                : undefined,
            })
          );

          medications.push({
            id: doc.id,
            ...data,
            reminders: processedReminders,
            startDate: data.startDate.toDate(),
            endDate: data.endDate?.toDate() || undefined,
          } as Medication);
        });

        // Sort by startDate descending in memory
        medications.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

        // Cache for offline access
        await offlineService.storeOfflineData("medications", medications);
        return medications;
      } else {
        // Offline - use cached data filtered by userId
        const cachedMedications = await offlineService.getOfflineCollection<Medication>("medications");
        return cachedMedications
          .filter((m) => m.userId === userId && m.isActive !== false)
          .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
      }
    } catch (error) {
      // If online but fails, try offline cache
      if (isOnline) {
        const cachedMedications = await offlineService.getOfflineCollection<Medication>("medications");
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
    try {
      const updateData: any = { ...updates };
      if (updates.startDate) {
        updateData.startDate = Timestamp.fromDate(updates.startDate);
      }
      if (updates.endDate) {
        updateData.endDate = Timestamp.fromDate(updates.endDate);
      }
      await updateDoc(doc(db, "medications", medicationId), updateData);
    } catch (error) {
      // Silently handle error updating medication:", error);
      throw error;
    }
  },

  // Mark medication as taken
  async markMedicationTaken(
    medicationId: string,
    reminderId: string
  ): Promise<void> {
    try {
      // Get the current medication to update the specific reminder
      const medication = await this.getMedication(medicationId);
      if (!medication) {
        throw new Error("Medication not found");
      }

      // Find the reminder to toggle
      const reminder = medication.reminders.find((r) => r.id === reminderId);
      if (!reminder) {
        throw new Error("Reminder not found");
      }

      // Toggle the taken state and update takenAt accordingly
      const newTakenState = !reminder.taken;
      const updatedReminders = medication.reminders.map((reminder) =>
        reminder.id === reminderId
          ? {
              ...reminder,
              taken: newTakenState,
              takenAt: newTakenState ? Timestamp.now() : null,
            }
          : reminder
      );

      await updateDoc(doc(db, "medications", medicationId), {
        reminders: updatedReminders,
      });
    } catch (error) {
      // Silently handle error marking medication as taken:", error);
      throw error;
    }
  },

  // Get single medication
  async getMedication(medicationId: string): Promise<Medication | null> {
    try {
      const docRef = doc(db, "medications", medicationId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();

      // Convert reminder takenAt Timestamps to Date objects
      const processedReminders = (data.reminders || []).map(
        (reminder: any) => ({
          ...reminder,
          takenAt: reminder.takenAt
            ? reminder.takenAt.toDate
              ? reminder.takenAt.toDate()
              : new Date(reminder.takenAt)
            : undefined,
        })
      );

      return {
        id: docSnap.id,
        ...data,
        reminders: processedReminders,
        startDate: data.startDate.toDate(),
        endDate: data.endDate?.toDate() || undefined,
      } as Medication;
    } catch (error) {
      // Silently handle error getting medication:", error);
      throw error;
    }
  },

  // Delete medication
  async deleteMedication(medicationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, "medications", medicationId), {
        isActive: false,
      });
    } catch (error) {
      // Silently handle error deleting medication:", error);
      throw error;
    }
  },

  // Get today's medications
  async getTodaysMedications(userId: string): Promise<Medication[]> {
    try {
      const medications = await this.getUserMedications(userId);
      const today = new Date().toDateString();

      // Filter medications that should be taken today
      return medications.filter((med) => {
        if (!med.isActive) return false;

        const startDate = new Date(med.startDate).toDateString();
        const endDate = med.endDate
          ? new Date(med.endDate).toDateString()
          : null;

        // Check if today is within the medication period
        const isInPeriod = today >= startDate && (!endDate || today <= endDate);

        return isInPeriod;
      });
    } catch (error) {
      // Silently handle error getting today's medications:", error);
      throw error;
    }
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
    try {
      const medications = await this.getUserMedications(userId);
      const reminders: any[] = [];

      medications.forEach((med) => {
        const medicationReminders = med.reminders || [];
        medicationReminders.forEach((reminder) => {
          const now = new Date();
          const [hourStr, minuteStr] = reminder.time.split(":");
          const reminderTime = new Date();
          reminderTime.setHours(
            Number.parseInt(hourStr),
            Number.parseInt(minuteStr),
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
        });
      });

      return reminders.sort((a, b) => a.time.localeCompare(b.time));
    } catch (error) {
      // Silently handle error getting upcoming reminders:", error);
      throw error;
    }
  },

  // Reset daily reminders (should be called once per day)
  async resetDailyReminders(userId: string): Promise<void> {
    try {
      const medications = await this.getUserMedications(userId);
      const today = new Date().toDateString();

      for (const medication of medications) {
        // Check if reminders need to be reset for today
        const needsReset = medication.reminders.some((reminder) => {
          const lastTaken = reminder.takenAt
            ? new Date(reminder.takenAt).toDateString()
            : null;
          return reminder.taken && lastTaken !== today;
        });

        if (needsReset) {
          // Reset all reminders for this medication
          const resetReminders = medication.reminders.map((reminder) => {
            const resetReminder: any = {
              ...reminder,
              taken: false,
            };
            // Remove takenAt field entirely instead of setting to undefined
            delete resetReminder.takenAt;
            return resetReminder;
          });

          await updateDoc(doc(db, "medications", medication.id), {
            reminders: resetReminders,
          });
        }
      }
    } catch (error) {
      // Silently handle error resetting daily reminders:", error);
      throw error;
    }
  },

  // Get medications for all family members (for admins)
  async getFamilyMedications(familyId: string): Promise<Medication[]> {
    try {
      // First get all family members
      const familyMembersQuery = query(
        collection(db, "users"),
        where("familyId", "==", familyId)
      );
      const familyMembersSnapshot = await getDocs(familyMembersQuery);
      const memberIds = familyMembersSnapshot.docs.map((doc) => doc.id);

      if (memberIds.length === 0) {
        return [];
      }

      // Get medications for all family members
      const medicationsQuery = query(
        collection(db, "medications"),
        where("userId", "in", memberIds),
        where("isActive", "==", true),
        orderBy("startDate", "desc")
      );

      const querySnapshot = await getDocs(medicationsQuery);
      const medications: Medication[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Convert reminder takenAt Timestamps to Date objects
        const processedReminders = (data.reminders || []).map(
          (reminder: any) => ({
            ...reminder,
            takenAt: reminder.takenAt
              ? reminder.takenAt.toDate
                ? reminder.takenAt.toDate()
                : new Date(reminder.takenAt)
              : undefined,
          })
        );

        medications.push({
          id: doc.id,
          ...data,
          startDate: data.startDate.toDate(),
          endDate: data.endDate?.toDate(),
          reminders: processedReminders,
        } as Medication);
      });

      return medications;
    } catch (error) {
      // Silently handle error getting family medications:", error);
      throw error;
    }
  },

  // Get today's medications for all family members (for admins)
  async getFamilyTodaysMedications(familyId: string): Promise<Medication[]> {
    try {
      const familyMedications = await this.getFamilyMedications(familyId);

      // Filter for today's medications (active medications with reminders)
      const today = new Date().toDateString();
      return familyMedications.filter((med) => {
        if (!med.isActive) return false;

        // Check if medication has any reminders for today
        return Array.isArray(med.reminders) && med.reminders.length > 0;
      });
    } catch (error) {
      // Silently handle error getting family today medications:", error);
      throw error;
    }
  },

  // Get medications for a specific family member (for admins)
  async getMemberMedications(memberId: string): Promise<Medication[]> {
    try {
      const q = query(
        collection(db, "medications"),
        where("userId", "==", memberId),
        where("isActive", "==", true),
        orderBy("startDate", "desc")
      );

      const querySnapshot = await getDocs(q);
      const medications: Medication[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Convert reminder takenAt Timestamps to Date objects
        const processedReminders = (data.reminders || []).map(
          (reminder: any) => ({
            ...reminder,
            takenAt: reminder.takenAt
              ? reminder.takenAt.toDate
                ? reminder.takenAt.toDate()
                : new Date(reminder.takenAt)
              : undefined,
          })
        );

        medications.push({
          id: doc.id,
          ...data,
          startDate: data.startDate.toDate(),
          endDate: data.endDate?.toDate(),
          reminders: processedReminders,
        } as Medication);
      });

      return medications;
    } catch (error) {
      // Silently handle error getting member medications:", error);
      throw error;
    }
  },

  // Get today's medications for a specific family member (for admins)
  async getMemberTodaysMedications(memberId: string): Promise<Medication[]> {
    try {
      const memberMedications = await this.getMemberMedications(memberId);

      // Filter for today's medications (active medications with reminders)
      const today = new Date().toDateString();
      return memberMedications.filter((med) => {
        if (!med.isActive) return false;

        // Check if medication has any reminders for today
        return Array.isArray(med.reminders) && med.reminders.length > 0;
      });
    } catch (error) {
      // Silently handle error getting member today medications:", error);
      throw error;
    }
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
            if (!(r.taken && r.takenAt)) return false;
            const takenDate = (r.takenAt as any).toDate
              ? (r.takenAt as any).toDate()
              : new Date(r.takenAt);
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
    } catch (error) {
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
    medications: Array<Omit<Medication, "id">>,
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
        result.success++;
      } catch (error) {
        result.failed++;
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
