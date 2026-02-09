/**
 * Fitbit Service
 * OAuth 2.0 integration with Fitbit API for health data
 */

import Constants from "expo-constants";
import {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
} from "expo-crypto";
import { getItemAsync, setItemAsync, deleteItemAsync } from "expo-secure-store";
import {
  maybeCompleteAuthSession,
  openAuthSessionAsync,
} from "expo-web-browser";
import {
  getAvailableMetricsForProvider,
  getFitbitScopesForMetrics,
  getMetricByKey,
} from "../health/healthMetricsCatalog";
import { saveProviderConnection } from "../health/healthSync";
import {
  type FitbitTokens,
  HEALTH_STORAGE_KEYS,
  type NormalizedMetricPayload,
  type ProviderAvailability,
} from "../health/healthTypes";

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
// OAuth redirect URI - must match what's registered with Fitbit (web URL)
const REDIRECT_URI = "https://maak-5caad.web.app/fitbit-callback";
const FITBIT_PKCE_VERIFIER_KEY = "health_fitbit_pkce_verifier";
const BASE64_URL_PLUS_REGEX = /\+/g;
const BASE64_URL_SLASH_REGEX = /\//g;
const BASE64_URL_PADDING_REGEX = /=+$/;

const base64UrlEncode = (bytes: Uint8Array): string => {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary)
    .replace(BASE64_URL_PLUS_REGEX, "-")
    .replace(BASE64_URL_SLASH_REGEX, "_")
    .replace(BASE64_URL_PADDING_REGEX, "");
};

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

type FitbitApiEntry = {
  value?: number;
  dateTime?: string;
  weight?: number;
  fat?: number;
  date?: string;
  duration?: number;
  startTime?: string;
  endTime?: string;
};

type FitbitApiResponse = {
  "activities-heart"?: Array<{ value?: { restingHeartRate?: number } }>;
  "activities-steps"?: Array<{ value?: string }>;
  "activities-calories"?: Array<{ value?: string }>;
  "activities-distance"?: Array<{ value?: string }>;
  "activities-floors"?: Array<{ value?: string }>;
  value?: FitbitApiEntry[];
  weight?: FitbitApiEntry[];
  fat?: FitbitApiEntry[];
  sleep?: FitbitApiEntry[];
  summary?: { water?: number };
};

const createPkcePair = async (): Promise<{
  verifier: string;
  challenge: string;
}> => {
  const verifier = base64UrlEncode(randomBytes(32));
  const hashBase64 = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: CryptoEncoding.BASE64 }
  );
  const challenge = hashBase64
    .replace(BASE64_URL_PLUS_REGEX, "-")
    .replace(BASE64_URL_SLASH_REGEX, "_")
    .replace(BASE64_URL_PADDING_REGEX, "");
  return { verifier, challenge };
};

// Complete OAuth flow
maybeCompleteAuthSession();

/**
 * Check if Fitbit integration is available
 */
export const fitbitService = {
  isAvailable: (): Promise<ProviderAvailability> => {
    try {
      // Check if credentials are configured
      if (
        FITBIT_CLIENT_ID === "YOUR_FITBIT_CLIENT_ID" ||
        FITBIT_CLIENT_SECRET === "YOUR_FITBIT_CLIENT_SECRET" ||
        !FITBIT_CLIENT_ID?.trim() ||
        !FITBIT_CLIENT_SECRET?.trim()
      ) {
        return Promise.resolve({
          available: false,
          reason:
            "Fitbit credentials not configured. Please set FITBIT_CLIENT_ID and FITBIT_CLIENT_SECRET in app.json extra config.",
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
   * Start OAuth authentication flow
   */
  startAuth: async (selectedMetrics: string[]): Promise<void> => {
    try {
      // Validate redirect URI is not empty
      if (!REDIRECT_URI || REDIRECT_URI.trim() === "") {
        throw new Error(
          "Fitbit redirect URI is not configured. Please set REDIRECT_URI in fitbitService.ts"
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
      if (!FITBIT_CLIENT_ID || FITBIT_CLIENT_ID === "YOUR_FITBIT_CLIENT_ID") {
        throw new Error(
          "Fitbit Client ID is not configured. Please set FITBIT_CLIENT_ID in app.json extra config."
        );
      }

      // Get required scopes for selected metrics
      const scopes = getFitbitScopesForMetrics(selectedMetrics);

      // Add profile scope for user info
      if (!scopes.includes("profile")) {
        scopes.push("profile");
      }

      // Generate PKCE verifier + challenge (Fitbit requires 43-128 chars)
      const { verifier, challenge } = await createPkcePair();

      // Validate key and verifier before storing
      const storeKey = FITBIT_PKCE_VERIFIER_KEY;

      if (!storeKey || storeKey.trim().length === 0) {
        throw new Error("Invalid SecureStore key: key cannot be empty");
      }
      if (!verifier || verifier.trim().length === 0) {
        throw new Error("Invalid PKCE verifier: verifier cannot be empty");
      }

      // Ensure key only contains allowed characters (alphanumeric, underscore, hyphen, period)
      const keyPattern = /^[a-zA-Z0-9._-]+$/;
      if (!keyPattern.test(storeKey)) {
        throw new Error(
          `Invalid SecureStore key format: "${storeKey}" contains invalid characters`
        );
      }

      await setItemAsync(storeKey, verifier);

      // Build authorization URL with proper encoding
      const redirectUriEncoded = encodeURIComponent(REDIRECT_URI);
      const authUrl =
        `${FITBIT_AUTH_URL}?` +
        "response_type=code&" +
        `client_id=${encodeURIComponent(FITBIT_CLIENT_ID)}&` +
        `redirect_uri=${redirectUriEncoded}&` +
        `scope=${encodeURIComponent(scopes.join(" "))}&` +
        `code_challenge=${encodeURIComponent(challenge)}&` +
        "code_challenge_method=S256";

      // Use web callback URL for OAuth (registered with Fitbit)
      // The web page will redirect to deep link after extracting the code
      const result = await openAuthSessionAsync(authUrl, REDIRECT_URI);

      if (result.type === "success" && result.url) {
        await fitbitService.handleRedirect(result.url);
      } else {
        throw new Error("Authentication cancelled or failed");
      }
    } catch (error: unknown) {
      throw new Error(`Fitbit authentication failed: ${getErrorMessage(error)}`);
    }
  },

  /**
   * Handle OAuth redirect callback
   * Handles both web callback URL and deep link redirects
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
      const errorDescription =
        urlObj.searchParams.get("error_description") || "";

      if (error) {
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
            `Fitbit OAuth callback URL error: ${error}\n\n` +
              `The redirect URI being used is: ${REDIRECT_URI}\n\n` +
              "This error usually means the callback URL is not registered in Fitbit Developer Portal.\n\n" +
              "To fix this:\n" +
              "1. Log in to https://dev.fitbit.com/\n" +
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

        throw new Error(`Fitbit OAuth error: ${detailedError}`);
      }

      if (!code) {
        throw new Error("No authorization code received");
      }

      // Exchange code for tokens
      // Create base64 encoded credentials
      const credentials = `${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`;
      const base64Credentials = btoa(credentials);

      // Validate key before reading
      if (
        !FITBIT_PKCE_VERIFIER_KEY ||
        FITBIT_PKCE_VERIFIER_KEY.trim().length === 0
      ) {
        throw new Error("Invalid SecureStore key: key cannot be empty");
      }

      const verifier = await getItemAsync(FITBIT_PKCE_VERIFIER_KEY);
      if (!verifier) {
        throw new Error("Missing PKCE verifier. Please retry Fitbit sign-in.");
      }

      const tokenResponse = await fetch(FITBIT_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${base64Credentials}`,
        },
        body: new URLSearchParams({
          client_id: FITBIT_CLIENT_ID,
          code,
          redirect_uri: REDIRECT_URI, // Must match registered callback URL
          grant_type: "authorization_code",
          code_verifier: verifier,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        let errorData:
          | {
              errors?: Array<{ message?: string; errorType?: string }>;
            }
          | undefined;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // Not JSON, use as-is
        }

        const errorMsg =
          errorData?.errors?.[0]?.message ||
          errorText ||
          "Token exchange failed";
        const errorType = errorData?.errors?.[0]?.errorType || "";

        // Provide helpful guidance for redirect_uri_mismatch during token exchange
        if (
          errorMsg.includes("redirect_uri") ||
          errorType.includes("redirect_uri") ||
          errorText.includes("redirect_uri")
        ) {
          throw new Error(
            "Fitbit token exchange failed: redirect URI mismatch.\n\n" +
              `The redirect URI being used is: ${REDIRECT_URI}\n\n` +
              "To fix this:\n" +
              "1. Log in to https://dev.fitbit.com/\n" +
              "2. Go to your application settings\n" +
              `3. Find the "Callback URL" or "Redirect URI" field\n` +
              `4. Make sure it exactly matches: ${REDIRECT_URI}\n` +
              "5. Check for trailing slashes, http vs https, or typos\n" +
              "6. Save the changes and try again\n\n" +
              `Current redirect URI: ${REDIRECT_URI}\n` +
              `Error details: ${errorMsg}`
          );
        }

        throw new Error(`Fitbit token exchange failed: ${errorMsg}`);
      }

      const tokenData = await tokenResponse.json();

      // Validate key before deleting
      if (
        FITBIT_PKCE_VERIFIER_KEY &&
        FITBIT_PKCE_VERIFIER_KEY.trim().length > 0
      ) {
        await deleteItemAsync(FITBIT_PKCE_VERIFIER_KEY);
      }

      // Get user profile to get user ID
      const profileResponse = await fetch(
        `${FITBIT_API_BASE}/user/-/profile.json`,
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        }
      );

      if (!profileResponse.ok) {
        throw new Error("Failed to fetch user profile");
      }

      const profileData = await profileResponse.json();
      const userId = profileData.user?.encodedId || "-";

      // Store tokens securely
      const tokens: FitbitTokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
        userId,
        scope: tokenData.scope || "",
      };

      await setItemAsync(
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

      // Save Fitbit user ID to Firestore for webhook matching
      if (userId && userId !== "-") {
        try {
          const { auth } = await import("../firebase");
          const { db } = await import("../firebase");
          const { doc, updateDoc } = await import("firebase/firestore");
          const currentUser = auth.currentUser;
          if (currentUser) {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, {
              fitbitUserId: userId,
            });
          }
        } catch (_error) {
          // Silently handle Firestore update error - not critical for OAuth flow
        }
      }
    } catch (error: unknown) {
      throw new Error(
        `Failed to complete Fitbit authentication: ${getErrorMessage(error)}`
      );
    }
  },

  /**
   * Refresh access token if needed
   */
  refreshTokenIfNeeded: async (): Promise<void> => {
    const tokensJson = await getItemAsync(HEALTH_STORAGE_KEYS.FITBIT_TOKENS);

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
      expiresAt: Date.now() + refreshData.expires_in * 1000,
    };

    await setItemAsync(
      HEALTH_STORAGE_KEYS.FITBIT_TOKENS,
      JSON.stringify(updatedTokens)
    );
  },

  /**
   * Get access token (with automatic refresh)
   */
  getAccessToken: async (): Promise<string> => {
    await fitbitService.refreshTokenIfNeeded();

    const tokensJson = await getItemAsync(HEALTH_STORAGE_KEYS.FITBIT_TOKENS);

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
          if (!(metric?.fitbit?.available && metric.fitbit.endpoint)) {
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
              return null;
            }

            const data = await response.json();
            return { metricKey, metric, data, dateStr };
          } catch (_error) {
            return null;
          }
        });

        const metricResults = await Promise.all(metricPromises);

        // Process results and convert to normalized format
        for (const result of metricResults) {
          if (!result) continue;

          const { metricKey, metric, data, dateStr: resultDateStr } = result;
          const samples = fitbitService.parseFitbitData(
            metricKey,
            data,
            resultDateStr
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
    } catch (error: unknown) {
      throw new Error(`Failed to fetch Fitbit metrics: ${getErrorMessage(error)}`);
    }
  },

  /**
   * Parse Fitbit API response into normalized samples
   */
  parseFitbitData: (
    metricKey: string,
    data: unknown,
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
      const payload = data as FitbitApiResponse;
      switch (metricKey) {
        case "heart_rate": {
          // Fitbit heart rate endpoint returns intraday data
          const dataset =
            payload["activities-heart"]?.[0]?.value?.restingHeartRate;
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
          const rhr = payload["activities-heart"]?.[0]?.value?.restingHeartRate;
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
          const steps = payload["activities-steps"]?.[0]?.value;
          if (steps !== undefined) {
            samples.push({
              value: Number.parseInt(steps, 10),
              unit: "count",
              startDate: `${dateStr}T00:00:00Z`,
              endDate: `${dateStr}T23:59:59Z`,
              source: "Fitbit",
            });
          }
          break;
        }

        case "active_energy": {
          const calories = payload["activities-calories"]?.[0]?.value;
          if (calories !== undefined) {
            samples.push({
              value: Number.parseInt(calories, 10),
              unit: "kcal",
              startDate: `${dateStr}T00:00:00Z`,
              endDate: `${dateStr}T23:59:59Z`,
              source: "Fitbit",
            });
          }
          break;
        }

        case "distance_walking_running": {
          const distance = payload["activities-distance"]?.[0]?.value;
          if (distance !== undefined) {
            // Convert from km to meters, then to km (Fitbit returns km as string)
            const km = Number.parseFloat(distance);
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
          const floors = payload["activities-floors"]?.[0]?.value;
          if (floors !== undefined) {
            samples.push({
              value: Number.parseInt(floors, 10),
              unit: "count",
              startDate: `${dateStr}T00:00:00Z`,
              endDate: `${dateStr}T23:59:59Z`,
              source: "Fitbit",
            });
          }
          break;
        }

        case "blood_oxygen": {
          const spo2 = payload.value;
          if (spo2 !== undefined && Array.isArray(spo2)) {
            for (const entry of spo2) {
              if (entry.value !== undefined) {
                samples.push({
                  value: entry.value,
                  unit: "%",
                  startDate: entry.dateTime || `${dateStr}T00:00:00Z`,
                  source: "Fitbit",
                });
              }
            }
          }
          break;
        }

        case "body_temperature": {
          const temp = payload.value;
          if (temp !== undefined && Array.isArray(temp)) {
            for (const entry of temp) {
              if (entry.value !== undefined) {
                samples.push({
                  value: entry.value,
                  unit: "°C",
                  startDate: entry.dateTime || `${dateStr}T00:00:00Z`,
                  source: "Fitbit",
                });
              }
            }
          }
          break;
        }

        case "weight": {
          const weight = payload.weight;
          if (weight !== undefined && Array.isArray(weight)) {
            for (const entry of weight) {
              if (entry.weight !== undefined) {
                samples.push({
                  value: entry.weight,
                  unit: "kg",
                  startDate: entry.date || `${dateStr}T00:00:00Z`,
                  source: "Fitbit",
                });
              }
            }
          }
          break;
        }

        case "body_fat_percentage": {
          const fat = payload.fat;
          if (fat !== undefined && Array.isArray(fat)) {
            for (const entry of fat) {
              if (entry.fat !== undefined) {
                samples.push({
                  value: entry.fat,
                  unit: "%",
                  startDate: entry.date || `${dateStr}T00:00:00Z`,
                  source: "Fitbit",
                });
              }
            }
          }
          break;
        }

        case "sleep_analysis": {
          const sleep = payload.sleep;
          if (sleep !== undefined && Array.isArray(sleep)) {
            for (const entry of sleep) {
              if (entry.duration !== undefined) {
                samples.push({
                  value: entry.duration / 60_000, // Convert ms to minutes
                  unit: "min",
                  startDate: entry.startTime || `${dateStr}T00:00:00Z`,
                  endDate: entry.endTime,
                  source: "Fitbit",
                });
              }
            }
          }
          break;
        }

        case "water_intake": {
          const water = payload.summary?.water;
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
          // Unknown metric key - skip
          break;
      }
    } catch (_error) {
      // Silently handle parsing error
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
        const tokensJson = await getItemAsync(HEALTH_STORAGE_KEYS.FITBIT_TOKENS);
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
      } catch (_error) {
        // Ignore revocation errors
      }

      // Remove tokens
      await deleteItemAsync(HEALTH_STORAGE_KEYS.FITBIT_TOKENS);
    } catch (error: unknown) {
      throw error;
    }
  },
};
