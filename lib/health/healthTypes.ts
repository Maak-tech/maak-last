/**
 * Unified Health Data Types
 * Normalized schema for health data across all providers
 */

import type { HealthProvider } from "./healthMetricsCatalog";

/**
 * Normalized metric sample
 */
export interface MetricSample {
  value: number | string;
  unit?: string;
  startDate: string; // ISO 8601
  endDate?: string; // ISO 8601
  source?: string; // Device or app source
}

/**
 * Normalized metric payload
 */
export interface NormalizedMetricPayload {
  provider: HealthProvider;
  metricKey: string;
  displayName: string;
  unit?: string;
  samples: MetricSample[];
}

/**
 * Device information
 */
export interface DeviceInfo {
  platform: "ios" | "android";
  model?: string;
  osVersion?: string;
  appVersion?: string;
}

/**
 * Health sync payload sent to backend
 */
export interface HealthSyncPayload {
  provider: HealthProvider;
  selectedMetrics: string[];
  range: {
    startDate: string; // ISO 8601
    endDate: string; // ISO 8601
  };
  device: DeviceInfo;
  metrics: NormalizedMetricPayload[];
}

/**
 * Provider connection status
 */
export interface ProviderConnection {
  provider: HealthProvider;
  connected: boolean;
  connectedAt?: string; // ISO 8601
  lastSyncAt?: string; // ISO 8601
  selectedMetrics: string[];
  grantedMetrics?: string[]; // Metrics actually granted by user (may differ from selected)
  deniedMetrics?: string[]; // Metrics explicitly denied
}

/**
 * Fitbit OAuth tokens
 */
export interface FitbitTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  userId: string;
  scope: string;
}

/**
 * Health provider availability
 */
export interface ProviderAvailability {
  available: boolean;
  reason?: string; // If not available, why?
  requiresInstall?: boolean; // For Health Connect
  installUrl?: string;
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  provider: HealthProvider;
  syncedAt: string; // ISO 8601
  metricsCount: number;
  samplesCount: number;
  error?: string;
}

/**
 * Health data storage keys
 */
export const HEALTH_STORAGE_KEYS = {
  APPLE_HEALTH_CONNECTION: "@health/apple_health_connection",
  HEALTH_CONNECT_CONNECTION: "@health/health_connect_connection",
  FITBIT_CONNECTION: "@health/fitbit_connection",
  FITBIT_TOKENS: "@health/fitbit_tokens_secure", // Stored in Keychain/Keystore
  LAST_SYNC_TIMESTAMPS: "@health/last_sync_timestamps",
} as const;

