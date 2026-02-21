/**
 * Withings Service
 * OAuth 2.0 integration with Withings API
 * Supports comprehensive health data including body measurements, vitals, and activity
 */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Withings OAuth and metric normalization flows intentionally consolidate many provider-specific branches in one integration module. */

import CryptoJS from "crypto-js";
import Constants from "expo-constants";
import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";
import {
  maybeCompleteAuthSession,
  openAuthSessionAsync,
} from "expo-web-browser";
import {
  getAvailableMetricsForProvider,
  getMetricByKey,
  getWithingsScopesForMetrics,
} from "../health/healthMetricsCatalog";
import {
  HEALTH_STORAGE_KEYS,
  type MetricSample,
  type NormalizedMetricPayload,
  type ProviderAvailability,
  type WithingsTokens,
} from "../health/healthTypes";
import { saveProviderConnection } from "../health/providerConnections";

// Withings OAuth configuration
const WITHINGS_CLIENT_ID =
  Constants.expoConfig?.extra?.withingsClientId || "YOUR_WITHINGS_CLIENT_ID";
const WITHINGS_CLIENT_SECRET =
  Constants.expoConfig?.extra?.withingsClientSecret ||
  "YOUR_WITHINGS_CLIENT_SECRET";
const WITHINGS_AUTH_URL = "https://account.withings.com/oauth2_user/authorize2";
const WITHINGS_API_BASE =
  Constants.expoConfig?.extra?.withingsApiBase ||
  process.env.WITHINGS_API_BASE ||
  "https://wbsapi.withings.net";
const WITHINGS_TOKEN_URL = `${WITHINGS_API_BASE}/v2/oauth2`;
// OAuth redirect URI - must match what's registered with Withings (web URL)
const REDIRECT_URI = "https://maak-5caad.web.app/withings-callback";

// Complete OAuth flow
maybeCompleteAuthSession();

/**
 * Generate HMAC SHA-256 signature for Withings API requests
 * @param params - Parameters to sign (action, client_id, and optionally timestamp or nonce)
 * @param clientSecret - Client secret for HMAC key
 * @returns HMAC SHA-256 signature as hex string
 */
function generateSignature(
  params: {
    action: string;
    client_id: string;
    timestamp?: string;
    nonce?: string;
  },
  clientSecret: string
): string {
  // Build params object with only the fields we need to sign
  const paramsToSign: Record<string, string> = {
    action: params.action,
    client_id: params.client_id,
  };

  if (params.timestamp) {
    paramsToSign.timestamp = params.timestamp;
  }
  if (params.nonce) {
    paramsToSign.nonce = params.nonce;
  }

  // Sort keys alphabetically and concatenate values with commas
  // This matches the Withings documentation: "Concatenate the sorted values (alphabetically by key name)"
  const sortedKeys = Object.keys(paramsToSign).sort();
  const sortedValues = sortedKeys.map((key) => paramsToSign[key]).join(",");

  // Generate HMAC SHA-256 signature using crypto-js
  // Withings expects hex format output
  const signature = CryptoJS.HmacSHA256(sortedValues, clientSecret);
  return signature.toString(CryptoJS.enc.Hex);
}

/**
 * Get a nonce from Withings API
 * Required for signing API requests
 * Step 1: Obtain a nonce using HMAC SHA-256 signature
 * @returns Nonce string
 */
async function getNonce(): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const params = {
    action: "getnonce",
    client_id: WITHINGS_CLIENT_ID,
    timestamp,
  };

  // Generate signature for nonce request
  // For nonce request: concatenate action, client_id, timestamp (in that order per docs)
  const signature = generateSignature(params, WITHINGS_CLIENT_SECRET);

  // Request nonce from Withings API
  const response = await fetch(`${WITHINGS_API_BASE}/v2/signature`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      action: params.action,
      client_id: params.client_id,
      timestamp,
      signature,
    }).toString(),
  });

  const responseData = await response.json();

  if (responseData.status !== 0) {
    const errorMsg = responseData.error || "Failed to get nonce";
    const errorText = responseData.error_text || "";
    throw new Error(
      `Failed to get Withings nonce: ${errorMsg}${errorText ? ` - ${errorText}` : ""}`
    );
  }

  return responseData.body.nonce;
}

/**
 * Make a signed API request to Withings
 * Step 2: Sign the actual API request using the nonce
 * Automatically handles nonce retrieval and request signing
 * @param endpoint - API endpoint path (e.g., "/v2/user")
 * @param action - API action name
 * @param additionalParams - Additional parameters to include in the request
 * @param accessToken - Optional access token for authenticated requests
 * @returns API response data
 */
async function makeSignedRequest(
  endpoint: string,
  action: string,
  additionalParams: Record<string, string> = {},
  accessToken?: string
): Promise<any> {
  // Step 1: Get nonce for signing
  const nonce = await getNonce();

  // Step 2: Build parameters for signing (action, client_id, nonce - sorted alphabetically)
  const signParams = {
    action,
    client_id: WITHINGS_CLIENT_ID,
    nonce,
  };

  // Generate signature using HMAC SHA-256
  const signature = generateSignature(signParams, WITHINGS_CLIENT_SECRET);

  // Build request body with signature
  const bodyParams = new URLSearchParams({
    action,
    client_id: WITHINGS_CLIENT_ID,
    nonce,
    signature,
    ...additionalParams,
  });

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  // Make the signed request
  const response = await fetch(`${WITHINGS_API_BASE}${endpoint}`, {
    method: "POST",
    headers,
    body: bodyParams.toString(),
  });

  const responseData = await response.json();

  if (responseData.status !== 0) {
    const errorMsg = responseData.error || "API request failed";
    const errorText = responseData.error_text || "";
    throw new Error(
      `Withings API error: ${errorMsg}${errorText ? ` - ${errorText}` : ""}`
    );
  }

  return responseData;
}

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
   * Generate a random state parameter for CSRF protection
   */
  generateState: (): string => {
    // Generate a cryptographically random state string
    const array = new Uint8Array(32);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for environments without crypto.getRandomValues
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
  },

  /**
   * Start OAuth authentication flow
   * @param selectedMetrics - Array of metric keys to request access for
   * @param useDemoMode - Optional: Set to true to use demo user mode for testing
   */
  startAuth: async (
    selectedMetrics: string[],
    useDemoMode = false
  ): Promise<void> => {
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

      // Get required scopes for selected metrics
      const scopes = getWithingsScopesForMetrics(selectedMetrics);
      if (scopes.length === 0) {
        throw new Error(
          "No valid scopes found for selected metrics. Please select at least one metric."
        );
      }

      // Generate and store state parameter for CSRF protection
      const state = withingsService.generateState();
      await setItemAsync(
        HEALTH_STORAGE_KEYS.WITHINGS_OAUTH_STATE,
        JSON.stringify({
          state,
          selectedMetrics,
          timestamp: Date.now(),
        })
      );

      // Build OAuth URL following Withings documentation:
      // https://account.withings.com/oauth2_user/authorize2?response_type=code&client_id=YOUR_CLIENT_ID&scope=user.info,user.metrics,user.activity&redirect_uri=YOUR_REDIRECT_URI&state=YOUR_STATE
      const redirectUriEncoded = encodeURIComponent(REDIRECT_URI);
      const authUrl =
        `${WITHINGS_AUTH_URL}?` +
        "response_type=code&" +
        `client_id=${encodeURIComponent(WITHINGS_CLIENT_ID)}&` +
        `scope=${encodeURIComponent(scopes.join(","))}&` +
        `redirect_uri=${redirectUriEncoded}&` +
        `state=${encodeURIComponent(state)}` +
        (useDemoMode ? "&mode=demo" : "");

      // Use web callback URL for OAuth (registered with Withings)
      // The web page will redirect to deep link after extracting the code
      const result = await openAuthSessionAsync(authUrl, REDIRECT_URI);

      if (result.type === "success" && result.url) {
        // Handle both web callback URL and deep link redirect
        await withingsService.handleRedirect(result.url);
      } else {
        // Clean up stored state on cancellation
        await deleteItemAsync(HEALTH_STORAGE_KEYS.WITHINGS_OAUTH_STATE);
        throw new Error("Authentication cancelled or failed");
      }
    } catch (error: unknown) {
      // Clean up stored state on error
      try {
        await deleteItemAsync(HEALTH_STORAGE_KEYS.WITHINGS_OAUTH_STATE);
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(
        `Withings authentication failed: ${getErrorMessage(error)}`
      );
    }
  },

  /**
   * Handle OAuth redirect callback
   * Handles both web callback URL and deep link redirects
   * Validates state parameter for CSRF protection per Withings documentation
   */
  handleRedirect: async (url: string): Promise<void> => {
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
      const returnedState = urlObj.searchParams.get("state");

      // Retrieve and validate state parameter for CSRF protection
      let storedStateData: {
        state: string;
        selectedMetrics: string[];
        timestamp: number;
      } | null = null;
      try {
        const storedStateStr = await getItemAsync(
          HEALTH_STORAGE_KEYS.WITHINGS_OAUTH_STATE
        );
        if (storedStateStr) {
          storedStateData = JSON.parse(storedStateStr);
          // Clean up stored state after retrieval
          await deleteItemAsync(HEALTH_STORAGE_KEYS.WITHINGS_OAUTH_STATE);
        }
      } catch {
        // State not found or invalid - will fail validation below
      }

      // Validate state parameter matches (CSRF protection)
      if (
        !(returnedState && storedStateData) ||
        returnedState !== storedStateData.state
      ) {
        throw new Error(
          "Invalid state parameter. The authorization response may have been tampered with or expired. Please try again."
        );
      }

      // Check if state is too old (more than 10 minutes)
      const stateAge = Date.now() - storedStateData.timestamp;
      if (stateAge > 10 * 60 * 1000) {
        throw new Error(
          "Authorization state expired. Please try connecting again."
        );
      }

      const selectedMetrics = storedStateData.selectedMetrics || [];

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

      // Note: Authorization code is only valid for 30 seconds per Withings documentation
      // Exchange authorization code for access token using signed request
      // Token requests must be signed with nonce and signature per Withings API requirements
      const nonce = await getNonce();

      // Build parameters for signing (action, client_id, nonce - sorted alphabetically)
      const signParams = {
        action: "requesttoken",
        client_id: WITHINGS_CLIENT_ID,
        nonce,
      };

      // Generate signature
      const signature = generateSignature(signParams, WITHINGS_CLIENT_SECRET);

      // Exchange authorization code for tokens using signed request
      const tokenResponse = await fetch(WITHINGS_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          action: "requesttoken",
          client_id: WITHINGS_CLIENT_ID,
          code,
          grant_type: "authorization_code",
          nonce,
          redirect_uri: REDIRECT_URI, // Must match registered callback URL
          signature,
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
    await setItemAsync(
      HEALTH_STORAGE_KEYS.WITHINGS_TOKENS,
      JSON.stringify(tokens)
    );
  },

  /**
   * Get stored tokens
   */
  getTokens: async (): Promise<WithingsTokens | null> => {
    try {
      const tokensStr = await getItemAsync(HEALTH_STORAGE_KEYS.WITHINGS_TOKENS);
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
   * Uses signed request per Withings API requirements
   * Important: Always replaces the previous refresh_token with the new one
   * Token expiration: access_token expires after 3 hours, refresh_token expires after 1 year
   */
  refreshTokenIfNeeded: async (): Promise<string | null> => {
    try {
      const tokens = await withingsService.getTokens();
      if (!tokens) {
        return null;
      }

      // Return existing token if still valid (with 5 min buffer)
      // access_token expires after 3 hours per Withings documentation
      if (tokens.expiresAt > Date.now() + 5 * 60 * 1000) {
        return tokens.accessToken;
      }

      // Get nonce for signing the refresh token request
      const nonce = await getNonce();

      // Build parameters for signing (action, client_id, nonce - sorted alphabetically)
      const signParams = {
        action: "requesttoken",
        client_id: WITHINGS_CLIENT_ID,
        nonce,
      };

      // Generate signature
      const signature = generateSignature(signParams, WITHINGS_CLIENT_SECRET);

      // Refresh token using signed request
      const response = await fetch(WITHINGS_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          action: "requesttoken",
          client_id: WITHINGS_CLIENT_ID,
          grant_type: "refresh_token",
          nonce,
          refresh_token: tokens.refreshToken,
          signature,
        }).toString(),
      });

      const responseData = await response.json();

      if (responseData.status !== 0) {
        return null;
      }

      const newTokens = responseData.body;

      // Important: Always replace the previous refresh_token with the new one
      // Old refresh_token expires 8 hours after new issuance or once the new access_token is used
      await withingsService.saveTokens({
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || tokens.refreshToken, // Fallback to old if not provided
        expiresAt: Date.now() + newTokens.expires_in * 1000, // expires_in is in seconds
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
      if (!accessToken) {
        return [];
      }

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
            if (!measureType) {
              continue;
            }

            const metricKey = measureType.key;
            if (!metricKeys.includes(metricKey)) {
              continue;
            }

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
                if (!samplesByMetric.heart_rate) {
                  samplesByMetric.heart_rate = [];
                }
                samplesByMetric.heart_rate.push({
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
            if (!samplesByMetric.sleep_analysis) {
              samplesByMetric.sleep_analysis = [];
            }

            for (const item of sleepData.body.series) {
              // Total sleep in hours
              const totalSleep =
                ((item.data?.lightsleepduration || 0) +
                  (item.data?.deepsleepduration || 0) +
                  (item.data?.remsleepduration || 0)) /
                3600;

              samplesByMetric.sleep_analysis.push({
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
                if (!samplesByMetric.steps) {
                  samplesByMetric.steps = [];
                }
                samplesByMetric.steps.push({
                  value: activity.steps,
                  unit: "count",
                  startDate: timestamp,
                  source: "Withings",
                });
              }

              if (metricKeys.includes("active_energy") && activity.calories) {
                if (!samplesByMetric.active_energy) {
                  samplesByMetric.active_energy = [];
                }
                samplesByMetric.active_energy.push({
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
                if (!samplesByMetric.distance_walking_running) {
                  samplesByMetric.distance_walking_running = [];
                }
                samplesByMetric.distance_walking_running.push({
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
   * Uses signed request for user unlink action
   */
  revokeAccess: async (): Promise<boolean> => {
    try {
      const tokens = await withingsService.getTokens();
      if (!tokens) {
        return true;
      }

      // Use signed request for unlink action
      await makeSignedRequest("/v2/user", "unlink", {}, tokens.accessToken);

      await withingsService.disconnect();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get a nonce from Withings API (exposed for testing/debugging)
   * @returns Nonce string
   */
  getNonce: async (): Promise<string> => getNonce(),

  /**
   * Make a signed API request to Withings (exposed for advanced usage)
   * @param endpoint - API endpoint path
   * @param action - API action name
   * @param additionalParams - Additional parameters
   * @param accessToken - Optional access token
   * @returns API response data
   */
  makeSignedRequest: async (
    endpoint: string,
    action: string,
    additionalParams: Record<string, string> = {},
    accessToken?: string
  ): Promise<any> =>
    makeSignedRequest(endpoint, action, additionalParams, accessToken),
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
