/**
 * Medication Refill Service
 *
 * Manages medication refill workflows including fetching pending refills,
 * submitting refill requests, retrieving upcoming refill reminders, and
 * dismissing reminders the user has acknowledged. All operations go through
 * the backend REST API.
 */

import { api } from "@/lib/apiClient";
import { logger } from "@/lib/utils/logger";
import type { Medication } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MedicationRefill = {
  id: string;
  userId: string;
  medicationId: string;
  medicationName: string;
  daysRemaining: number;
  lastFillDate?: Date;
  pharmacyName?: string;
  status: "pending" | "requested" | "ready" | "dismissed";
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

type RawRefill = Omit<MedicationRefill, "lastFillDate"> & {
  lastFillDate?: string;
};

function deserializeRefill(raw: RawRefill): MedicationRefill {
  return {
    ...raw,
    lastFillDate: raw.lastFillDate ? new Date(raw.lastFillDate) : undefined,
  };
}

// ─── Singleton Service ────────────────────────────────────────────────────────

export const medicationRefillService = {
  /**
   * Retrieves all pending medication refills for the given user.
   * Returns an empty array if the request fails.
   */
  getPendingRefills: async (userId: string): Promise<MedicationRefill[]> => {
    try {
      const raw = await api.get<RawRefill[]>(
        `/api/medications/refills/pending?userId=${encodeURIComponent(userId)}`
      );
      return (Array.isArray(raw) ? raw : []).map(deserializeRefill);
    } catch (error: unknown) {
      logger.error(
        "Failed to fetch pending medication refills",
        { userId, error },
        "MedicationRefill"
      );
      return [];
    }
  },

  /**
   * Submits a refill request for the specified medication.
   */
  requestRefill: async (medicationId: string): Promise<void> => {
    try {
      await api.post("/api/medications/refills", { medicationId });
    } catch (error: unknown) {
      logger.error(
        "Failed to request medication refill",
        { medicationId, error },
        "MedicationRefill"
      );
    }
  },

  /**
   * Retrieves upcoming refill reminders for the given user.
   * Returns an empty array if the request fails.
   */
  getRefillReminders: async (userId: string): Promise<MedicationRefill[]> => {
    try {
      const raw = await api.get<RawRefill[]>(
        `/api/medications/refills/reminders?userId=${encodeURIComponent(userId)}`
      );
      return (Array.isArray(raw) ? raw : []).map(deserializeRefill);
    } catch (error: unknown) {
      logger.error(
        "Failed to fetch refill reminders",
        { userId, error },
        "MedicationRefill"
      );
      return [];
    }
  },

  /**
   * Generates client-side refill predictions from the current medication list.
   * Returns a summary object consumed by smartNotificationService and
   * proactiveHealthSuggestionsService.
   */
  getRefillPredictions: (medications: Medication[]): {
    predictions: Array<{
      medicationId: string;
      medicationName: string;
      daysUntilRefill: number;
      needsRefill: boolean;
      urgency: "critical" | "high" | "medium" | "low";
    }>;
  } => {
    const predictions = medications
      .filter((med) => med.isActive && med.refillDate != null)
      .map((med) => {
        const refillDate = med.refillDate as Date;
        const daysUntilRefill = Math.ceil(
          (refillDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        const needsRefill = daysUntilRefill <= 7;
        const urgency: "critical" | "high" | "medium" | "low" =
          daysUntilRefill <= 0
            ? "critical"
            : daysUntilRefill <= 2
              ? "high"
              : daysUntilRefill <= 5
                ? "medium"
                : "low";
        return {
          medicationId: med.id,
          medicationName: med.name,
          daysUntilRefill,
          needsRefill,
          urgency,
        };
      });
    return { predictions };
  },

  /**
   * Formats a days-until-refill count into a human-readable string.
   */
  formatDaysUntilRefill: (days: number): string => {
    if (days <= 0) return "now";
    if (days === 1) return "1 day";
    return `${days} days`;
  },

  /**
   * Marks a refill reminder as dismissed so it no longer appears to the user.
   */
  dismissReminder: async (refillId: string): Promise<void> => {
    try {
      await api.patch(`/api/medications/refills/${encodeURIComponent(refillId)}/dismiss`, {});
    } catch (error: unknown) {
      logger.error(
        "Failed to dismiss refill reminder",
        { refillId, error },
        "MedicationRefill"
      );
    }
  },
};

export default medicationRefillService;
