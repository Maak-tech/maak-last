# Production Deployment Quick Start

This guide provides step-by-step instructions to deploy your Maak Health app to production.

## Prerequisites

- [x] EAS CLI installed: `npm install -g @expo/eas-cli@latest`
- [x] Logged into EAS: `eas login`
- [x] Firebase project configured
- [x] Apple Developer account (for iOS)
- [x] Google Play Developer account (for Android)

## Step 1: Set Up EAS Secrets

Environment variables must be set in EAS Secrets for production builds.

### Quick Setup (Using Existing Firebase Config)

Based on your current Firebase configuration, run these commands:

```bash
# Firebase Configuration
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "AIzaSyBzfNXpiKb5LhpX347PTXIODpZ6M9XFblQ"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "maak-5caad.firebaseapp.com"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "maak-5caad"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value "maak-5caad.firebasestorage.app"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value "827176918437"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_APP_ID --value "1:827176918437:web:356fe7e2b4ecb3b99b1c4c"

# Google Services Files (base64 encoded)
# On Windows PowerShell:
$jsonContent = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes("google-services.json"))
eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type string --value $jsonContent

$plistContent = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes("GoogleService-Info.plist"))
eas secret:create --scope project --name GOOGLE_SERVICE_INFO_PLIST --type string --value $plistContent

# On macOS/Linux:
cat google-services.json | base64 | eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type string --value "$(cat)"
cat GoogleService-Info.plist | base64 | eas secret:create --scope project --name GOOGLE_SERVICE_INFO_PLIST --type string --value "$(cat)"
```

### Verify Secrets

```bash
eas secret:list
```

See [EAS_SECRETS_SETUP.md](./EAS_SECRETS_SETUP.md) for detailed instructions.

## Step 2: Configure Build Credentials

### iOS Credentials

```bash
eas credentials -p ios
```

Select:
1. Profile: **production**
2. Action: **Manage everything needed to build your project**
3. Distribution Certificate: **Let EAS handle this**
4. Provisioning Profile: **Let EAS handle this**

### Android Credentials

```bash
eas credentials -p android
```

Select:
1. Profile: **production**
2. Action: **Manage everything needed to build your project**
3. Keystore: **Let EAS generate a new keystore** (or use existing)

## Step 3: Validate Production Readiness

Run the validation script:

```bash
bunx tsx scripts/validate-production.ts
```

**Note:** Environment variables will show as missing locally - this is expected. They should be set in EAS Secrets for production builds.

## Step 4: Deploy Firebase Rules and Functions

### Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### Deploy Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

### Deploy Firebase Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

## Step 5: Build Production Apps

### Build Both Platforms

```bash
eas build --profile production
```

### Build Individual Platforms

```bash
# iOS only
eas build --profile production --platform ios

# Android only
eas build --profile production --platform android
```

### Monitor Build Progress

```bash
eas build:list
```

Builds typically take 10-20 minutes. You'll receive an email when complete.

## Step 6: Test Production Builds

1. **Download builds** from the EAS dashboard or build list
2. **Install on real devices:**
   - iOS: Install via TestFlight or direct install
   - Android: Install APK/AAB via internal testing track
3. **Test critical features:**
   - [ ] User authentication
   - [ ] Firebase connectivity
   - [ ] Push notifications
   - [ ] Health data sync
   - [ ] Family features
   - [ ] Medication reminders

## Step 7: Submit to App Stores

### iOS App Store

```bash
eas submit -p ios --profile production
```

**Before submitting:**
- [ ] App is created in App Store Connect
- [ ] App Store listing is complete
- [ ] Screenshots uploaded
- [ ] Privacy policy URL set
- [ ] App complies with App Store guidelines

### Google Play Store

```bash
eas submit -p android --profile production
```

**Before submitting:**
- [ ] App is created in Google Play Console
- [ ] Store listing is complete
- [ ] Screenshots uploaded
- [ ] Privacy policy URL set
- [ ] Content rating completed
- [ ] App complies with Google Play policies

## Step 8: Monitor Submission

### iOS
- Check App Store Connect for review status
- Respond to any review feedback
- Monitor crash reports and analytics

### Android
- Check Google Play Console for review status
- Respond to any review feedback
- Monitor crash reports and analytics

## Troubleshooting

### Build Fails

1. **Check build logs:**
   ```bash
   eas build:logs [BUILD_ID]
   ```

2. **Common issues:**
   - Missing EAS secrets → Set them with `eas secret:create`
   - Credential issues → Run `eas credentials -p [platform]`
   - Firebase config → Verify Google Services files are in EAS secrets

### App Crashes After Build

1. **Check device logs**
2. **Verify Firebase configuration**
3. **Check for missing permissions**
4. **Test in preview build first**

### Store Rejection

1. **Review rejection reasons**
2. **Fix issues and resubmit**
3. **Update app metadata if needed**

## Post-Deployment Checklist

- [ ] Monitor crash reports
- [ ] Check analytics
- [ ] Monitor Firebase usage
- [ ] Respond to user feedback
- [ ] Plan updates and improvements

## Quick Reference

```bash
# Validate production readiness
bunx tsx scripts/validate-production.ts

# Build production apps
eas build --profile production

# Submit to stores
eas submit --profile production

# Check build status
eas build:list

# View build logs
eas build:logs [BUILD_ID]

# List secrets
eas secret:list
```

## Additional Resources

- [Production Checklist](./PRODUCTION_CHECKLIST.md) - Detailed checklist
- [EAS Secrets Setup](./EAS_SECRETS_SETUP.md) - Environment variables guide
- [EAS Build Guide](./EAS_BUILD_GUIDE.md) - Build configuration details
- [Firebase Setup](./FIREBASE_SETUP.md) - Firebase configuration

## Support

If you encounter issues:

1. Check build logs: `eas build:logs [BUILD_ID]`
2. Review error messages carefully
3. Consult EAS documentation: https://docs.expo.dev/build/introduction/
4. Check Firebase Console for configuration issues

