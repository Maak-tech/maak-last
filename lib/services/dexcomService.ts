/**
 * Dexcom CGM Service
 * OAuth 2.0 integration with Dexcom CGM API for continuous glucose monitoring
 */

/* biome-ignore-all lint/performance/noNamespaceImport: Expo modules are consumed via namespace APIs in this integration layer. */
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import {
  getDexcomScopesForMetrics,
  getMetricByKey,
} from "../health/healthMetricsCatalog";
import {
  type DexcomTokens,
  HEALTH_STORAGE_KEYS,
  type NormalizedMetricPayload,
  type ProviderAvailability,
} from "../health/healthTypes";
import { saveProviderConnection } from "../health/providerConnections";

// Dexcom OAuth configuration
const DEXCOM_CLIENT_ID =
  Constants.expoConfig?.extra?.dexcomClientId || "YOUR_DEXCOM_CLIENT_ID";
const DEXCOM_CLIENT_SECRET =
  Constants.expoConfig?.extra?.dexcomClientSecret ||
  "YOUR_DEXCOM_CLIENT_SECRET";
const DEXCOM_AUTH_URL = "https://api.dexcom.com/v2/oauth2/login";
const DEXCOM_TOKEN_URL = "https://api.dexcom.com/v2/oauth2/token";
const DEXCOM_API_BASE = "https://api.dexcom.com";

// Redirect URI: Use HTTPS for Dexcom (required)
// Set dexcomRedirectUri in app.config.js extra config to use a custom HTTPS redirect URI
// Default uses Firebase Hosting: https://maak-5caad.web.app/dexcom-callback
const DEXCOM_REDIRECT_URI_HTTPS =
  Constants.expoConfig?.extra?.dexcomRedirectUri ||
  "https://maak-5caad.web.app/dexcom-callback";
const _REDIRECT_URI_DEEP_LINK = Linking.createURL("dexcom-callback");
// Use HTTPS redirect URI for Dexcom registration (required by Dexcom)
const REDIRECT_URI = DEXCOM_REDIRECT_URI_HTTPS;

// Complete OAuth flow
WebBrowser.maybeCompleteAuthSession();

/**
 * Dexcom CGM Service
 */
export const dexcomService = {
  /**
   * Check if Dexcom integration is available
   */
  isAvailable: (): ProviderAvailability => {
    try {
      if (
        DEXCOM_CLIENT_ID === "YOUR_DEXCOM_CLIENT_ID" ||
        DEXCOM_CLIENT_SECRET === "YOUR_DEXCOM_CLIENT_SECRET"
      ) {
        return {
          available: false,
          reason:
            "Dexcom credentials not configured. Please set DEXCOM_CLIENT_ID and DEXCOM_CLIENT_SECRET in app.json extra config.",
        };
      }

      return {
        available: true,
      };
    } catch (error: unknown) {
      return {
        available: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Start OAuth authentication flow
   */
  startAuth: async (selectedMetrics: string[]): Promise<void> => {
    try {
      const scopes = getDexcomScopesForMetrics(selectedMetrics);

      const authUrl =
        `${DEXCOM_AUTH_URL}?` +
        `client_id=${encodeURIComponent(DEXCOM_CLIENT_ID)}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        "response_type=code&" +
        `scope=${encodeURIComponent(scopes.join(" "))}&` +
        `state=${encodeURIComponent("dexcom_auth")}`;

      // Use HTTPS redirect URI for Dexcom (required), expo-web-browser handles HTTPS redirects
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        REDIRECT_URI
      );

      if (result.type === "success" && result.url) {
        await dexcomService.handleRedirect(result.url, selectedMetrics);
      } else {
        throw new Error("Authentication cancelled or failed");
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown authentication error";
      throw new Error(`Dexcom authentication failed: ${message}`);
    }
  },

  /**
   * Handle OAuth redirect callback
   */
  handleRedirect: async (
    url: string,
    selectedMetrics?: string[]
  ): Promise<void> => {
    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get("code");
      const error = urlObj.searchParams.get("error");

      if (error) {
        throw new Error(`Dexcom OAuth error: ${error}`);
      }

      if (!code) {
        throw new Error("No authorization code received");
      }

      // Exchange code for tokens
      const tokenResponse = await fetch(DEXCOM_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: DEXCOM_CLIENT_ID,
          client_secret: DEXCOM_CLIENT_SECRET,
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

      // Get user ID from Dexcom API
      // Dexcom API uses "self" as userId, but we need to fetch it to confirm
      let userId = "self"; // Default to "self" as Dexcom uses /users/self endpoints
      try {
        // Try to get user info if available
        const userResponse = await fetch(`${DEXCOM_API_BASE}/v2/users/self`, {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          userId = userData.accountId || userData.userId || "self";
        }
      } catch {
        // If user endpoint fails, use "self" as default
        userId = tokens.userId || tokens.accountId || "self";
      }

      // Save tokens securely
      await dexcomService.saveTokens({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        userId,
        scope: tokens.scope,
      });

      // Save connection state
      await saveProviderConnection({
        provider: "dexcom",
        connected: true,
        connectedAt: new Date().toISOString(),
        selectedMetrics: selectedMetrics || ["blood_glucose"],
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown authentication error";
      throw new Error(`Failed to complete Dexcom authentication: ${message}`);
    }
  },

  /**
   * Save tokens securely
   */
  saveTokens: async (tokens: DexcomTokens): Promise<void> => {
    await SecureStore.setItemAsync(
      HEALTH_STORAGE_KEYS.DEXCOM_TOKENS,
      JSON.stringify(tokens)
    );
  },

  /**
   * Get stored tokens
   */
  getTokens: async (): Promise<DexcomTokens | null> => {
    try {
      const tokensStr = await SecureStore.getItemAsync(
        HEALTH_STORAGE_KEYS.DEXCOM_TOKENS
      );
      if (!tokensStr) {
        return null;
      }
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
      const tokens = await dexcomService.getTokens();
      if (!tokens) {
        return null;
      }

      // Check if token is still valid (with 5 minute buffer)
      if (tokens.expiresAt > Date.now() + 5 * 60 * 1000) {
        return tokens.accessToken;
      }

      // Refresh the token
      const response = await fetch(DEXCOM_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: DEXCOM_CLIENT_ID,
          client_secret: DEXCOM_CLIENT_SECRET,
          refresh_token: tokens.refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });

      if (!response.ok) {
        return null;
      }

      const newTokens = await response.json();

      await dexcomService.saveTokens({
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || tokens.refreshToken,
        expiresAt: Date.now() + newTokens.expires_in * 1000,
        userId: tokens.userId, // Preserve existing userId
        scope: newTokens.scope || tokens.scope,
      });

      return newTokens.access_token;
    } catch (_error) {
      return null;
    }
  },

  /**
   * Get current glucose reading
   */
  getCurrentGlucose: async (): Promise<{
    value: number;
    unit: string;
    timestamp: string;
    trend: string;
    trendArrow: string;
  } | null> => {
    try {
      const accessToken = await dexcomService.refreshTokenIfNeeded();
      if (!accessToken) {
        return null;
      }

      const response = await fetch(
        `${DEXCOM_API_BASE}/v2/users/self/egvs?startDate=${getStartDate()}&endDate=${getEndDate()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const latestReading = data.egvs?.[0];

      if (!latestReading) {
        return null;
      }

      return {
        value: latestReading.value,
        unit: "mg/dL",
        timestamp: latestReading.displayTime,
        trend: latestReading.trend,
        trendArrow: getTrendArrow(latestReading.trend),
      };
    } catch (_error) {
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
      const accessToken = await dexcomService.refreshTokenIfNeeded();
      if (!accessToken) {
        return [];
      }

      const results: NormalizedMetricPayload[] = [];

      // Dexcom only supports blood glucose
      if (!selectedMetrics.includes("blood_glucose")) {
        return [];
      }

      const metric = getMetricByKey("blood_glucose");
      if (!metric) {
        return [];
      }

      const response = await fetch(
        `${DEXCOM_API_BASE}/v2/users/self/egvs?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const egvs = data.egvs || [];

      if (egvs.length > 0) {
        const samples = egvs.map((reading: DexcomEgv) => ({
          value: reading.value,
          unit: "mg/dL",
          startDate: reading.displayTime,
          source: "Dexcom CGM",
        }));

        results.push({
          provider: "dexcom",
          metricKey: "blood_glucose",
          displayName: metric.displayName,
          unit: "mg/dL",
          samples,
        });
      }

      return results;
    } catch (_error: unknown) {
      return [];
    }
  },

  /**
   * Get glucose history
   */
  getGlucoseHistory: async (
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> =>
    dexcomService.fetchMetrics(["blood_glucose"], startDate, endDate),

  /**
   * Disconnect Dexcom integration
   */
  disconnect: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(HEALTH_STORAGE_KEYS.DEXCOM_TOKENS);
      // Connection data is stored in AsyncStorage via saveProviderConnection
      // and will be cleared by disconnectProvider in healthSync.ts
    } catch (_error) {
      // Best effort cleanup; ignore if secure storage is unavailable.
    }
  },
};

// Helper functions
function getStartDate(): string {
  const date = new Date();
  date.setHours(date.getHours() - 3); // Last 3 hours
  return date.toISOString();
}

function getEndDate(): string {
  return new Date().toISOString();
}

function getTrendArrow(trend: string): string {
  const arrows: Record<string, string> = {
    doubleUp: "⬆⬆",
    singleUp: "⬆",
    fortyFiveUp: "↗",
    flat: "➡",
    fortyFiveDown: "↘",
    singleDown: "⬇",
    doubleDown: "⬇⬇",
    notComputable: "?",
    rateOutOfRange: "!",
  };
  return arrows[trend] || "?";
}

type DexcomEgv = {
  value: number;
  displayTime: string;
};

export default dexcomService;
