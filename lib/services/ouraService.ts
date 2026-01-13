/**
 * Oura Ring Service
 * OAuth 2.0 integration with Oura Ring API
 */

import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import {
  getAvailableMetricsForProvider,
  getOuraScopesForMetrics,
  getMetricByKey,
} from "../health/healthMetricsCatalog";
import {
  HEALTH_STORAGE_KEYS,
  type OuraTokens,
  type NormalizedMetricPayload,
  type ProviderAvailability,
} from "../health/healthTypes";
import { saveProviderConnection } from "../health/healthSync";

// Oura OAuth configuration
const OURA_CLIENT_ID =
  Constants.expoConfig?.extra?.ouraClientId || "YOUR_OURA_CLIENT_ID";
const OURA_CLIENT_SECRET =
  Constants.expoConfig?.extra?.ouraClientSecret || "YOUR_OURA_CLIENT_SECRET";
const OURA_AUTH_URL = "https://cloud.ouraring.com/oauth/authorize";
const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";
const OURA_API_BASE = "https://api.ouraring.com";
const REDIRECT_URI = Linking.createURL("oura-callback");

// Complete OAuth flow
WebBrowser.maybeCompleteAuthSession();

/**
 * Oura Ring Service
 */
export const ouraService = {
  /**
   * Check if Oura integration is available
   */
  isAvailable: async (): Promise<ProviderAvailability> => {
    try {
      if (
        OURA_CLIENT_ID === "YOUR_OURA_CLIENT_ID" ||
        OURA_CLIENT_SECRET === "YOUR_OURA_CLIENT_SECRET"
      ) {
        return {
          available: false,
          reason:
            "Oura credentials not configured. Please set OURA_CLIENT_ID and OURA_CLIENT_SECRET in app.json extra config.",
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
      const scopes = getOuraScopesForMetrics(selectedMetrics);

      const authUrl =
        `${OURA_AUTH_URL}?` +
        `response_type=code&` +
        `client_id=${encodeURIComponent(OURA_CLIENT_ID)}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(scopes.join(" "))}&` +
        `state=${encodeURIComponent("oura_auth")}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

      if (result.type === "success" && result.url) {
        await ouraService.handleRedirect(result.url, selectedMetrics);
      } else {
        throw new Error("Authentication cancelled or failed");
      }
    } catch (error: any) {
      throw new Error(`Oura authentication failed: ${error.message}`);
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
        throw new Error(`Oura OAuth error: ${error}`);
      }

      if (!code) {
        throw new Error("No authorization code received");
      }

      const tokenResponse = await fetch(OURA_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: OURA_CLIENT_ID,
          client_secret: OURA_CLIENT_SECRET,
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

      // Get user ID from Oura API
      let userId = "unknown";
      try {
        const userResponse = await fetch(`${OURA_API_BASE}/v2/userinfo`, {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          userId = userData.id || userData.user_id || "unknown";
        }
      } catch {
        // If user endpoint fails, try to get from token response
        userId = tokens.userId || tokens.user_id || "unknown";
      }

      await ouraService.saveTokens({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        userId: userId,
        scope: tokens.scope,
      });

      await saveProviderConnection({
        provider: "oura",
        connected: true,
        connectedAt: new Date().toISOString(),
        selectedMetrics: selectedMetrics || [],
      });
    } catch (error: any) {
      throw new Error(`Failed to complete Oura authentication: ${error.message}`);
    }
  },

  /**
   * Save tokens securely
   */
  saveTokens: async (tokens: OuraTokens): Promise<void> => {
    await SecureStore.setItemAsync(
      HEALTH_STORAGE_KEYS.OURA_TOKENS,
      JSON.stringify(tokens)
    );
  },

  /**
   * Get stored tokens
   */
  getTokens: async (): Promise<OuraTokens | null> => {
    try {
      const tokensStr = await SecureStore.getItemAsync(
        HEALTH_STORAGE_KEYS.OURA_TOKENS
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
      const tokens = await ouraService.getTokens();
      if (!tokens) return null;

      if (tokens.expiresAt > Date.now() + 5 * 60 * 1000) {
        return tokens.accessToken;
      }

      const response = await fetch(OURA_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: OURA_CLIENT_ID,
          client_secret: OURA_CLIENT_SECRET,
          refresh_token: tokens.refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });

      if (!response.ok) {
        return null;
      }

      const newTokens = await response.json();

      await ouraService.saveTokens({
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || tokens.refreshToken,
        expiresAt: Date.now() + newTokens.expires_in * 1000,
        userId: tokens.userId, // Preserve existing userId
        scope: newTokens.scope || tokens.scope,
      });

      return newTokens.access_token;
    } catch (error) {
      return null;
    }
  },

  /**
   * Fetch metrics for sync
   */
  fetchMetrics: async (
    selectedMetrics: string[],
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> => {
    try {
      const accessToken = await ouraService.refreshTokenIfNeeded();
      if (!accessToken) return [];

      const results: NormalizedMetricPayload[] = [];
      const dateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);

      // Fetch sleep data if requested
      if (selectedMetrics.includes("sleep_analysis")) {
        const sleepResponse = await fetch(
          `${OURA_API_BASE}/v2/usercollection/sleep?start_date=${dateStr}&end_date=${endDateStr}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (sleepResponse.ok) {
          const sleepData = await sleepResponse.json();
          const metric = getMetricByKey("sleep_analysis");
          if (metric) {
            const samples = (sleepData.data || []).map((sleep: any) => ({
              value: sleep.total_sleep_duration / 60, // Convert seconds to minutes
              unit: "min",
              startDate: sleep.day,
              source: "Oura Ring",
            }));

            if (samples.length > 0) {
              results.push({
                provider: "oura",
                metricKey: "sleep_analysis",
                displayName: metric.displayName,
                unit: "min",
                samples,
              });
            }
          }
        }
      }

      // Fetch activity data if requested
      if (selectedMetrics.some((m) => ["steps", "active_energy"].includes(m))) {
        const activityResponse = await fetch(
          `${OURA_API_BASE}/v2/usercollection/daily_activity?start_date=${dateStr}&end_date=${endDateStr}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (activityResponse.ok) {
          const activityData = await activityResponse.json();

          // Steps
          if (selectedMetrics.includes("steps")) {
            const metric = getMetricByKey("steps");
            if (metric) {
              const samples = (activityData.data || []).map((activity: any) => ({
                value: activity.steps,
                unit: "count",
                startDate: activity.day,
                source: "Oura Ring",
              }));

              if (samples.length > 0) {
                results.push({
                  provider: "oura",
                  metricKey: "steps",
                  displayName: metric.displayName,
                  unit: "count",
                  samples,
                });
              }
            }
          }

          // Active energy
          if (selectedMetrics.includes("active_energy")) {
            const metric = getMetricByKey("active_energy");
            if (metric) {
              const samples = (activityData.data || []).map((activity: any) => ({
                value: activity.active_calories,
                unit: "kcal",
                startDate: activity.day,
                source: "Oura Ring",
              }));

              if (samples.length > 0) {
                results.push({
                  provider: "oura",
                  metricKey: "active_energy",
                  displayName: metric.displayName,
                  unit: "kcal",
                  samples,
                });
              }
            }
          }
        }
      }

      return results;
    } catch (error: any) {
      return [];
    }
  },

  /**
   * Fetch sleep data from Oura
   */
  fetchSleepData: async (
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> => {
    return ouraService.fetchMetrics(["sleep_analysis"], startDate, endDate);
  },

  /**
   * Fetch readiness data from Oura
   */
  fetchReadinessData: async (
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> => {
    // Readiness score is not a standard health metric, return empty array
    // This can be extended if needed in the future
    return [];
  },

  /**
   * Fetch activity data from Oura
   */
  fetchActivityData: async (
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> => {
    return ouraService.fetchMetrics(["steps", "active_energy"], startDate, endDate);
  },

  /**
   * Disconnect Oura integration
   */
  disconnect: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(HEALTH_STORAGE_KEYS.OURA_TOKENS);
      // Connection data is stored in AsyncStorage via saveProviderConnection
      // and will be cleared by disconnectProvider in healthSync.ts
    } catch (error) {
    }
  },
};

// Helper functions
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default ouraService;
