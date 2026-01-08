# Production Deployment Checklist

This checklist ensures your Maak Health app is ready for production deployment.

## Pre-Deployment Checklist

### ✅ Environment Variables

- [ ] **Firebase Configuration**
  - [ ] `EXPO_PUBLIC_FIREBASE_API_KEY` - Set in EAS secrets
  - [ ] `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` - Set in EAS secrets
  - [ ] `EXPO_PUBLIC_FIREBASE_PROJECT_ID` - Set in EAS secrets
  - [ ] `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` - Set in EAS secrets
  - [ ] `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - Set in EAS secrets
  - [ ] `EXPO_PUBLIC_FIREBASE_APP_ID` - Set in EAS secrets

- [ ] **API Keys (Optional)**
  - [ ] `OPENAI_API_KEY` - Set if using AI features
  - [ ] `FITBIT_CLIENT_ID` - Set if using Fitbit integration
  - [ ] `FITBIT_CLIENT_SECRET` - Set if using Fitbit integration

- [ ] **Google Services Files**
  - [ ] `GOOGLE_SERVICES_JSON` - Set in EAS secrets (base64 encoded)
  - [ ] `GOOGLE_SERVICE_INFO_PLIST` - Set in EAS secrets (base64 encoded)

**To set EAS secrets:**
```bash
# Firebase environment variables
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "your-api-key"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "your-project.firebaseapp.com"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "your-project-id"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value "your-project.appspot.com"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value "your-sender-id"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_APP_ID --value "your-app-id"

# Google Services files (base64 encoded)
cat google-services.json | base64 | eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type string --value "$(cat)"
cat GoogleService-Info.plist | base64 | eas secret:create --scope project --name GOOGLE_SERVICE_INFO_PLIST --type string --value "$(cat)"

# Optional API keys
eas secret:create --scope project --name OPENAI_API_KEY --value "your-openai-key"
eas secret:create --scope project --name FITBIT_CLIENT_ID --value "your-fitbit-id"
eas secret:create --scope project --name FITBIT_CLIENT_SECRET --value "your-fitbit-secret"
```

### ✅ Firebase Configuration

- [ ] **Firestore Security Rules**
  - [ ] Rules are deployed: `firebase deploy --only firestore:rules`
  - [ ] Rules are tested and secure
  - [ ] No overly permissive rules (e.g., `allow read, write: if true`)

- [ ] **Firestore Indexes**
  - [ ] Indexes are deployed: `firebase deploy --only firestore:indexes`
  - [ ] All required indexes are created

- [ ] **Firebase Functions**
  - [ ] Functions are deployed: `firebase deploy --only functions`
  - [ ] Functions are tested
  - [ ] Environment variables are set in Firebase Functions

- [ ] **Firebase Storage**
  - [ ] Storage rules are configured
  - [ ] Storage buckets are set up correctly

### ✅ App Configuration

- [ ] **Version Numbers**
  - [ ] iOS build number is incremented in `app.config.js`
  - [ ] Android version code is incremented in `app.config.js`
  - [ ] App version is updated in `app.config.js`

- [ ] **Bundle Identifiers**
  - [ ] iOS bundle identifier matches Apple Developer account
  - [ ] Android package name matches Google Play Console

- [ ] **App Icons & Splash Screens**
  - [ ] App icon is set and correct size
  - [ ] Splash screen is configured
  - [ ] All required icon sizes are present

- [ ] **Permissions**
  - [ ] All required permissions are declared in `app.config.js`
  - [ ] Permission descriptions are user-friendly
  - [ ] iOS Info.plist permissions are configured

### ✅ EAS Build Configuration

- [ ] **Build Profiles**
  - [ ] Production profile exists in `eas.json`
  - [ ] iOS production profile has `autoIncrement: true`
  - [ ] Android production profile has `autoIncrement: true`
  - [ ] Android production profile uses `app-bundle` build type

- [ ] **Credentials**
  - [ ] iOS distribution certificate is configured
  - [ ] iOS provisioning profile is configured
  - [ ] Android keystore is configured
  - [ ] All credentials are stored in EAS

**To configure credentials:**
```bash
eas credentials -p ios
eas credentials -p android
```

### ✅ Code Quality

- [ ] **Linting**
  - [ ] No linting errors: `npm run lint` (if available)
  - [ ] Code follows project style guidelines

- [ ] **TypeScript**
  - [ ] No TypeScript errors: `npx tsc --noEmit`
  - [ ] All types are properly defined

- [ ] **Testing**
  - [ ] Critical features are tested
  - [ ] Authentication flow works
  - [ ] Firebase connectivity works
  - [ ] Push notifications work

### ✅ Security

- [ ] **Secrets Management**
  - [ ] No hardcoded API keys in code
  - [ ] All secrets are in environment variables
  - [ ] `.env` file is in `.gitignore`

- [ ] **Firebase Security**
  - [ ] Firestore rules are secure
  - [ ] Storage rules are secure
  - [ ] Authentication is properly configured

### ✅ Store Requirements

#### iOS App Store

- [ ] **App Store Connect**
  - [ ] App is created in App Store Connect
  - [ ] App Store listing is complete
  - [ ] Screenshots are uploaded
  - [ ] App description is complete
  - [ ] Privacy policy URL is set
  - [ ] Support URL is set

- [ ] **App Store Guidelines**
  - [ ] App complies with App Store guidelines
  - [ ] Required permissions are justified
  - [ ] HealthKit usage is properly declared

**To submit to App Store:**
```bash
eas submit -p ios --profile production
```

#### Google Play Store

- [ ] **Google Play Console**
  - [ ] App is created in Google Play Console
  - [ ] Store listing is complete
  - [ ] Screenshots are uploaded
  - [ ] App description is complete
  - [ ] Privacy policy URL is set
  - [ ] Content rating is completed

- [ ] **Google Play Guidelines**
  - [ ] App complies with Google Play policies
  - [ ] Required permissions are justified
  - [ ] Health Connect usage is properly declared

**To submit to Google Play:**
```bash
eas submit -p android --profile production
```

## Pre-Build Steps

1. **Run validation script:**
   ```bash
   bunx tsx scripts/validate-production.ts
   ```

2. **Validate environment:**
   ```bash
   bunx tsx scripts/validate-env.ts
   ```

3. **Check Firebase setup:**
   ```bash
   npm run firebase:check
   ```

4. **Clean and install dependencies:**
   ```bash
   rm -rf node_modules
   npm install
   ```

5. **Clear Expo cache:**
   ```bash
   npx expo start --clear
   ```

## Build Commands

### Preview Builds (for testing)
```bash
# iOS preview
npm run build:ios:preview

# Android preview
npm run build:android:preview
```

### Production Builds
```bash
# iOS production
npm run build:ios:production

# Android production
npm run build:android:production

# Both platforms
eas build --profile production
```

## Post-Build Verification

- [ ] **Download and test builds**
  - [ ] Install on real iOS device
  - [ ] Install on real Android device
  - [ ] Test all critical features
  - [ ] Verify Firebase connectivity
  - [ ] Test push notifications
  - [ ] Test authentication flow

- [ ] **Check build logs**
  ```bash
  eas build:list
  eas build:logs [BUILD_ID]
  ```

## Deployment Steps

1. **Build production apps:**
   ```bash
   eas build --profile production
   ```

2. **Wait for builds to complete** (check with `eas build:list`)

3. **Test builds on real devices**

4. **Submit to stores:**
   ```bash
   eas submit --profile production
   ```

5. **Monitor submission status:**
   - iOS: Check App Store Connect
   - Android: Check Google Play Console

## Troubleshooting

### Build Failures

- Check build logs: `eas build:logs [BUILD_ID]`
- Verify environment variables are set
- Check Firebase configuration files
- Verify credentials are correct

### App Crashes After Build

- Check device logs
- Verify Firebase configuration
- Check for missing permissions
- Verify all required files are included

### Store Rejection

- Review rejection reasons
- Fix issues and resubmit
- Update app metadata if needed

## Additional Resources

- [EAS Build Guide](./EAS_BUILD_GUIDE.md)
- [Environment Setup](./ENV_SETUP.md)
- [Firebase Setup](./FIREBASE_SETUP.md)
- [App Store Publishing Plan](./APP_STORE_PUBLISHING_PLAN.md)

## Quick Validation

Run this command to validate production readiness:
```bash
bunx tsx scripts/validate-production.ts
```

This will check:
- ✅ Environment variables
- ✅ Firebase configuration files
- ✅ EAS configuration
- ✅ App configuration
- ✅ Firestore security rules
- ✅ Package configuration

