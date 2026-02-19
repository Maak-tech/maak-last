/**
 * Centralized secrets management for Firebase Functions
 *
 * All secrets are defined here and can be imported by other modules.
 * Secrets are loaded from Firebase Functions Secrets Manager.
 *
 * To use a secret in a function, add it to the function's secrets array:
 *
 * export const myFunction = onCall(
 *   { secrets: [OPENAI_API_KEY, TWILIO_ACCOUNT_SID] },
 *   async (request) => {
 *     const apiKey = OPENAI_API_KEY.value();
 *     // Use the secret...
 *   }
 * );
 */

import { defineSecret } from "firebase-functions/params";

// OpenAI & AI Services
export const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
export const ZEINA_API_KEY = defineSecret("ZEINA_API_KEY");

// Twilio (SMS notifications)
export const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
export const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
export const TWILIO_FROM_NUMBER = defineSecret("TWILIO_FROM_NUMBER");

// PPG ML Service
export const PPG_ML_SERVICE_API_KEY = defineSecret("PPG_ML_SERVICE_API_KEY");

// Health Integration API Keys
export const FITBIT_CLIENT_ID = defineSecret("FITBIT_CLIENT_ID");
export const FITBIT_CLIENT_SECRET = defineSecret("FITBIT_CLIENT_SECRET");
export const WITHINGS_CLIENT_ID = defineSecret("WITHINGS_CLIENT_ID");
export const WITHINGS_CLIENT_SECRET = defineSecret("WITHINGS_CLIENT_SECRET");
export const DEXCOM_REDIRECT_URI = defineSecret("DEXCOM_REDIRECT_URI");
export const GARMIN_CLIENT_ID = defineSecret("GARMIN_CLIENT_ID");
export const GARMIN_CLIENT_SECRET = defineSecret("GARMIN_CLIENT_SECRET");
export const GARMIN_OAUTH_AUTH_URL = defineSecret("GARMIN_OAUTH_AUTH_URL");
export const GARMIN_OAUTH_TOKEN_URL = defineSecret("GARMIN_OAUTH_TOKEN_URL");
export const GARMIN_OAUTH_SCOPE = defineSecret("GARMIN_OAUTH_SCOPE");
export const GARMIN_REDIRECT_URI = defineSecret("GARMIN_REDIRECT_URI");

// RevenueCat
export const REVENUECAT_PROJECT_ID = defineSecret("REVENUECAT_PROJECT_ID");
// RevenueCat Secret API key (REST API) - server-only
export const REVENUECAT_SECRET_API_KEY = defineSecret(
  "REVENUECAT_SECRET_API_KEY"
);

/**
 * Helper function to get a secret value safely
 * Falls back to process.env if secret is not available
 */
export function getSecretValue(
  secret: ReturnType<typeof defineSecret>,
  envFallback?: string
): string | undefined {
  try {
    return secret.value();
  } catch (_error) {
    // If secret is not available (e.g., in local development), fall back to env
    return envFallback || process.env[secret.name] || undefined;
  }
}
