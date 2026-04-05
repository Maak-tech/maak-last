/**
 * FreeStyle Libre Service
 *
 * Provides integration with the FreeStyle Libre continuous glucose monitoring
 * system via the backend REST API. Supports fetching the current glucose reading,
 * checking connection status, and retrieving historical readings for a user.
 */

import { api } from "@/lib/apiClient";
import { logger } from "@/lib/utils/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

type GlucoseReading = {
  value: number;
  unit: string;
  timestamp: Date;
  trend?: string;
};

// ─── Singleton Service ────────────────────────────────────────────────────────

export const freestyleLibreService = {
  /**
   * Fetches the most recent glucose reading for the given user.
   * Returns null if the user has no active sensor or the request fails.
   */
  getCurrentGlucose: async (
    userId: string
  ): Promise<GlucoseReading | null> => {
    try {
      const raw = await api.get<{
        value: number;
        unit: string;
        timestamp: string;
      }>(
        `/api/integrations/freestyle-libre/current?userId=${encodeURIComponent(userId)}`
      );
      if (!raw) return null;
      return {
        value: raw.value,
        unit: raw.unit,
        timestamp: new Date(raw.timestamp),
      };
    } catch (error: unknown) {
      logger.error(
        "Failed to fetch current FreeStyle Libre glucose",
        { userId, error },
        "FreestyleLibre"
      );
      return null;
    }
  },

  /**
   * Checks whether the given user has an active FreeStyle Libre connection.
   */
  isConnected: async (userId: string): Promise<boolean> => {
    try {
      const raw = await api.get<{ connected: boolean }>(
        `/api/integrations/freestyle-libre/status?userId=${encodeURIComponent(userId)}`
      );
      return raw?.connected ?? false;
    } catch (error: unknown) {
      logger.error(
        "Failed to check FreeStyle Libre connection status",
        { userId, error },
        "FreestyleLibre"
      );
      return false;
    }
  },

  /**
   * Retrieves historical glucose readings for the given user since the specified date.
   * Returns an empty array if the request fails.
   */
  getReadings: async (
    userId: string,
    since: Date
  ): Promise<GlucoseReading[]> => {
    try {
      const sinceParam = encodeURIComponent(since.toISOString());
      const raw = await api.get<
        Array<{ value: number; unit: string; timestamp: string }>
      >(
        `/api/integrations/freestyle-libre/readings?userId=${encodeURIComponent(userId)}&since=${sinceParam}`
      );
      return (Array.isArray(raw) ? raw : []).map((item) => ({
        value: item.value,
        unit: item.unit,
        timestamp: new Date(item.timestamp),
      }));
    } catch (error: unknown) {
      logger.error(
        "Failed to fetch FreeStyle Libre readings",
        { userId, error },
        "FreestyleLibre"
      );
      return [];
    }
  },
};

export default freestyleLibreService;
