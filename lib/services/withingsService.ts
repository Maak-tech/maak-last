/**
 * Withings Service
 * OAuth 2.0 integration with Withings API
 */

import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import {
  getAvailableMetricsForProvider,
  getWithingsScopesForMetrics,
  getMetricByKey,
} from "../health/healthMetricsCatalog";
import {
  HEALTH_STORAGE_KEYS,
  type WithingsTokens,
  type NormalizedMetricPayload,
  type ProviderAvailability,
  type MetricSample,
} from "../health/healthTypes";
import { saveProviderConnection } from "../health/healthSync";

// Withings OAuth configuration
const WITHINGS_CLIENT_ID =
  Constants.expoConfig?.extra?.withingsClientId || "YOUR_WITHINGS_CLIENT_ID";
const WITHINGS_CLIENT_SECRET =
  Constants.expoConfig?.extra?.withingsClientSecret || "YOUR_WITHINGS_CLIENT_SECRET";
const WITHINGS_AUTH_URL = "https://account.withings.com/oauth2_user/authorize2";
const WITHINGS_TOKEN_URL = "https://wbsapi.withings.net/v2/oauth2";
const WITHINGS_API_BASE = "https://wbsapi.withings.net";
const REDIRECT_URI = Linking.createURL("withings-callback");

// Complete OAuth flow
WebBrowser.maybeCompleteAuthSession();

/**
 * Withings Service
 */
export const withingsService = {
  /**
   * Check if Withings integration is available
   */
  isAvailable: async (): Promise<ProviderAvailability> => {
    try {
      if (
        WITHINGS_CLIENT_ID === "YOUR_WITHINGS_CLIENT_ID" ||
        WITHINGS_CLIENT_SECRET === "YOUR_WITHINGS_CLIENT_SECRET"
      ) {
        return {
          available: false,
          reason:
            "Withings credentials not configured. Please set WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET in app.json extra config.",
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
      const scopes = getWithingsScopesForMetrics(selectedMetrics);

      const authUrl =
        `${WITHINGS_AUTH_URL}?` +
        `response_type=code&` +
        `client_id=${encodeURIComponent(WITHINGS_CLIENT_ID)}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(scopes.join(","))}&` +
        `state=${encodeURIComponent("withings_auth")}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

      if (result.type === "success" && result.url) {
        await withingsService.handleRedirect(result.url, selectedMetrics);
      } else {
        throw new Error("Authentication cancelled or failed");
      }
    } catch (error: any) {
      throw new Error(`Withings authentication failed: ${error.message}`);
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
        throw new Error(`Withings OAuth error: ${error}`);
      }

      if (!code) {
        throw new Error("No authorization code received");
      }

      const tokenResponse = await fetch(WITHINGS_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          action: "requesttoken",
          client_id: WITHINGS_CLIENT_ID,
          client_secret: WITHINGS_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: REDIRECT_URI,
        }).toString(),
      });

      const responseData = await tokenResponse.json();

      if (responseData.status !== 0) {
        throw new Error(responseData.error || "Token exchange failed");
      }

      const tokens = responseData.body;

      await withingsService.saveTokens({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        scope: tokens.scope,
        userId: tokens.userid,
      });

      await saveProviderConnection({
        provider: "withings",
        connected: true,
        connectedAt: new Date().toISOString(),
        selectedMetrics: selectedMetrics || [],
      });
    } catch (error: any) {
      throw new Error(`Failed to complete Withings authentication: ${error.message}`);
    }
  },

  /**
   * Save tokens securely
   */
  saveTokens: async (tokens: WithingsTokens): Promise<void> => {
    await SecureStore.setItemAsync(
      HEALTH_STORAGE_KEYS.WITHINGS_TOKENS,
      JSON.stringify(tokens)
    );
  },

  /**
   * Get stored tokens
   */
  getTokens: async (): Promise<WithingsTokens | null> => {
    try {
      const tokensStr = await SecureStore.getItemAsync(
        HEALTH_STORAGE_KEYS.WITHINGS_TOKENS
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
      const tokens = await withingsService.getTokens();
      if (!tokens) return null;

      if (tokens.expiresAt > Date.now() + 5 * 60 * 1000) {
        return tokens.accessToken;
      }

      const response = await fetch(WITHINGS_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          action: "requesttoken",
          client_id: WITHINGS_CLIENT_ID,
          client_secret: WITHINGS_CLIENT_SECRET,
          refresh_token: tokens.refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });

      const responseData = await response.json();

      if (responseData.status !== 0) {
        console.error("Withings token refresh failed");
        return null;
      }

      const newTokens = responseData.body;

      await withingsService.saveTokens({
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || tokens.refreshToken,
        expiresAt: Date.now() + newTokens.expires_in * 1000,
        scope: newTokens.scope || tokens.scope,
        userId: newTokens.userid || tokens.userId,
      });

      return newTokens.access_token;
    } catch (error) {
      console.error("Error refreshing Withings token:", error);
      return null;
    }
  },

  /**
   * Fetch health data from Withings
   */
  fetchHealthData: async (
    metricKeys: string[],
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> => {
    try {
      const accessToken = await withingsService.refreshTokenIfNeeded();
      if (!accessToken) return [];

      const results: NormalizedMetricPayload[] = [];
      const samplesByMetric: Record<string, MetricSample[]> = {};

      // Fetch measurements
      const response = await fetch(`${WITHINGS_API_BASE}/measure`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${accessToken}`,
        },
        body: new URLSearchParams({
          action: "getmeas",
          startdate: Math.floor(startDate.getTime() / 1000).toString(),
          enddate: Math.floor(endDate.getTime() / 1000).toString(),
        }).toString(),
      });

      const data = await response.json();

      if (data.status === 0 && data.body?.measuregrps) {
        for (const group of data.body.measuregrps) {
          const timestamp = new Date(group.date * 1000);
          for (const measure of group.measures) {
            const metricKey = mapWithingsMeasureType(measure.type);
            if (metricKey && metricKeys.includes(metricKey)) {
              if (!samplesByMetric[metricKey]) {
                samplesByMetric[metricKey] = [];
              }
              const sample: MetricSample = {
                value: measure.value * Math.pow(10, measure.unit),
                unit: getUnitForMetric(metricKey),
                startDate: timestamp.toISOString(),
                source: "Withings",
              };
              samplesByMetric[metricKey].push(sample);
            }
          }
        }
      }

      // Convert grouped samples to NormalizedMetricPayload format
      for (const [metricKey, samples] of Object.entries(samplesByMetric)) {
        const metric = getMetricByKey(metricKey);
        if (metric && samples.length > 0) {
          results.push({
            provider: "withings",
            metricKey,
            displayName: metric.displayName,
            unit: getUnitForMetric(metricKey),
            samples,
          });
        }
      }

      return results;
    } catch (error) {
      console.error("Error fetching Withings data:", error);
      return [];
    }
  },

  /**
   * Disconnect Withings integration
   */
  disconnect: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(HEALTH_STORAGE_KEYS.WITHINGS_TOKENS);
      // Withings connection is stored in AsyncStorage via saveProviderConnection,
      // not in SecureStore, so we don't need to delete it here
    } catch (error) {
      console.error("Error disconnecting Withings:", error);
    }
  },
};

// Helper functions
function mapWithingsMeasureType(type: number): string | null {
  const typeMap: Record<number, string> = {
    1: "weight",
    4: "height",
    5: "fatFreeMass",
    6: "fatRatio",
    8: "fatMassWeight",
    9: "blood_pressure_diastolic",
    10: "blood_pressure_systolic",
    11: "heart_rate",
    12: "body_temperature",
    54: "blood_oxygen",
    71: "body_temperature",
    73: "skin_temperature",
  };
  return typeMap[type] || null;
}

function getUnitForMetric(metricKey: string): string {
  const unitMap: Record<string, string> = {
    weight: "kg",
    height: "m",
    fatRatio: "%",
    blood_pressure_diastolic: "mmHg",
    blood_pressure_systolic: "mmHg",
    heart_rate: "bpm",
    body_temperature: "°C",
    blood_oxygen: "%",
  };
  return unitMap[metricKey] || "";
}

export default withingsService;
