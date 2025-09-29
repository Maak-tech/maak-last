# App Store Publishing Plan for Maak Health

## Overview
This document contains the complete plan and step-by-step instructions for publishing the Maak Health app to both Apple App Store and Google Play Store. Follow these instructions sequentially for the fastest path to publication.

## Current Status
- **App Name**: Maak Health
- **Bundle ID (iOS)**: com.maak.health
- **Package Name (Android)**: com.maak.health
- **Version**: 1.0.0
- **EAS Project ID**: 26cb86fa-b368-4a41-8d1c-49d212a7f604

## Prerequisites Checklist
Before starting, ensure you have:
- [ ] Apple Developer Account ($99/year) - https://developer.apple.com
- [ ] Google Play Developer Account ($25 one-time) - https://play.google.com/console
- [ ] Access to the Expo account (owner: ahmad_alstaty)
- [ ] Testing devices (iOS and Android)

## Phase 1: Project Preparation (Priority: HIGH)

### 1.1 Fix Project Health Issues
```bash
# Update all Expo packages to compatible versions
npx expo install --check

# Specifically update these packages:
npx expo install expo@53.0.20 \
  expo-camera@~16.1.11 \
  expo-constants@~17.1.7 \
  expo-font@~13.3.2 \
  expo-linking@~7.1.7 \
  expo-localization@~16.1.6 \
  expo-notifications@~0.31.4 \
  expo-router@~5.1.4 \
  expo-splash-screen@~0.30.10 \
  expo-system-ui@~5.0.10 \
  react-native@0.79.5

# Fix metro-resolver version
npm install metro-resolver@^0.82.0 --save-dev

# Fix config-plugins version
npm install @expo/config-plugins@~10.1.1 --save-dev
```

### 1.2 Create Production Assets
Create the following in `/assets/production/`:

#### App Icons
- `icon-1024.png` - 1024x1024px for iOS App Store
- `icon-512.png` - 512x512px for Google Play Store
- Ensure icons have no transparency and no rounded corners

#### Screenshots (Required)
**iOS Screenshots** (save in `/assets/screenshots/ios/`):
- iPhone 6.7" (1290 × 2796px) - 3-5 screenshots
- iPhone 6.5" (1242 × 2688px) - 3-5 screenshots
- iPad 12.9" (2048 × 2732px) - optional

**Android Screenshots** (save in `/assets/screenshots/android/`):
- Phone (1080 × 1920px minimum) - 2-8 screenshots
- 7" Tablet (1200 × 1920px) - optional
- 10" Tablet (1800 × 2560px) - optional

### 1.3 Update App Configuration

#### Update app.json:
```json
{
  "expo": {
    "name": "Maak Health",
    "slug": "maak-health",
    "owner": "ahmad_alstaty",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/production/icon-1024.png",
    "scheme": "maak",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/production/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#F8FAFC"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.maak.health",
      "buildNumber": "1",
      "infoPlist": {
        "NSCameraUsageDescription": "Maak Health uses the camera to allow you to take profile photos and scan medication barcodes.",
        "NSPhotoLibraryUsageDescription": "Maak Health needs access to your photo library to select profile pictures.",
        "NSMotionUsageDescription": "Maak Health uses motion sensors to detect falls and alert your emergency contacts.",
        "NSLocationWhenInUseUsageDescription": "Maak Health uses your location to share with emergency contacts during fall detection alerts.",
        "NSUserTrackingUsageDescription": "This identifier will be used to deliver personalized health insights and recommendations."
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/production/adaptive-icon.png",
        "backgroundColor": "#2563EB"
      },
      "package": "com.maak.health",
      "versionCode": 1,
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "com.google.android.c2dm.permission.RECEIVE"
      ]
    }
  }
}
```

#### Update eas.json:
```json
{
  "cli": {
    "version": ">= 3.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium",
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium",
        "simulator": false,
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "ios": {
        "resourceClass": "m-medium",
        "buildConfiguration": "Release",
        "autoIncrement": true
      },
      "android": {
        "resourceClass": "m-medium",
        "buildType": "app-bundle",
        "autoIncrement": true
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID@EMAIL.COM",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

## Phase 2: Store Metadata Preparation

### 2.1 Create Store Listing Content
Create `/store-metadata/` directory with:

#### app-description.md:
```markdown
# Maak Health - App Store Listing

## App Name
Maak Health

## Subtitle (iOS only, 30 chars max)
Your Personal Health Companion

## Short Description (80 chars max)
Track medications, symptoms, and connect with family for better health care.

## Full Description (4000 chars max)
Maak Health is your comprehensive health management companion designed to help you and your loved ones stay on top of health and wellness. Whether you're managing chronic conditions, tracking medications, or ensuring the safety of elderly family members, Maak Health provides the tools you need.

**Key Features:**

📱 **Medication Management**
- Set medication reminders and never miss a dose
- Track medication inventory
- Record dosage information and schedules
- Get alerts for refills

🏥 **Symptom Tracking**
- Log symptoms as they occur
- Track symptom patterns over time
- Generate reports for healthcare providers
- Monitor health trends

👨‍👩‍👧‍👦 **Family Connection**
- Share health updates with family members
- Coordinate care across family caregivers
- Emergency contact management
- Real-time health status sharing

🚨 **Fall Detection & Emergency Alerts**
- Automatic fall detection using device sensors
- Instant alerts to emergency contacts
- Location sharing during emergencies
- Quick access to emergency services

🤖 **AI Health Assistant**
- Get instant answers to health questions
- Medication interaction checker
- Symptom assessment guidance
- Personalized health insights

📊 **Health Analytics**
- Visual health trends and charts
- Comprehensive health reports
- Data export for healthcare providers
- Progress tracking

🔒 **Privacy & Security**
- Secure data encryption
- HIPAA-compliant data handling
- Private family sharing
- Control your data sharing

Maak Health supports multiple languages including English and Arabic, making it accessible for diverse communities.

Download Maak Health today and take control of your health journey!

## Keywords (iOS, 100 chars max total)
health,medication,reminder,symptom,tracker,family,medical,pills,elderly,care,fall,detection

## Categories
- Primary: Medical
- Secondary: Health & Fitness

## Age Rating
12+ (Infrequent/Mild Medical/Treatment Information)

## Privacy Policy URL
https://maakhealth.com/privacy-policy

## Terms of Service URL
https://maakhealth.com/terms-of-service

## Support URL
https://maakhealth.com/support

## Marketing URL
https://maakhealth.com
```

## Phase 3: Apple App Store Setup

### 3.1 App Store Connect Configuration

1. **Create App in App Store Connect**
   - Log in to https://appstoreconnect.apple.com
   - Click "+" and select "New App"
   - Platform: iOS
   - App Name: Maak Health
   - Primary Language: English (U.S.)
   - Bundle ID: com.maak.health
   - SKU: maak-health-2024

2. **Configure App Information**
   - Add app description from metadata file
   - Upload screenshots
   - Set age rating
   - Add privacy policy and terms URLs
   - Configure pricing (Free)

3. **Set Up TestFlight**
   - Add internal testers
   - Configure test information
   - Set beta app description

### 3.2 Configure EAS for iOS
```bash
# Login to EAS
eas login

# Configure iOS credentials
eas credentials

# Select iOS platform
# Choose "production" profile
# Let EAS handle certificate and provisioning profile creation
```

## Phase 4: Google Play Store Setup

### 4.1 Play Console Configuration

1. **Create App in Play Console**
   - Go to https://play.google.com/console
   - Click "Create app"
   - App name: Maak Health
   - Default language: English (United States)
   - App type: App
   - Category: Medical
   - Select Free

2. **Complete Store Listing**
   - Add descriptions from metadata
   - Upload screenshots and graphics
   - Add icon and feature graphic
   - Set content rating (fill questionnaire)
   - Add privacy policy URL

3. **Create Service Account for EAS**
   - Go to Google Play Console Settings
   - Navigate to API access
   - Create new service account
   - Download JSON key as `google-play-service-account.json`
   - Place in project root

### 4.2 Configure EAS for Android
```bash
# Configure Android credentials
eas credentials

# Select Android platform
# Choose "production" profile
# Let EAS handle keystore creation
```

## Phase 5: Build Production Apps

### 5.1 Pre-Build Checklist
```bash
# Clean and install dependencies
rm -rf node_modules
npm install

# Clear caches
npx expo start --clear
npm run clear-cache

# Run tests if available
npm test

# Check for build issues
npx expo-doctor
```

### 5.2 Create Production Builds
```bash
# Build iOS app
eas build --platform ios --profile production

# Build Android app
eas build --platform android --profile production

# Monitor build status
eas build:list
```

## Phase 6: Testing

### 6.1 iOS Testing
1. Download .ipa file from EAS dashboard
2. Install on test device using TestFlight
3. Test critical flows:
   - User registration/login
   - Medication management
   - Fall detection
   - Push notifications
   - Firebase connectivity

### 6.2 Android Testing
1. Download .aab file from EAS dashboard
2. Test using bundletool or internal testing track
3. Verify same critical flows as iOS

### 6.3 Testing Checklist
- [ ] User authentication works
- [ ] Firebase data syncs correctly
- [ ] Push notifications received
- [ ] Fall detection triggers properly
- [ ] All navigation flows work
- [ ] No crashes or ANRs
- [ ] Performance is acceptable
- [ ] Offline mode handles gracefully

## Phase 7: Submission

### 7.1 Submit to App Store
```bash
# Submit iOS app
eas submit --platform ios --profile production

# Or manually:
# 1. Download .ipa from EAS
# 2. Upload using Transporter app
# 3. Submit for review in App Store Connect
```

**App Review Notes Template:**
```
Test Account:
Email: test@maakhealth.com
Password: TestUser123!

The app requires a registered account to access main features.
Fall detection uses device motion sensors.
Location is only used during emergency alerts.
```

### 7.2 Submit to Google Play
```bash
# Submit Android app
eas submit --platform android --profile production

# This will upload to internal track first
# Then manually promote to production in Play Console
```

## Phase 8: Post-Submission

### 8.1 Monitor Review Status
- **iOS**: Check App Store Connect daily (usually 24-48 hours)
- **Android**: Check Play Console (usually 2-3 hours)

### 8.2 Common Rejection Reasons & Solutions

**iOS Rejections:**
- Missing usage descriptions → Update Info.plist
- Crashes on review → Test on clean device
- Incomplete features → Disable or complete them
- Privacy issues → Update privacy policy

**Android Rejections:**
- Policy violations → Review Google Play policies
- Crashes/ANRs → Check crash reports
- Metadata issues → Update store listing

### 8.3 Post-Launch Tasks
1. Set up monitoring:
   - Firebase Crashlytics
   - Analytics dashboards
   - Performance monitoring

2. Prepare update workflow:
   - Version bumping strategy
   - Release notes template
   - Beta testing process

## Quick Commands Reference

```bash
# Update dependencies
npx expo install --check

# Build for iOS
eas build --platform ios --profile production

# Build for Android  
eas build --platform android --profile production

# Submit to App Store
eas submit --platform ios --profile production

# Submit to Play Store
eas submit --platform android --profile production

# Check build status
eas build:list

# View build logs
eas build:view [BUILD_ID]
```

## Support Resources

- EAS Build docs: https://docs.expo.dev/build/introduction/
- App Store guidelines: https://developer.apple.com/app-store/review/guidelines/
- Play Store policies: https://play.google.com/about/developer-content-policy/
- Expo Discord: https://chat.expo.dev

## Timeline Estimate

With all prerequisites ready:
- Day 1-2: Project preparation and fixes
- Day 3: Store account setup
- Day 4: Build production apps
- Day 5: Testing
- Day 6: Submission
- Day 7-9: Review and approval

Total: **7-9 days to launch**

---

**Last Updated**: January 2025
**Document Version**: 1.0.0