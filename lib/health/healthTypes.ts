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
  lastSyncAt?: string;       // ISO timestamp
  authorizedMetrics: string[];
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
