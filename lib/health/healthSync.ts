/**
 * Unified Health Data Sync Module
 * Handles syncing health data from all providers to backend
 */

import { AppState, Platform } from "react-native";
import {
  getProviderConnection,
  saveProviderConnection,
  disconnectProvider as _disconnectProviderConnection,
} from "./providerConnections";

export {
  getProviderConnection,
  saveProviderConnection,
} from "./providerConnections";

// Import services
import { healthConnectService } from "../services/healthConnectService";
import type { HealthProvider } from "./healthMetricsCatalog";
import type {
  HealthMetricReading,
  NormalizedMetricPayload,
  ProviderConnection,
  ProviderType,
  SyncResult,
} from "./healthTypes";

const BACKEND_HEALTH_SYNC_URL = "/health/sync"; // Unified endpoint
const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

/** Convert HealthMetricReading[] (apple/health_connect shape) to NormalizedMetricPayload[] */
function readingsToMetricPayloads(
  rawReadings: HealthMetricReading[],
  providerName: string
): NormalizedMetricPayload[] {
  const map = new Map<string, NormalizedMetricPayload>();
  for (const r of rawReadings) {
    let payload = map.get(r.type);
    if (!payload) {
      payload = { provider: providerName, metricKey: r.type, unit: r.unit, samples: [] };
      map.set(r.type, payload);
    }
    payload.samples.push({ value: r.value, unit: r.unit, startDate: r.recordedAt });
  }
  return Array.from(map.values());
}

// Placeholder userId — callers should pass a real userId; using a module-level
// default keeps the public API unchanged while satisfying the new 2-arg signatures.
let _currentUserId = "unknown";

/** Call this once at app startup (e.g. from AuthContext) to set the active user. */
export function setHealthSyncUserId(userId: string): void {
  _currentUserId = userId;
}

/**
 * Disconnect provider
 */
export const disconnectProvider = async (
  provider: HealthProvider
): Promise<void> => {
  // Call provider-specific SDK disconnect, then remove the connection record.
  switch (provider) {
    case "apple_health":
      break;
    case "health_connect":
      break;
    case "fitbit":
      {
        const { fitbitService } = await import("../services/fitbitService");
        await fitbitService.disconnect();
      }
      break;
    case "samsung_health":
      try {
        const { samsungHealthService } = await import(
          "../services/samsungHealthService"
        );
        await samsungHealthService.disconnect();
      } catch (err: unknown) {
        console.debug('[healthSync] samsung_health disconnect non-critical error:', err instanceof Error ? err.message : String(err));
      }
      break;
    case "garmin":
      try {
        const { garminService } = await import("../services/garminService");
        await garminService.disconnect();
      } catch (err: unknown) {
        console.debug('[healthSync] garmin disconnect non-critical error:', err instanceof Error ? err.message : String(err));
      }
      break;
    case "withings":
      try {
        const { withingsService } = await import("../services/withingsService");
        await withingsService.disconnect();
      } catch (err: unknown) {
        console.debug('[healthSync] withings disconnect non-critical error:', err instanceof Error ? err.message : String(err));
      }
      break;
    case "oura":
      try {
        const { ouraService } = await import("../services/ouraService");
        await ouraService.disconnect();
      } catch (err: unknown) {
        console.debug('[healthSync] oura disconnect non-critical error:', err instanceof Error ? err.message : String(err));
      }
      break;
    case "dexcom":
      try {
        const { dexcomService } = await import("../services/dexcomService");
        await dexcomService.disconnect();
      } catch (err: unknown) {
        console.debug('[healthSync] dexcom disconnect non-critical error:', err instanceof Error ? err.message : String(err));
      }
      break;
    default:
      break;
  }

  try {
    await _disconnectProviderConnection(_currentUserId, provider as ProviderType);
  } catch (err: unknown) {
    console.debug('[healthSync] disconnectProviderConnection non-critical error:', err instanceof Error ? err.message : String(err));
  }
};

/**
 * Sync health data from provider to backend
 */
export const syncHealthData = async (
  provider: HealthProvider,
  retryOnce = true
): Promise<SyncResult> => {
  const syncStart = Date.now();
  try {
    // CRITICAL: Check app state before heavy operations
    // Defer sync if app is backgrounded or inactive to prevent crashes
    const appState = AppState.currentState;
    if (appState !== "active") {
      // Return early if app is not active - sync will be retried when app becomes active
      return {
        provider: provider as ProviderType,
        recordsSynced: 0,
        recordsSkipped: 0,
        errors: ["App is not in active state - sync deferred"],
        syncedAt: new Date().toISOString(),
        duration: Date.now() - syncStart,
      };
    }

    // Get provider connection
    const connection = await getProviderConnection(_currentUserId, provider as ProviderType);
    if (!connection?.isConnected) {
      throw new Error(`${provider} not connected`);
    }

    // Calculate date range (last 30 days or since last sync)
    const endDate = new Date();
    let startDate: Date;
    if (connection.lastSyncAt) {
      // Start from last sync, but ensure at least 1 day range
      const lastSync = new Date(connection.lastSyncAt);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      startDate = lastSync < oneDayAgo ? lastSync : oneDayAgo;
    } else {
      // First sync: get last 30 days
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const selectedMetrics: string[] = connection.authorizedMetrics ?? [];

    // Fetch metrics from provider — normalised to NormalizedMetricPayload[]
    // so they can be forwarded to saveSyncVitals.
    let metrics: NormalizedMetricPayload[] = [];

    switch (provider) {
      case "apple_health": {
        // Lazy import to prevent early native module loading
        const { appleHealthService } = await import(
          "../services/appleHealthService"
        );
        const result = await appleHealthService.syncReadings(
          selectedMetrics,
          startDate
        );
        metrics = readingsToMetricPayloads(result.readings ?? [], "apple_health");
        break;
      }
      case "health_connect": {
        const result = await healthConnectService.syncReadings(
          selectedMetrics,
          startDate
        );
        metrics = readingsToMetricPayloads(result.readings ?? [], "health_connect");
        break;
      }
      case "fitbit": {
        const { fitbitService } = await import("../services/fitbitService");
        metrics = await fitbitService.fetchMetrics(
          selectedMetrics,
          startDate,
          endDate
        );
        break;
      }
      case "samsung_health": {
        const { samsungHealthService } = await import(
          "../services/samsungHealthService"
        );
        metrics = await samsungHealthService.fetchMetrics(
          selectedMetrics,
          startDate,
          endDate
        );
        break;
      }
      case "garmin": {
        const { garminService } = await import("../services/garminService");
        metrics = await garminService.fetchMetrics(
          selectedMetrics,
          startDate,
          endDate
        );
        break;
      }
      case "withings": {
        const { withingsService } = await import("../services/withingsService");
        metrics = await withingsService.fetchMetrics(
          selectedMetrics,
          startDate,
          endDate
        );
        break;
      }
      case "oura": {
        const { ouraService } = await import("../services/ouraService");
        metrics = await ouraService.fetchMetrics(
          selectedMetrics,
          startDate,
          endDate
        );
        break;
      }
      case "dexcom": {
        const { dexcomService } = await import("../services/dexcomService");
        metrics = await dexcomService.fetchMetrics(
          selectedMetrics,
          startDate,
          endDate
        );
        break;
      }
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    // Send to backend (if endpoint exists)
    try {
      const payload = {
        provider,
        selectedMetrics,
        range: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        device: {
          id: "device",
          name: Platform.select({ ios: "iOS Device", android: "Android Device", default: "Unknown" }) ?? "Unknown",
          osVersion: Platform.Version?.toString(),
        },
        metrics,
      };
      const response = await fetch(BACKEND_HEALTH_SYNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Backend sync failed: ${response.statusText}
        // Continue anyway to save to Firestore
      }
    } catch (error: unknown) {
      console.warn('[healthSync] Backend sync endpoint unavailable, Firestore only:', error instanceof Error ? error.message : String(error));
    }

    // Save vitals to Firestore for benchmark checking and admin alerts
    try {
      const { saveSyncVitals } = await import(
        "../services/vitalSyncService"
      );
      await saveSyncVitals({
        provider,
        metrics,
      });
    } catch (error: unknown) {
      console.warn('[healthSync] Firestore save failed (non-critical):', error instanceof Error ? error.message : String(error));
    }

    // Update last sync timestamp
    const updatedConnection: ProviderConnection = {
      ...connection,
      lastSyncAt: new Date().toISOString(),
    };
    await saveProviderConnection(_currentUserId, updatedConnection);

    const totalSamples = metrics.reduce((sum, m) => sum + m.samples.length, 0);
    const result: SyncResult = {
      provider: provider as ProviderType,
      recordsSynced: totalSamples,
      recordsSkipped: 0,
      errors: [],
      syncedAt: updatedConnection.lastSyncAt!,
      duration: Date.now() - syncStart,
    };

    return result;
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    // Retry once on network failure
    if (retryOnce && errorMessage.includes("network")) {
      return syncHealthData(provider, false);
    }

    return {
      provider: provider as ProviderType,
      recordsSynced: 0,
      recordsSkipped: 0,
      errors: [errorMessage],
      syncedAt: new Date().toISOString(),
      duration: Date.now() - syncStart,
    };
  }
};

/**
 * Get last sync timestamp for provider
 */
export const getLastSyncTimestamp = async (
  provider: HealthProvider
): Promise<string | null> => {
  try {
    const connection = await getProviderConnection(_currentUserId, provider as ProviderType);
    return connection?.lastSyncAt || null;
  } catch {
    return null;
  }
};

/**
 * Get all connected providers
 */
export const getAllConnectedProviders = async (): Promise<
  ProviderConnection[]
> => {
  const providers: HealthProvider[] = [
    "apple_health",
    "health_connect",
    "fitbit",
    "samsung_health",
    "garmin",
    "withings",
    "oura",
    "dexcom",
  ];

  const connections = await Promise.all(
    providers.map((p) => getProviderConnection(_currentUserId, p as ProviderType))
  );

  return connections.filter(
    (c): c is ProviderConnection => c?.isConnected === true
  );
};
