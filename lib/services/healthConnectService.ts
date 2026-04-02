/**
 * Health Connect (Android) integration service.
 * Wraps the React Native Health Connect library and normalises readings
 * into the app's HealthMetricReading format for sync to the API.
 */

import { Platform } from "react-native";
import type { HealthMetricReading, ProviderConnection, SyncResult } from "../health/healthTypes";

// Lazy-imported to avoid crashing on iOS where the library is absent
async function getHealthConnect() {
  if (Platform.OS !== "android") return null;
  try {
    // react-native-health-connect
    const hc = await import("react-native-health-connect");
    return hc;
  } catch {
    return null;
  }
}

export const healthConnectService = {
  async isAvailable(): Promise<boolean> {
    const hc = await getHealthConnect();
    if (!hc) return false;
    try {
      const { getSdkStatus, SdkAvailabilityStatus } = hc;
      const status = await getSdkStatus();
      return status === SdkAvailabilityStatus.SDK_AVAILABLE;
    } catch {
      return false;
    }
  },

  async requestPermissions(metrics: string[]): Promise<boolean> {
    const hc = await getHealthConnect();
    if (!hc) return false;
    try {
      const permissions = metrics.flatMap((type) => [
        { accessType: "read", recordType: type },
      ]);
      const granted = await hc.requestPermission(permissions as any);
      return Array.isArray(granted) && granted.length > 0;
    } catch {
      return false;
    }
  },

  async getConnection(): Promise<ProviderConnection> {
    const available = await this.isAvailable();
    return {
      provider: "health_connect",
      isConnected: available,
      authorizedMetrics: available ? ["HeartRate", "Steps", "SleepSession", "Weight"] : [],
    };
  },

  async syncReadings(
    metrics: string[],
    since: Date
  ): Promise<{ readings: HealthMetricReading[]; result: SyncResult }> {
    const syncStart = Date.now();
    const readings: HealthMetricReading[] = [];
    const errors: string[] = [];

    const hc = await getHealthConnect();
    if (!hc) {
      return {
        readings: [],
        result: {
          provider: "health_connect",
          recordsSynced: 0,
          recordsSkipped: 0,
          errors: ["Health Connect SDK not available on this platform"],
          syncedAt: new Date().toISOString(),
          duration: Date.now() - syncStart,
        },
      };
    }

    try {
      await hc.initialize();
    } catch {
      errors.push("Failed to initialize Health Connect");
    }

    for (const metric of metrics) {
      try {
        const records = await hc.readRecords(metric as any, {
          timeRangeFilter: {
            operator: "between",
            startTime: since.toISOString(),
            endTime: new Date().toISOString(),
          },
        });
        const normalized = (records.records ?? []).map((r: any): HealthMetricReading => ({
          type: metric.toLowerCase(),
          value: r.count ?? r.heartRateRecord?.samples?.[0]?.beatsPerMinute ?? r.weight?.inKilograms ?? 0,
          unit: getUnitForMetric(metric),
          recordedAt: r.startTime ?? r.time ?? new Date().toISOString(),
          source: "health_connect",
        }));
        readings.push(...normalized);
      } catch (e: any) {
        errors.push(`${metric}: ${e?.message ?? "unknown error"}`);
      }
    }

    return {
      readings,
      result: {
        provider: "health_connect",
        recordsSynced: readings.length,
        recordsSkipped: 0,
        errors,
        syncedAt: new Date().toISOString(),
        duration: Date.now() - syncStart,
      },
    };
  },
};

function getUnitForMetric(metric: string): string {
  const units: Record<string, string> = {
    HeartRate: "bpm",
    Steps: "steps",
    Weight: "kg",
    SleepSession: "hrs",
    BloodPressure: "mmHg",
    OxygenSaturation: "%",
    BodyTemperature: "°C",
    BloodGlucose: "mg/dL",
  };
  return units[metric] ?? "unit";
}
