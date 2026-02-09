import ExpoHealthConnectModule from "./ExpoHealthConnectModule";

export type HealthConnectAvailability = {
  available: boolean;
  reason?: string;
};

export type HealthRecord = {
  value: number | string;
  unit: string;
  startDate: string;
  endDate: string;
  source: string;
};

/**
 * Check if Health Connect is available
 */
export function isAvailable(): Promise<HealthConnectAvailability> {
  return ExpoHealthConnectModule.isAvailable();
}

/**
 * Request permissions for health data types
 * Returns granted and denied permissions
 */
export function requestPermissions(permissions: string[]): Promise<{
  granted: string[];
  denied: string[];
}> {
  return ExpoHealthConnectModule.requestPermissions(permissions);
}

/**
 * Read health records
 */
export function readRecords(
  recordType: string,
  startTime: string,
  endTime: string
): Promise<HealthRecord[]> {
  return ExpoHealthConnectModule.readRecords(recordType, startTime, endTime);
}

/**
 * Get permission status
 */
export function getPermissionStatus(permission: string): Promise<string> {
  return ExpoHealthConnectModule.getPermissionStatus(permission);
}

export default {
  isAvailable,
  requestPermissions,
  readRecords,
  getPermissionStatus,
};
