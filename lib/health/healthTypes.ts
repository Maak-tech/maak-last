/**
 * Shared types for the health data sync layer.
 * Used by healthSync.ts, healthMetricsCatalog.ts, and healthConnectService.ts.
 */

export type ProviderType =
  | "apple_health"
  | "health_connect"
  | "fitbit"
  | "garmin"
  | "oura"
  | "withings"
  | "samsung_health"
  | "dexcom"
  | "freestyle_libre"
  | "manual";

export interface DeviceInfo {
  id: string;
  name: string;
  model?: string;
  osVersion?: string;
  appVersion?: string;
}

export interface ProviderConnection {
  provider: ProviderType;
  isConnected: boolean;
  connectedAt?: string;      // ISO timestamp of when connection was established
  lastSyncAt?: string;       // ISO timestamp
  authorizedMetrics: string[];
  selectedMetrics?: string[];
  deviceInfo?: DeviceInfo;
  error?: string;
}

export interface SyncResult {
  provider: ProviderType;
  recordsSynced: number;
  recordsSkipped: number;
  errors: string[];
  syncedAt: string;          // ISO timestamp
  duration: number;          // milliseconds
}

export interface HealthMetricReading {
  type: string;
  value: number;
  secondaryValue?: number;   // e.g. diastolic for blood pressure
  unit: string;
  recordedAt: string;        // ISO timestamp
  source: ProviderType;
  metadata?: Record<string, unknown>;
}

// ─── Provider Availability ───────────────────────────────────────────────────

export interface ProviderAvailability {
  available: boolean;
  reason?: string;
}

// ─── Normalized metric types (used by wearable/OAuth provider services) ──────

export interface MetricSample {
  value: number | string;
  unit?: string;
  startDate: string;         // ISO timestamp
  endDate?: string;          // ISO timestamp
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedMetricPayload {
  provider: string;
  metricKey: string;
  displayName?: string;
  unit?: string;
  samples: MetricSample[];
}

// ─── Sync payload sent to the backend ────────────────────────────────────────

export interface HealthSyncPayload {
  provider: string;
  selectedMetrics: string[];
  range: {
    startDate: string;
    endDate: string;
  };
  device?: DeviceInfo;
  metrics: NormalizedMetricPayload[];
}

// ─── OAuth token types for each provider ─────────────────────────────────────

export interface FitbitTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;         // Unix ms
  userId: string;
  scope: string;
}

export interface OuraTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId?: string;
  scope?: string;
}

export interface GarminTokens {
  accessToken: string;
  accessTokenSecret: string;
  userId?: string;
}

export interface WithingsTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
  userId?: string;
}

export interface SamsungHealthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId?: string;
  scope?: string;
}

export interface DexcomTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId?: string;
  scope?: string;
}

// ─── Secure-store key constants ───────────────────────────────────────────────

export const HEALTH_STORAGE_KEYS = {
  FITBIT_TOKENS: "fitbit_tokens",
  OURA_TOKENS: "oura_tokens",
  GARMIN_TOKENS: "garmin_tokens",
  WITHINGS_TOKENS: "withings_tokens",
  WITHINGS_OAUTH_STATE: "withings_oauth_state",
  SAMSUNG_HEALTH_TOKENS: "samsung_health_tokens",
  DEXCOM_TOKENS: "dexcom_tokens",
} as const;
