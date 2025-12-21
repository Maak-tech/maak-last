/**
 * Unified Health Data Sync Module
 * Handles syncing health data from all providers to backend
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  HealthSyncPayload,
  ProviderConnection,
  SyncResult,
  DeviceInfo,
} from "./healthTypes";
import type { HealthProvider } from "./healthMetricsCatalog";
import { HEALTH_STORAGE_KEYS } from "./healthTypes";

// Import services
import { appleHealthService } from "../services/appleHealthService";
import { healthConnectService } from "../services/healthConnectService";
import { fitbitService } from "../services/fitbitService";

const BACKEND_HEALTH_SYNC_URL = "/health/sync"; // Unified endpoint

/**
 * Get device information
 */
const getDeviceInfo = (): DeviceInfo => {
  return {
    platform: Platform.OS as "ios" | "android",
    model: Platform.select({
      ios: "iOS Device",
      android: "Android Device",
      default: "Unknown",
    }),
    osVersion: Platform.Version?.toString(),
    appVersion: "1.0.0", // TODO: Get from app.json
  };
};

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
      default:
        return null;
    }

    const data = await AsyncStorage.getItem(storageKey);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error getting ${provider} connection:`, error);
    return null;
  }
};

/**
 * Save provider connection status
 */
export const saveProviderConnection = async (
  connection: ProviderConnection
): Promise<void> => {
  try {
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
      default:
        throw new Error(`Unknown provider: ${connection.provider}`);
    }

    await AsyncStorage.setItem(storageKey, JSON.stringify(connection));
  } catch (error) {
    console.error(`Error saving ${connection.provider} connection:`, error);
    throw error;
  }
};

/**
 * Disconnect provider
 */
export const disconnectProvider = async (
  provider: HealthProvider
): Promise<void> => {
  try {
    // Clear connection data
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
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    await AsyncStorage.removeItem(storageKey);
  } catch (error) {
    console.error(`Error disconnecting ${provider}:`, error);
    throw error;
  }
};

/**
 * Sync health data from provider to backend
 */
export const syncHealthData = async (
  provider: HealthProvider,
  retryOnce: boolean = true
): Promise<SyncResult> => {
  try {
    // Get provider connection
    const connection = await getProviderConnection(provider);
    if (!connection || !connection.connected) {
      throw new Error(`${provider} not connected`);
    }

    // Calculate date range (last 30 days or since last sync)
    const endDate = new Date();
    const startDate = connection.lastSyncAt
      ? new Date(connection.lastSyncAt)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Fetch metrics from provider
    let metrics;
    switch (provider) {
      case "apple_health":
        metrics = await appleHealthService.fetchMetrics(
          connection.selectedMetrics,
          startDate,
          endDate
        );
        break;
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

    // Send to backend
    const response = await fetch(BACKEND_HEALTH_SYNC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Backend sync failed: ${response.statusText}`);
    }

    // Update last sync timestamp
    connection.lastSyncAt = new Date().toISOString();
    await saveProviderConnection(connection);

    const result: SyncResult = {
      success: true,
      provider,
      syncedAt: connection.lastSyncAt,
      metricsCount: metrics.length,
      samplesCount: metrics.reduce(
        (sum, m) => sum + m.samples.length,
        0
      ),
    };

    return result;
  } catch (error: any) {
    console.error(`Health sync failed for ${provider}:`, error);

    // Retry once on network failure
    if (retryOnce && error.message?.includes("network")) {
      return syncHealthData(provider, false);
    }

    return {
      success: false,
      provider,
      syncedAt: new Date().toISOString(),
      metricsCount: 0,
      samplesCount: 0,
      error: error.message || "Unknown error",
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
  } catch (error) {
    console.error(`Error getting last sync for ${provider}:`, error);
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
  ];

  const connections = await Promise.all(
    providers.map((p) => getProviderConnection(p))
  );

  return connections.filter(
    (c): c is ProviderConnection => c !== null && c.connected
  );
};

