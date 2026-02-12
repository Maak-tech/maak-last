/**
 * Oura Ring Service
 * OAuth 2.0 integration with Oura Ring API v2
 * Supports comprehensive health data including sleep, activity, HRV, SpO2, and readiness
 */
/* biome-ignore-all lint/performance/noNamespaceImport: Expo linking, secure-store, and web-browser namespace APIs are used throughout this integration service. */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Oura data fetch/normalization currently centralizes many endpoint-specific branches in one flow. */

import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import {
  getAvailableMetricsForProvider,
  getMetricByKey,
  getOuraScopesForMetrics,
} from "../health/healthMetricsCatalog";
import {
  HEALTH_STORAGE_KEYS,
  type MetricSample,
  type NormalizedMetricPayload,
  type OuraTokens,
  type ProviderAvailability,
} from "../health/healthTypes";
import { saveProviderConnection } from "../health/providerConnections";

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

type OuraDataPoint = {
  day?: string;
  total_sleep_duration?: number;
  bedtime_start?: string;
  bedtime_end?: string;
  lowest_heart_rate?: number;
  average_hrv?: number;
  average_breath?: number;
  temperature_deviation?: number;
  steps?: number;
  active_calories?: number;
  equivalent_walking_distance?: number;
  bpm?: number;
  timestamp?: string;
  source?: string;
  contributors?: {
    hrv_balance?: number;
    resting_heart_rate?: number;
  };
  spo2_percentage?: {
    average?: number;
  };
  activity?: string;
  sport?: string;
  start_datetime?: string;
  end_datetime?: string;
  calories?: number;
};

type OuraApiResponse = {
  data?: OuraDataPoint[];
};

const asIsoString = (value?: string): string =>
  value ?? new Date().toISOString();

/**
 * Oura data parsers for different endpoints
 */
const ouraDataParsers = {
  // Sleep data parser
  sleep: (data: OuraDataPoint[]): Record<string, MetricSample[]> => {
    const samples: Record<string, MetricSample[]> = {
      sleep_analysis: [],
      resting_heart_rate: [],
      heart_rate_variability: [],
      respiratory_rate: [],
      body_temperature: [],
    };

    for (const sleep of data) {
      const day = sleep.day;

      // Total sleep duration in hours
      if (sleep.total_sleep_duration) {
        samples.sleep_analysis.push({
          value: sleep.total_sleep_duration / 3600, // seconds to hours
          unit: "hours",
          startDate: asIsoString(sleep.bedtime_start ?? day),
          endDate: sleep.bedtime_end,
          source: "Oura Ring",
        });
      }

      // Resting heart rate (lowest)
      if (sleep.lowest_heart_rate) {
        samples.resting_heart_rate.push({
          value: sleep.lowest_heart_rate,
          unit: "bpm",
          startDate: asIsoString(day),
          source: "Oura Ring",
        });
      }

      // HRV (average during sleep)
      if (sleep.average_hrv) {
        samples.heart_rate_variability.push({
          value: sleep.average_hrv,
          unit: "ms",
          startDate: asIsoString(day),
          source: "Oura Ring",
        });
      }

      // Respiratory rate
      if (sleep.average_breath) {
        samples.respiratory_rate.push({
          value: sleep.average_breath,
          unit: "breaths/min",
          startDate: asIsoString(day),
          source: "Oura Ring",
        });
      }

      // Temperature deviation from baseline
      if (sleep.temperature_deviation !== undefined) {
        samples.body_temperature.push({
          value: 37 + sleep.temperature_deviation, // Baseline ~37°C
          unit: "°C",
          startDate: asIsoString(day),
          source: "Oura Ring",
        });
      }
    }

    return samples;
  },

  // Daily activity parser
  daily_activity: (data: OuraDataPoint[]): Record<string, MetricSample[]> => {
    const samples: Record<string, MetricSample[]> = {
      steps: [],
      active_energy: [],
      distance_walking_running: [],
    };

    for (const activity of data) {
      const day = activity.day;

      if (activity.steps) {
        samples.steps.push({
          value: activity.steps,
          unit: "count",
          startDate: asIsoString(day),
          source: "Oura Ring",
        });
      }

      if (activity.active_calories) {
        samples.active_energy.push({
          value: activity.active_calories,
          unit: "kcal",
          startDate: asIsoString(day),
          source: "Oura Ring",
        });
      }

      if (activity.equivalent_walking_distance) {
        samples.distance_walking_running.push({
          value: activity.equivalent_walking_distance / 1000, // meters to km
          unit: "km",
          startDate: asIsoString(day),
          source: "Oura Ring",
        });
      }
    }

    return samples;
  },

  // Heart rate data parser
  heartrate: (data: OuraDataPoint[]): Record<string, MetricSample[]> => {
    const samples: Record<string, MetricSample[]> = {
      heart_rate: [],
    };

    for (const hr of data) {
      samples.heart_rate.push({
        value: hr.bpm ?? 0,
        unit: "bpm",
        startDate: asIsoString(hr.timestamp),
        source: hr.source || "Oura Ring",
      });
    }

    return samples;
  },

  // Daily readiness (includes temp deviation, HRV)
  daily_readiness: (data: OuraDataPoint[]): Record<string, MetricSample[]> => {
    const samples: Record<string, MetricSample[]> = {
      body_temperature: [],
      heart_rate_variability: [],
      resting_heart_rate: [],
    };

    for (const readiness of data) {
      const day = readiness.day;

      if (readiness.temperature_deviation !== undefined) {
        samples.body_temperature.push({
          value: 37 + readiness.temperature_deviation,
          unit: "°C",
          startDate: asIsoString(day),
          source: "Oura Ring Readiness",
        });
      }

      if (readiness.contributors?.hrv_balance !== undefined) {
        // HRV balance is a score, not raw HRV
        // We'll use it as an indicator
      }

      if (readiness.contributors?.resting_heart_rate !== undefined) {
        // This is a score, not raw value
      }
    }

    return samples;
  },

  // Daily SpO2
  daily_spo2: (data: OuraDataPoint[]): Record<string, MetricSample[]> => {
    const samples: Record<string, MetricSample[]> = {
      blood_oxygen: [],
    };

    for (const spo2 of data) {
      if (spo2.spo2_percentage?.average) {
        samples.blood_oxygen.push({
          value: spo2.spo2_percentage.average,
          unit: "%",
          startDate: asIsoString(spo2.day),
          source: "Oura Ring",
        });
      }
    }

    return samples;
  },

  // Workouts
  workout: (data: OuraDataPoint[]): Record<string, MetricSample[]> => {
    const samples: Record<string, MetricSample[]> = {
      workouts: [],
      active_energy: [],
    };

    for (const workout of data) {
      samples.workouts.push({
        value: workout.activity || workout.sport || "workout",
        unit: "",
        startDate: asIsoString(workout.start_datetime),
        endDate: workout.end_datetime,
        source: "Oura Ring",
      });

      if (workout.calories) {
        samples.active_energy.push({
          value: workout.calories,
          unit: "kcal",
          startDate: asIsoString(workout.start_datetime),
          endDate: workout.end_datetime,
          source: "Oura Ring Workout",
        });
      }
    }

    return samples;
  },
};

/**
 * Oura Ring Service
 */
export const ouraService = {
  /**
   * Check if Oura integration is available
   */
  isAvailable: (): ProviderAvailability => {
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
    } catch (error: unknown) {
      return {
        available: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Get all available metrics for Oura
   */
  getAvailableMetrics: () => getAvailableMetricsForProvider("oura"),

  /**
   * Check if connected to Oura
   */
  isConnected: async (): Promise<boolean> => {
    const tokens = await ouraService.getTokens();
    return tokens !== null && tokens.expiresAt > Date.now();
  },

  /**
   * Start OAuth authentication flow
   */
  startAuth: async (selectedMetrics: string[]): Promise<void> => {
    try {
      const scopes = getOuraScopesForMetrics(selectedMetrics);

      // Oura requires these scopes for most health data
      const allScopes = [
        ...new Set([
          ...scopes,
          "personal",
          "daily",
          "heartrate",
          "workout",
          "session",
        ]),
      ];

      const authUrl =
        `${OURA_AUTH_URL}?` +
        "response_type=code&" +
        `client_id=${encodeURIComponent(OURA_CLIENT_ID)}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(allScopes.join(" "))}&` +
        `state=${encodeURIComponent("oura_auth")}`;

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        REDIRECT_URI
      );

      if (result.type === "success" && result.url) {
        await ouraService.handleRedirect(result.url, selectedMetrics);
      } else {
        throw new Error("Authentication cancelled or failed");
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown authentication error";
      throw new Error(`Oura authentication failed: ${message}`);
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

      // Get user info
      let userId = "unknown";
      try {
        const userResponse = await fetch(
          `${OURA_API_BASE}/v2/usercollection/personal_info`,
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          }
        );
        if (userResponse.ok) {
          const userData = await userResponse.json();
          userId = userData.id || userData.user_id || "unknown";
        }
      } catch {
        userId = tokens.userId || tokens.user_id || "unknown";
      }

      await ouraService.saveTokens({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        userId,
        scope: tokens.scope || "",
      });

      await saveProviderConnection({
        provider: "oura",
        connected: true,
        connectedAt: new Date().toISOString(),
        selectedMetrics: selectedMetrics || [],
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown authentication error";
      throw new Error(`Failed to complete Oura authentication: ${message}`);
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
      const tokens = await ouraService.getTokens();
      if (!tokens) {
        return null;
      }

      // Return existing token if still valid (with 5 min buffer)
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
        userId: tokens.userId,
        scope: newTokens.scope || tokens.scope,
      });

      return newTokens.access_token;
    } catch {
      return null;
    }
  },

  /**
   * Make authenticated API request
   */
  makeApiRequest: async (
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<OuraApiResponse> => {
    const accessToken = await ouraService.refreshTokenIfNeeded();
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    const url = new URL(`${OURA_API_BASE}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return (await response.json()) as OuraApiResponse;
  },

  /**
   * Fetch health data from Oura
   */
  fetchHealthData: async (
    metricKeys: string[],
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> => {
    try {
      const accessToken = await ouraService.refreshTokenIfNeeded();
      if (!accessToken) {
        return [];
      }

      const results: NormalizedMetricPayload[] = [];
      const allSamples: Record<string, MetricSample[]> = {};
      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);

      // Define which endpoints to fetch based on requested metrics
      const endpointMetrics: Record<
        string,
        { endpoint: string; parser: keyof typeof ouraDataParsers }
      > = {
        sleep_analysis: {
          endpoint: "/v2/usercollection/sleep",
          parser: "sleep",
        },
        resting_heart_rate: {
          endpoint: "/v2/usercollection/sleep",
          parser: "sleep",
        },
        heart_rate_variability: {
          endpoint: "/v2/usercollection/sleep",
          parser: "sleep",
        },
        respiratory_rate: {
          endpoint: "/v2/usercollection/sleep",
          parser: "sleep",
        },
        body_temperature: {
          endpoint: "/v2/usercollection/daily_readiness",
          parser: "daily_readiness",
        },
        steps: {
          endpoint: "/v2/usercollection/daily_activity",
          parser: "daily_activity",
        },
        active_energy: {
          endpoint: "/v2/usercollection/daily_activity",
          parser: "daily_activity",
        },
        distance_walking_running: {
          endpoint: "/v2/usercollection/daily_activity",
          parser: "daily_activity",
        },
        heart_rate: {
          endpoint: "/v2/usercollection/heartrate",
          parser: "heartrate",
        },
        blood_oxygen: {
          endpoint: "/v2/usercollection/daily_spo2",
          parser: "daily_spo2",
        },
        workouts: { endpoint: "/v2/usercollection/workout", parser: "workout" },
      };

      // Group by endpoint to reduce API calls
      const endpointsToFetch = new Map<
        string,
        { parser: keyof typeof ouraDataParsers; metrics: string[] }
      >();

      for (const metricKey of metricKeys) {
        const config = endpointMetrics[metricKey];
        if (!config) {
          continue;
        }

        const existing = endpointsToFetch.get(config.endpoint);
        if (existing) {
          existing.metrics.push(metricKey);
        } else {
          endpointsToFetch.set(config.endpoint, {
            parser: config.parser,
            metrics: [metricKey],
          });
        }
      }

      // Fetch data from each unique endpoint
      for (const [endpoint, { parser, metrics }] of endpointsToFetch) {
        try {
          const data = await ouraService.makeApiRequest(endpoint, {
            start_date: startDateStr,
            end_date: endDateStr,
          });

          const items = data.data || [];
          if (!Array.isArray(items)) {
            continue;
          }

          const parserFn = ouraDataParsers[parser];
          if (!parserFn) {
            continue;
          }

          const parsed = parserFn(items);

          // Merge samples
          for (const [metricKey, samples] of Object.entries(parsed)) {
            if (!metrics.includes(metricKey)) {
              continue;
            }
            if (!allSamples[metricKey]) {
              allSamples[metricKey] = [];
            }
            allSamples[metricKey].push(...samples);
          }
        } catch {
          // Continue with other endpoints even if one fails
        }
      }

      // Convert to NormalizedMetricPayload format
      for (const [metricKey, samples] of Object.entries(allSamples)) {
        if (samples.length === 0) {
          continue;
        }

        const metric = getMetricByKey(metricKey);
        if (!metric) {
          continue;
        }

        results.push({
          provider: "oura",
          metricKey,
          displayName: metric.displayName,
          unit: metric.unit || samples[0].unit,
          samples,
        });
      }

      return results;
    } catch {
      return [];
    }
  },

  /**
   * Fetch sleep data from Oura
   */
  fetchSleepData: async (
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> =>
    ouraService.fetchHealthData(
      [
        "sleep_analysis",
        "resting_heart_rate",
        "heart_rate_variability",
        "respiratory_rate",
      ],
      startDate,
      endDate
    ),

  /**
   * Fetch activity data from Oura
   */
  fetchActivityData: async (
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> =>
    ouraService.fetchHealthData(
      ["steps", "active_energy", "distance_walking_running"],
      startDate,
      endDate
    ),

  /**
   * Fetch all available metrics for a date range
   */
  fetchAllMetrics: (
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> => {
    const availableMetrics = getAvailableMetricsForProvider("oura");
    const metricKeys = availableMetrics.map((m) => m.key);
    return ouraService.fetchHealthData(metricKeys, startDate, endDate);
  },

  /**
   * Fetch metrics for sync (legacy support)
   */
  fetchMetrics: async (
    selectedMetrics: string[],
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> =>
    ouraService.fetchHealthData(selectedMetrics, startDate, endDate),

  /**
   * Disconnect Oura integration
   */
  disconnect: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(HEALTH_STORAGE_KEYS.OURA_TOKENS);
    } catch {
      // Ignore errors during disconnect
    }
  },

  /**
   * Revoke access token
   */
  revokeAccess: async (): Promise<boolean> => {
    try {
      const tokens = await ouraService.getTokens();
      if (!tokens) {
        return true;
      }

      // Oura doesn't have a revoke endpoint, just delete local tokens
      await ouraService.disconnect();
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

export default ouraService;
