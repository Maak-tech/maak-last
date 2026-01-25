# Integration Availability Fix

## Issue
Fitbit and Withings integrations show as "unavailable" even though credentials are set in `.env` file.

## Root Cause
The credentials are read from `app.config.js` at build/config time, not at runtime. The app needs to be restarted or rebuilt for the credentials to be available.

## Solution

### For Development (Expo Go / Dev Client)

1. **Restart the development server:**
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart:
   npm run dev
   # or
   expo start --dev-client
   ```

2. **Clear cache and restart:**
   ```bash
   npm run dev:clear
   # or
   expo start --dev-client --clear
   ```

3. **Reload the app** on your device/emulator (shake device → Reload)

### For Production Builds

1. **Rebuild the app** after adding credentials:
   ```bash
   # For development build
   eas build --profile development --platform all
   
   # For production build
   eas build --profile production --platform all
   ```

## How It Works

1. `.env` file contains credentials:
   ```
   FITBIT_CLIENT_ID=23TRCB
   FITBIT_CLIENT_SECRET=...
   WITHINGS_CLIENT_ID=...
   WITHINGS_CLIENT_SECRET=...
   ```

2. `app.config.js` reads from `process.env`:
   ```javascript
   fitbitClientId: process.env.FITBIT_CLIENT_ID || "",
   withingsClientId: process.env.WITHINGS_CLIENT_ID || "",
   ```

3. Services check availability at runtime:
   ```javascript
   const FITBIT_CLIENT_ID = Constants.expoConfig?.extra?.fitbitClientId || "YOUR_FITBIT_CLIENT_ID";
   
   isAvailable: async () => {
     if (!FITBIT_CLIENT_ID?.trim() || !FITBIT_CLIENT_SECRET?.trim()) {
       return { available: false };
     }
     return { available: true };
   }
   ```

## Verification

After restarting, the integrations should:
- ✅ Show as available (not "Coming Soon")
- ✅ Be clickable in the Health Integrations screen
- ✅ Allow OAuth flow to proceed

## Troubleshooting

If integrations are still unavailable after restarting:

1. **Check `.env` file** - Ensure credentials are set correctly
2. **Check `app.config.js`** - Verify `process.env` variables are being read
3. **Check runtime values** - Add temporary console.log to see actual values:
   ```javascript
   console.log('Fitbit ID:', Constants.expoConfig?.extra?.fitbitClientId);
   console.log('Withings ID:', Constants.expoConfig?.extra?.withingsClientId);
   ```
4. **Verify dotenv loading** - Ensure `require("dotenv").config()` is at the top of `app.config.js`

## Notes

- Environment variables are loaded at config time, not runtime
- Changes to `.env` require app restart/rebuild
- For EAS builds, use `eas secret:create` instead of `.env` file
- Development builds can use `.env` file with `dotenv` package
