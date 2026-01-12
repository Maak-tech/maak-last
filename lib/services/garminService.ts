/**
 * Garmin Connect Service
 * OAuth 2.0 integration with Garmin Connect API
 */

import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import {
  getAvailableMetricsForProvider,
  getGarminScopesForMetrics,
  getMetricByKey,
} from "../health/healthMetricsCatalog";
import {
  HEALTH_STORAGE_KEYS,
  type GarminTokens,
  type NormalizedMetricPayload,
  type ProviderAvailability,
} from "../health/healthTypes";
import { saveProviderConnection } from "../health/healthSync";

// Garmin OAuth configuration
const GARMIN_CLIENT_ID =
  Constants.expoConfig?.extra?.garminClientId || "YOUR_GARMIN_CLIENT_ID";
const GARMIN_CLIENT_SECRET =
  Constants.expoConfig?.extra?.garminClientSecret || "YOUR_GARMIN_CLIENT_SECRET";
const GARMIN_AUTH_URL = "https://connect.garmin.com/oauthConfirm";
const GARMIN_TOKEN_URL = "https://connectapi.garmin.com/oauth-service/oauth/access_token";
const GARMIN_API_BASE = "https://apis.garmin.com";
const REDIRECT_URI = Linking.createURL("garmin-callback");

// Complete OAuth flow
WebBrowser.maybeCompleteAuthSession();

/**
 * Garmin Connect Service
 */
export const garminService = {
  /**
   * Check if Garmin integration is available
   */
  isAvailable: async (): Promise<ProviderAvailability> => {
    try {
      if (
        GARMIN_CLIENT_ID === "YOUR_GARMIN_CLIENT_ID" ||
        GARMIN_CLIENT_SECRET === "YOUR_GARMIN_CLIENT_SECRET"
      ) {
        return {
          available: false,
          reason:
            "Garmin credentials not configured. Please set GARMIN_CLIENT_ID and GARMIN_CLIENT_SECRET in app.json extra config.",
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
      const scopes = getGarminScopesForMetrics(selectedMetrics);

      const authUrl =
        `${GARMIN_AUTH_URL}?` +
        `oauth_consumer_key=${encodeURIComponent(GARMIN_CLIENT_ID)}&` +
        `oauth_callback=${encodeURIComponent(REDIRECT_URI)}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

      if (result.type === "success" && result.url) {
        await garminService.handleRedirect(result.url, selectedMetrics);
      } else {
        throw new Error("Authentication cancelled or failed");
      }
    } catch (error: any) {
      throw new Error(`Garmin authentication failed: ${error.message}`);
    }
  },

  /**
   * Handle OAuth redirect callback
   */
  handleRedirect: async (url: string, selectedMetrics?: string[]): Promise<void> => {
    try {
      const urlObj = new URL(url);
      const oauthToken = urlObj.searchParams.get("oauth_token");
      const oauthVerifier = urlObj.searchParams.get("oauth_verifier");

      if (!oauthToken || !oauthVerifier) {
        throw new Error("Missing OAuth tokens");
      }

      // Exchange for access token (simplified - Garmin uses OAuth 1.0a)
      // Note: GarminTokens type uses refreshToken, but Garmin OAuth 1.0a uses oauth_verifier
      // For now, storing oauth_verifier as refreshToken for compatibility
      await garminService.saveTokens({
        accessToken: oauthToken,
        refreshToken: oauthVerifier, // OAuth 1.0a verifier stored as refreshToken
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
        userId: "", // Will be populated after token exchange
        scope: "", // Will be populated after token exchange
      });

      await saveProviderConnection({
        provider: "garmin",
        connected: true,
        connectedAt: new Date().toISOString(),
        selectedMetrics: selectedMetrics || [],
      });
    } catch (error: any) {
      throw new Error(`Failed to complete Garmin authentication: ${error.message}`);
    }
  },

  /**
   * Save tokens securely
   */
  saveTokens: async (tokens: GarminTokens): Promise<void> => {
    await SecureStore.setItemAsync(
      HEALTH_STORAGE_KEYS.GARMIN_TOKENS,
      JSON.stringify(tokens)
    );
  },

  /**
   * Get stored tokens
   */
  getTokens: async (): Promise<GarminTokens | null> => {
    try {
      const tokensStr = await SecureStore.getItemAsync(
        HEALTH_STORAGE_KEYS.GARMIN_TOKENS
      );
      if (!tokensStr) return null;
      return JSON.parse(tokensStr);
    } catch {
      return null;
    }
  },

  /**
   * Fetch health data from Garmin
   */
  fetchHealthData: async (
    metricKeys: string[],
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> => {
    try {
      const tokens = await garminService.getTokens();
      if (!tokens) return [];

      const results: NormalizedMetricPayload[] = [];

      for (const key of metricKeys) {
        const metric = getMetricByKey(key);
        if (!metric?.garmin?.endpoint) continue;

        // Garmin API calls would go here
        // For now, return empty as we need OAuth 1.0a signing
      }

      return results;
    } catch (error) {
      console.error("Error fetching Garmin data:", error);
      return [];
    }
  },

  /**
   * Disconnect Garmin integration
   */
  disconnect: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(HEALTH_STORAGE_KEYS.GARMIN_TOKENS);
      // Garmin connection is stored in AsyncStorage via saveProviderConnection,
      // not in SecureStore, so we don't need to delete it here
    } catch (error) {
      console.error("Error disconnecting Garmin:", error);
    }
  },
};

export default garminService;
