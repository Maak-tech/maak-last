/**
 * Garmin Connect Service
 * OAuth 1.0a integration with Garmin Connect Health API
 * Supports comprehensive health data including vitals, activity, sleep, and body composition
 */
/* biome-ignore-all lint/performance/noNamespaceImport: Expo Garmin integration currently relies on namespace APIs from linking, secure-store, and web-browser in this module. */

import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import {
  getAvailableMetricsForProvider,
  getMetricByKey,
} from "../health/healthMetricsCatalog";
import { saveProviderConnection } from "../health/providerConnections";
import {
  type GarminTokens,
  HEALTH_STORAGE_KEYS,
  type MetricSample,
  type NormalizedMetricPayload,
  type ProviderAvailability,
} from "../health/healthTypes";

// Garmin OAuth configuration
const GARMIN_CLIENT_ID =
  Constants.expoConfig?.extra?.garminClientId || "YOUR_GARMIN_CLIENT_ID";
const GARMIN_CLIENT_SECRET =
  Constants.expoConfig?.extra?.garminClientSecret ||
  "YOUR_GARMIN_CLIENT_SECRET";
const GARMIN_REQUEST_TOKEN_URL =
  "https://connectapi.garmin.com/oauth-service/oauth/request_token";
const GARMIN_AUTH_URL = "https://connect.garmin.com/oauthConfirm";
const GARMIN_ACCESS_TOKEN_URL =
  "https://connectapi.garmin.com/oauth-service/oauth/access_token";
const GARMIN_API_BASE = "https://apis.garmin.com";
const REDIRECT_URI = Linking.createURL("garmin-callback");

// Complete OAuth flow
WebBrowser.maybeCompleteAuthSession();

type GarminHeartRateValue = {
  heartRate?: number;
  value?: number;
  timestampInSeconds?: number;
};

type GarminDataPoint = {
  heartRateValues?: GarminHeartRateValue[];
  startTimeInSeconds?: number;
  endTimeInSeconds?: number;
  startTimeLocal?: string;
  calendarDate?: string | number;
  heartRate?: number;
  averageHeartRate?: number;
  value?: number | string;
  restingHeartRate?: number;
  hrvValue?: number;
  weeklyAvg?: number;
  lastNightAvg?: number;
  averageSpO2?: number;
  spo2Value?: number;
  avgWakingRespirationValue?: number;
  avgSleepingRespirationValue?: number;
  steps?: number;
  totalSteps?: number;
  activeKilocalories?: number;
  activeCalories?: number;
  bmrKilocalories?: number;
  restingCalories?: number;
  totalDistanceMeters?: number;
  distanceInMeters?: number;
  floorsAscended?: number;
  floorsClimbed?: number;
  sleepTimeSeconds?: number;
  totalSleepTimeInSeconds?: number;
  weight?: number;
  weightInGrams?: number;
  samplePk?: number;
  bodyFat?: number;
  bodyFatPercentage?: number;
  bmi?: number;
  valueInML?: number;
  waterInML?: number;
  timestampInSeconds?: number;
  activityType?: string;
  activityName?: string;
};

const asDataPoints = (data: unknown): GarminDataPoint[] =>
  Array.isArray(data) ? (data as GarminDataPoint[]) : [];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
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

/**
 * Garmin data type parsers
 */
const dataTypeParsers: Record<
  string,
  (data: unknown, metricKey: string) => MetricSample[]
> = {
  // Heart rate data
  /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Garmin heart rate payload varies across endpoints and is normalized here for compatibility. */
  heart_rate: (data) => {
    if (!data) {
      return [];
    }
    const samples: MetricSample[] = [];

    // Handle different response formats
    if (Array.isArray(data)) {
      for (const item of data as GarminDataPoint[]) {
        if (item.heartRateValues) {
          for (const hr of item.heartRateValues) {
            samples.push({
              value: hr.heartRate || hr.value || 0,
              unit: "bpm",
              startDate: toIsoDate(
                (hr.timestampInSeconds !== undefined
                  ? hr.timestampInSeconds * 1000
                  : undefined) ||
                  (item.startTimeInSeconds !== undefined
                    ? item.startTimeInSeconds * 1000
                    : undefined)
              ),
              source: "Garmin",
            });
          }
        } else {
          samples.push({
            value: item.heartRate || item.averageHeartRate || item.value || 0,
            unit: "bpm",
            startDate: toIsoDate(
              (item.startTimeInSeconds !== undefined
                ? item.startTimeInSeconds * 1000
                : undefined) || item.calendarDate
            ),
            source: "Garmin",
          });
        }
      }
    }
    return samples;
  },

  // Resting heart rate
  resting_heart_rate: (data) => {
    if (!(data && Array.isArray(data))) {
      return [];
    }
    return asDataPoints(data)
      .filter((item) => item.restingHeartRate)
      .map((item) => ({
        value: item.restingHeartRate ?? 0,
        unit: "bpm",
        startDate: toIsoDate(
          item.calendarDate ||
            (item.startTimeInSeconds !== undefined
              ? item.startTimeInSeconds * 1000
              : undefined)
        ),
        source: "Garmin",
      }));
  },

  // Heart rate variability
  heart_rate_variability: (data) => {
    if (!(data && Array.isArray(data))) {
      return [];
    }
    return asDataPoints(data).map((item) => ({
      value: item.hrvValue || item.weeklyAvg || item.lastNightAvg || 0,
      unit: "ms",
      startDate: toIsoDate(
        item.calendarDate ||
          (item.startTimeInSeconds !== undefined
            ? item.startTimeInSeconds * 1000
            : undefined)
      ),
      source: "Garmin",
    }));
  },

  // Blood oxygen (SpO2)
  blood_oxygen: (data) => {
    if (!(data && Array.isArray(data))) {
      return [];
    }
    return asDataPoints(data).map((item) => ({
      value: item.averageSpO2 || item.spo2Value || item.value || 0,
      unit: "%",
      startDate: toIsoDate(
        item.calendarDate ||
          (item.startTimeInSeconds !== undefined
            ? item.startTimeInSeconds * 1000
            : undefined)
      ),
      source: "Garmin",
    }));
  },

  // Respiratory rate
  respiratory_rate: (data) => {
    if (!(data && Array.isArray(data))) {
      return [];
    }
    return asDataPoints(data).map((item) => ({
      value:
        item.avgWakingRespirationValue ||
        item.avgSleepingRespirationValue ||
        item.value ||
        0,
      unit: "breaths/min",
      startDate: toIsoDate(
        item.calendarDate ||
          (item.startTimeInSeconds !== undefined
            ? item.startTimeInSeconds * 1000
            : undefined)
      ),
      source: "Garmin",
    }));
  },

  // Steps
  steps: (data) => {
    if (!(data && Array.isArray(data))) {
      return [];
    }
    return asDataPoints(data).map((item) => ({
      value: item.steps || item.totalSteps || 0,
      unit: "count",
      startDate: toIsoDate(
        item.calendarDate ||
          (item.startTimeInSeconds !== undefined
            ? item.startTimeInSeconds * 1000
            : undefined)
      ),
      source: "Garmin",
    }));
  },

  // Active energy
  active_energy: (data) => {
    if (!(data && Array.isArray(data))) {
      return [];
    }
    return asDataPoints(data).map((item) => ({
      value: item.activeKilocalories || item.activeCalories || 0,
      unit: "kcal",
      startDate: toIsoDate(
        item.calendarDate ||
          (item.startTimeInSeconds !== undefined
            ? item.startTimeInSeconds * 1000
            : undefined)
      ),
      source: "Garmin",
    }));
  },

  // Basal energy
  basal_energy: (data) => {
    if (!(data && Array.isArray(data))) {
      return [];
    }
    return asDataPoints(data).map((item) => ({
      value: item.bmrKilocalories || item.restingCalories || 0,
      unit: "kcal",
      startDate: toIsoDate(
        item.calendarDate ||
          (item.startTimeInSeconds !== undefined
            ? item.startTimeInSeconds * 1000
            : undefined)
      ),
      source: "Garmin",
    }));
  },

  // Distance
  distance_walking_running: (data) => {
    if (!(data && Array.isArray(data))) {
      return [];
    }
    return asDataPoints(data).map((item) => ({
      // Convert meters to km
      value: (item.totalDistanceMeters || item.distanceInMeters || 0) / 1000,
      unit: "km",
      startDate: toIsoDate(
        item.calendarDate ||
          (item.startTimeInSeconds !== undefined
            ? item.startTimeInSeconds * 1000
            : undefined)
      ),
      source: "Garmin",
    }));
  },

  // Floors climbed
  flights_climbed: (data) => {
    if (!(data && Array.isArray(data))) {
      return [];
    }
    return asDataPoints(data).map((item) => ({
      value: item.floorsAscended || item.floorsClimbed || 0,
      unit: "count",
      startDate: toIsoDate(
        item.calendarDate ||
          (item.startTimeInSeconds !== undefined
            ? item.startTimeInSeconds * 1000
            : undefined)
      ),
      source: "Garmin",
    }));
  },

  // Sleep
  sleep_analysis: (data) => {
    if (!(data && Array.isArray(data))) {
      return [];
    }
    return asDataPoints(data).map((item) => ({
      // Convert seconds to hours
      value:
        (item.sleepTimeSeconds || item.totalSleepTimeInSeconds || 0) / 3600,
      unit: "hours",
      startDate: toIsoDate(
        item.calendarDate ||
          (item.startTimeInSeconds !== undefined
            ? item.startTimeInSeconds * 1000
            : undefined)
      ),
      endDate: item.endTimeInSeconds
        ? toIsoDate(
            item.endTimeInSeconds !== undefined
              ? item.endTimeInSeconds * 1000
              : undefined
          )
        : undefined,
      source: "Garmin",
    }));
  },

  // Weight
  weight: (data) => {
    if (!(data && Array.isArray(data))) {
      return [];
    }
    return asDataPoints(data).map((item) => ({
      // Convert grams to kg
      value: (item.weight || item.weightInGrams || 0) / 1000,
      unit: "kg",
      startDate: new Date(
        item.calendarDate || item.samplePk || Date.now()
      ).toISOString(),
      source: "Garmin",
    }));
  },

  // Body fat percentage
  body_fat_percentage: (data) => {
    if (!(data && Array.isArray(data))) {
      return [];
    }
    return asDataPoints(data)
      .filter((item) => item.bodyFat || item.bodyFatPercentage)
      .map((item) => ({
        value: item.bodyFat || item.bodyFatPercentage || 0,
        unit: "%",
        startDate: new Date(
          item.calendarDate || item.samplePk || Date.now()
        ).toISOString(),
        source: "Garmin",
      }));
  },

  // BMI
  body_mass_index: (data) => {
    if (!(data && Array.isArray(data))) {
      return [];
    }
    return asDataPoints(data)
      .filter((item) => item.bmi)
      .map((item) => ({
        value: item.bmi ?? 0,
        unit: "kg/m²",
        startDate: new Date(
          item.calendarDate || item.samplePk || Date.now()
        ).toISOString(),
        source: "Garmin",
      }));
  },

  // Water intake
  water_intake: (data) => {
    if (!(data && Array.isArray(data))) {
      return [];
    }
    return asDataPoints(data).map((item) => ({
      value: item.valueInML || item.waterInML || 0,
      unit: "ml",
      startDate: toIsoDate(
        item.calendarDate ||
          (item.timestampInSeconds !== undefined
            ? item.timestampInSeconds * 1000
            : undefined)
      ),
      source: "Garmin",
    }));
  },

  // Workouts/Activities
  workouts: (data) => {
    if (!(data && Array.isArray(data))) {
      return [];
    }
    return asDataPoints(data).map((item) => ({
      value: item.activityType || item.activityName || "workout",
      unit: "",
      startDate: toIsoDate(
        (item.startTimeInSeconds !== undefined
          ? item.startTimeInSeconds * 1000
          : undefined) || item.startTimeLocal
      ),
      endDate: item.endTimeInSeconds
        ? toIsoDate(
            item.endTimeInSeconds !== undefined
              ? item.endTimeInSeconds * 1000
              : undefined
          )
        : undefined,
      source: "Garmin",
    }));
  },
};

/**
 * Generate OAuth 1.0a signature (simplified - production should use crypto library)
 */
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  tokenSecret = ""
): string {
  // Sort parameters alphabetically
  const sortedParams = Object.keys(params)
    .sort()
    .map(
      (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
    )
    .join("&");

  // Create signature base string
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

  // Create signing key
  const signingKey = `${encodeURIComponent(GARMIN_CLIENT_SECRET)}&${encodeURIComponent(tokenSecret)}`;

  // For React Native, we'll use a simple base64 encoding as a placeholder
  // In production, use a proper HMAC-SHA1 implementation
  // This is a simplified version - use crypto-js or similar for production
  const signature = btoa(signatureBaseString + signingKey).substring(0, 43);

  return signature;
}

/**
 * Generate OAuth 1.0a authorization header
 */
/* biome-ignore lint/nursery/useMaxParams: OAuth header generation naturally requires method/url/token/tokenSecret plus optional params. */
function generateOAuthHeader(
  method: string,
  url: string,
  token = "",
  tokenSecret = "",
  additionalParams: Record<string, string> = {}
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2) + timestamp;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: GARMIN_CLIENT_ID,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: "1.0",
    ...additionalParams,
  };

  if (token) {
    oauthParams.oauth_token = token;
  }

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    tokenSecret
  );
  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`
    )
    .join(", ");

  return `OAuth ${headerParts}`;
}

/**
 * Garmin Connect Service
 */
export const garminService = {
  /**
   * Check if Garmin integration is available
   */
  isAvailable: (): Promise<ProviderAvailability> => {
    try {
      if (
        GARMIN_CLIENT_ID === "YOUR_GARMIN_CLIENT_ID" ||
        GARMIN_CLIENT_SECRET === "YOUR_GARMIN_CLIENT_SECRET"
      ) {
        return Promise.resolve({
          available: false,
          reason:
            "Garmin credentials not configured. Please set GARMIN_CLIENT_ID and GARMIN_CLIENT_SECRET in app.json extra config.",
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
   * Get all available metrics for Garmin
   */
  getAvailableMetrics: () => getAvailableMetricsForProvider("garmin"),

  /**
   * Check if connected to Garmin
   */
  isConnected: async (): Promise<boolean> => {
    const tokens = await garminService.getTokens();
    return tokens !== null;
  },

  /**
   * Start OAuth 1.0a authentication flow
   */
  startAuth: async (selectedMetrics: string[]): Promise<void> => {
    try {
      // Step 1: Get request token
      const authHeader = generateOAuthHeader(
        "POST",
        GARMIN_REQUEST_TOKEN_URL,
        "",
        "",
        { oauth_callback: REDIRECT_URI }
      );

      const requestTokenResponse = await fetch(GARMIN_REQUEST_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (!requestTokenResponse.ok) {
        throw new Error("Failed to get request token");
      }

      const requestTokenData = await requestTokenResponse.text();
      const requestTokenParams = new URLSearchParams(requestTokenData);
      const oauthToken = requestTokenParams.get("oauth_token");
      const oauthTokenSecret = requestTokenParams.get("oauth_token_secret");

      if (!(oauthToken && oauthTokenSecret)) {
        throw new Error("Invalid request token response");
      }

      // Store temporary token secret for later use
      await SecureStore.setItemAsync(
        "@garmin_temp_token_secret",
        oauthTokenSecret
      );
      await SecureStore.setItemAsync(
        "@garmin_selected_metrics",
        JSON.stringify(selectedMetrics)
      );

      // Step 2: Redirect user to authorize
      const authUrl = `${GARMIN_AUTH_URL}?oauth_token=${encodeURIComponent(oauthToken)}`;

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        REDIRECT_URI
      );

      if (result.type === "success" && result.url) {
        await garminService.handleRedirect(result.url);
      } else {
        throw new Error("Authentication cancelled or failed");
      }
    } catch (error: unknown) {
      throw new Error(
        `Garmin authentication failed: ${getErrorMessage(error)}`
      );
    }
  },

  /**
   * Handle OAuth redirect callback
   */
  handleRedirect: async (url: string): Promise<void> => {
    try {
      const urlObj = new URL(url);
      const oauthToken = urlObj.searchParams.get("oauth_token");
      const oauthVerifier = urlObj.searchParams.get("oauth_verifier");

      if (!(oauthToken && oauthVerifier)) {
        throw new Error("Missing OAuth tokens");
      }

      // Retrieve temporary token secret
      const tokenSecret = await SecureStore.getItemAsync(
        "@garmin_temp_token_secret"
      );
      const selectedMetricsStr = await SecureStore.getItemAsync(
        "@garmin_selected_metrics"
      );
      const selectedMetrics = selectedMetricsStr
        ? JSON.parse(selectedMetricsStr)
        : [];

      if (!tokenSecret) {
        throw new Error("Missing token secret");
      }

      // Step 3: Exchange for access token
      const authHeader = generateOAuthHeader(
        "POST",
        GARMIN_ACCESS_TOKEN_URL,
        oauthToken,
        tokenSecret,
        { oauth_verifier: oauthVerifier }
      );

      const accessTokenResponse = await fetch(GARMIN_ACCESS_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (!accessTokenResponse.ok) {
        throw new Error("Failed to get access token");
      }

      const accessTokenData = await accessTokenResponse.text();
      const accessTokenParams = new URLSearchParams(accessTokenData);
      const accessToken = accessTokenParams.get("oauth_token");
      const accessTokenSecret = accessTokenParams.get("oauth_token_secret");

      if (!(accessToken && accessTokenSecret)) {
        throw new Error("Invalid access token response");
      }

      // Clean up temporary storage
      await SecureStore.deleteItemAsync("@garmin_temp_token_secret");
      await SecureStore.deleteItemAsync("@garmin_selected_metrics");

      // Save tokens
      await garminService.saveTokens({
        accessToken,
        refreshToken: accessTokenSecret, // OAuth 1.0a uses token secret
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year (OAuth 1.0a tokens don't expire)
        userId: "",
        scope: selectedMetrics.join(","),
      });

      await saveProviderConnection({
        provider: "garmin",
        connected: true,
        connectedAt: toIsoDate(),
        selectedMetrics,
      });
    } catch (error: unknown) {
      throw new Error(
        `Failed to complete Garmin authentication: ${getErrorMessage(error)}`
      );
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
      if (!tokensStr) {
        return null;
      }
      return JSON.parse(tokensStr);
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
  ): Promise<unknown> => {
    const tokens = await garminService.getTokens();
    if (!tokens) {
      throw new Error("Not authenticated");
    }

    const url = new URL(`${GARMIN_API_BASE}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const authHeader = generateOAuthHeader(
      "GET",
      url.toString().split("?")[0],
      tokens.accessToken,
      tokens.refreshToken // Token secret stored in refreshToken
    );

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Fetch health data from Garmin
   */
  /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Endpoint grouping and parser dispatch intentionally keep API call orchestration in one flow. */
  async fetchHealthData(
    metricKeys: string[],
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> {
    try {
      const tokens = await garminService.getTokens();
      if (!tokens) {
        return [];
      }

      const results: NormalizedMetricPayload[] = [];
      const _startDateStr = formatDate(startDate);
      const _endDateStr = formatDate(endDate);

      // Group metrics by endpoint to reduce API calls
      const endpointMetrics: Record<string, string[]> = {
        "/wellness-api/rest/dailies": [
          "steps",
          "active_energy",
          "basal_energy",
          "distance_walking_running",
          "flights_climbed",
          "resting_heart_rate",
        ],
        "/wellness-api/rest/heartRate": ["heart_rate"],
        "/wellness-api/rest/hrv": ["heart_rate_variability"],
        "/wellness-api/rest/pulseOx": ["blood_oxygen"],
        "/wellness-api/rest/respiration": ["respiratory_rate"],
        "/wellness-api/rest/sleep": ["sleep_analysis"],
        "/wellness-api/rest/bodyComposition": [
          "weight",
          "body_fat_percentage",
          "body_mass_index",
        ],
        "/wellness-api/rest/hydration": ["water_intake"],
        "/wellness-api/rest/activities": ["workouts"],
      };

      for (const [endpoint, endpointMetricKeys] of Object.entries(
        endpointMetrics
      )) {
        const relevantMetrics = metricKeys.filter((m) =>
          endpointMetricKeys.includes(m)
        );
        if (relevantMetrics.length === 0) {
          continue;
        }

        try {
          const data = await garminService.makeApiRequest(endpoint, {
            uploadStartTimeInSeconds: Math.floor(
              startDate.getTime() / 1000
            ).toString(),
            uploadEndTimeInSeconds: Math.floor(
              endDate.getTime() / 1000
            ).toString(),
          });

          for (const metricKey of relevantMetrics) {
            const metric = getMetricByKey(metricKey);
            if (!metric) {
              continue;
            }

            const parser = dataTypeParsers[metricKey];
            if (!parser) {
              continue;
            }

            const samples = parser(data, metricKey);
            if (samples.length > 0) {
              results.push({
                provider: "garmin",
                metricKey,
                displayName: metric.displayName,
                unit: metric.unit,
                samples,
              });
            }
          }
        } catch {
          // Continue with other endpoints even if one fails
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
    const availableMetrics = getAvailableMetricsForProvider("garmin");
    const metricKeys = availableMetrics.map((m) => m.key);
    return garminService.fetchHealthData(metricKeys, startDate, endDate);
  },

  /**
   * Fetch metrics (alias for fetchHealthData for backward compatibility)
   */
  fetchMetrics: async (
    metricKeys: string[],
    startDate: Date,
    endDate: Date
  ): Promise<NormalizedMetricPayload[]> =>
    garminService.fetchHealthData(metricKeys, startDate, endDate),

  /**
   * Disconnect Garmin integration
   */
  disconnect: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(HEALTH_STORAGE_KEYS.GARMIN_TOKENS);
      await SecureStore.deleteItemAsync("@garmin_temp_token_secret");
      await SecureStore.deleteItemAsync("@garmin_selected_metrics");
    } catch {
      // Ignore errors during disconnect
    }
  },
};

// Helper function
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default garminService;
