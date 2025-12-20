/**
 * Fitbit Service
 * Placeholder - not implemented yet (iOS-only focus)
 */

import type {
  NormalizedMetricPayload,
  ProviderAvailability,
  FitbitTokens,
} from "../health/healthTypes";

export const fitbitService = {
  isAvailable: async (): Promise<ProviderAvailability> => {
    return {
      available: false,
      reason: "Fitbit integration not implemented yet (iOS-only focus)",
    };
  },
  startAuth: async (_selectedMetrics: string[]): Promise<void> => {
    throw new Error("Fitbit not implemented");
  },
  handleRedirect: async (_url: string): Promise<void> => {
    throw new Error("Fitbit not implemented");
  },
  refreshTokenIfNeeded: async (): Promise<void> => {
    throw new Error("Fitbit not implemented");
  },
  fetchMetrics: async (
    _selectedMetrics: string[],
    _startDate: Date,
    _endDate: Date
  ): Promise<NormalizedMetricPayload[]> => {
    throw new Error("Fitbit not implemented");
  },
  disconnect: async (): Promise<void> => {
    // No-op for placeholder
  },
};

