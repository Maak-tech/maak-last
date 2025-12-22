# HealthKit Not Available - Rebuild Required

## The Problem

You built the iOS development app **BEFORE** we added the HealthKit entitlements to `app.json`. The build doesn't include HealthKit capability, so it's not available.

## Solution: Rebuild the App

You **MUST rebuild** the iOS development app for HealthKit to work:

```bash
bun run build:ios:dev
```

## Why This Happened

1. ✅ You built the app with EAS Build
2. ✅ We added HealthKit entitlements to `app.json` AFTER your build
3. ❌ Your current build doesn't have HealthKit capability
4. ✅ Code is now fixed to properly detect HealthKit

## What Changed

1. **Added HealthKit entitlements** to `app.json`:
   ```json
   "entitlements": {
     "com.apple.developer.healthkit": true,
     "com.apple.developer.healthkit.access": []
   }
   ```

2. **Fixed HealthKit detection code** in `healthDataService.ts`:
   - Now properly imports `react-native-health`
   - Better error messages
   - Properly checks if module is available

## Steps to Fix

1. **Rebuild the iOS app:**
   ```bash
   bun run build:ios:dev
   ```
   (This will take 8-15 minutes)

2. **After build completes:**
   - Download the new `.ipa` file
   - Install it on your iPhone (replace the old one)
   - Delete the old app first if needed

3. **Start dev server:**
   ```bash
   bun run dev:tunnel
   ```

4. **Connect iPhone:**
   - Open the NEW development app
   - Connect to dev server
   - HealthKit should now be available! ✅

## Verify HealthKit is Working

After rebuilding and installing:

1. Open the app on your iPhone
2. Go to Health/Apple Health integration screen
3. You should see HealthKit available (not the error message)
4. You can request permissions and access health data

## Important Notes

- ⚠️ **You MUST rebuild** - The current build doesn't have HealthKit
- ⚠️ **Install the NEW build** - Replace the old app on your iPhone
- ✅ **Code is fixed** - Once rebuilt, HealthKit will work properly

## Troubleshooting

**If HealthKit still not available after rebuild:**

1. **Check Apple Developer Portal:**
   - Go to https://developer.apple.com/account
   - Certificates, Identifiers & Profiles
   - App IDs → Find `com.maak.health`
   - Ensure HealthKit capability is enabled

2. **Verify entitlements in build:**
   ```bash
   # Check build logs
   eas build:logs [BUILD_ID]
   ```
   Look for HealthKit entitlement in logs

3. **Clear and rebuild:**
   ```bash
   bun run build:ios:dev -- --clear-cache
   ```

4. **Check device:**
   - HealthKit requires iOS 8.0+
   - Must be physical device (not simulator for full functionality)

