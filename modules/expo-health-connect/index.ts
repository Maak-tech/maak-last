import { NativeModulesProxy, EventEmitter } from 'expo-modules-core';

import ExpoHealthConnectModule from './ExpoHealthConnectModule';

export interface HealthConnectAvailability {
  available: boolean;
  reason?: string;
}

export interface HealthRecord {
  value: number | string;
  unit: string;
  startDate: string;
  endDate: string;
  source: string;
}

/**
 * Check if Health Connect is available
 */
export async function isAvailable(): Promise<HealthConnectAvailability> {
  return await ExpoHealthConnectModule.isAvailable();
}

/**
 * Request permissions for health data types
 * Returns granted and denied permissions
 */
export async function requestPermissions(permissions: string[]): Promise<{
  granted: string[];
  denied: string[];
}> {
  return await ExpoHealthConnectModule.requestPermissions(permissions);
}

/**
 * Read health records
 */
export async function readRecords(
  recordType: string,
  startTime: string,
  endTime: string
): Promise<HealthRecord[]> {
  return await ExpoHealthConnectModule.readRecords(recordType, startTime, endTime);
}

/**
 * Get permission status
 */
export async function getPermissionStatus(permission: string): Promise<string> {
  return await ExpoHealthConnectModule.getPermissionStatus(permission);
}

export default {
  isAvailable,
  requestPermissions,
  readRecords,
  getPermissionStatus,
};

