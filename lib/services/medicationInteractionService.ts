/**
 * Medication Interaction Service
 *
 * Provides real-time medication interaction alert generation and on-demand
 * interaction checking between sets of medications. Uses the backend REST API
 * to surface clinically significant drug-drug interactions for a given user.
 */

import { api } from "@/lib/apiClient";
import { logger } from "@/lib/utils/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MedicationInteraction = {
  drug1: string;
  drug2: string;
  severity: "mild" | "moderate" | "severe" | "contraindicated";
  description: string;
};

export type MedicationInteractionAlert = {
  id: string;
  userId: string;
  interaction: MedicationInteraction;
  activeMedications: string[];
  createdAt: Date;
};

// ─── Singleton Service ────────────────────────────────────────────────────────

export const medicationInteractionService = {
  /**
   * Generates real-time interaction alerts for all active medications of a user.
   * Returns an empty array if the request fails.
   */
  generateRealtimeAlerts: async (
    userId: string
  ): Promise<MedicationInteractionAlert[]> => {
    try {
      const raw = await api.get<
        Array<
          Omit<MedicationInteractionAlert, "createdAt"> & { createdAt: string }
        >
      >(
        `/api/medications/interaction-alerts?userId=${encodeURIComponent(userId)}`
      );
      return (raw ?? []).map((item) => ({
        ...item,
        createdAt: new Date(item.createdAt),
      }));
    } catch (error) {
      logger.error(
        "Failed to fetch real-time medication interaction alerts",
        { userId, error },
        "MedicationInteraction"
      );
      return [];
    }
  },

  /**
   * Checks for interactions between the given list of medication IDs.
   * Returns an empty array if the request fails.
   */
  checkInteractions: async (
    medicationIds: string[]
  ): Promise<MedicationInteraction[]> => {
    try {
      const raw = await api.post<MedicationInteraction[]>(
        "/api/medications/check-interactions",
        { medicationIds }
      );
      return raw ?? [];
    } catch (error) {
      logger.error(
        "Failed to check medication interactions",
        { medicationIds, error },
        "MedicationInteraction"
      );
      return [];
    }
  },
};

export default medicationInteractionService;
