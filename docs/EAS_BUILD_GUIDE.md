# EAS Build & Deployment Guide

## Prerequisites Setup

### 1. Install EAS CLI (if not already installed)
```bash
npm install -g @expo/eas-cli@latest
```

### 2. Login to EAS
```bash
eas login
```
Use your Expo account: **Nour_Maak**

### 3. Verify EAS Project
```bash
eas whoami
eas project:info
```
## iOS Setup

### 1. Configure iOS Credentials
```bash
eas credentials -p ios
```

**Select options:**
1. **Select profile**: production
2. **What do you want to do?**: Manage everything needed to build your project
3. **Distribution Certificate**: Let EAS handle this (recommended)
4. **Provisioning Profile**: Let EAS handle this (recommended)

This will:
- Create/update distribution certificate
- Create/update provisioning profile
- Store credentials securely in EAS

### 2. Apple Developer Account Requirements
You need:
- ✅ **Apple Developer Account** ($99/year)
- ✅ **Team ID** (found in Apple Developer portal)
- ✅ **App Store Connect access**

**To get Team ID:**
1. Go to https://developer.apple.com/account  
2. Click "Membership" in sidebar
3. Copy "Team ID" (10-character alphanumeric)
4. Update `eas.json` with this Team ID

## Android Setup

### 1. Configure Android Credentials  
```bash
eas credentials -p android
```

**Select options:**
1. **Select profile**: production
2. **What do you want to do?**: Manage everything needed to build your project  
3. **Android Keystore**: Let EAS generate a new keystore (recommended for new apps)

This will:
- Generate signing keystore
- Store credentials securely in EAS

### 2. Google Play Console Requirements
You need:
- ✅ **Google Play Developer Account** ($25 one-time)
- ✅ **Service Account for API access** (for automated submission)

**To create Service Account:**
1. Go to https://play.google.com/console
2. Settings → API access
3. Create new service account in Google Cloud Console
4. Download JSON key file
5. Save as `google-service-account.json` in project root

## Build Commands

### Preview Build (for testing)
```bash
# iOS preview build
eas build -p ios --profile preview

# Android preview build  
eas build -p android --profile preview

# Both platforms
eas build --profile preview
```

### Production Build
```bash
# iOS production build
eas build -p ios --profile production

# Android production build
eas build -p android --profile production

# Both platforms (recommended)
eas build --profile production
```

### Monitor Builds
```bash
# List all builds
eas build:list

# View specific build details
eas build:view [BUILD_ID]

# View build logs
eas build:logs [BUILD_ID]
```

## Pre-Build Checklist

Run these commands before building:

```bash
# Clean project
rm -rf node_modules
npm install

# Clear Expo cache
npx expo start --clear

# Run health check
npx expo-doctor

# Verify Firebase files exist
ls -la google-services.json GoogleService-Info.plist

# Test local development
npm run dev
```

## Build Profiles Explanation

### Development Profile
- ✅ **Development client**: Enabled
- ✅ **Simulator**: Allowed  
- ✅ **Distribution**: Internal only
- 🎯 **Use for**: Testing new features

### Preview Profile  
- ✅ **Distribution**: Internal
- ✅ **Release build**: Yes (iOS)
- ✅ **APK format**: Yes (Android - easier for testing)
- 🎯 **Use for**: Final testing before submission

### Production Profile
- ✅ **Release build**: iOS and Android
- ✅ **App Bundle**: Android (required for Play Store)
- ✅ **Auto increment**: Version numbers
- ✅ **Optimized**: For store submission
- 🎯 **Use for**: Store submission only

## Common Build Issues & Solutions

### iOS Build Failures
```bash
# Certificate issues
eas credentials -p ios --clear-all
eas credentials -p ios

# Info.plist issues  
# Check app.json ios.infoPlist section

# Bundle identifier mismatch
# Verify ios.bundleIdentifier in app.json matches Apple Developer portal
```

### Android Build Failures  
```bash
# Gradle issues
# Ensure google-services.json is in project root

# Package name issues
# Verify android.package in app.json

# Permission issues
# Check android.permissions array in app.json
```

### General Build Issues
```bash
# Metro bundler issues
rm -rf node_modules .expo
npm install
npx expo start --clear

# Dependency conflicts
npx expo install --check
npx expo-doctor

# Network issues (retry build)
eas build --profile production --clear-cache
```

## Build Output Files

### iOS Production Build
- **File**: `Maak Health.ipa`
- **Size**: ~50-100 MB
- **Use**: Upload to App Store Connect or TestFlight

### Android Production Build  
- **File**: `application.aab` (App Bundle)
- **Size**: ~30-80 MB
- **Use**: Upload to Google Play Console

## Build Timeline

### Typical Build Times
- **iOS Build**: 8-15 minutes
- **Android Build**: 6-12 minutes  
- **Both platforms**: 10-20 minutes (parallel)

### Factors Affecting Build Time
- ✅ **Native dependencies** (react-native-health adds time)
- ✅ **Asset optimization** (images, fonts)
- ✅ **EAS resource class** (m-medium is good balance)
- ✅ **Build queue** (can be busy during peak hours)

## Post-Build Actions

### After Successful Build

1. **Download builds**:
```bash
# Download latest builds
eas build:list
# Click download links in output
```

2. **Test on real devices**:
   - Install .ipa on iOS device via TestFlight/direct install
   - Install .aab on Android via internal testing

3. **Verify core functionality**:
   - User authentication
   - Firebase connectivity  
   - Push notifications
   - Fall detection
   - Medication reminders

### If Build Succeeds But App Crashes

1. **Check build logs**:
```bash
eas build:logs [BUILD_ID]
```

2. **Common crash causes**:
   - Missing Firebase configuration
   - Incorrect bundle/package identifiers
   - Missing native permissions
   - Asset loading issues

3. **Debug steps**:
   - Test in development mode first
   - Check device logs/crash reports
   - Verify all required files are included

## Ready to Submit?

Once builds are successful and tested:

```bash
# Submit iOS to App Store
eas submit -p ios --profile production

# Submit Android to Google Play
eas submit -p android --profile production

# Submit both
eas submit --profile production
```

## Troubleshooting Commands

```bash
# Reset EAS credentials
eas credentials -p ios --clear-all
eas credentials -p android --clear-all

# Check project configuration
eas config

# Validate configuration  
npx expo config --type introspect

# Clear all caches
rm -rf node_modules .expo
npm install
eas build --profile production --clear-cache
```