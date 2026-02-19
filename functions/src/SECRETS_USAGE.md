# Secrets Usage Guide

All secrets from your `.env` file are now available in Firebase Functions through the centralized secrets module.

## Available Secrets

All secrets are defined in `functions/src/secrets.ts` and can be imported where needed:

- **OpenAI & AI**: `OPENAI_API_KEY`, `ZEINA_API_KEY`
- **Twilio**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- **PPG ML Service**: `PPG_ML_SERVICE_API_KEY`
- **Health Integrations**: 
  - `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET`
  - `GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET`, `GARMIN_OAUTH_AUTH_URL`, `GARMIN_OAUTH_TOKEN_URL`, `GARMIN_OAUTH_SCOPE`, `GARMIN_REDIRECT_URI`
  - `WITHINGS_CLIENT_ID`, `WITHINGS_CLIENT_SECRET`
  - `DEXCOM_REDIRECT_URI`
- **RevenueCat**: `REVENUECAT_PROJECT_ID`, `REVENUECAT_SECRET_API_KEY`

## How to Use Secrets in Functions

### 1. Import the secret(s) you need

```typescript
import { OPENAI_API_KEY, FITBIT_CLIENT_ID } from "./secrets";
```

### 2. Add secrets to your function's configuration

For v2 functions (onCall, onRequest, etc.):

```typescript
import { onCall } from "firebase-functions/v2/https";
import { OPENAI_API_KEY } from "./secrets";

export const myFunction = onCall(
  {
    secrets: [OPENAI_API_KEY], // Add all secrets your function needs
  },
  async (request) => {
    // Access the secret value
    const apiKey = OPENAI_API_KEY.value();
    
    // Use the secret...
  }
);
```

For Firestore triggers:

```typescript
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { OPENAI_API_KEY } from "./secrets";

export const myTrigger = onDocumentCreated(
  {
    document: "collection/{docId}",
    secrets: [OPENAI_API_KEY],
  },
  async (event) => {
    const apiKey = OPENAI_API_KEY.value();
    // Use the secret...
  }
);
```

### 3. Access the secret value

Use `.value()` to get the secret value:

```typescript
const apiKey = OPENAI_API_KEY.value();
const clientId = FITBIT_CLIENT_ID.value();
```

## Example: Using Secrets in a New Function

```typescript
import { onCall } from "firebase-functions/v2/https";
import { FITBIT_CLIENT_ID, FITBIT_CLIENT_SECRET } from "./secrets";

export const syncFitbitData = onCall(
  {
    secrets: [FITBIT_CLIENT_ID, FITBIT_CLIENT_SECRET],
  },
  async (request) => {
    const clientId = FITBIT_CLIENT_ID.value();
    const clientSecret = FITBIT_CLIENT_SECRET.value();
    
    // Use Fitbit API with these credentials...
    return { success: true };
  }
);
```

## Helper Function

The `secrets.ts` module also exports a `getSecretValue()` helper that falls back to `process.env` if the secret is not available (useful for local development):

```typescript
import { getSecretValue, OPENAI_API_KEY } from "./secrets";

// Will try secret first, then fall back to process.env.OPENAI_API_KEY
const apiKey = getSecretValue(OPENAI_API_KEY, process.env.OPENAI_API_KEY);
```

## Important Notes

1. **Always add secrets to the function's `secrets` array** - Functions won't have access to secrets unless they're explicitly declared.

2. **Secrets are only available at runtime** - You cannot access secret values at module load time. Always call `.value()` inside your function handler.

3. **Local development** - When running Firebase emulators locally, secrets may not be available. Use `getSecretValue()` helper or fall back to `process.env`.

4. **Deployment** - After adding secrets to your code, deploy your functions:
   ```bash
   firebase deploy --only functions
   ```

## Current Usage

- `OPENAI_API_KEY` - Used in `triggers/vitals.ts` for vital benchmark checking
- `TWILIO_*` - Used in `sendEmergencySms` function for SMS notifications
- `PPG_ML_SERVICE_API_KEY` - Used in `analyzePPGWithML` function

All other secrets are available but not yet used in functions. Add them to functions as needed!
