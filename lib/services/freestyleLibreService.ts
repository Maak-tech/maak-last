/**
 * Freestyle Libre CGM Service
 * Integration with Abbott Freestyle Libre CGM API for continuous glucose monitoring
 */

import { deleteItemAsync, getItemAsync } from "expo-secure-store";
import {
  type FreestyleLibreTokens,
  HEALTH_STORAGE_KEYS,
  type NormalizedMetricPayload,
  type ProviderAvailability,
} from "../health/healthTypes";

// Freestyle Libre API configuration
// Note: Freestyle Libre uses different authentication - typically through patient account
const _FREESTYLE_LIBRE_BASE_URL = "https://api.libreview.io";
const _FREESTYLE_LIBRE_AUTH_URL = "https://api.libreview.io/oauth";

type LibreReading = {
  value?: number | string;
  trend?: number | string;
  timestamp?: string;
};

type LibrePayload = {
  glucoseMeasurements?: LibreReading[];
};

type NormalizedSample = {
  value: number | string;
  unit?: string;
  startDate: string;
  endDate?: string;
  source?: string;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const getLibreReadings = (data: unknown): LibreReading[] => {
  const payload = data as LibrePayload;
  if (!Array.isArray(payload.glucoseMeasurements)) {
    return [];
  }
  return payload.glucoseMeasurements;
};

const toNormalizedSamples = (
  readings: LibreReading[],
  options: {
    unit: string;
    source: string;
    getValue: (reading: LibreReading) => number | string | undefined;
  }
): NormalizedSample[] => {
  const samples: NormalizedSample[] = [];

  for (const reading of readings) {
    const value = options.getValue(reading);
    if (value === undefined) {
      continue;
    }

    samples.push({
      value,
      unit: options.unit,
      startDate: reading.timestamp || new Date().toISOString(),
      source: options.source,
    });
  }

  return samples;
};

/**
 * Check if Freestyle Libre integration is available
 */
export const freestyleLibreService = {
  isAvailable: (): Promise<ProviderAvailability> => {
    try {
      // Freestyle Libre integration requires specific setup
      // This would typically require partnership with Abbott
      return Promise.resolve({
        available: false,
        reason:
          "Freestyle Libre integration requires partnership with Abbott. Contact Abbott for API access.",
      });
    } catch (error: unknown) {
      return Promise.resolve({
        available: false,
        reason: getErrorMessage(error),
      });
    }
  },

  /**
   * Start authentication flow for Freestyle Libre
   * Note: This is a placeholder - actual implementation would depend on Abbott's API
   */
  startAuth: (_selectedMetrics: string[]): Promise<void> =>
    Promise.reject(
      new Error(
        "Freestyle Libre integration not yet implemented. Requires Abbott partnership."
      )
    ),

  /**
   * Handle authentication redirect
   */
  handleRedirect: (_url: string): Promise<void> =>
    Promise.reject(
      new Error("Freestyle Libre integration not yet implemented.")
    ),

  /**
   * Refresh access token if needed
   */
  refreshTokenIfNeeded: async (): Promise<void> => {
    const tokensJson = await getItemAsync(
      HEALTH_STORAGE_KEYS.FREESTYLE_LIBRE_TOKENS
    );

    if (!tokensJson) {
      throw new Error("No Freestyle Libre tokens found");
    }

    const tokens: FreestyleLibreTokens = JSON.parse(tokensJson);

    // Check if token needs refresh (placeholder logic)
    if (Date.now() < tokens.expiresAt - 5 * 60 * 1000) {
      return; // Token still valid
    }

    // Placeholder refresh logic
    throw new Error("Token refresh not implemented for Freestyle Libre");
  },

  /**
   * Get access token
   */
  getAccessToken: async (): Promise<string> => {
    await freestyleLibreService.refreshTokenIfNeeded();

    const tokensJson = await getItemAsync(
      HEALTH_STORAGE_KEYS.FREESTYLE_LIBRE_TOKENS
    );

    if (!tokensJson) {
      throw new Error("Not authenticated with Freestyle Libre");
    }

    const tokens: FreestyleLibreTokens = JSON.parse(tokensJson);
    return tokens.accessToken;
  },

  /**
   * Fetch health metrics from Freestyle Libre API
   * Note: This is a placeholder implementation
   */
  fetchMetrics: (
    _selectedMetrics: string[],
    _startDate: Date,
    _endDate: Date
  ): Promise<NormalizedMetricPayload[]> =>
    Promise.reject(
      new Error("Freestyle Libre API integration not yet implemented")
    ),

  /**
   * Parse Freestyle Libre API response
   * Note: This is a placeholder implementation
   */
  parseFreestyleLibreData: (
    metricKey: string,
    data: unknown
  ): NormalizedSample[] => {
    try {
      const readings = getLibreReadings(data);

      switch (metricKey) {
        case "blood_glucose":
          return toNormalizedSamples(readings, {
            unit: "mg/dL",
            source: "Freestyle Libre",
            getValue: (reading) => reading.value,
          });
        case "glucose_trend":
          return toNormalizedSamples(readings, {
            unit: "trend",
            source: "Freestyle Libre",
            getValue: (reading) => reading.trend,
          });
        default:
          return [];
      }
    } catch (_error) {
      // Silently handle parsing error
      return [];
    }
  },

  /**
   * Get current glucose reading
   * Note: This is a placeholder implementation
   */
  getCurrentGlucose: (): Promise<{
    value: number;
    unit: string;
    timestamp: string;
    trend?: string;
  } | null> => Promise.resolve(null),

  /**
   * Disconnect Freestyle Libre account
   */
  disconnect: async (): Promise<void> => {
    await deleteItemAsync(HEALTH_STORAGE_KEYS.FREESTYLE_LIBRE_TOKENS);
  },
};
