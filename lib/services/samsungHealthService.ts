/**
 * Samsung Health Service
 * OAuth 2.0 integration with Samsung Health API
 * Supports comprehensive health data including vitals, activity, sleep, and body composition
 */
/* biome-ignore-all lint/performance/noNamespaceImport: Expo linking, secure-store, and web-browser namespace APIs are used throughout this provider integration module. */

import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import {
  getAvailableMetricsForProvider,
  getMetricByKey,
  getSamsungHealthScopesForMetrics,
} from "../health/healthMetricsCatalog";
import {
  HEALTH_STORAGE_KEYS,
  type MetricSample,
  type NormalizedMetricPayload,
  type ProviderAvailability,
  type SamsungHealthTokens,
} from "../health/healthTypes";
import { saveProviderConnection } from "../health/providerConnections";

// Samsung Health OAuth configuration
const SAMSUNG_HEALTH_CLIENT_ID =
  Constants.expoConfig?.extra?.samsungHealthClientId ||
  "YOUR_SAMSUNG_CLIENT_ID";
const SAMSUNG_HEALTH_CLIENT_SECRET =
  Constants.expoConfig?.extra?.samsungHealthClientSecret ||
  "YOUR_SAMSUNG_CLIENT_SECRET";
const SAMSUNG_HEALTH_AUTH_URL =
  "https://oauth-account.samsung.com/oauth2/v1/auth";
const SAMSUNG_HEALTH_TOKEN_URL =
  "https://oauth-account.samsung.com/oauth2/v1/token";
const SAMSUNG_HEALTH_API_BASE = "https://api-health.samsung.com/v1";
const REDIRECT_URI = Linking.createURL("samsung-health-callback");

// Complete OAuth flow
WebBrowser.maybeCompleteAuthSession();

type SamsungHealthDataItem = {
  timestamp?: string | number;
  start_time?: string | number;
  end_time?: string | number;
  date?: string | number;
  source?: string;
  value?: number;
  count?: number;
  bpm?: number;
  heart_rate?: number;
  resting_heart_rate?: number;
  hrv?: number;
  sdnn?: number;
  rmssd?: number;
  systolic?: number;
  systolic_pressure?: number;
  diastolic?: number;
  diastolic_pressure?: number;
  spo2?: number;
  oxygen_saturation?: number;
  respiratory_rate?: number;
  breaths_per_minute?: number;
  temperature?: number;
  body_temperature?: number;
  weight?: number;
  body_weight?: number;
  height?: number;
  bmi?: number;
  body_mass_index?: number;
  body_fat?: number;
  fat_percentage?: number;
  steps?: number;
  step_count?: number;
  active_calories?: number;
  calories_burned?: number;
  calories?: number;
  distance?: number;
  total_distance?: number;
  floors?: number;
  floors_climbed?: number;
  duration_minutes?: number;
  duration?: number;
  exercise_type?: string;
  workout_type?: string;
  type?: string;
  total_sleep_minutes?: number;
  bed_time?: string | number;
  wake_time?: string | number;
  amount?: number;
  water_ml?: number;
  glucose?: number;
  blood_glucose?: number;
};

type SamsungHealthResponsePayload = {
  data?: SamsungHealthDataItem[];
  height?: number;
};

const toIsoDate = (
  ...candidates: Array<string | number | Date | undefined>
): string => {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      return new Date(candidate).toISOString();
    }
  }
  return new Date().toISOString();
};

const getDataRows = (data: unknown): SamsungHealthDataItem[] => {
  const payload = data as SamsungHealthResponsePayload;
  return Array.isArray(payload.data) ? payload.data : [];
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

/**
 * Samsung Health data type parsers
 * Maps API responses to normalized MetricSample format
 */
const dataTypeParsers: Record<
  string,
  (data: unknown, metricKey: string) => MetricSample[]
> = {
  // Heart rate data
  heart_rate: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value: item.heart_rate || item.value || item.bpm || 0,
      unit: "bpm",
      startDate: toIsoDate(item.timestamp || item.start_time || item.date),
      endDate: item.end_time ? toIsoDate(item.end_time) : undefined,
      source: item.source || "Samsung Health",
    }));
  },

  // Resting heart rate
  resting_heart_rate: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value: item.resting_heart_rate || item.value || 0,
      unit: "bpm",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },

  // Heart rate variability
  heart_rate_variability: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value: item.hrv || item.sdnn || item.rmssd || item.value || 0,
      unit: "ms",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },

  // Blood pressure (systolic)
  blood_pressure_systolic: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value: item.systolic || item.systolic_pressure || 0,
      unit: "mmHg",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },

  // Blood pressure (diastolic)
  blood_pressure_diastolic: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value: item.diastolic || item.diastolic_pressure || 0,
      unit: "mmHg",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },

  // Blood oxygen (SpO2)
  blood_oxygen: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value: item.spo2 || item.oxygen_saturation || item.value || 0,
      unit: "%",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },

  // Respiratory rate
  respiratory_rate: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value:
        item.respiratory_rate || item.breaths_per_minute || item.value || 0,
      unit: "breaths/min",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },

  // Body temperature
  body_temperature: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value: item.temperature || item.body_temperature || item.value || 0,
      unit: "°C",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },

  // Weight
  weight: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value: item.weight || item.body_weight || item.value || 0,
      unit: "kg",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },

  // Height (from user profile)
  height: (data) => {
    const payload = data as SamsungHealthResponsePayload;
    // Height may come from profile endpoint
    if (payload.height) {
      return [
        {
          value: payload.height,
          unit: "cm",
          startDate: toIsoDate(),
          source: "Samsung Health Profile",
        },
      ];
    }
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value: item.height || item.value || 0,
      unit: "cm",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },

  // Body mass index
  body_mass_index: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value: item.bmi || item.body_mass_index || item.value || 0,
      unit: "kg/m²",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },

  // Body fat percentage
  body_fat_percentage: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value: item.body_fat || item.fat_percentage || item.value || 0,
      unit: "%",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },

  // Steps
  steps: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value: item.steps || item.step_count || item.count || item.value || 0,
      unit: "count",
      startDate: toIsoDate(item.timestamp || item.start_time || item.date),
      endDate: item.end_time ? toIsoDate(item.end_time) : undefined,
      source: item.source || "Samsung Health",
    }));
  },

  // Active energy burned
  active_energy: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value:
        item.active_calories ||
        item.calories_burned ||
        item.calories ||
        item.value ||
        0,
      unit: "kcal",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },

  // Distance walking/running
  distance_walking_running: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      // Samsung Health typically returns distance in meters, convert to km
      value: (item.distance || item.total_distance || item.value || 0) / 1000,
      unit: "km",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },

  // Flights/floors climbed
  flights_climbed: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value:
        item.floors || item.floors_climbed || item.count || item.value || 0,
      unit: "count",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },

  // Exercise minutes
  exercise_minutes: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      // Convert from milliseconds or seconds to minutes if needed
      value:
        item.duration_minutes ??
        (item.duration !== undefined ? item.duration / 60_000 : undefined) ??
        item.value ??
        0,
      unit: "min",
      startDate: toIsoDate(item.timestamp || item.start_time || item.date),
      endDate: item.end_time ? toIsoDate(item.end_time) : undefined,
      source: item.source || "Samsung Health",
    }));
  },

  // Workouts
  workouts: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value: item.exercise_type || item.workout_type || item.type || "workout",
      unit: "",
      startDate: toIsoDate(item.timestamp || item.start_time || item.date),
      endDate: item.end_time ? toIsoDate(item.end_time) : undefined,
      source: item.source || "Samsung Health",
    }));
  },

  // Sleep analysis
  sleep_analysis: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      // Total sleep in hours
      value: item.total_sleep_minutes
        ? item.total_sleep_minutes / 60
        : ((item.duration !== undefined
            ? item.duration / 3_600_000
            : undefined) ??
          item.value ??
          0),
      unit: "hours",
      startDate: toIsoDate(item.start_time || item.bed_time || item.date),
      endDate: toIsoDate(item.end_time || item.wake_time),
      source: item.source || "Samsung Health",
    }));
  },

  // Water intake
  water_intake: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value: item.amount || item.water_ml || item.value || 0,
      unit: "ml",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },

  // Blood glucose
  blood_glucose: (data) => {
    const rows = getDataRows(data);
    if (rows.length === 0) {
      return [];
    }
    return rows.map((item) => ({
      value: item.glucose || item.blood_glucose || item.value || 0,
      unit: "mg/dL",
      startDate: toIsoDate(item.timestamp || item.date),
      source: item.source || "Samsung Health",
    }));
  },
};

/**
 * Samsung Health Service
 */
export const samsungHealthService = {
  /**
   * Check if Samsung Health integration is available
   */
  isAvailable: (): Promise<ProviderAvailability> => {
    try {
      if (
        SAMSUNG_HEALTH_CLIENT_ID === "YOUR_SAMSUNG_CLIENT_ID" ||
        SAMSUNG_HEALTH_CLIENT_SECRET === "YOUR_SAMSUNG_CLIENT_SECRET"
      ) {
        return Promise.resolve({
          available: false,
          reason:
            "Samsung Health credentials not configured. Please set SAMSUNG_HEALTH_CLIENT_ID and SAMSUNG_HEALTH_CLIENT_SECRET in app.json extra config.",
        });
      }

      return Promise.resolve({
        available: true,
      });
    } catch (error: unknown) {
      return Promise.resolve({
        available: false,
        reason: getErrorMessage(error),
      });
    }
  },

  /**
   * Get all available metrics for Samsung Health
   */
  getAvailableMetrics: () => getAvailableMetricsForProvider("samsung_health"),

  /**
   * Check if connected to Samsung Health
   */
  isConnected: async (): Promise<boolean> => {
    const tokens = await samsungHealthService.getTokens();
    return tokens !== null && tokens.expiresAt > Date.now();
  },

  /**
   * Start OAuth authentication flow
   */
  startAuth: async (selectedMetrics: string[]): Promise<void> => {
    try {
      const scopes = getSamsungHealthScopesForMetrics(selectedMetrics);

      const authUrl =
        `${SAMSUNG_HEALTH_AUTH_URL}?` +
        "response_type=code&" +
        `client_id=${encodeURIComponent(SAMSUNG_HEALTH_CLIENT_ID)}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(scopes.join(" "))}&` +
        `state=${encodeURIComponent("samsung_health_auth")}`;

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        REDIRECT_URI
      );

      if (result.type === "success" && result.url) {
        await samsungHealthService.handleRedirect(result.url, selectedMetrics);
      } else {
        throw new Error("Authentication cancelled or failed");
      }
    } catch (error: unknown) {
      throw new Error(
        `Samsung Health authentication failed: ${getErrorMessage(error)}`
      );
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
        userId: tokens.user_id || tokens.userId || "",
        scope: tokens.scope || "",
      });

      await saveProviderConnection({
        provider: "samsung_health",
        connected: true,
        connectedAt: toIsoDate(),
        selectedMetrics: selectedMetrics || [],
      });
    } catch (error: unknown) {
      throw new Error(
        `Failed to complete Samsung Health authentication: ${getErrorMessage(error)}`
      );
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
      const tokens = await samsungHealthService.getTokens();
      if (!tokens) {
        return null;
      }

      // Return existing token if still valid (with 5 min buffer)
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
    } catch {
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
      if (!accessToken) {
        return [];
      }

      const results: NormalizedMetricPayload[] = [];

      for (const key of metricKeys) {
        const metric = getMetricByKey(key);
        if (!metric?.samsungHealth?.endpoint) {
          continue;
        }

        try {
          // Build endpoint URL with date parameter
          const endpoint = metric.samsungHealth.endpoint.replace(
            "{date}",
            formatDate(startDate)
          );

          // Add date range params for endpoints that support it
          const url = new URL(`${SAMSUNG_HEALTH_API_BASE}${endpoint}`);
          url.searchParams.set("start_date", formatDate(startDate));
          url.searchParams.set("end_date", formatDate(endDate));

          const response = await fetch(url.toString(), {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          });

          if (response.ok) {
            const data = await response.json();
            const samples = parseMetricData(key, data);

            if (samples.length > 0) {
              results.push({
                provider: "samsung_health",
                metricKey: key,
                displayName: metric.displayName,
                unit: metric.unit,
                samples,
              });
            }
          }
        } catch {
          // Continue with other metrics even if one fails
        }
      }

      return results;
    } catch {
      return [];
    }
  },

  /**
   * Fetch a single metric from Samsung Health
   */
  fetchSingleMetric: async (
    metricKey: string,
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload | null> => {
    const results = await samsungHealthService.fetchHealthData(
      [metricKey],
      startDate,
      endDate
    );
    return results.length > 0 ? results[0] : null;
  },

  /**
   * Fetch all available metrics for a date range
   */
  fetchAllMetrics: (
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> => {
    const availableMetrics = getAvailableMetricsForProvider("samsung_health");
    const metricKeys = availableMetrics.map((m) => m.key);
    return samsungHealthService.fetchHealthData(metricKeys, startDate, endDate);
  },

  /**
   * Fetch metrics (alias for fetchHealthData for backward compatibility)
   */
  fetchMetrics: async (
    metricKeys: string[],
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> =>
    samsungHealthService.fetchHealthData(metricKeys, startDate, endDate),

  /**
   * Disconnect Samsung Health integration
   */
  disconnect: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(
        HEALTH_STORAGE_KEYS.SAMSUNG_HEALTH_TOKENS
      );
    } catch {
      // Ignore errors during disconnect
    }
  },

  /**
   * Revoke access token (if Samsung Health API supports it)
   */
  revokeAccess: async (): Promise<boolean> => {
    try {
      const tokens = await samsungHealthService.getTokens();
      if (!tokens) {
        return true;
      }

      // Attempt to revoke the token via Samsung's API
      // Note: Samsung Health may or may not support token revocation
      try {
        await fetch("https://oauth-account.samsung.com/oauth2/v1/revoke", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            token: tokens.accessToken,
            client_id: SAMSUNG_HEALTH_CLIENT_ID,
            client_secret: SAMSUNG_HEALTH_CLIENT_SECRET,
          }).toString(),
        });
      } catch {
        // Revocation endpoint may not exist, continue with local cleanup
      }

      await samsungHealthService.disconnect();
      return true;
    } catch {
      return false;
    }
  },
};

// Helper functions
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function parseMetricData(metricKey: string, data: unknown): MetricSample[] {
  // Use specific parser if available
  const parser = dataTypeParsers[metricKey];
  if (parser) {
    return parser(data, metricKey);
  }

  // Fallback generic parser
  const rows = getDataRows(data);
  if (rows.length === 0) {
    return [];
  }

  return rows.map((item) => ({
    value: item.value || item.count || 0,
    unit: "",
    startDate: toIsoDate(item.timestamp || item.date),
    source: "Samsung Health",
  }));
}

export default samsungHealthService;
