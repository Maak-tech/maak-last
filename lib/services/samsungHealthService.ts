/**
 * Samsung Health Service
 * OAuth 2.0 integration with Samsung Health API
 */

import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import {
  getAvailableMetricsForProvider,
  getSamsungHealthScopesForMetrics,
  getMetricByKey,
} from "../health/healthMetricsCatalog";
import {
  HEALTH_STORAGE_KEYS,
  type SamsungHealthTokens,
  type NormalizedMetricPayload,
  type ProviderAvailability,
  type MetricSample,
} from "../health/healthTypes";
import { saveProviderConnection } from "../health/healthSync";

// Samsung Health OAuth configuration
const SAMSUNG_HEALTH_CLIENT_ID =
  Constants.expoConfig?.extra?.samsungHealthClientId || "YOUR_SAMSUNG_CLIENT_ID";
const SAMSUNG_HEALTH_CLIENT_SECRET =
  Constants.expoConfig?.extra?.samsungHealthClientSecret ||
  "YOUR_SAMSUNG_CLIENT_SECRET";
const SAMSUNG_HEALTH_AUTH_URL = "https://oauth-account.samsung.com/oauth2/v1/auth";
const SAMSUNG_HEALTH_TOKEN_URL = "https://oauth-account.samsung.com/oauth2/v1/token";
const SAMSUNG_HEALTH_API_BASE = "https://api-health.samsung.com/v1";
const REDIRECT_URI = Linking.createURL("samsung-health-callback");

// Complete OAuth flow
WebBrowser.maybeCompleteAuthSession();

/**
 * Samsung Health Service
 */
export const samsungHealthService = {
  /**
   * Check if Samsung Health integration is available
   */
  isAvailable: async (): Promise<ProviderAvailability> => {
    try {
      if (
        SAMSUNG_HEALTH_CLIENT_ID === "YOUR_SAMSUNG_CLIENT_ID" ||
        SAMSUNG_HEALTH_CLIENT_SECRET === "YOUR_SAMSUNG_CLIENT_SECRET"
      ) {
        return {
          available: false,
          reason:
            "Samsung Health credentials not configured. Please set SAMSUNG_HEALTH_CLIENT_ID and SAMSUNG_HEALTH_CLIENT_SECRET in app.json extra config.",
        };
      }

      return {
        available: true,
      };
    } catch (error: any) {
      return {
        available: false,
        reason: error?.message || "Unknown error",
      };
    }
  },

  /**
   * Start OAuth authentication flow
   */
  startAuth: async (selectedMetrics: string[]): Promise<void> => {
    try {
      const scopes = getSamsungHealthScopesForMetrics(selectedMetrics);

      const authUrl =
        `${SAMSUNG_HEALTH_AUTH_URL}?` +
        `response_type=code&` +
        `client_id=${encodeURIComponent(SAMSUNG_HEALTH_CLIENT_ID)}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(scopes.join(" "))}&` +
        `state=${encodeURIComponent("samsung_health_auth")}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

      if (result.type === "success" && result.url) {
        await samsungHealthService.handleRedirect(result.url, selectedMetrics);
      } else {
        throw new Error("Authentication cancelled or failed");
      }
    } catch (error: any) {
      throw new Error(`Samsung Health authentication failed: ${error.message}`);
    }
  },

  /**
   * Handle OAuth redirect callback
   */
  handleRedirect: async (url: string, selectedMetrics?: string[]): Promise<void> => {
    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get("code");
      const error = urlObj.searchParams.get("error");

      if (error) {
        throw new Error(`Samsung Health OAuth error: ${error}`);
      }

      if (!code) {
        throw new Error("No authorization code received");
      }

      const tokenResponse = await fetch(SAMSUNG_HEALTH_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: SAMSUNG_HEALTH_CLIENT_ID,
          client_secret: SAMSUNG_HEALTH_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: REDIRECT_URI,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error_description || "Token exchange failed");
      }

      const tokens = await tokenResponse.json();

      await samsungHealthService.saveTokens({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        userId: tokens.user_id || tokens.userId || "", // Samsung Health may provide user_id in token response
        scope: tokens.scope || "",
      });

      await saveProviderConnection({
        provider: "samsung_health",
        connected: true,
        connectedAt: new Date().toISOString(),
        selectedMetrics: selectedMetrics || [],
      });
    } catch (error: any) {
      throw new Error(`Failed to complete Samsung Health authentication: ${error.message}`);
    }
  },

  /**
   * Save tokens securely
   */
  saveTokens: async (tokens: SamsungHealthTokens): Promise<void> => {
    await SecureStore.setItemAsync(
      HEALTH_STORAGE_KEYS.SAMSUNG_HEALTH_TOKENS,
      JSON.stringify(tokens)
    );
  },

  /**
   * Get stored tokens
   */
  getTokens: async (): Promise<SamsungHealthTokens | null> => {
    try {
      const tokensStr = await SecureStore.getItemAsync(
        HEALTH_STORAGE_KEYS.SAMSUNG_HEALTH_TOKENS
      );
      if (!tokensStr) return null;
      return JSON.parse(tokensStr);
    } catch {
      return null;
    }
  },

  /**
   * Refresh access token if expired
   */
  refreshTokenIfNeeded: async (): Promise<string | null> => {
    try {
      const tokens = await samsungHealthService.getTokens();
      if (!tokens) return null;

      if (tokens.expiresAt > Date.now() + 5 * 60 * 1000) {
        return tokens.accessToken;
      }

      const response = await fetch(SAMSUNG_HEALTH_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: SAMSUNG_HEALTH_CLIENT_ID,
          client_secret: SAMSUNG_HEALTH_CLIENT_SECRET,
          refresh_token: tokens.refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });

      if (!response.ok) {
        return null;
      }

      const newTokens = await response.json();

      await samsungHealthService.saveTokens({
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || tokens.refreshToken,
        expiresAt: Date.now() + newTokens.expires_in * 1000,
        userId: newTokens.user_id || newTokens.userId || tokens.userId || "",
        scope: newTokens.scope || tokens.scope || "",
      });

      return newTokens.access_token;
    } catch (error) {
      return null;
    }
  },

  /**
   * Fetch health data from Samsung Health
   */
  fetchHealthData: async (
    metricKeys: string[],
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> => {
    try {
      const accessToken = await samsungHealthService.refreshTokenIfNeeded();
      if (!accessToken) return [];

      const results: NormalizedMetricPayload[] = [];

      for (const key of metricKeys) {
        const metric = getMetricByKey(key);
        if (!metric?.samsungHealth?.endpoint) continue;

        const endpoint = metric.samsungHealth.endpoint
          .replace("{date}", formatDate(startDate));

        const response = await fetch(`${SAMSUNG_HEALTH_API_BASE}${endpoint}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const normalized = parseMetricData(key, data, metric);
          if (normalized) {
            results.push(normalized);
          }
        }
      }

      return results;
    } catch (error) {
      return [];
    }
  },

  /**
   * Disconnect Samsung Health integration
   */
  disconnect: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(HEALTH_STORAGE_KEYS.SAMSUNG_HEALTH_TOKENS);
      // Samsung Health connection is stored in AsyncStorage via saveProviderConnection,
      // not in SecureStore, so we don't need to delete it here
    } catch (error) {
    }
  },
};

// Helper functions
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function parseMetricData(
  metricKey: string,
  data: any,
  metric: { displayName: string; unit?: string } | undefined
): NormalizedMetricPayload | null {
  if (!data || !Array.isArray(data.data) || data.data.length === 0) {
    return null;
  }

  if (!metric) {
    return null;
  }

  const samples: MetricSample[] = data.data.map((item: any) => ({
    value: item.value || item.count || 0,
    unit: metric.unit || "",
    startDate: new Date(item.timestamp || item.date).toISOString(),
    source: "Samsung Health",
  }));

  return {
    provider: "samsung_health",
    metricKey,
    displayName: metric.displayName,
    unit: metric.unit,
    samples,
  };
}

export default samsungHealthService;
