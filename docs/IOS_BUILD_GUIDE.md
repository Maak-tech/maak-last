# iOS Production Build Guide

## 🚀 Quick Start

### Build iOS Production App

```bash
# Option 1: Use npm script (recommended)
npm run build:ios:production

# Option 2: Use EAS directly
eas build -p ios --profile production

# Check build status
eas build:list
```

---

## 📋 Pre-Build Checklist

### 1. Environment Setup

- [ ] EAS CLI installed: `npm install -g eas-cli`
- [ ] Logged into EAS: `eas login`
- [ ] Apple Developer account active
- [ ] Certificates and provisioning profiles valid

### 2. Code Quality

- [ ] All changes committed to git
- [ ] No linting errors: Check workspace
- [ ] TypeScript compiles: No errors shown
- [ ] Tests passing (if applicable)

### 3. Configuration Verification

- [ ] `app.config.js` - Version and build number correct
- [ ] `eas.json` - Production profile configured
- [ ] `.env` - All production API keys set
- [ ] Firebase config - Google services files present

### 4. Dependencies

- [ ] All npm packages up to date
- [ ] No security vulnerabilities: `npm audit`
- [ ] Patches applied: `npm run postinstall`

---

## 🔧 Build Configuration

### Current Settings (from app.config.js)

```javascript
{
  version: "1.0.0",
  ios: {
    buildNumber: "27", // Auto-increments to 28
    bundleIdentifier: "com.maak.health",
    jsEngine: "hermes"
  }
}
```

### EAS Production Profile (from eas.json)

```json
{
  "production": {
    "ios": {
      "resourceClass": "m-medium",
      "buildConfiguration": "Release",
      "autoIncrement": true  // Build number auto-increments
    }
  }
}
```

---

## 🏗️ Building Process

### Step 1: Start the Build

```bash
# Navigate to project root
cd /path/to/maak-last

# Start production build
npm run build:ios:production
```

**What happens:**
1. EAS checks configuration
2. Uploads source code
3. Increments build number (27 → 28)
4. Builds on EAS servers
5. Generates .ipa file

### Step 2: Monitor Progress

```bash
# Check build status
eas build:list

# View build logs
# Click the build link shown in terminal
# Or visit: https://expo.dev/accounts/maak-tech/projects/maak-app/builds
```

**Expected Timeline:**
- 🔄 Queue: 0-5 minutes
- 🏗️ Build: 10-20 minutes
- ✅ Complete: ~15-25 minutes total

### Step 3: Download Build

Once complete:
1. Visit EAS dashboard
2. Find your build (#28)
3. Click "Download" for .ipa file
4. Or use CLI: `eas build:download --platform ios`

---

## 📱 Testing the Build

### Install on Physical Device

#### Method 1: Via EAS (Recommended)

```bash
# Generate a shareable link
eas build:share

# Share link to test devices
# Users can install directly from browser
```

#### Method 2: Via Xcode

1. Open Xcode
2. Window → Devices and Simulators
3. Drag .ipa file onto device
4. App installs automatically

#### Method 3: Via TestFlight

```bash
# Submit to TestFlight
eas submit -p ios --profile production

# Or use npm script
# (if defined in package.json)
```

### Verification Tests

After installation:

- [ ] App launches successfully
- [ ] Login works
- [ ] Health events show real data
- [ ] Member names display on alerts
- [ ] Emergency alerts load
- [ ] All action buttons work
- [ ] No crashes observed
- [ ] Performance feels smooth

---

## 🐛 Troubleshooting

### Common Issues

#### Build Fails: "Provisioning Profile Error"

**Solution:**
```bash
# Regenerate credentials
eas credentials

# Or let EAS manage automatically
eas build -p ios --profile production --auto-submit
```

#### Build Fails: "Missing GoogleService-Info.plist"

**Solution:**
1. Check file exists in project root
2. Verify EAS secret: `GOOGLE_SERVICE_INFO_PLIST`
3. Re-encode file:
   ```bash
   base64 -i GoogleService-Info.plist
   # Add output to EAS secret
   ```

#### Build Fails: "Native Module Error"

**Solution:**
```bash
# Clear EAS cache
eas build -p ios --profile production --clear-cache

# Or locally
expo prebuild --clean
```

#### Build Succeeds but App Crashes

**Check:**
1. Device logs in Xcode
2. Firebase Crashlytics
3. EAS build logs for warnings

**Common Causes:**
- Missing native dependencies
- Invalid API keys
- Permissions not granted

---

## 📊 Build Verification

### After Build Completes

Check EAS dashboard for:

- ✅ **Status:** Build completed
- ✅ **Size:** ~50-80 MB typical
- ✅ **Build Time:** 10-25 minutes
- ✅ **Warnings:** None or minimal

### Download & Inspect

```bash
# Download the .ipa
eas build:download --platform ios

# Check file size
ls -lh *.ipa

# Extract and inspect (optional)
unzip -l your-app.ipa | head -20
```

---

## 🚢 App Store Submission

### Step 1: Submit to TestFlight

```bash
# Submit build
eas submit -p ios --profile production

# Or manually:
# 1. Download .ipa
# 2. Open Xcode → Organizer
# 3. Distribute App → App Store Connect
```

### Step 2: Configure in App Store Connect

1. Visit: https://appstoreconnect.apple.com
2. Select "Maak Health"
3. Add build to new version
4. Fill in:
   - What's New (use BUILD_28_CHANGELOG.md)
   - Screenshots (if changed)
   - Keywords and description
   - Privacy information

### Step 3: Submit for Review

- [ ] Select build 28
- [ ] Add release notes
- [ ] Set release date
- [ ] Submit for review

**Review Time:** Typically 24-48 hours

---

## 📈 Post-Release

### Day 1 Monitoring

- [ ] Check TestFlight crash reports
- [ ] Monitor Firebase Crashlytics
- [ ] Review user feedback
- [ ] Check performance metrics

### Week 1 Monitoring

- [ ] Analyze adoption rate
- [ ] Review feature usage
- [ ] Check error rates
- [ ] Collect user feedback

### Success Metrics

- **Crash-free rate:** > 99.5%
- **Load times:** < 500ms
- **Error rate:** < 1%
- **User rating:** > 4.5 stars

---

## 🔄 Rollback Plan

If critical issues found:

### Option 1: Hot Fix
```bash
# Fix the issue
# Increment to build 29
npm run build:ios:production
```

### Option 2: Revert in App Store Connect
1. Remove build 28 from release
2. Select previous stable build
3. Submit updated version

---

## 📚 Reference

### Important Links

- **EAS Dashboard:** https://expo.dev/accounts/maak-tech/projects/maak-app
- **App Store Connect:** https://appstoreconnect.apple.com
- **Firebase Console:** https://console.firebase.google.com/project/maak-5caad
- **Expo Docs:** https://docs.expo.dev/eas

### Build Scripts Reference

```json
{
  "build:ios:dev": "Development build with dev client",
  "build:ios:preview": "Preview build for testing",
  "build:ios:production": "Production build for App Store",
  "build:list": "List all builds",
}
```

### Environment Variables Needed

```bash
OPENAI_API_KEY=sk_...
ZEINA_API_KEY=sk_...
REVENUECAT_API_KEY=...
FITBIT_CLIENT_ID=...
# ... other service credentials
```

---

## ✅ Final Checklist

Before building:

- [ ] All code committed and pushed
- [ ] Version/build number updated
- [ ] Environment variables set
- [ ] Firebase indexes deployed
- [ ] Documentation updated
- [ ] Tests passing
- [ ] No linting errors

During build:

- [ ] Build starts successfully
- [ ] No errors in build logs
- [ ] Build completes (15-25 min)
- [ ] .ipa file generated

After build:

- [ ] Download and test .ipa
- [ ] Install on physical device
- [ ] Verify all features work
- [ ] Submit to TestFlight
- [ ] Monitor for issues

---

**Last Updated:** 2026-01-13  
**Current Build:** 28  
**Status:** Ready to Build 🚀
