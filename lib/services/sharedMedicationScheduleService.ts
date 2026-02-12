import { doc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Medication, User } from "@/types";
import { coerceToDate } from "@/utils/dateCoercion";
import { medicationService } from "./medicationService";
import { userService } from "./userService";

export type MedicationScheduleEntry = {
  medication: Medication;
  member: User;
  nextDose?: Date;
  lastTaken?: Date;
  complianceRate?: number; // Percentage of doses taken on time
  missedDoses?: number;
};

export type SharedScheduleDay = {
  date: Date;
  entries: MedicationScheduleEntry[];
};

class SharedMedicationScheduleService {
  private readonly familyScheduleCacheTtlMs = 60_000;
  private readonly familyScheduleCache = new Map<
    string,
    { cachedAt: number; entries: MedicationScheduleEntry[] }
  >();
  private readonly familyScheduleInFlight = new Map<
    string,
    Promise<MedicationScheduleEntry[]>
  >();

  private isMedicationScheduledForDate(
    medication: Medication,
    targetDate: Date
  ): boolean {
    if (
      !(medication.isActive && medication.reminders) ||
      medication.reminders.length === 0
    ) {
      return false;
    }

    const startDate = new Date(medication.startDate);
    startDate.setHours(0, 0, 0, 0);
    if (startDate.getTime() > targetDate.getTime()) {
      return false;
    }

    if (medication.endDate) {
      const endDate = new Date(medication.endDate);
      endDate.setHours(0, 0, 0, 0);
      if (endDate.getTime() < targetDate.getTime()) {
        return false;
      }
    }

    return true;
  }

  private getTodayScheduleFromEntries(
    entries: MedicationScheduleEntry[],
    today = new Date()
  ): SharedScheduleDay {
    const normalizedToday = new Date(today);
    normalizedToday.setHours(0, 0, 0, 0);

    const todayEntries = entries.filter((entry) =>
      this.isMedicationScheduledForDate(entry.medication, normalizedToday)
    );

    return {
      date: normalizedToday,
      entries: todayEntries,
    };
  }

  private getUpcomingScheduleFromEntries(
    entries: MedicationScheduleEntry[],
    days = 7
  ): SharedScheduleDay[] {
    const scheduleDays: SharedScheduleDay[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);

      const dayEntries = entries.filter((entry) => {
        if (!entry.nextDose) {
          return false;
        }
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
   * Get all medication schedules for family members
   */
  async getFamilyMedicationSchedules(
    familyId: string,
    _userId?: string, // Current user ID (to check permissions)
    forceRefresh = false,
    familyMembersOverride?: User[]
  ): Promise<MedicationScheduleEntry[]> {
    const cached = this.familyScheduleCache.get(familyId);
    if (
      !forceRefresh &&
      cached &&
      Date.now() - cached.cachedAt < this.familyScheduleCacheTtlMs
    ) {
      return cached.entries;
    }

    const inFlight = this.familyScheduleInFlight.get(familyId);
    if (!forceRefresh && inFlight) {
      return inFlight;
    }

    const loadPromise = (async () => {
      try {
        // Get all family members
        const familyMembers =
          familyMembersOverride && familyMembersOverride.length > 0
            ? familyMembersOverride
            : await userService.getFamilyMembers(familyId);

        // Get medications for all family members in parallel
        const medicationResults = await Promise.allSettled(
          familyMembers.map((member) =>
            medicationService.getUserMedications(member.id)
          )
        );

        const scheduleEntries: MedicationScheduleEntry[] = [];

        for (const [index, result] of medicationResults.entries()) {
          if (result.status !== "fulfilled") {
            continue;
          }

          const member = familyMembers[index];
          if (!member) {
            continue;
          }

          const activeMedications = result.value.filter((m) => m.isActive);

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
          if (!(a.nextDose || b.nextDose)) {
            return 0;
          }
          if (!a.nextDose) {
            return 1;
          }
          if (!b.nextDose) {
            return -1;
          }
          return a.nextDose.getTime() - b.nextDose.getTime();
        });

        this.familyScheduleCache.set(familyId, {
          cachedAt: Date.now(),
          entries: scheduleEntries,
        });

        return scheduleEntries;
      } catch (_error) {
        return [];
      } finally {
        this.familyScheduleInFlight.delete(familyId);
      }
    })();

    this.familyScheduleInFlight.set(familyId, loadPromise);

    try {
      return await loadPromise;
    } catch (_error) {
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
    } catch (_error) {
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
    const convertToTimestamp = (value: unknown): Timestamp | undefined => {
      if (!value) {
        return;
      }
      if (value instanceof Timestamp) {
        return value;
      }
      if (value instanceof Date) {
        return Timestamp.fromDate(value);
      }
      // If it's a Firestore Timestamp-like object with toDate method
      if (
        typeof value === "object" &&
        value &&
        "toDate" in value &&
        typeof value.toDate === "function"
      ) {
        return Timestamp.fromDate(value.toDate());
      }
      if (typeof value === "string" || typeof value === "number") {
        return Timestamp.fromDate(new Date(value));
      }
      return;
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
  }

  /**
   * Get today's medication schedule for family
   */
  async getTodaySchedule(
    familyId: string,
    forceRefresh = false,
    familyMembersOverride?: User[]
  ): Promise<SharedScheduleDay> {
    const entries = await this.getFamilyMedicationSchedules(
      familyId,
      undefined,
      forceRefresh,
      familyMembersOverride
    );
    return this.getTodayScheduleFromEntries(entries);
  }

  /**
   * Get upcoming medications (next 7 days)
   */
  async getUpcomingSchedule(
    familyId: string,
    days = 7,
    forceRefresh = false,
    familyMembersOverride?: User[]
  ): Promise<SharedScheduleDay[]> {
    const entries = await this.getFamilyMedicationSchedules(
      familyId,
      undefined,
      forceRefresh,
      familyMembersOverride
    );
    return this.getUpcomingScheduleFromEntries(entries, days);
  }

  /**
   * Get entries + today + upcoming schedules with a single family-medications fetch.
   */
  async getFamilyScheduleBundle(
    familyId: string,
    userId?: string,
    forceRefresh = false,
    familyMembersOverride?: User[],
    upcomingDays = 7
  ): Promise<{
    entries: MedicationScheduleEntry[];
    today: SharedScheduleDay;
    upcoming: SharedScheduleDay[];
  }> {
    const entries = await this.getFamilyMedicationSchedules(
      familyId,
      userId,
      forceRefresh,
      familyMembersOverride
    );
    const today = this.getTodayScheduleFromEntries(entries);
    const upcoming = this.getUpcomingScheduleFromEntries(entries, upcomingDays);

    return { entries, today, upcoming };
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
    if (!medication.reminders) {
      return;
    }

    const takenReminders = medication.reminders
      .filter((r) => r.takenAt)
      .map((r) => coerceToDate(r.takenAt))
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime());

    return takenReminders.length > 0 ? takenReminders[0] : undefined;
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
    const takenDoses = medication.reminders.filter((r) => {
      const takenAt = coerceToDate(r.takenAt);
      return (!!takenAt && takenAt >= thirtyDaysAgo) || (r.taken && !!takenAt);
    }).length;

    if (totalExpectedDoses === 0) {
      return 100;
    }

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

    const takenDoses = medication.reminders.filter((r) => {
      const takenAt = coerceToDate(r.takenAt);
      return (!!takenAt && takenAt >= sevenDaysAgo) || (r.taken && !!takenAt);
    }).length;

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

      if (!(caregiver && member)) {
        return false;
      }

      // Can manage if:
      // 1. Managing own medications
      // 2. Is admin in same family
      return (
        caregiverId === memberId ||
        (caregiver.role === "admin" &&
          caregiver.familyId === member.familyId &&
          !!member.familyId)
      );
    } catch (_error) {
      return false;
    }
  }
}

export const sharedMedicationScheduleService =
  new SharedMedicationScheduleService();
