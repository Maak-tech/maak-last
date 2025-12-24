/**
 * Google Health Connect Service
 * Android Health Connect integration
 * NOTE: Health Connect integration has been removed from this version
 */

import type {
  NormalizedMetricPayload,
  ProviderAvailability,
} from "../health/healthTypes";

/**
 * Check if Health Connect is available
 */
const isAvailable = async (): Promise<ProviderAvailability> => ({
  available: false,
  reason: "Health Connect integration has been removed from this version",
});

/**
 * Open Health Connect app or Play Store
 */
const openHealthConnect = async () => {
  // No-op: Health Connect removed
};

/**
 * Request authorization for selected metrics
 */
const requestAuthorization = async (
  selectedMetrics: string[]
): Promise<{ granted: string[]; denied: string[] }> => ({
  granted: [],
  denied: selectedMetrics,
});

/**
 * Check authorization status for a metric
 */
const getAuthorizationStatus = async (
  _metricKey: string
): Promise<"authorized" | "denied" | "undetermined"> => "undetermined";

/**
 * Fetch metrics from Health Connect
 */
const fetchMetrics = async (
  _selectedMetrics: string[],
  _startDate: Date,
  _endDate: Date
): Promise<NormalizedMetricPayload[]> => [];

export const googleHealthService = {
  isAvailable,
  requestAuthorization,
  getAuthorizationStatus,
  fetchMetrics,
  openHealthConnect,
};
