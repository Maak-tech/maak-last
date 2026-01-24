import { doc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Medication, User } from "@/types";
import { medicationService } from "./medicationService";
import { userService } from "./userService";

export interface MedicationScheduleEntry {
  medication: Medication;
  member: User;
  nextDose?: Date;
  lastTaken?: Date;
  complianceRate?: number; // Percentage of doses taken on time
  missedDoses?: number;
}

export interface SharedScheduleDay {
  date: Date;
  entries: MedicationScheduleEntry[];
}

class SharedMedicationScheduleService {
  /**
   * Get all medication schedules for family members
   */
  async getFamilyMedicationSchedules(
    familyId: string,
    userId?: string // Current user ID (to check permissions)
  ): Promise<MedicationScheduleEntry[]> {
    try {
      // Get all family members
      const familyMembers = await userService.getFamilyMembers(familyId);

      // Get medications for all family members
      const scheduleEntries: MedicationScheduleEntry[] = [];

      for (const member of familyMembers) {
        const medications = await medicationService.getUserMedications(
          member.id
        );

        // Filter only active medications
        const activeMedications = medications.filter((m) => m.isActive);

        for (const medication of activeMedications) {
          const nextDose = this.calculateNextDose(medication);
          const lastTaken = this.getLastTaken(medication);
          const complianceRate = this.calculateComplianceRate(medication);
          const missedDoses = this.countMissedDoses(medication);

          scheduleEntries.push({
            medication,
            member,
            nextDose,
            lastTaken,
            complianceRate,
            missedDoses,
          });
        }
      }

      // Sort by next dose time
      scheduleEntries.sort((a, b) => {
        if (!(a.nextDose || b.nextDose)) return 0;
        if (!a.nextDose) return 1;
        if (!b.nextDose) return -1;
        return a.nextDose.getTime() - b.nextDose.getTime();
      });

      return scheduleEntries;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get medication schedule for a specific family member
   */
  async getMemberMedicationSchedule(
    memberId: string,
    familyId: string
  ): Promise<MedicationScheduleEntry[]> {
    try {
      const member = await userService.getUser(memberId);
      if (!member || member.familyId !== familyId) {
        return [];
      }

      const medications = await medicationService.getUserMedications(memberId);
      const activeMedications = medications.filter((m) => m.isActive);

      return activeMedications.map((medication) => {
        const nextDose = this.calculateNextDose(medication);
        const lastTaken = this.getLastTaken(medication);
        const complianceRate = this.calculateComplianceRate(medication);
        const missedDoses = this.countMissedDoses(medication);

        return {
          medication,
          member,
          nextDose,
          lastTaken,
          complianceRate,
          missedDoses,
        };
      });
    } catch (error) {
      return [];
    }
  }

  /**
   * Mark medication as taken (for caregivers)
   */
  async markMedicationAsTaken(
    medicationId: string,
    memberId: string,
    caregiverId: string,
    familyId: string
  ): Promise<void> {
    try {
      // Verify caregiver has permission (is admin or same family)
      const caregiver = await userService.getUser(caregiverId);
      const member = await userService.getUser(memberId);

      if (!(caregiver && member)) {
        throw new Error("User not found");
      }

      // Check if caregiver is admin or same family
      if (
        caregiver.familyId !== familyId ||
        member.familyId !== familyId ||
        (caregiver.role !== "admin" &&
          caregiver.role !== "caregiver" &&
          caregiverId !== memberId)
      ) {
        throw new Error("Permission denied");
      }

      // Get medication
      const medication = await medicationService.getMedication(medicationId);
      if (!medication || medication.userId !== memberId) {
        throw new Error("Medication not found");
      }

      // Update medication with taken timestamp
      const now = Timestamp.now();
      const reminders = medication.reminders || [];

      // Helper function to convert Date to Timestamp for Firestore
      const convertToTimestamp = (value: Date | any): Timestamp | undefined => {
        if (!value) return;
        if (value instanceof Timestamp) return value;
        if (value instanceof Date) return Timestamp.fromDate(value);
        // If it's a Firestore Timestamp-like object with toDate method
        if (value.toDate && typeof value.toDate === "function") {
          return Timestamp.fromDate(value.toDate());
        }
        return Timestamp.fromDate(new Date(value));
      };

      // Find the next untaken reminder and mark it as taken
      let foundUntakenReminder = false;
      const updatedReminders = reminders.map((reminder) => {
        // Convert existing takenAt Date to Timestamp if it exists
        const takenAtTimestamp = reminder.takenAt
          ? convertToTimestamp(reminder.takenAt)
          : undefined;

        // Check if reminder is already taken
        const isTaken = reminder.taken || !!reminder.takenAt;

        // Only mark the first untaken reminder we encounter
        if (!(foundUntakenReminder || isTaken)) {
          foundUntakenReminder = true;
          return {
            id: reminder.id,
            time: reminder.time,
            taken: true,
            takenAt: now,
            takenBy: caregiverId !== memberId ? caregiverId : undefined, // Track if taken by caregiver
          };
        }
        // Return reminder with converted takenAt Timestamp (preserve existing takenBy if present)
        return {
          id: reminder.id,
          time: reminder.time,
          taken: reminder.taken,
          takenAt: takenAtTimestamp,
          ...(reminder.takenBy && { takenBy: reminder.takenBy }),
        };
      });

      // If no reminders exist or all are already taken, create a new one
      if (reminders.length === 0 || !foundUntakenReminder) {
        updatedReminders.push({
          id: Date.now().toString(),
          time: medication.reminders?.[0]?.time || "09:00",
          taken: true,
          takenAt: now,
          takenBy: caregiverId !== memberId ? caregiverId : undefined,
        });
      }

      // Use updateDoc directly to ensure Timestamp objects are properly handled
      // This bypasses updateMedication which might not handle nested Timestamps correctly
      await updateDoc(doc(db, "medications", medicationId), {
        reminders: updatedReminders,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get today's medication schedule for family
   */
  async getTodaySchedule(familyId: string): Promise<SharedScheduleDay> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const entries = await this.getFamilyMedicationSchedules(familyId);

    // Filter entries that have reminders scheduled for today
    // A medication should appear in today's schedule if it has any reminders
    // scheduled for today, regardless of whether they've been taken or not
    const todayEntries = entries.filter((entry) => {
      const medication = entry.medication;

      // Check if medication is active and has reminders
      if (
        !(medication.isActive && medication.reminders) ||
        medication.reminders.length === 0
      ) {
        return false;
      }

      // Check if medication has started (startDate is today or earlier)
      const startDate =
        medication.startDate instanceof Date
          ? medication.startDate
          : new Date(medication.startDate);
      const startDateOnly = new Date(startDate);
      startDateOnly.setHours(0, 0, 0, 0);
      if (startDateOnly.getTime() > today.getTime()) {
        return false;
      }

      // Check if medication has ended (endDate is before today)
      if (medication.endDate) {
        const endDate =
          medication.endDate instanceof Date
            ? medication.endDate
            : new Date(medication.endDate);
        const endDateOnly = new Date(endDate);
        endDateOnly.setHours(0, 0, 0, 0);
        if (endDateOnly.getTime() < today.getTime()) {
          return false;
        }
      }

      // If medication has reminders, it should appear in today's schedule
      // The reminders are scheduled daily based on their time values
      return true;
    });

    return {
      date: today,
      entries: todayEntries,
    };
  }

  /**
   * Get upcoming medications (next 7 days)
   */
  async getUpcomingSchedule(
    familyId: string,
    days = 7
  ): Promise<SharedScheduleDay[]> {
    const entries = await this.getFamilyMedicationSchedules(familyId);
    const scheduleDays: SharedScheduleDay[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);

      const dayEntries = entries.filter((entry) => {
        if (!entry.nextDose) return false;
        const entryDate = new Date(entry.nextDose);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === date.getTime();
      });

      scheduleDays.push({
        date,
        entries: dayEntries,
      });
    }

    return scheduleDays.filter((day) => day.entries.length > 0);
  }

  /**
   * Calculate next dose time for a medication
   */
  private calculateNextDose(medication: Medication): Date | undefined {
    if (
      !(medication.isActive && medication.reminders) ||
      medication.reminders.length === 0
    ) {
      return;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get all reminder times for today
    const reminderTimes = medication.reminders
      .map((r) => {
        const [hours, minutes] = r.time.split(":").map(Number);
        const reminderTime = new Date(today);
        reminderTime.setHours(hours, minutes, 0, 0);
        return reminderTime;
      })
      .sort((a, b) => a.getTime() - b.getTime());

    // Find next reminder time today
    const nextToday = reminderTimes.find((time) => time > now);
    if (nextToday) {
      return nextToday;
    }

    // If no more reminders today, return first reminder tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const firstReminder = reminderTimes[0];
    if (firstReminder) {
      const nextDose = new Date(tomorrow);
      const [hours, minutes] = medication.reminders[0].time
        .split(":")
        .map(Number);
      nextDose.setHours(hours, minutes, 0, 0);
      return nextDose;
    }

    return;
  }

  /**
   * Get last taken timestamp
   */
  private getLastTaken(medication: Medication): Date | undefined {
    if (!medication.reminders) return;

    const takenReminders = medication.reminders
      .filter((r) => r.takenAt)
      .map((r) => r.takenAt!)
      .sort((a, b) => {
        const dateA = a instanceof Date ? a : new Date(a);
        const dateB = b instanceof Date ? b : new Date(b);
        return dateB.getTime() - dateA.getTime();
      });

    return takenReminders.length > 0
      ? takenReminders[0] instanceof Date
        ? takenReminders[0]
        : new Date(takenReminders[0])
      : undefined;
  }

  /**
   * Calculate compliance rate (percentage of doses taken on time)
   */
  private calculateComplianceRate(medication: Medication): number {
    if (!medication.reminders || medication.reminders.length === 0) {
      return 100; // No reminders means 100% compliance
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Count total expected doses in last 30 days
    const frequency = this.parseFrequency(medication.frequency);
    const daysSinceStart = Math.floor(
      (now.getTime() - medication.startDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    const totalExpectedDoses = Math.min(
      daysSinceStart * frequency.dosesPerDay,
      30 * frequency.dosesPerDay
    );

    // Count taken doses
    const takenDoses = medication.reminders.filter(
      (r) =>
        (r.takenAt && new Date(r.takenAt) >= thirtyDaysAgo) ||
        (r.taken && r.takenAt)
    ).length;

    if (totalExpectedDoses === 0) return 100;

    return Math.round((takenDoses / totalExpectedDoses) * 100);
  }

  /**
   * Count missed doses
   */
  private countMissedDoses(medication: Medication): number {
    if (!medication.reminders || medication.reminders.length === 0) {
      return 0;
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const frequency = this.parseFrequency(medication.frequency);
    const expectedDoses = 7 * frequency.dosesPerDay;

    const takenDoses = medication.reminders.filter(
      (r) =>
        (r.takenAt && new Date(r.takenAt) >= sevenDaysAgo) ||
        (r.taken && r.takenAt)
    ).length;

    return Math.max(0, expectedDoses - takenDoses);
  }

  /**
   * Parse frequency string to get doses per day
   */
  private parseFrequency(frequency: string): { dosesPerDay: number } {
    const lower = frequency.toLowerCase();

    if (lower.includes("once") || lower.includes("daily")) {
      return { dosesPerDay: 1 };
    }
    if (lower.includes("twice") || lower.includes("2x")) {
      return { dosesPerDay: 2 };
    }
    if (lower.includes("three") || lower.includes("3x")) {
      return { dosesPerDay: 3 };
    }
    if (lower.includes("four") || lower.includes("4x")) {
      return { dosesPerDay: 4 };
    }

    // Default to once daily
    return { dosesPerDay: 1 };
  }

  /**
   * Check if user can manage medications for a family member
   */
  async canManageMedications(
    caregiverId: string,
    memberId: string
  ): Promise<boolean> {
    try {
      const caregiver = await userService.getUser(caregiverId);
      const member = await userService.getUser(memberId);

      if (!(caregiver && member)) return false;

      // Can manage if:
      // 1. Managing own medications
      // 2. Is admin in same family
      return (
        caregiverId === memberId ||
        (caregiver.role === "admin" &&
          caregiver.familyId === member.familyId &&
          !!member.familyId)
      );
    } catch (error) {
      return false;
    }
  }
}

export const sharedMedicationScheduleService =
  new SharedMedicationScheduleService();
