/**
 * Garmin Connect - Health API (Push integration)
 *
 * Per Garmin guides, this integration must be server-to-server.
 * - The mobile app must NOT embed the Garmin client secret.
 * - OAuth2 authorization code is exchanged on the REST API server.
 * - Health data is delivered to the backend via Push webhooks.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import {
  maybeCompleteAuthSession,
  openAuthSessionAsync,
} from "expo-web-browser";
import { Platform } from "react-native";
import { api } from "@/lib/apiClient";
import type {
  GarminTokens,
  NormalizedMetricPayload,
  ProviderAvailability,
} from "../health/healthTypes";
import {
  getProviderConnection,
  getProviderStorageKey,
  saveProviderConnection,
} from "../health/providerConnections";

maybeCompleteAuthSession();

function extractParams(url: string): Record<string, string> {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    if (urlObj.hash) {
      const hashParams = new URLSearchParams(urlObj.hash.substring(1));
      hashParams.forEach((value, key) => {
        params[key] = value;
      });
    }
    return params;
  } catch {
    return {};
  }
}

export const garminService = {
  isAvailable: (): Promise<ProviderAvailability> => {
    if (Platform.OS === "web") {
      // Web support depends on your app's auth + API config.
      // We still allow it, but users may need to complete auth in a separate flow.
      return Promise.resolve({ available: true });
    }
    return Promise.resolve({ available: true });
  },

  isConnected: async (): Promise<boolean> => {
    const conn = await getProviderConnection("garmin");
    return !!conn?.connected;
  },

  /**
   * Starts the Garmin OAuth flow via the REST API (server-side code exchange).
   */
  startAuth: async (selectedMetrics: string[]): Promise<void> => {
    const data = await api.post("/api/health/garmin/auth-url", {
      selectedMetrics,
    }) as { url?: string; redirectUri?: string; state?: string };

    const url = typeof data.url === "string" ? data.url : "";
    const redirectUri =
      typeof data.redirectUri === "string"
        ? data.redirectUri
        : Constants.expoConfig?.extra?.garminRedirectUri ||
          "https://app.nuralix.ai/garmin-callback";

    if (!url) {
      throw new Error("Garmin auth URL is not configured.");
    }

    const authResult = await openAuthSessionAsync(url, redirectUri);

    if (!(authResult.type === "success" && authResult.url)) {
      throw new Error("Authentication cancelled or failed");
    }

    const params = extractParams(authResult.url);
    const code = params.code;
    const state = params.state;

    if (!(code && state)) {
      throw new Error("Missing authorization code from Garmin redirect");
    }

    await api.post("/api/health/garmin/exchange", { code, state });

    await saveProviderConnection({
      provider: "garmin",
      connected: true,
      connectedAt: new Date().toISOString(),
      selectedMetrics,
    });
  },

  disconnect: async (): Promise<void> => {
    await api.post("/api/health/garmin/disconnect", {});
    await AsyncStorage.removeItem(getProviderStorageKey("garmin"));
  },

  /**
   * Tokens are stored server-side for Push integrations.
   * This is kept only for type compatibility with older code paths.
   */
  getTokens: async (): Promise<GarminTokens | null> => null,

  /**
   * Push integration means data arrives server-side; client-side pulling is disabled.
   */
  fetchMetrics: async (
    _metricKeys: string[],
    _startDate: Date,
    _endDate: Date
  ): Promise<NormalizedMetricPayload[]> => [],
};

export default garminService;
