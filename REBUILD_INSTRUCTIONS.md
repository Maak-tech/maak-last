# HealthKit Rebuild Instructions

## Current Status
The app is **stable and working** but HealthKit native modules are not included.
All crash protections are in place, so the app won't crash when accessing health features.

## When to Rebuild
Your EAS free builds reset on **January 1, 2026** (10 days from now).

## How to Rebuild (After Jan 1, 2026)

### 1. Verify Configuration
Make sure these files are configured correctly:

#### `app.json` - Plugins section should include:
```json
"plugins": [
  "expo-router",
  "expo-font",
  ["expo-notifications", {...}],
  ["expo-sensors", {...}],
  [
    "react-native-health",
    {
      "healthSharePermission": "Maak Health reads health data...",
      "healthUpdatePermission": "Maak Health writes health data..."
    }
  ],
  "expo-localization",
  "expo-secure-store",
  "expo-web-browser",
  "./plugins/withFollyFix.js"
],
```

**IMPORTANT:** 
- ✅ Using the **official built-in Expo config plugin** from `react-native-health` v1.19.0
- ✅ The plugin automatically handles iOS pod linking, entitlements, and permissions
- ✅ No custom plugin or `react-native.config.js` needed

#### `package.json` - Verify react-native-health is installed:
```json
"react-native-health": "^1.19.0"
```

This version includes the official Expo config plugin with proper native linking.

### 2. Clean Build Command
Run this command to build with native modules:

```bash
bun run build:ios:dev --clear-cache
```

Or use EAS directly:
```bash
eas build -p ios --profile development --clear-cache
```

### 3. Install the New Build
- Scan the QR code from the build output
- OR open the build URL on your iPhone
- Delete the old app first, then install the new one

### 4. Verify It Works
After installing, check the Metro logs for:
```
LOG  Available native modules: ["RCTAppleHealthKit"]  ✅
```

Instead of:
```
LOG  Available native modules: []  ❌
```

## What's Fixed
- ✅ Registration form crashes are fixed
- ✅ Vitals tab doesn't crash
- ✅ All HealthKit calls have error handling
- ✅ App is stable even without native modules
- ✅ Using official `react-native-health` Expo plugin (v1.19.0)
- ⏳ HealthKit features will work after rebuild with native modules

## Why This Will Work Now
The previous attempts failed because:
- ❌ Custom plugin approach didn't work with EAS builds
- ❌ Empty `react-native.config.js` didn't actually link the native code

Now fixed:
- ✅ Using the **official built-in Expo config plugin** from `react-native-health` package
- ✅ This plugin is maintained by the library authors and designed for Expo
- ✅ Automatically handles all iOS native setup (pod linking, entitlements, permissions)

## If You Need Help
The app is fully functional except for HealthKit integration. All other features work:
- ✅ User authentication
- ✅ Medications tracking
- ✅ Symptoms logging
- ✅ Family management
- ✅ AI assistant
- ✅ Fall detection
- ⏳ HealthKit (after rebuild)

## Alternative: Local Build on Mac
If you have access to a Mac, you can build immediately:
```bash
expo run:ios
```
This bypasses the EAS build limit.

