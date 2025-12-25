/**
 * Fitbit Service
 * OAuth 2.0 integration with Fitbit API for health data
 */

import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import {
  getAvailableMetricsForProvider,
  getFitbitScopesForMetrics,
  getMetricByKey,
} from "../health/healthMetricsCatalog";
import {
  HEALTH_STORAGE_KEYS,
  type FitbitTokens,
  type NormalizedMetricPayload,
  type ProviderAvailability,
} from "../health/healthTypes";
import { saveProviderConnection } from "../health/healthSync";

// Fitbit OAuth configuration
// Note: These should be set as environment variables in production
const FITBIT_CLIENT_ID =
  Constants.expoConfig?.extra?.fitbitClientId || "YOUR_FITBIT_CLIENT_ID";
const FITBIT_CLIENT_SECRET =
  Constants.expoConfig?.extra?.fitbitClientSecret ||
  "YOUR_FITBIT_CLIENT_SECRET";
const FITBIT_AUTH_URL = "https://www.fitbit.com/oauth2/authorize";
const FITBIT_TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const FITBIT_API_BASE = "https://api.fitbit.com/1";
// Redirect URI must match what's configured in Fitbit app settings
// Format: maak://fitbit-callback (using app scheme)
const REDIRECT_URI = Linking.createURL("fitbit-callback");

// Complete OAuth flow
WebBrowser.maybeCompleteAuthSession();

/**
 * Check if Fitbit integration is available
 */
export const fitbitService = {
  isAvailable: async (): Promise<ProviderAvailability> => {
    try {
      // Check if credentials are configured
      if (
        FITBIT_CLIENT_ID === "YOUR_FITBIT_CLIENT_ID" ||
        FITBIT_CLIENT_SECRET === "YOUR_FITBIT_CLIENT_SECRET"
      ) {
        return {
          available: false,
          reason: "Fitbit credentials not configured. Please set FITBIT_CLIENT_ID and FITBIT_CLIENT_SECRET in app.json extra config.",
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
      // Get required scopes for selected metrics
      const scopes = getFitbitScopesForMetrics(selectedMetrics);
      
      // Add profile scope for user info
      if (!scopes.includes("profile")) {
        scopes.push("profile");
      }

      // Build authorization URL
      const authUrl = `${FITBIT_AUTH_URL}?` +
        `response_type=code&` +
        `client_id=${encodeURIComponent(FITBIT_CLIENT_ID)}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(scopes.join(" "))}&` +
        `code_challenge=${encodeURIComponent("challenge")}&` +
        `code_challenge_method=plain`;

      // Open browser for OAuth
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        REDIRECT_URI
      );

      if (result.type === "success" && result.url) {
        await fitbitService.handleRedirect(result.url);
      } else {
        throw new Error("Authentication cancelled or failed");
      }
    } catch (error: any) {
      console.error("[Fitbit Service] Auth error:", error);
      throw new Error(`Fitbit authentication failed: ${error.message}`);
    }
  },

  /**
   * Handle OAuth redirect callback
   */
  handleRedirect: async (url: string): Promise<void> => {
    try {
      // Parse callback URL
      const parsedUrl = Linking.parse(url);
      const code = parsedUrl.queryParams?.code as string;
      const error = parsedUrl.queryParams?.error as string;

      if (error) {
        throw new Error(`Fitbit authorization error: ${error}`);
      }

      if (!code) {
        throw new Error("No authorization code received");
      }

      // Exchange code for tokens
      // Create base64 encoded credentials
      const credentials = `${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`;
      const base64Credentials = btoa(credentials);
      
      const tokenResponse = await fetch(FITBIT_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${base64Credentials}`,
        },
        body: new URLSearchParams({
          client_id: FITBIT_CLIENT_ID,
          code,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
          code_verifier: "challenge", // In production, use PKCE properly
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();

      // Get user profile to get user ID
      const profileResponse = await fetch(`${FITBIT_API_BASE}/user/-/profile.json`, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!profileResponse.ok) {
        throw new Error("Failed to fetch user profile");
      }

      const profileData = await profileResponse.json();
      const userId = profileData.user?.encodedId || "-";

      // Store tokens securely
      const tokens: FitbitTokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
        userId,
        scope: tokenData.scope || "",
      };

      await SecureStore.setItemAsync(
        HEALTH_STORAGE_KEYS.FITBIT_TOKENS,
        JSON.stringify(tokens)
      );

      // Get available metrics for Fitbit
      const availableMetrics = getAvailableMetricsForProvider("fitbit");
      const selectedMetricKeys = availableMetrics
        .filter((m) => tokenData.scope?.includes(m.fitbit?.scope || ""))
        .map((m) => m.key);

      // Save connection
      await saveProviderConnection({
        provider: "fitbit",
        connected: true,
        connectedAt: new Date().toISOString(),
        selectedMetrics: selectedMetricKeys,
        grantedMetrics: selectedMetricKeys,
      });
    } catch (error: any) {
      console.error("[Fitbit Service] Redirect handling error:", error);
      throw new Error(`Failed to complete Fitbit authentication: ${error.message}`);
    }
  },

  /**
   * Refresh access token if needed
   */
  refreshTokenIfNeeded: async (): Promise<void> => {
    try {
      const tokensJson = await SecureStore.getItemAsync(
        HEALTH_STORAGE_KEYS.FITBIT_TOKENS
      );

      if (!tokensJson) {
        throw new Error("No Fitbit tokens found");
      }

      const tokens: FitbitTokens = JSON.parse(tokensJson);

      // Check if token needs refresh (refresh 5 minutes before expiry)
      if (Date.now() < tokens.expiresAt - 5 * 60 * 1000) {
        return; // Token still valid
      }

      // Refresh token
      // Create base64 encoded credentials
      const credentials = `${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`;
      const base64Credentials = btoa(credentials);
      
      const refreshResponse = await fetch(FITBIT_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${base64Credentials}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: tokens.refreshToken,
        }).toString(),
      });

      if (!refreshResponse.ok) {
        throw new Error("Token refresh failed");
      }

      const refreshData = await refreshResponse.json();

      // Update tokens
      const updatedTokens: FitbitTokens = {
        ...tokens,
        accessToken: refreshData.access_token,
        refreshToken: refreshData.refresh_token || tokens.refreshToken,
        expiresAt: Date.now() + (refreshData.expires_in * 1000),
      };

      await SecureStore.setItemAsync(
        HEALTH_STORAGE_KEYS.FITBIT_TOKENS,
        JSON.stringify(updatedTokens)
      );
    } catch (error: any) {
      console.error("[Fitbit Service] Token refresh error:", error);
      throw error;
    }
  },

  /**
   * Get access token (with automatic refresh)
   */
  getAccessToken: async (): Promise<string> => {
    await fitbitService.refreshTokenIfNeeded();

    const tokensJson = await SecureStore.getItemAsync(
      HEALTH_STORAGE_KEYS.FITBIT_TOKENS
    );

    if (!tokensJson) {
      throw new Error("Not authenticated with Fitbit");
    }

    const tokens: FitbitTokens = JSON.parse(tokensJson);
    return tokens.accessToken;
  },

  /**
   * Fetch health metrics from Fitbit API
   */
  fetchMetrics: async (
    selectedMetrics: string[],
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> => {
    try {
      const accessToken = await fitbitService.getAccessToken();
      const results: NormalizedMetricPayload[] = [];

      // Fetch data for each day in the range
      const currentDate = new Date(startDate);
      const end = new Date(endDate);

      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD

        // Fetch metrics in parallel
        const metricPromises = selectedMetrics.map(async (metricKey) => {
          const metric = getMetricByKey(metricKey);
          if (!metric?.fitbit?.available || !metric.fitbit.endpoint) {
            return null;
          }

          try {
            const endpoint = metric.fitbit.endpoint.replace("{date}", dateStr);
            const url = `${FITBIT_API_BASE}${endpoint}`;

            const response = await fetch(url, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });

            if (!response.ok) {
              console.warn(
                `[Fitbit Service] Failed to fetch ${metricKey} for ${dateStr}: ${response.statusText}`
              );
              return null;
            }

            const data = await response.json();
            return { metricKey, metric, data, dateStr };
          } catch (error) {
            console.warn(
              `[Fitbit Service] Error fetching ${metricKey} for ${dateStr}:`,
              error
            );
            return null;
          }
        });

        const metricResults = await Promise.all(metricPromises);
        
        // Process results and convert to normalized format
        for (const result of metricResults) {
          if (!result) continue;

          const { metricKey, metric, data, dateStr } = result;
          const samples = fitbitService.parseFitbitData(
            metricKey,
            data,
            dateStr
          );

          if (samples.length > 0) {
            // Check if metric already exists in results
            let metricPayload = results.find((m) => m.metricKey === metricKey);
            if (!metricPayload) {
              metricPayload = {
                provider: "fitbit",
                metricKey,
                displayName: metric.displayName,
                unit: metric.unit,
                samples: [],
              };
              results.push(metricPayload);
            }
            metricPayload.samples.push(...samples);
          }
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return results;
    } catch (error: any) {
      console.error("[Fitbit Service] Fetch metrics error:", error);
      throw new Error(`Failed to fetch Fitbit metrics: ${error.message}`);
    }
  },

  /**
   * Parse Fitbit API response into normalized samples
   */
  parseFitbitData: (
    metricKey: string,
    data: any,
    dateStr: string
  ): Array<{
    value: number | string;
    unit?: string;
    startDate: string;
    endDate?: string;
    source?: string;
  }> => {
    const samples: Array<{
      value: number | string;
      unit?: string;
      startDate: string;
      endDate?: string;
      source?: string;
    }> = [];

    try {
      switch (metricKey) {
        case "heart_rate": {
          // Fitbit heart rate endpoint returns intraday data
          const dataset = data?.["activities-heart"]?.[0]?.value
            ?.restingHeartRate;
          if (dataset !== undefined) {
            samples.push({
              value: dataset,
              unit: "bpm",
              startDate: `${dateStr}T00:00:00Z`,
              source: "Fitbit",
            });
          }
          break;
        }

        case "resting_heart_rate": {
          const rhr = data?.["activities-heart"]?.[0]?.value
            ?.restingHeartRate;
          if (rhr !== undefined) {
            samples.push({
              value: rhr,
              unit: "bpm",
              startDate: `${dateStr}T00:00:00Z`,
              source: "Fitbit",
            });
          }
          break;
        }

        case "steps": {
          const steps = data?.["activities-steps"]?.[0]?.value;
          if (steps !== undefined) {
            samples.push({
              value: parseInt(steps, 10),
              unit: "count",
              startDate: `${dateStr}T00:00:00Z`,
              endDate: `${dateStr}T23:59:59Z`,
              source: "Fitbit",
            });
          }
          break;
        }

        case "active_energy": {
          const calories = data?.["activities-calories"]?.[0]?.value;
          if (calories !== undefined) {
            samples.push({
              value: parseInt(calories, 10),
              unit: "kcal",
              startDate: `${dateStr}T00:00:00Z`,
              endDate: `${dateStr}T23:59:59Z`,
              source: "Fitbit",
            });
          }
          break;
        }

        case "distance_walking_running": {
          const distance = data?.["activities-distance"]?.[0]?.value;
          if (distance !== undefined) {
            // Convert from km to meters, then to km (Fitbit returns km as string)
            const km = parseFloat(distance);
            samples.push({
              value: km,
              unit: "km",
              startDate: `${dateStr}T00:00:00Z`,
              endDate: `${dateStr}T23:59:59Z`,
              source: "Fitbit",
            });
          }
          break;
        }

        case "flights_climbed": {
          const floors = data?.["activities-floors"]?.[0]?.value;
          if (floors !== undefined) {
            samples.push({
              value: parseInt(floors, 10),
              unit: "count",
              startDate: `${dateStr}T00:00:00Z`,
              endDate: `${dateStr}T23:59:59Z`,
              source: "Fitbit",
            });
          }
          break;
        }

        case "blood_oxygen": {
          const spo2 = data?.value;
          if (spo2 !== undefined && Array.isArray(spo2)) {
            spo2.forEach((entry: any) => {
              if (entry.value !== undefined) {
                samples.push({
                  value: entry.value,
                  unit: "%",
                  startDate: entry.dateTime || `${dateStr}T00:00:00Z`,
                  source: "Fitbit",
                });
              }
            });
          }
          break;
        }

        case "body_temperature": {
          const temp = data?.value;
          if (temp !== undefined && Array.isArray(temp)) {
            temp.forEach((entry: any) => {
              if (entry.value !== undefined) {
                samples.push({
                  value: entry.value,
                  unit: "°C",
                  startDate: entry.dateTime || `${dateStr}T00:00:00Z`,
                  source: "Fitbit",
                });
              }
            });
          }
          break;
        }

        case "weight": {
          const weight = data?.weight;
          if (weight !== undefined && Array.isArray(weight)) {
            weight.forEach((entry: any) => {
              if (entry.weight !== undefined) {
                samples.push({
                  value: entry.weight,
                  unit: "kg",
                  startDate: entry.date || `${dateStr}T00:00:00Z`,
                  source: "Fitbit",
                });
              }
            });
          }
          break;
        }

        case "body_fat_percentage": {
          const fat = data?.fat;
          if (fat !== undefined && Array.isArray(fat)) {
            fat.forEach((entry: any) => {
              if (entry.fat !== undefined) {
                samples.push({
                  value: entry.fat,
                  unit: "%",
                  startDate: entry.date || `${dateStr}T00:00:00Z`,
                  source: "Fitbit",
                });
              }
            });
          }
          break;
        }

        case "sleep_analysis": {
          const sleep = data?.sleep;
          if (sleep !== undefined && Array.isArray(sleep)) {
            sleep.forEach((entry: any) => {
              if (entry.duration !== undefined) {
                samples.push({
                  value: entry.duration / 60000, // Convert ms to minutes
                  unit: "min",
                  startDate: entry.startTime || `${dateStr}T00:00:00Z`,
                  endDate: entry.endTime,
                  source: "Fitbit",
                });
              }
            });
          }
          break;
        }

        case "water_intake": {
          const water = data?.summary?.water;
          if (water !== undefined) {
            samples.push({
              value: water,
              unit: "ml",
              startDate: `${dateStr}T00:00:00Z`,
              endDate: `${dateStr}T23:59:59Z`,
              source: "Fitbit",
            });
          }
          break;
        }

        default:
          console.warn(`[Fitbit Service] Unknown metric key: ${metricKey}`);
      }
    } catch (error) {
      console.error(`[Fitbit Service] Error parsing ${metricKey}:`, error);
    }

    return samples;
  },

  /**
   * Disconnect Fitbit account
   */
  disconnect: async (): Promise<void> => {
    try {
      // Revoke token if available
      try {
        const tokensJson = await SecureStore.getItemAsync(
          HEALTH_STORAGE_KEYS.FITBIT_TOKENS
        );
        if (tokensJson) {
          const tokens: FitbitTokens = JSON.parse(tokensJson);
          // Create base64 encoded credentials
          const credentials = `${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`;
          const base64Credentials = btoa(credentials);
          
          await fetch(`${FITBIT_TOKEN_URL}/revoke`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${base64Credentials}`,
            },
            body: new URLSearchParams({
              token: tokens.accessToken,
            }).toString(),
          });
        }
      } catch (error) {
        // Ignore revocation errors
        console.warn("[Fitbit Service] Token revocation failed:", error);
      }

      // Remove tokens
      await SecureStore.deleteItemAsync(HEALTH_STORAGE_KEYS.FITBIT_TOKENS);
    } catch (error) {
      console.error("[Fitbit Service] Disconnect error:", error);
      throw error;
    }
  },
};
