/**
 * Apple Health Service
 *
 * Provides integration with Apple HealthKit via the backend REST API.
 * Handles availability checks, permission requests, connection state retrieval,
 * and syncing health metric readings from Apple Health on iOS devices.
 */

import { Platform } from "react-native";
import { api } from "@/lib/apiClient";
import type {
  HealthMetricReading,
  ProviderConnection,
  SyncResult,
} from "@/lib/health/healthTypes";

// ─── Singleton Service ────────────────────────────────────────────────────────

export const appleHealthService = {
  /**
   * Returns true only on iOS, where Apple HealthKit is available.
   */
  isAvailable: async (): Promise<boolean> => {
    return Platform.OS === "ios";
  },

  /**
   * Requests HealthKit authorization for the given list of metric types.
   * Calls the backend to register the permissions grant.
   */
  requestPermissions: async (metrics: string[]): Promise<boolean> => {
    try {
      const result = await api.post<{ granted: boolean }>(
        "/api/integrations/apple-health/permissions",
        { metrics }
      );
      return result?.granted ?? false;
    } catch {
      return false;
    }
  },

  /**
   * Retrieves the current Apple Health provider connection state,
   * including whether it is connected and which metrics are authorized.
   */
  getConnection: async (): Promise<ProviderConnection> => {
    try {
      const result = await api.get<ProviderConnection>(
        "/api/integrations/apple-health/connection"
      );
      return (
        result ?? {
          provider: "apple_health",
          isConnected: false,
          authorizedMetrics: [],
        }
      );
    } catch {
      return {
        provider: "apple_health",
        isConnected: false,
        authorizedMetrics: [],
      };
    }
  },

  /**
   * Syncs health metric readings from Apple Health for the given metric types
   * since the specified date. Returns the readings and a sync result summary.
   */
  syncReadings: async (
    metrics: string[],
    since: Date
  ): Promise<{ readings: HealthMetricReading[]; result: SyncResult }> => {
    const metricsParam = metrics
      .map((m) => encodeURIComponent(m))
      .join(",");
    const sinceParam = encodeURIComponent(since.toISOString());

    try {
      const response = await api.get<{
        readings: HealthMetricReading[];
        result: SyncResult;
      }>(
        `/api/integrations/apple-health/readings?metrics=${metricsParam}&since=${sinceParam}`
      );
      return (
        response ?? {
          readings: [],
          result: {
            provider: "apple_health",
            recordsSynced: 0,
            recordsSkipped: 0,
            errors: [],
            syncedAt: new Date().toISOString(),
            duration: 0,
          },
        }
      );
    } catch {
      return {
        readings: [],
        result: {
          provider: "apple_health",
          recordsSynced: 0,
          recordsSkipped: 0,
          errors: ["Sync request failed"],
          syncedAt: new Date().toISOString(),
          duration: 0,
        },
      };
    }
  },
};

export default appleHealthService;
