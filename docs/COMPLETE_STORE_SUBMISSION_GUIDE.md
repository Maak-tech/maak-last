# 🚀 Complete App Store Submission Guide

## REQUIRED ACCOUNTS & PERMISSIONS

### Apple App Store
- ✅ **Apple Developer Account** ($99/year)
  - Sign up: https://developer.apple.com
  - Verification takes 24-48 hours
  - Need: Valid payment method, government ID

- ✅ **App Store Connect Access**  
  - Uses same Apple ID as Developer Account
  - Access: https://appstoreconnect.apple.com
  - Role needed: "Admin" or "App Manager"

### Google Play Store
- ✅ **Google Play Developer Account** ($25 one-time)
  - Sign up: https://play.google.com/console
  - Verification takes 1-3 hours
  - Need: Valid payment method, phone verification

### Required Information for Both
- 📧 **Primary Email**: ahmad.alstaty@gmail.com
- 📱 **Phone Number**: For 2FA verification
- 💳 **Payment Method**: Credit/debit card for fees
- 🏢 **Developer Name**: Ahmad Alstaty
- 🌍 **Country/Region**: Saudi Arabia (or your location)
- 📄 **Tax Information**: May be required for payments

---

## 🍎 APPLE APP STORE SETUP

### Step 1: Create App in App Store Connect

1. **Go to App Store Connect**
   - URL: https://appstoreconnect.apple.com
   - Sign in with Apple ID: ahmad.alstaty@gmail.com

2. **Create New App**
   - Click "My Apps" → "+" → "New App"
   - **Platforms**: iOS
   - **Name**: Maak Health
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: Select `com.maak.health` (from your Developer Portal)
   - **SKU**: maak-health-2024 (unique identifier for your records)
   - **User Access**: Full Access

### Step 2: Complete App Information

#### **General Information**
- **App Name**: Maak Health
- **Subtitle**: Your Health Companion
- **Category**: Primary: Medical, Secondary: Health & Fitness

#### **Pricing and Availability**
- **Price**: Free
- **Availability**: All countries/regions
- **App Store Distribution**: Make available on the App Store

#### **App Privacy**
- **Privacy Policy URL**: https://maakhealth.com/privacy-policy
- **User Privacy Choices URL**: Leave blank for now

### Step 3: Fill App Store Information

#### **App Information Section**
```
App Name: Maak Health
Subtitle: Your Health Companion  
Primary Category: Medical
Secondary Category: Health & Fitness

Description: [Use content from store-metadata/app-store-listing.md]

Keywords: health,medication,reminder,family,medical,fall,detection,elderly,care,symptom,tracker,pills

Support URL: https://maakhealth.com/support
Marketing URL: https://maakhealth.com
```

#### **Age Rating**
Complete the age rating questionnaire:
- **Medical/Treatment Information**: Infrequent/Mild
- **All other categories**: None
- **Final Rating**: 12+

### Step 4: Upload Assets

#### **App Icon** (Required)
- **Size**: 1024 x 1024 pixels
- **Format**: PNG (no transparency)
- **File**: Use `assets/images/generated_image.png` (resize to 1024x1024)

#### **Screenshots** (Required)
Upload to these device categories:
1. **6.7" iPhone** (1290 x 2796): 3-10 screenshots
2. **6.5" iPhone** (1242 x 2688): 3-10 screenshots  
3. **iPad Pro 12.9"** (2048 x 2732): Optional but recommended

### Step 5: App Review Information

#### **App Review Information**
```
Sign-in required: Yes
Demo Account:
  Username: reviewer@maakhealth.com
  Password: ReviewDemo2024!

Notes:
This app helps users manage medications and health tracking. Key features:
- Medication reminders require notification permissions
- Fall detection uses device motion sensors  
- Location is only used during emergency alerts
- App requires user account for data synchronization
- Firebase is used for secure data storage

The demo account has sample data to showcase all features.

Contact Information:
First Name: Ahmad
Last Name: Alstaty  
Phone: +966 XXX XXX XXXX
Email: ahmad.alstaty@gmail.com
```

#### **Attachment** (if needed)
Upload demo video or additional screenshots if app functionality is complex.

### Step 6: Version Information

```
Version Number: 1.0.0
Copyright: © 2024 Ahmad Alstaty
What's New in This Version:
🎉 Welcome to Maak Health v1.0!

Your complete health management companion:
• Never miss medications with smart reminders
• Share health updates with family securely  
• Automatic fall detection with emergency alerts
• AI-powered health assistant for instant answers
• Beautiful health analytics and trend tracking
• Multi-language support (English & Arabic)
• Privacy-first design with encryption

Perfect for managing chronic conditions, elderly care, and family health coordination.
```

### Step 7: Build Upload

1. **Generate iOS Build**:
```bash
eas build -p ios --profile production
```

2. **Upload Build**:
   - Download .ipa file from EAS dashboard
   - Use **Transporter** app to upload to App Store Connect
   - OR use automatic upload: `eas submit -p ios --profile production`

3. **Select Build in App Store Connect**:
   - Go to "TestFlight" tab
   - Wait for build processing (5-15 minutes)
   - Add to App Store submission

---

## 🤖 GOOGLE PLAY STORE SETUP

### Step 1: Create App in Play Console

1. **Go to Play Console**
   - URL: https://play.google.com/console
   - Sign in with Google Account: ahmad.alstaty@gmail.com

2. **Create New App**
   - Click "Create app"
   - **App name**: Maak Health
   - **Default language**: English (United States)  
   - **App or game**: App
   - **Free or paid**: Free
   - **Declarations**: Check all required boxes

### Step 2: Set up App Content

#### **App Content Requirements**
1. **Privacy Policy**: https://maakhealth.com/privacy-policy
2. **Target Audience**: Ages 13+ (Teen audience)
3. **Content Rating**: Complete questionnaire → Likely "Everyone" or "Teen"
4. **App Category**: Medical
5. **Government Apps**: No

### Step 3: Store Listing

#### **Main Store Listing**
```
App name: Maak Health
Short description: Track meds, manage health, connect with family. Fall detection included.

Full description: [Use content from store-metadata/app-store-listing.md]

App icon: Upload 512 x 512 PNG (no transparency)
Feature graphic: Create 1024 x 500 promotional banner
Phone screenshots: Upload 2-8 screenshots (minimum 1080 x 1920)
```

### Step 4: Content Rating

Complete the content rating questionnaire:
- **Violence**: None
- **Sexual Content**: None  
- **Profanity**: None
- **Controlled Substances**: None (medical app, not promoting substances)
- **Gambling**: None
- **User-Generated Content**: None

### Step 5: App Signing

1. **Google Play App Signing**: Enabled (recommended)
2. **Upload Key**: EAS will handle this automatically

### Step 6: Release Setup

#### **Internal Testing** (recommended first step)
1. **Create Internal Testing Release**
2. **Add Test Users**: ahmad.alstaty@gmail.com
3. **Upload AAB**: Use EAS build output

#### **Production Release**
1. **Upload AAB file**: From EAS build
2. **Release Name**: v1.0.0 (1) - Launch Release
3. **Release Notes**: Use same as iOS "What's New"

---

## 🚀 SUBMISSION PROCESS

### iOS Submission Steps

1. **Final Review**:
   - Verify all fields are complete
   - Test app thoroughly on device
   - Ensure demo account works

2. **Submit for Review**:
   - Click "Add for Review" → "Submit to App Review"
   - **Review Timeline**: 24-48 hours typically
   - **Status**: Check in App Store Connect

3. **Approval Actions**:
   - **If Approved**: App goes live automatically (or set release date)
   - **If Rejected**: Address issues and resubmit

### Android Submission Steps

1. **Complete All Required Sections**:
   - ✅ Store listing
   - ✅ Content rating  
   - ✅ Target audience
   - ✅ Privacy policy
   - ✅ App content

2. **Publish to Internal Track** (recommended):
   - Test with internal testers first
   - Verify everything works correctly

3. **Publish to Production**:
   - **Review Timeline**: 2-3 hours typically
   - **Rollout**: Can start with small percentage

---

## 📋 PRE-SUBMISSION CHECKLIST

### Technical Requirements
- [ ] App builds successfully with EAS
- [ ] Tested on real iOS and Android devices  
- [ ] Firebase connection works
- [ ] Push notifications function
- [ ] Fall detection triggers properly
- [ ] No crashes during basic user flows
- [ ] All permissions work correctly

### Store Requirements  
- [ ] App Store Connect account created
- [ ] Google Play Console account created
- [ ] App icons created (1024x1024 for iOS, 512x512 for Android)
- [ ] Screenshots captured for all required sizes
- [ ] Store descriptions written and reviewed
- [ ] Privacy policy published at specified URL
- [ ] Terms of service published at specified URL
- [ ] Demo account created and tested

### Legal & Business
- [ ] Apple Developer Program membership active
- [ ] Google Play Developer account verified
- [ ] Tax information provided (if required)
- [ ] Banking information for app payments (if applicable)
- [ ] Content rating completed accurately
- [ ] Age-appropriate content verified

---

## ⚡ AUTOMATION COMMANDS

### Complete Build & Submit Process
```bash
# Step 1: Build for both platforms  
eas build --profile production

# Step 2: Wait for builds to complete (10-20 minutes)
eas build:list

# Step 3: Test builds on devices
# Download and install .ipa/.aab files

# Step 4: Submit to both stores
eas submit --profile production
```

### Individual Platform Commands
```bash
# iOS only
eas build -p ios --profile production
eas submit -p ios --profile production

# Android only  
eas build -p android --profile production
eas submit -p android --profile production
```

---

## 🔧 UPDATE REQUIRED VALUES

Before submitting, update these placeholder values:

### In `eas.json`:
```json
{
  "submit": {
    "production": {
      "ios": {
        "appleTeamId": "REPLACE_WITH_YOUR_APPLE_TEAM_ID",
        "ascAppId": "REPLACE_WITH_APP_STORE_CONNECT_APP_ID"
      }
    }
  }
}
```

### URLs to Create:
- **Privacy Policy**: https://maakhealth.com/privacy-policy
- **Terms of Service**: https://maakhealth.com/terms-of-service
- **Support**: https://maakhealth.com/support  
- **Marketing**: https://maakhealth.com

---

## 📞 SUPPORT CONTACTS

### Apple Developer Support
- **Phone**: 1-800-633-2152 (US) / +966 8008500407 (Saudi Arabia)
- **Email**: Through Developer Portal
- **Best Times**: 9 AM - 5 PM PT (Apple's hours)

### Google Play Support  
- **Help Center**: https://support.google.com/googleplay/android-developer
- **Chat Support**: Available in Play Console
- **Email**: Through Play Console only

### Expo/EAS Support
- **Discord**: https://chat.expo.dev
- **Documentation**: https://docs.expo.dev
- **GitHub Issues**: https://github.com/expo/expo

---

## 🎯 SUCCESS METRICS

### Timeline Expectations
- **Total Time**: 3-7 days from start to live
- **iOS Review**: 24-48 hours  
- **Android Review**: 2-3 hours
- **Account Setup**: Same day
- **Asset Creation**: 1-2 days

### Launch Readiness Score
Your app should meet these criteria:
- ✅ **Technical**: Builds without errors, core features work
- ✅ **Legal**: Privacy policy live, terms accessible
- ✅ **Marketing**: Store listings complete, screenshots ready
- ✅ **Operational**: Support contacts working, accounts verified

**Your Current Status**: ~85% ready (need to complete Firebase setup and create assets)

---

*This guide ensures your app meets all requirements for both App Store and Google Play Store. Follow each section carefully and update placeholder values with your actual information.*