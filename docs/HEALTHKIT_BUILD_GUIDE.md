# HealthKit Development Build Guide

## ⚠️ Important: HealthKit Requires EAS Build

**HealthKit does NOT work with:**
- ❌ Expo Go app
- ❌ `expo run:ios` (local builds)
- ❌ Standard Expo development builds without native modules

**HealthKit ONLY works with:**
- ✅ EAS Build development builds (with `expo-dev-client`)
- ✅ Standalone/production builds

## Why This Happens

HealthKit is a native iOS framework that requires:
1. Native module compilation (`react-native-health`)
2. HealthKit capability enabled in Xcode
3. Proper provisioning profiles with HealthKit entitlement
4. Physical device (not simulator for full functionality)

`expo run:ios` doesn't properly configure these native modules, which is why you see the error.

## Solution: Build with EAS Build

### Step 1: Verify Configuration

Your `app.json` is already configured correctly:
- ✅ `react-native-health` plugin with `enableHealthKit: true`
- ✅ HealthKit permissions in `infoPlist`
- ✅ HealthKit entitlements configured
- ✅ `expo-dev-client` installed

### Step 2: Build Development iOS App

**This is the ONLY way to get HealthKit working:**

```bash
bun run build:ios:dev
```

Or directly:
```bash
eas build -p ios --profile development
```

**What happens:**
- EAS Build compiles native modules including `react-native-health`
- HealthKit capability is automatically enabled
- Build includes `expo-dev-client` for development mode
- Build is configured for physical device

**Build time:** 8-15 minutes

### Step 3: Install Build on iPhone

After build completes:

1. **Download the build:**
   ```bash
   bun run build:list
   ```
   - Click the download link
   - Or download from: https://expo.dev/accounts/nour_maak/projects/maak-health/builds

2. **Install on iPhone:**
   - **Option A:** Upload to TestFlight (recommended)
     ```bash
     eas submit -p ios --profile development
     ```
     Then install TestFlight app and install from there.
   
   - **Option B:** Direct install via Apple Configurator 2 or 3uTools

### Step 4: Start Dev Server

```bash
bun run dev
```

### Step 5: Connect iPhone to Dev Server

1. Open the development app on your iPhone
2. Enter connection URL: `exp://192.168.1.5:8081`
3. HealthKit will now be available! ✅

## Troubleshooting

### "HealthKit not available" Error

**Cause:** Using wrong build method

**Solution:**
- ❌ Don't use: `expo run:ios`
- ✅ Use: `bun run build:ios:dev` (EAS Build)

### Build Fails

**Check:**
1. Apple Developer account is active
2. Bundle identifier matches Apple Developer portal
3. HealthKit capability is enabled in Apple Developer portal

**Fix credentials:**
```bash
eas credentials -p ios --clear-all
eas credentials -p ios
```

### HealthKit Still Not Working After Build

1. **Verify entitlements:**
   - Check Apple Developer portal → Certificates, Identifiers & Profiles
   - Ensure HealthKit capability is enabled for your App ID

2. **Rebuild:**
   ```bash
   bun run build:ios:dev -- --clear-cache
   ```

3. **Check device:**
   - HealthKit requires physical device (not simulator)
   - Ensure iPhone is running iOS 8.0+

## Quick Reference

```bash
# Build iOS development app (REQUIRED for HealthKit)
bun run build:ios:dev

# List builds
bun run build:list

# Start dev server
bun run dev

# Submit to TestFlight
eas submit -p ios --profile development
```

## Key Points

1. **Always use EAS Build** for HealthKit development builds
2. **Never use `expo run:ios`** if you need HealthKit
3. **Physical device required** (simulator has limited HealthKit support)
4. **Development build includes native modules** automatically

## After Building

Once you have the development build installed:
- ✅ HealthKit will be available
- ✅ Native modules will work
- ✅ You can develop with hot reload
- ✅ Changes reflect instantly (no rebuild needed unless you add native modules)

