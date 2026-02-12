/**
 * Unified Health Data Sync Module
 * Handles syncing health data from all providers to backend
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import {
  getProviderConnection,
  getProviderStorageKey,
  saveProviderConnection,
} from "./providerConnections";

export {
  getProviderConnection,
  saveProviderConnection,
} from "./providerConnections";

// Import services
// Lazy import to prevent early native module loading
// import { appleHealthService } from "../services/appleHealthService";
import { healthConnectService } from "../services/healthConnectService";
import type { HealthProvider } from "./healthMetricsCatalog";
import type {
  DeviceInfo,
  HealthSyncPayload,
  ProviderConnection,
  SyncResult,
} from "./healthTypes";

const BACKEND_HEALTH_SYNC_URL = "/health/sync"; // Unified endpoint
const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

/**
 * Get device information
 */
const getDeviceInfo = (): DeviceInfo => ({
  platform: Platform.OS as "ios" | "android",
  model: Platform.select({
    ios: "iOS Device",
    android: "Android Device",
    default: "Unknown",
  }),
  osVersion: Platform.Version?.toString(),
  appVersion: Constants.expoConfig?.version || "1.0.0",
});

/**
 * Disconnect provider
 */
export const disconnectProvider = async (
  provider: HealthProvider
): Promise<void> => {
  // Clear connection data and call service disconnect methods
  const storageKey = getProviderStorageKey(provider);
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
      } catch {
        // Best effort disconnect for optional provider.
      }
      break;
    case "garmin":
      try {
        const { garminService } = await import("../services/garminService");
        await garminService.disconnect();
      } catch {
        // Best effort disconnect for optional provider.
      }
      break;
    case "withings":
      try {
        const { withingsService } = await import("../services/withingsService");
        await withingsService.disconnect();
      } catch {
        // Best effort disconnect for optional provider.
      }
      break;
    case "oura":
      try {
        const { ouraService } = await import("../services/ouraService");
        await ouraService.disconnect();
      } catch {
        // Best effort disconnect for optional provider.
      }
      break;
    case "dexcom":
      try {
        const { dexcomService } = await import("../services/dexcomService");
        await dexcomService.disconnect();
      } catch {
        // Best effort disconnect for optional provider.
      }
      break;
    case "freestyle_libre":
      try {
        const { freestyleLibreService } = await import(
          "../services/freestyleLibreService"
        );
        await freestyleLibreService.disconnect();
      } catch {
        // Best effort disconnect for optional provider.
      }
      break;
  }

  await AsyncStorage.removeItem(storageKey);
};

/**
 * Sync health data from provider to backend
 */
export const syncHealthData = async (
  provider: HealthProvider,
  retryOnce = true
): Promise<SyncResult> => {
  try {
    // CRITICAL: Check app state before heavy operations
    // Defer sync if app is backgrounded or inactive to prevent crashes
    const appState = AppState.currentState;
    if (appState !== "active") {
      // Return early if app is not active - sync will be retried when app becomes active
      return {
        success: false,
        provider,
        syncedAt: new Date().toISOString(),
        metricsCount: 0,
        samplesCount: 0,
        error: "App is not in active state - sync deferred",
      };
    }

    // Get provider connection
    const connection = await getProviderConnection(provider);
    if (!connection?.connected) {
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

    // Fetch metrics from provider

    let metrics: HealthSyncPayload["metrics"];
    switch (provider) {
      case "apple_health": {
        // Lazy import to prevent early native module loading
        const { appleHealthService } = await import(
          "../services/appleHealthService"
        );
        metrics = await appleHealthService.fetchMetrics(
          connection.selectedMetrics,
          startDate,
          endDate
        );
        break;
      }
      case "health_connect":
        metrics = await healthConnectService.fetchMetrics(
          connection.selectedMetrics,
          startDate,
          endDate
        );
        break;
      case "fitbit":
        {
          const { fitbitService } = await import("../services/fitbitService");
          metrics = await fitbitService.fetchMetrics(
            connection.selectedMetrics,
            startDate,
            endDate
          );
        }
        break;
      case "samsung_health": {
        const { samsungHealthService } = await import(
          "../services/samsungHealthService"
        );
        metrics = await samsungHealthService.fetchMetrics(
          connection.selectedMetrics,
          startDate,
          endDate
        );
        break;
      }
      case "garmin": {
        const { garminService } = await import("../services/garminService");
        metrics = await garminService.fetchMetrics(
          connection.selectedMetrics,
          startDate,
          endDate
        );
        break;
      }
      case "withings": {
        const { withingsService } = await import("../services/withingsService");
        metrics = await withingsService.fetchMetrics(
          connection.selectedMetrics,
          startDate,
          endDate
        );
        break;
      }
      case "oura": {
        const { ouraService } = await import("../services/ouraService");
        metrics = await ouraService.fetchMetrics(
          connection.selectedMetrics,
          startDate,
          endDate
        );
        break;
      }
      case "dexcom": {
        const { dexcomService } = await import("../services/dexcomService");
        metrics = await dexcomService.fetchMetrics(
          connection.selectedMetrics,
          startDate,
          endDate
        );
        break;
      }
      case "freestyle_libre": {
        const { freestyleLibreService } = await import(
          "../services/freestyleLibreService"
        );
        metrics = await freestyleLibreService.fetchMetrics(
          connection.selectedMetrics,
          startDate,
          endDate
        );
        break;
      }
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    // Create sync payload
    const payload: HealthSyncPayload = {
      provider,
      selectedMetrics: connection.selectedMetrics,
      range: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      device: getDeviceInfo(),
      metrics,
    };

    // Send to backend (if endpoint exists)
    try {
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
    } catch (_error) {
      // Backend sync endpoint not available, saving to Firestore only: ${error}
      // Continue to save to Firestore
    }

    // Save vitals to Firestore for benchmark checking and admin alerts
    try {
      const { saveSyncVitalsToFirestore } = await import(
        "../services/vitalSyncService"
      );
      await saveSyncVitalsToFirestore({
        provider,
        metrics,
      });
    } catch (_error) {
      // Don't fail the sync if Firestore save fails
    }

    // Update last sync timestamp
    connection.lastSyncAt = new Date().toISOString();
    await saveProviderConnection(connection);

    const result: SyncResult = {
      success: true,
      provider,
      syncedAt: connection.lastSyncAt,
      metricsCount: metrics.length,
      samplesCount: metrics.reduce((sum, m) => sum + m.samples.length, 0),
    };

    return result;
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    // Retry once on network failure
    if (retryOnce && errorMessage.includes("network")) {
      return syncHealthData(provider, false);
    }

    return {
      success: false,
      provider,
      syncedAt: new Date().toISOString(),
      metricsCount: 0,
      samplesCount: 0,
      error: errorMessage,
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
    const connection = await getProviderConnection(provider);
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
    "freestyle_libre",
  ];

  const connections = await Promise.all(
    providers.map((p) => getProviderConnection(p))
  );

  return connections.filter(
    (c): c is ProviderConnection => c?.connected === true
  );
};
