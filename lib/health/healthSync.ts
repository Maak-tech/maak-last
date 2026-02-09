/**
 * Unified Health Data Sync Module
 * Handles syncing health data from all providers to backend
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import { fitbitService } from "../services/fitbitService";
// Import services
// Lazy import to prevent early native module loading
// import { appleHealthService } from "../services/appleHealthService";
import { healthConnectService } from "../services/healthConnectService";
import { saveSyncVitalsToFirestore } from "../services/vitalSyncService";
import type { HealthProvider } from "./healthMetricsCatalog";
import type {
  DeviceInfo,
  HealthSyncPayload,
  ProviderConnection,
  SyncResult,
} from "./healthTypes";
import { HEALTH_STORAGE_KEYS } from "./healthTypes";

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
 * Get provider connection status
 */
export const getProviderConnection = async (
  provider: HealthProvider
): Promise<ProviderConnection | null> => {
  try {
    let storageKey: string;
    switch (provider) {
      case "apple_health":
        storageKey = HEALTH_STORAGE_KEYS.APPLE_HEALTH_CONNECTION;
        break;
      case "health_connect":
        storageKey = HEALTH_STORAGE_KEYS.HEALTH_CONNECT_CONNECTION;
        break;
      case "fitbit":
        storageKey = HEALTH_STORAGE_KEYS.FITBIT_CONNECTION;
        break;
      case "samsung_health":
        storageKey = HEALTH_STORAGE_KEYS.SAMSUNG_HEALTH_TOKENS;
        break;
      case "garmin":
        storageKey = HEALTH_STORAGE_KEYS.GARMIN_TOKENS;
        break;
      case "withings":
        storageKey = HEALTH_STORAGE_KEYS.WITHINGS_TOKENS;
        break;
      case "oura":
        storageKey = HEALTH_STORAGE_KEYS.OURA_TOKENS;
        break;
      case "dexcom":
        storageKey = HEALTH_STORAGE_KEYS.DEXCOM_TOKENS;
        break;
      case "freestyle_libre":
        storageKey = HEALTH_STORAGE_KEYS.FREESTYLE_LIBRE_TOKENS;
        break;
      default:
        return null;
    }

    const data = await AsyncStorage.getItem(storageKey);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

/**
 * Save provider connection status
 */
export const saveProviderConnection = async (
  connection: ProviderConnection
): Promise<void> => {
  let storageKey: string;
  switch (connection.provider) {
    case "apple_health":
      storageKey = HEALTH_STORAGE_KEYS.APPLE_HEALTH_CONNECTION;
      break;
    case "health_connect":
      storageKey = HEALTH_STORAGE_KEYS.HEALTH_CONNECT_CONNECTION;
      break;
    case "fitbit":
      storageKey = HEALTH_STORAGE_KEYS.FITBIT_CONNECTION;
      break;
    case "samsung_health":
      storageKey = HEALTH_STORAGE_KEYS.SAMSUNG_HEALTH_TOKENS;
      break;
    case "garmin":
      storageKey = HEALTH_STORAGE_KEYS.GARMIN_TOKENS;
      break;
    case "withings":
      storageKey = HEALTH_STORAGE_KEYS.WITHINGS_TOKENS;
      break;
    case "oura":
      storageKey = HEALTH_STORAGE_KEYS.OURA_TOKENS;
      break;
    case "dexcom":
      storageKey = HEALTH_STORAGE_KEYS.DEXCOM_TOKENS;
      break;
    case "freestyle_libre":
      storageKey = HEALTH_STORAGE_KEYS.FREESTYLE_LIBRE_TOKENS;
      break;
    default:
      throw new Error(`Unknown provider: ${connection.provider}`);
  }

  await AsyncStorage.setItem(storageKey, JSON.stringify(connection));
};

/**
 * Disconnect provider
 */
export const disconnectProvider = async (
  provider: HealthProvider
): Promise<void> => {
  // Clear connection data and call service disconnect methods
  let storageKey: string;
  switch (provider) {
    case "apple_health":
      storageKey = HEALTH_STORAGE_KEYS.APPLE_HEALTH_CONNECTION;
      break;
    case "health_connect":
      storageKey = HEALTH_STORAGE_KEYS.HEALTH_CONNECT_CONNECTION;
      break;
    case "fitbit":
      storageKey = HEALTH_STORAGE_KEYS.FITBIT_CONNECTION;
      await fitbitService.disconnect();
      break;
    case "samsung_health":
      storageKey = HEALTH_STORAGE_KEYS.SAMSUNG_HEALTH_TOKENS;
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
      storageKey = HEALTH_STORAGE_KEYS.GARMIN_TOKENS;
      try {
        const { garminService } = await import("../services/garminService");
        await garminService.disconnect();
      } catch {
        // Best effort disconnect for optional provider.
      }
      break;
    case "withings":
      storageKey = HEALTH_STORAGE_KEYS.WITHINGS_TOKENS;
      try {
        const { withingsService } = await import("../services/withingsService");
        await withingsService.disconnect();
      } catch {
        // Best effort disconnect for optional provider.
      }
      break;
    case "oura":
      storageKey = HEALTH_STORAGE_KEYS.OURA_TOKENS;
      try {
        const { ouraService } = await import("../services/ouraService");
        await ouraService.disconnect();
      } catch {
        // Best effort disconnect for optional provider.
      }
      break;
    case "dexcom":
      storageKey = HEALTH_STORAGE_KEYS.DEXCOM_TOKENS;
      try {
        const { dexcomService } = await import("../services/dexcomService");
        await dexcomService.disconnect();
      } catch {
        // Best effort disconnect for optional provider.
      }
      break;
    case "freestyle_libre":
      storageKey = HEALTH_STORAGE_KEYS.FREESTYLE_LIBRE_TOKENS;
      try {
        const { freestyleLibreService } = await import(
          "../services/freestyleLibreService"
        );
        await freestyleLibreService.disconnect();
      } catch {
        // Best effort disconnect for optional provider.
      }
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
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
        metrics = await fitbitService.fetchMetrics(
          connection.selectedMetrics,
          startDate,
          endDate
        );
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
