/**
 * Fitbit Service
 * OAuth 2.0 integration with Fitbit API for health data
 */

import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
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
// Redirect URI must match what's configured in Fitbit app settings
// Format: maak://fitbit-callback (using app scheme)
const REDIRECT_URI = Linking.createURL("fitbit-callback");
const FITBIT_PKCE_VERIFIER_KEY = "health_fitbit_pkce_verifier";

const base64UrlEncode = (bytes: Uint8Array): string => {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
};

const sha256 = (input: string): Uint8Array => {
  const utf8 = new TextEncoder().encode(input);
  const words: number[] = [];
  for (let i = 0; i < utf8.length; i += 1) {
    words[i >> 2] |= utf8[i] << (24 - (i % 4) * 8);
  }
  words[utf8.length >> 2] |= 0x80 << (24 - (utf8.length % 4) * 8);
  words[(((utf8.length + 8) >> 6) << 4) + 15] = utf8.length * 8;

  const K = [
    0x42_8a_2f_98, 0x71_37_44_91, 0xb5_c0_fb_cf, 0xe9_b5_db_a5, 0x39_56_c2_5b,
    0x59_f1_11_f1, 0x92_3f_82_a4, 0xab_1c_5e_d5, 0xd8_07_aa_98, 0x12_83_5b_01,
    0x24_31_85_be, 0x55_0c_7d_c3, 0x72_be_5d_74, 0x80_de_b1_fe, 0x9b_dc_06_a7,
    0xc1_9b_f1_74, 0xe4_9b_69_c1, 0xef_be_47_86, 0x0f_c1_9d_c6, 0x24_0c_a1_cc,
    0x2d_e9_2c_6f, 0x4a_74_84_aa, 0x5c_b0_a9_dc, 0x76_f9_88_da, 0x98_3e_51_52,
    0xa8_31_c6_6d, 0xb0_03_27_c8, 0xbf_59_7f_c7, 0xc6_e0_0b_f3, 0xd5_a7_91_47,
    0x06_ca_63_51, 0x14_29_29_67, 0x27_b7_0a_85, 0x2e_1b_21_38, 0x4d_2c_6d_fc,
    0x53_38_0d_13, 0x65_0a_73_54, 0x76_6a_0a_bb, 0x81_c2_c9_2e, 0x92_72_2c_85,
    0xa2_bf_e8_a1, 0xa8_1a_66_4b, 0xc2_4b_8b_70, 0xc7_6c_51_a3, 0xd1_92_e8_19,
    0xd6_99_06_24, 0xf4_0e_35_85, 0x10_6a_a0_70, 0x19_a4_c1_16, 0x1e_37_6c_08,
    0x27_48_77_4c, 0x34_b0_bc_b5, 0x39_1c_0c_b3, 0x4e_d8_aa_4a, 0x5b_9c_ca_4f,
    0x68_2e_6f_f3, 0x74_8f_82_ee, 0x78_a5_63_6f, 0x84_c8_78_14, 0x8c_c7_02_08,
    0x90_be_ff_fa, 0xa4_50_6c_eb, 0xbe_f9_a3_f7, 0xc6_71_78_f2,
  ];

  let h0 = 0x6a_09_e6_67;
  let h1 = 0xbb_67_ae_85;
  let h2 = 0x3c_6e_f3_72;
  let h3 = 0xa5_4f_f5_3a;
  let h4 = 0x51_0e_52_7f;
  let h5 = 0x9b_05_68_8c;
  let h6 = 0x1f_83_d9_ab;
  let h7 = 0x5b_e0_cd_19;

  const w = new Array<number>(64);
  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 16; t += 1) {
      w[t] = words[i + t] || 0;
    }
    for (let t = 16; t < 64; t += 1) {
      const s0 =
        ((w[t - 15] >>> 7) | (w[t - 15] << 25)) ^
        ((w[t - 15] >>> 18) | (w[t - 15] << 14)) ^
        (w[t - 15] >>> 3);
      const s1 =
        ((w[t - 2] >>> 17) | (w[t - 2] << 15)) ^
        ((w[t - 2] >>> 19) | (w[t - 2] << 13)) ^
        (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t += 1) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const hash = new Uint8Array(32);
  const hashWords = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (let i = 0; i < hashWords.length; i += 1) {
    hash[i * 4] = (hashWords[i] >>> 24) & 0xff;
    hash[i * 4 + 1] = (hashWords[i] >>> 16) & 0xff;
    hash[i * 4 + 2] = (hashWords[i] >>> 8) & 0xff;
    hash[i * 4 + 3] = hashWords[i] & 0xff;
  }
  return hash;
};

const createPkcePair = (): { verifier: string; challenge: string } => {
  const verifier = base64UrlEncode(randomBytes(32));
  const challenge = base64UrlEncode(sha256(verifier));
  return { verifier, challenge };
};

// Complete OAuth flow
WebBrowser.maybeCompleteAuthSession();

/**
 * Check if Fitbit integration is available
 */
export const fitbitService = {
  isAvailable: async (): Promise<ProviderAvailability> => {
    try {
      // Debug: Log the actual values being checked
      console.log("[Fitbit] Checking availability:");
      console.log(
        "[Fitbit] CLIENT_ID:",
        FITBIT_CLIENT_ID
          ? `${FITBIT_CLIENT_ID.substring(0, 4)}...`
          : "undefined"
      );
      console.log(
        "[Fitbit] CLIENT_SECRET:",
        FITBIT_CLIENT_SECRET ? "***" : "undefined"
      );
      console.log(
        "[Fitbit] From Constants:",
        Constants.expoConfig?.extra?.fitbitClientId ? "present" : "missing"
      );

      // Check if credentials are configured
      if (
        FITBIT_CLIENT_ID === "YOUR_FITBIT_CLIENT_ID" ||
        FITBIT_CLIENT_SECRET === "YOUR_FITBIT_CLIENT_SECRET" ||
        !FITBIT_CLIENT_ID?.trim() ||
        !FITBIT_CLIENT_SECRET?.trim()
      ) {
        console.log("[Fitbit] Not available - credentials missing or empty");
        return {
          available: false,
          reason:
            "Fitbit credentials not configured. Please set FITBIT_CLIENT_ID and FITBIT_CLIENT_SECRET in app.json extra config.",
        };
      }

      console.log("[Fitbit] Available!");
      return {
        available: true,
      };
    } catch (error: any) {
      console.error("[Fitbit] Error checking availability:", error);
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

      // Generate PKCE verifier + challenge (Fitbit requires 43-128 chars)
      const { verifier, challenge } = createPkcePair();

      // Validate key and verifier before storing
      const storeKey = FITBIT_PKCE_VERIFIER_KEY;
      console.log(
        "[Fitbit] SecureStore key:",
        storeKey,
        "length:",
        storeKey?.length
      );

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

      await SecureStore.setItemAsync(storeKey, verifier);

      // Build authorization URL
      const authUrl =
        `${FITBIT_AUTH_URL}?` +
        "response_type=code&" +
        `client_id=${encodeURIComponent(FITBIT_CLIENT_ID)}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(scopes.join(" "))}&` +
        `code_challenge=${encodeURIComponent(challenge)}&` +
        "code_challenge_method=S256";

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

      // Validate key before reading
      if (
        !FITBIT_PKCE_VERIFIER_KEY ||
        FITBIT_PKCE_VERIFIER_KEY.trim().length === 0
      ) {
        throw new Error("Invalid SecureStore key: key cannot be empty");
      }

      const verifier = await SecureStore.getItemAsync(FITBIT_PKCE_VERIFIER_KEY);
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
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
          code_verifier: verifier,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();

      // Validate key before deleting
      if (
        FITBIT_PKCE_VERIFIER_KEY &&
        FITBIT_PKCE_VERIFIER_KEY.trim().length > 0
      ) {
        await SecureStore.deleteItemAsync(FITBIT_PKCE_VERIFIER_KEY);
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
      throw new Error(
        `Failed to complete Fitbit authentication: ${error.message}`
      );
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
        expiresAt: Date.now() + refreshData.expires_in * 1000,
      };

      await SecureStore.setItemAsync(
        HEALTH_STORAGE_KEYS.FITBIT_TOKENS,
        JSON.stringify(updatedTokens)
      );
    } catch (error: any) {
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
          } catch (error) {
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
          const dataset =
            data?.["activities-heart"]?.[0]?.value?.restingHeartRate;
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
          const rhr = data?.["activities-heart"]?.[0]?.value?.restingHeartRate;
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
          const calories = data?.["activities-calories"]?.[0]?.value;
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
          const distance = data?.["activities-distance"]?.[0]?.value;
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
          const floors = data?.["activities-floors"]?.[0]?.value;
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
                  value: entry.duration / 60_000, // Convert ms to minutes
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
          // Unknown metric key - skip
          break;
      }
    } catch (error) {
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
      }

      // Remove tokens
      await SecureStore.deleteItemAsync(HEALTH_STORAGE_KEYS.FITBIT_TOKENS);
    } catch (error) {
      throw error;
    }
  },
};
