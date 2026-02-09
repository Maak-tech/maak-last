/**
 * Withings Service
 * OAuth 2.0 integration with Withings API
 * Supports comprehensive health data including body measurements, vitals, and activity
 */

import Constants from "expo-constants";
import {
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
} from "expo-secure-store";
import {
  maybeCompleteAuthSession,
  openAuthSessionAsync,
} from "expo-web-browser";
import {
  getAvailableMetricsForProvider,
  getMetricByKey,
  getWithingsScopesForMetrics,
} from "../health/healthMetricsCatalog";
import { saveProviderConnection } from "../health/healthSync";
import {
  HEALTH_STORAGE_KEYS,
  type MetricSample,
  type NormalizedMetricPayload,
  type ProviderAvailability,
  type WithingsTokens,
} from "../health/healthTypes";

// Withings OAuth configuration
const WITHINGS_CLIENT_ID =
  Constants.expoConfig?.extra?.withingsClientId || "YOUR_WITHINGS_CLIENT_ID";
const WITHINGS_CLIENT_SECRET =
  Constants.expoConfig?.extra?.withingsClientSecret ||
  "YOUR_WITHINGS_CLIENT_SECRET";
const WITHINGS_AUTH_URL = "https://account.withings.com/oauth2_user/authorize2";
const WITHINGS_TOKEN_URL = "https://wbsapi.withings.net/v2/oauth2";
const WITHINGS_API_BASE = "https://wbsapi.withings.net";
// OAuth redirect URI - must match what's registered with Withings (web URL)
const REDIRECT_URI = "https://maak-5caad.web.app/withings-callback";

// Complete OAuth flow
maybeCompleteAuthSession();

/**
 * Withings measurement types mapping
 * See: https://developer.withings.com/api-reference/#tag/measure
 */
const WITHINGS_MEASURE_TYPES = {
  1: { key: "weight", unit: "kg", divisor: 1000 }, // Weight in grams -> kg
  4: { key: "height", unit: "m", divisor: 100 }, // Height in cm -> m (we'll convert to cm)
  5: { key: "fat_free_mass", unit: "kg", divisor: 1000 },
  6: { key: "body_fat_percentage", unit: "%", divisor: 1 },
  8: { key: "fat_mass_weight", unit: "kg", divisor: 1000 },
  9: { key: "blood_pressure_diastolic", unit: "mmHg", divisor: 1 },
  10: { key: "blood_pressure_systolic", unit: "mmHg", divisor: 1 },
  11: { key: "heart_rate", unit: "bpm", divisor: 1 },
  12: { key: "body_temperature", unit: "°C", divisor: 1 },
  54: { key: "blood_oxygen", unit: "%", divisor: 1 },
  71: { key: "body_temperature", unit: "°C", divisor: 1 }, // Also body temperature
  73: { key: "skin_temperature", unit: "°C", divisor: 1 },
  76: { key: "muscle_mass", unit: "kg", divisor: 1000 },
  77: { key: "hydration", unit: "kg", divisor: 1000 },
  88: { key: "bone_mass", unit: "kg", divisor: 1000 },
  91: { key: "pulse_wave_velocity", unit: "m/s", divisor: 1 },
  123: { key: "vo2max", unit: "ml/kg/min", divisor: 1 },
  135: { key: "qrs_interval", unit: "ms", divisor: 1 },
  136: { key: "pr_interval", unit: "ms", divisor: 1 },
  137: { key: "qt_interval", unit: "ms", divisor: 1 },
  138: { key: "corrected_qt_interval", unit: "ms", divisor: 1 },
  139: { key: "atrial_fibrillation", unit: "", divisor: 1 },
} as const;

/**
 * Withings Service
 */
export const withingsService = {
  /**
   * Check if Withings integration is available
   */
  isAvailable: (): Promise<ProviderAvailability> => {
    if (
      WITHINGS_CLIENT_ID === "YOUR_WITHINGS_CLIENT_ID" ||
      WITHINGS_CLIENT_SECRET === "YOUR_WITHINGS_CLIENT_SECRET" ||
      !WITHINGS_CLIENT_ID?.trim() ||
      !WITHINGS_CLIENT_SECRET?.trim()
    ) {
      return Promise.resolve({
        available: false,
        reason:
          "Withings credentials not configured. Please set WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET in app.json extra config.",
      });
    }

    return Promise.resolve({
      available: true,
    });
  },

  /**
   * Get all available metrics for Withings
   */
  getAvailableMetrics: () => getAvailableMetricsForProvider("withings"),

  /**
   * Check if connected to Withings
   */
  isConnected: async (): Promise<boolean> => {
    const tokens = await withingsService.getTokens();
    return tokens !== null && tokens.expiresAt > Date.now();
  },

  /**
   * Start OAuth authentication flow
   */
  startAuth: async (selectedMetrics: string[]): Promise<void> => {
    try {
      // Validate redirect URI is not empty
      if (!REDIRECT_URI || REDIRECT_URI.trim() === "") {
        throw new Error(
          "Withings redirect URI is not configured. Please set REDIRECT_URI in withingsService.ts"
        );
      }

      // Validate redirect URI format
      try {
        new URL(REDIRECT_URI);
      } catch {
        throw new Error(
          `Invalid redirect URI format: ${REDIRECT_URI}. Must be a valid HTTPS URL.`
        );
      }

      // Validate client ID
      if (
        !WITHINGS_CLIENT_ID ||
        WITHINGS_CLIENT_ID === "YOUR_WITHINGS_CLIENT_ID"
      ) {
        throw new Error(
          "Withings Client ID is not configured. Please set WITHINGS_CLIENT_ID in app.json extra config."
        );
      }

      const scopes = getWithingsScopesForMetrics(selectedMetrics);

      // Build OAuth URL with proper encoding
      const redirectUriEncoded = encodeURIComponent(REDIRECT_URI);
      const authUrl =
        `${WITHINGS_AUTH_URL}?` +
        "response_type=code&" +
        `client_id=${encodeURIComponent(WITHINGS_CLIENT_ID)}&` +
        `redirect_uri=${redirectUriEncoded}&` +
        `scope=${encodeURIComponent(scopes.join(","))}&` +
        `state=${encodeURIComponent("withings_auth")}`;

      // Use web callback URL for OAuth (registered with Withings)
      // The web page will redirect to deep link after extracting the code
      const result = await openAuthSessionAsync(authUrl, REDIRECT_URI);

      if (result.type === "success" && result.url) {
        // Handle both web callback URL and deep link redirect
        await withingsService.handleRedirect(result.url, selectedMetrics);
      } else {
        throw new Error("Authentication cancelled or failed");
      }
    } catch (error: unknown) {
      throw new Error(
        `Withings authentication failed: ${getErrorMessage(error)}`
      );
    }
  },

  /**
   * Handle OAuth redirect callback
   * Handles both web callback URL and deep link redirects
   */
  handleRedirect: async (
    url: string,
    selectedMetrics?: string[]
  ): Promise<void> => {
    try {
      // Handle both web URLs and deep links (maak://)
      let urlObj: URL;
      if (url.startsWith("maak://")) {
        // Convert deep link to parseable URL format
        urlObj = new URL(url.replace("maak://", "https://maak.app/"));
      } else {
        urlObj = new URL(url);
      }

      const code = urlObj.searchParams.get("code");
      const error = urlObj.searchParams.get("error");

      if (error) {
        const errorDescription =
          urlObj.searchParams.get("error_description") || "";
        const detailedError = errorDescription
          ? `${error}: ${errorDescription}`
          : error;

        // Provide helpful guidance for redirect_uri errors
        if (
          error === "redirect_uri_mismatch" ||
          error === "redirect_uri" ||
          errorDescription.includes("redirect_uri") ||
          errorDescription.includes("callback URL") ||
          errorDescription.includes("Empty URL")
        ) {
          throw new Error(
            `Withings OAuth callback URL error: ${error}\n\n` +
              `The redirect URI being used is: ${REDIRECT_URI}\n\n` +
              "This error usually means the callback URL is not registered in Withings Developer Portal.\n\n" +
              "To fix this:\n" +
              "1. Log in to https://developer.withings.com/\n" +
              "2. Go to your application settings\n" +
              `3. Find the "Registered URLs" or "Callback URL" section\n` +
              `4. Add this exact URL: ${REDIRECT_URI}\n` +
              "5. Make sure:\n" +
              "   - It uses HTTPS (not HTTP)\n" +
              "   - No trailing slash\n" +
              "   - Exact match (case-sensitive)\n" +
              "6. Save the changes and wait 2-3 minutes\n" +
              "7. Try connecting again\n\n" +
              `Current redirect URI: ${REDIRECT_URI}`
          );
        }

        throw new Error(`Withings OAuth error: ${detailedError}`);
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
          redirect_uri: REDIRECT_URI, // Must match registered callback URL
        }).toString(),
      });

      const responseData = await tokenResponse.json();

      if (responseData.status !== 0) {
        const errorMsg = responseData.error || "Token exchange failed";
        const errorText = responseData.error_text || "";

        // Provide helpful guidance for redirect_uri_mismatch during token exchange
        if (
          errorMsg.includes("redirect_uri") ||
          errorText.includes("redirect_uri")
        ) {
          throw new Error(
            "Withings token exchange failed: redirect URI mismatch.\n\n" +
              `The redirect URI being used is: ${REDIRECT_URI}\n\n` +
              "To fix this:\n" +
              "1. Log in to https://developer.withings.com/\n" +
              "2. Go to your application settings\n" +
              `3. Find the "Callback URL" or "Redirect URI" field\n` +
              `4. Make sure it exactly matches: ${REDIRECT_URI}\n` +
              "5. Check for trailing slashes, http vs https, or typos\n" +
              "6. Save the changes and try again\n\n" +
              `Current redirect URI: ${REDIRECT_URI}\n` +
              `Error details: ${errorText || errorMsg}`
          );
        }

        throw new Error(
          errorText
            ? `Withings token exchange failed: ${errorMsg} - ${errorText}`
            : `Withings token exchange failed: ${errorMsg}`
        );
      }

      const tokens = responseData.body;

      const withingsUserId = tokens.userid?.toString() || "";

      await withingsService.saveTokens({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        scope: tokens.scope,
        userId: withingsUserId,
      });

      await saveProviderConnection({
        provider: "withings",
        connected: true,
        connectedAt: new Date().toISOString(),
        selectedMetrics: selectedMetrics || [],
      });

      // Save Withings user ID to Firestore for webhook matching
      if (withingsUserId) {
        try {
          const { auth } = await import("../firebase");
          const { db } = await import("../firebase");
          const { doc, updateDoc } = await import("firebase/firestore");
          const currentUser = auth.currentUser;
          if (currentUser) {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, {
              withingsUserId,
            });
          }
        } catch (_firestoreError) {
          // Silently handle Firestore update error - not critical for OAuth flow
        }
      }

      // Subscribe to Withings notifications for real-time data updates
      try {
        await withingsService.subscribeToNotifications(tokens.access_token);
      } catch (_subscriptionError) {
        // Silently handle subscription error - not critical for OAuth flow
        // User can still manually sync data
      }
    } catch (error: unknown) {
      throw new Error(
        `Failed to complete Withings authentication: ${getErrorMessage(error)}`
      );
    }
  },

  /**
   * Save tokens securely
   */
  saveTokens: async (tokens: WithingsTokens): Promise<void> => {
    await setItemAsync(HEALTH_STORAGE_KEYS.WITHINGS_TOKENS, JSON.stringify(tokens));
  },

  /**
   * Get stored tokens
   */
  getTokens: async (): Promise<WithingsTokens | null> => {
    try {
      const tokensStr = await getItemAsync(HEALTH_STORAGE_KEYS.WITHINGS_TOKENS);
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

      // Return existing token if still valid (with 5 min buffer)
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
        return null;
      }

      const newTokens = responseData.body;

      await withingsService.saveTokens({
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || tokens.refreshToken,
        expiresAt: Date.now() + newTokens.expires_in * 1000,
        scope: newTokens.scope || tokens.scope,
        userId: newTokens.userid?.toString() || tokens.userId,
      });

      return newTokens.access_token;
    } catch {
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

      // Fetch body measurements (weight, body fat, etc.)
      const measureResponse = await fetch(`${WITHINGS_API_BASE}/measure`, {
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

      const measureData = await measureResponse.json();

      if (measureData.status === 0 && measureData.body?.measuregrps) {
        for (const group of measureData.body.measuregrps) {
          const timestamp = new Date(group.date * 1000);
          for (const measure of group.measures) {
            const measureType =
              WITHINGS_MEASURE_TYPES[
                measure.type as keyof typeof WITHINGS_MEASURE_TYPES
              ];
            if (!measureType) continue;

            const metricKey = measureType.key;
            if (!metricKeys.includes(metricKey)) continue;

            if (!samplesByMetric[metricKey]) {
              samplesByMetric[metricKey] = [];
            }

            // Calculate actual value using the unit (power of 10)
            const value = measure.value * 10 ** measure.unit;

            // Convert height from meters to cm if needed
            let finalValue = value;
            let unit: string = measureType.unit;
            if (metricKey === "height") {
              finalValue = value * 100; // m to cm
              unit = "cm";
            }

            samplesByMetric[metricKey].push({
              value: finalValue,
              unit,
              startDate: timestamp.toISOString(),
              source: "Withings",
            });
          }
        }
      }

      // Fetch heart rate data from heart endpoint
      if (
        metricKeys.some((k) =>
          [
            "heart_rate",
            "blood_pressure_systolic",
            "blood_pressure_diastolic",
          ].includes(k)
        )
      ) {
        try {
          const heartResponse = await fetch(`${WITHINGS_API_BASE}/v2/heart`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Bearer ${accessToken}`,
            },
            body: new URLSearchParams({
              action: "list",
              startdate: Math.floor(startDate.getTime() / 1000).toString(),
              enddate: Math.floor(endDate.getTime() / 1000).toString(),
            }).toString(),
          });

          const heartData = await heartResponse.json();

          if (heartData.status === 0 && heartData.body?.series) {
            for (const item of heartData.body.series) {
              const timestamp = new Date(item.timestamp * 1000);

              // Heart rate from ECG
              if (metricKeys.includes("heart_rate") && item.heart_rate) {
                if (!samplesByMetric["heart_rate"]) {
                  samplesByMetric["heart_rate"] = [];
                }
                samplesByMetric["heart_rate"].push({
                  value: item.heart_rate,
                  unit: "bpm",
                  startDate: timestamp.toISOString(),
                  source: "Withings ECG",
                });
              }
            }
          }
        } catch {
          // Heart endpoint may not be available for all users
        }
      }

      // Fetch sleep data
      if (metricKeys.includes("sleep_analysis")) {
        try {
          const sleepResponse = await fetch(`${WITHINGS_API_BASE}/v2/sleep`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Bearer ${accessToken}`,
            },
            body: new URLSearchParams({
              action: "getsummary",
              startdateymd: formatDate(startDate),
              enddateymd: formatDate(endDate),
            }).toString(),
          });

          const sleepData = await sleepResponse.json();

          if (sleepData.status === 0 && sleepData.body?.series) {
            if (!samplesByMetric["sleep_analysis"]) {
              samplesByMetric["sleep_analysis"] = [];
            }

            for (const item of sleepData.body.series) {
              // Total sleep in hours
              const totalSleep =
                ((item.data?.lightsleepduration || 0) +
                  (item.data?.deepsleepduration || 0) +
                  (item.data?.remsleepduration || 0)) /
                3600;

              samplesByMetric["sleep_analysis"].push({
                value: totalSleep,
                unit: "hours",
                startDate:
                  item.date || new Date(item.startdate * 1000).toISOString(),
                endDate: item.enddate
                  ? new Date(item.enddate * 1000).toISOString()
                  : undefined,
                source: "Withings Sleep",
              });
            }
          }
        } catch {
          // Sleep endpoint may not be available
        }
      }

      // Fetch activity data (steps, calories)
      if (
        metricKeys.some((k) =>
          ["steps", "active_energy", "distance_walking_running"].includes(k)
        )
      ) {
        try {
          const activityResponse = await fetch(
            `${WITHINGS_API_BASE}/v2/measure`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Bearer ${accessToken}`,
              },
              body: new URLSearchParams({
                action: "getactivity",
                startdateymd: formatDate(startDate),
                enddateymd: formatDate(endDate),
              }).toString(),
            }
          );

          const activityData = await activityResponse.json();

          if (activityData.status === 0 && activityData.body?.activities) {
            for (const activity of activityData.body.activities) {
              const timestamp = activity.date;

              if (metricKeys.includes("steps") && activity.steps) {
                if (!samplesByMetric["steps"]) {
                  samplesByMetric["steps"] = [];
                }
                samplesByMetric["steps"].push({
                  value: activity.steps,
                  unit: "count",
                  startDate: timestamp,
                  source: "Withings",
                });
              }

              if (metricKeys.includes("active_energy") && activity.calories) {
                if (!samplesByMetric["active_energy"]) {
                  samplesByMetric["active_energy"] = [];
                }
                samplesByMetric["active_energy"].push({
                  value: activity.calories,
                  unit: "kcal",
                  startDate: timestamp,
                  source: "Withings",
                });
              }

              if (
                metricKeys.includes("distance_walking_running") &&
                activity.distance
              ) {
                if (!samplesByMetric["distance_walking_running"]) {
                  samplesByMetric["distance_walking_running"] = [];
                }
                samplesByMetric["distance_walking_running"].push({
                  value: activity.distance / 1000, // meters to km
                  unit: "km",
                  startDate: timestamp,
                  source: "Withings",
                });
              }
            }
          }
        } catch {
          // Activity endpoint may not be available
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
            unit: metric.unit || samples[0].unit,
            samples,
          });
        }
      }

      return results;
    } catch {
      return [];
    }
  },

  /**
   * Fetch all available metrics for a date range
   */
  fetchAllMetrics: (
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> => {
    const availableMetrics = getAvailableMetricsForProvider("withings");
    const metricKeys = availableMetrics.map((m) => m.key);
    return withingsService.fetchHealthData(metricKeys, startDate, endDate);
  },

  /**
   * Fetch metrics (alias for fetchHealthData for backward compatibility)
   */
  fetchMetrics: async (
    metricKeys: string[],
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> =>
    withingsService.fetchHealthData(metricKeys, startDate, endDate),

  /**
   * Subscribe to Withings notifications for real-time data updates
   * @param accessToken - Withings access token
   * @param appli - Data category (1=weight, 2=temperature, 4=blood pressure/heart rate, 16=activity, 44=sleep, 46=user profile)
   */
  subscribeToNotifications: async (
    accessToken: string,
    appli?: number
  ): Promise<void> => {
    // Default to subscribing to all relevant categories
    // 1: Weight, 2: Temperature, 4: Blood pressure/Heart rate, 16: Activity, 44: Sleep
    const categories = appli ? [appli] : [1, 2, 4, 16, 44];
    const callbackUrl =
      "https://us-central1-maak-5caad.cloudfunctions.net/withingsWebhook";

    // Subscribe to each category
    for (const category of categories) {
      try {
        const response = await fetch(`${WITHINGS_API_BASE}/notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${accessToken}`,
          },
          body: new URLSearchParams({
            action: "subscribe",
            callbackurl: callbackUrl,
            appli: category.toString(),
            comment: "Maak Health data sync",
          }).toString(),
        });

        const responseData = await response.json();

        if (responseData.status !== 0) {
          // Subscription failures are not critical
        }
      } catch {
        // Silently handle individual category subscription failures
      }
    }
  },

  /**
   * Disconnect Withings integration
   */
  disconnect: async (): Promise<void> => {
    try {
      await deleteItemAsync(HEALTH_STORAGE_KEYS.WITHINGS_TOKENS);
    } catch {
      // Ignore errors during disconnect
    }
  },

  /**
   * Revoke access
   */
  revokeAccess: async (): Promise<boolean> => {
    try {
      const tokens = await withingsService.getTokens();
      if (!tokens) return true;

      // Notify Withings to revoke the token
      await fetch(`${WITHINGS_API_BASE}/v2/user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: new URLSearchParams({
          action: "unlink",
        }).toString(),
      });

      await withingsService.disconnect();
      return true;
    } catch {
      return false;
    }
  },
};

// Helper function
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export default withingsService;
