/**
 * Health Connect Service (Android)
 * Placeholder - not implemented yet (iOS-only focus)
 */

import { Platform } from "react-native";
import type {
  NormalizedMetricPayload,
  ProviderAvailability,
} from "../health/healthTypes";

export const healthConnectService = {
  isAvailable: async (): Promise<ProviderAvailability> => {
    return {
      available: false,
      reason: "Health Connect integration not implemented yet (iOS-only focus)",
    };
  },
  requestPermissions: async (_selectedMetrics: string[]) => {
    throw new Error("Health Connect not implemented");
  },
  fetchMetrics: async (
    _selectedMetrics: string[],
    _startDate: Date,
    _endDate: Date
  ): Promise<NormalizedMetricPayload[]> => {
    throw new Error("Health Connect not implemented");
  },
};

