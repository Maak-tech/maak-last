# Manual EAS Secrets Setup Guide

Since EAS CLI requires interactive input, you'll need to set these secrets manually or run the script in an interactive terminal.

## Quick Setup (Run in PowerShell Terminal)

Open PowerShell in your project directory and run:

```powershell
# Make sure you're logged in
eas login

# Set each secret (replace YOUR_VALUE with actual values from .env)
eas secret:create --scope project --name OPENAI_API_KEY --value "YOUR_VALUE" --type string --visibility secret --environment all

eas secret:create --scope project --name ZEINA_API_KEY --value "YOUR_VALUE" --type string --visibility secret --environment all

eas secret:create --scope project --name FITBIT_CLIENT_ID --value "YOUR_VALUE" --type string --visibility secret --environment all

eas secret:create --scope project --name FITBIT_CLIENT_SECRET --value "YOUR_VALUE" --type string --visibility secret --environment all

eas secret:create --scope project --name WITHINGS_CLIENT_ID --value "YOUR_VALUE" --type string --visibility secret --environment all

eas secret:create --scope project --name WITHINGS_CLIENT_SECRET --value "YOUR_VALUE" --type string --visibility secret --environment all

eas secret:create --scope project --name DEXCOM_REDIRECT_URI --value "YOUR_VALUE" --type string --visibility secret --environment all

eas secret:create --scope project --name REVENUECAT_PROJECT_ID --value "YOUR_VALUE" --type string --visibility secret --environment all

eas secret:create --scope project --name REVENUECAT_API_KEY --value "YOUR_PRODUCTION_API_KEY" --type string --visibility secret --environment production

# Firebase public config (these are public, but still need to be in EAS)
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "YOUR_VALUE" --type string --visibility secret --environment all

eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "YOUR_VALUE" --type string --visibility secret --environment all

eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "YOUR_VALUE" --type string --visibility secret --environment all

eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value "YOUR_VALUE" --type string --visibility secret --environment all

eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value "YOUR_VALUE" --type string --visibility secret --environment all

eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_APP_ID --value "YOUR_VALUE" --type string --visibility secret --environment all

eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID --value "YOUR_VALUE" --type string --visibility secret --environment all
```

## Automated Script (Interactive Terminal Only)

The `setup-all-secrets.ps1` script will work if you run it in an **interactive PowerShell terminal** (not through automated tools):

1. Open PowerShell
2. Navigate to your project: `cd C:\Users\nours\Documents\GitHub\maak-last`
3. Run: `powershell -ExecutionPolicy Bypass -File scripts\setup-all-secrets.ps1`

## Verify Secrets

After setting secrets, verify they're configured:

```bash
eas env:list
```

## What Needs to be in EAS vs Firebase Functions

### EAS Secrets (Mobile App - Client Side)
- ✅ `OPENAI_API_KEY` - For AI features in the app
- ✅ `ZEINA_API_KEY` - For Zeina voice assistant
- ✅ `FITBIT_CLIENT_ID` & `FITBIT_CLIENT_SECRET` - OAuth for Fitbit integration
- ✅ `WITHINGS_CLIENT_ID` & `WITHINGS_CLIENT_SECRET` - OAuth for Withings integration
- ✅ `DEXCOM_REDIRECT_URI` - Dexcom OAuth redirect
- ✅ `REVENUECAT_PROJECT_ID` - RevenueCat project ID (proj76462039)
- ✅ `REVENUECAT_API_KEY` - RevenueCat production API key (REQUIRED for production builds)
  - **App ID**: `app7fb7d2f755`
  - **How to get**: Go to [RevenueCat Dashboard](https://app.revenuecat.com/) → Select your app → Project Settings → API Keys → Copy Public API Key
  - **Important**: Use production API key (starts with `appl_` for iOS or `goog_` for Android)
- ✅ `EXPO_PUBLIC_FIREBASE_*` - Firebase public config (needed for app initialization)

### Firebase Functions Secrets (Server Side Only)
- ✅ `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` - SMS notifications
- ✅ `PPG_ML_SERVICE_API_KEY` - ML service API key
- ✅ All the above (if used server-side)

## Note

Some secrets are used in BOTH places:
- `OPENAI_API_KEY` - Used in both mobile app (for client-side AI) and Firebase Functions (for server-side analysis)
- Health integration keys - Used in mobile app for OAuth, may be used server-side for webhooks
