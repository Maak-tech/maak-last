# 🔥 Firebase Troubleshooting Guide

## Quick Diagnostic Steps

### 1. **Check Firebase Configuration**

Run the Firebase setup check:
```bash
npm run firebase:check
```

### 2. **Test in App**

Navigate to the Firebase test screen in your app:
- Open the app
- Go to `/firebase-test` route
- Click "Run Permission Tests"
- Review the test results

### 3. **Check Console Logs**

Look for Firebase initialization errors:
- Open React Native Debugger or Metro logs
- Check for red error messages about Firebase
- Look for "Firebase initialization failed" messages

---

## Common Issues & Solutions

### ❌ Issue 1: "Firebase initialization failed"

**Symptoms:**
- App crashes on startup
- Firebase operations don't work
- Console shows initialization errors

**Causes & Fixes:**

#### A. Wrong App ID for Platform
**Problem:** Using web app ID on iOS/Android

**Solution:** ✅ **FIXED** - The config now uses platform-specific app IDs:
- iOS: `1:827176918437:ios:d950be8afe2055279b1c4c`
- Android: `1:827176918437:android:2fdd3c9e662310e69b1c4c`
- Web: `1:827176918437:web:356fe7e2b4ecb3b99b1c4c`

#### B. GoogleService-Info.plist Not Found
**Problem:** File not in project root or not included in build

**Check:**
```bash
# Verify file exists
ls GoogleService-Info.plist
ls google-services.json
```

**Fix:**
1. Ensure files are in project root (same level as `package.json`)
2. Verify `app.json` has:
   ```json
   "ios": {
     "googleServicesFile": "./GoogleService-Info.plist"
   },
   "android": {
     "googleServicesFile": "./google-services.json"
   }
   ```
3. **Rebuild the app** (files are copied during build):
   ```bash
   npm run build:ios:dev
   ```

#### C. Bundle ID Mismatch
**Problem:** Bundle ID in config doesn't match app.json

**Check:**
- `app.json` → `ios.bundleIdentifier`: `com.maak.health`
- `GoogleService-Info.plist` → `BUNDLE_ID`: `com.maak.health`
- `google-services.json` → `package_name`: `com.maak.health`

**Fix:** All should match `com.maak.health` ✅

---

### ❌ Issue 2: "Permission Denied" Errors

**Symptoms:**
- Can read data but can't write
- Firestore queries fail
- "Missing or insufficient permissions" errors

**Causes & Fixes:**

#### A. Firestore Rules Too Restrictive
**Check:** Open Firebase Console → Firestore Database → Rules

**Fix:** Ensure rules allow authenticated users:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

#### B. User Not Authenticated
**Check:** Verify user is logged in:
```typescript
import { auth } from "@/lib/firebase";
console.log("Current user:", auth.currentUser);
```

**Fix:** Ensure user signs in before accessing Firestore

---

### ❌ Issue 3: Analytics Not Working

**Symptoms:**
- Analytics events not showing in Firebase Console
- Analytics returns `undefined`

**Causes & Fixes:**

#### A. Analytics Disabled in Config
**Problem:** `IS_ANALYTICS_ENABLED` is `false` in `GoogleService-Info.plist`

**Check:**
```xml
<key>IS_ANALYTICS_ENABLED</key>
<false></false>  <!-- Should be <true></true> -->
```

**Fix:**
1. Go to Firebase Console
2. Project Settings → Your iOS App
3. Re-download `GoogleService-Info.plist` with Analytics enabled
4. Replace the file in your project root
5. Rebuild the app

#### B. Analytics Only Works on Web
**Problem:** Trying to use Analytics on iOS/Android

**Note:** Firebase Analytics in JavaScript SDK only works on **web**. For native analytics:
- Use Firebase Analytics native SDK (requires native modules)
- Or use Expo Analytics alternatives

**Current Setup:** Analytics is configured for web only ✅

---

### ❌ Issue 4: Push Notifications Not Working

**Symptoms:**
- Notifications not received
- FCM token not generated

**Causes & Fixes:**

#### A. APNs Not Configured
**Problem:** Apple Push Notification service not set up

**Fix:**
1. Go to Apple Developer Portal
2. Create APNs Key or Certificate
3. Upload to Firebase Console → Project Settings → Cloud Messaging
4. Rebuild app

#### B. FCM Not Initialized
**Check:** Verify FCM is enabled in config:
```xml
<key>IS_GCM_ENABLED</key>
<true></true>  <!-- Should be true -->
```

**Fix:** Ensure `GoogleService-Info.plist` has `IS_GCM_ENABLED` set to `true` ✅

---

### ❌ Issue 5: Build Errors

**Symptoms:**
- EAS build fails
- "GoogleService-Info.plist not found" error

**Fix:**
1. Verify files are in project root (not in `ios/` folder)
2. Check `.gitignore` - files should be ignored but present locally
3. Ensure `app.json` references the files correctly
4. Try clearing cache:
   ```bash
   npm run dev:clear
   eas build --clear-cache
   ```

---

## Advanced Debugging

### Check Firebase App Initialization

Add this to your app startup (e.g., `app/_layout.tsx`):

```typescript
import { app } from "@/lib/firebase";
import { Platform } from "react-native";

if (__DEV__) {
  console.log("🔥 Firebase initialized:", {
    platform: Platform.OS,
    projectId: app.options.projectId,
    appId: app.options.appId,
  });
}
```

### Verify Native Config Files Are Included

After building, check the build logs for:
```
✔ Copied GoogleService-Info.plist
✔ Copied google-services.json
```

### Test Firebase Connection

Use the Firebase test screen:
1. Navigate to `/firebase-test` in your app
2. Click "Run Permission Tests"
3. Review all test results
4. Check for any ❌ errors

---

## Platform-Specific Notes

### iOS
- ✅ Uses `GoogleService-Info.plist` automatically
- ✅ Native Firebase SDK reads from plist file
- ✅ JavaScript SDK uses config from `lib/firebase.ts`
- ⚠️ Analytics requires native module (not currently set up)

### Android
- ✅ Uses `google-services.json` automatically
- ✅ Native Firebase SDK reads from JSON file
- ✅ JavaScript SDK uses config from `lib/firebase.ts`

### Web
- ✅ Uses JavaScript SDK config only
- ✅ Analytics works natively
- ✅ No native config files needed

---

## Still Not Working?

### Step-by-Step Debugging:

1. **Verify Files Exist:**
   ```bash
   ls -la GoogleService-Info.plist google-services.json
   ```

2. **Check app.json Configuration:**
   ```bash
   cat app.json | grep -A 2 googleServicesFile
   ```

3. **Run Firebase Check:**
   ```bash
   npm run firebase:check
   ```

4. **Test in App:**
   - Open `/firebase-test` route
   - Run permission tests
   - Check console logs

5. **Check Firebase Console:**
   - Go to Firebase Console
   - Project Settings → Your Apps
   - Verify bundle IDs match
   - Check if apps are registered

6. **Rebuild Clean:**
   ```bash
   npm run dev:clear
   eas build -p ios --profile development --clear-cache
   ```

---

## Quick Reference

### File Locations:
- `GoogleService-Info.plist` → Project root
- `google-services.json` → Project root
- `lib/firebase.ts` → Firebase JavaScript config

### Important IDs:
- **Project ID:** `maak-5caad`
- **Bundle ID:** `com.maak.health`
- **iOS App ID:** `1:827176918437:ios:d950be8afe2055279b1c4c`
- **Android App ID:** `1:827176918437:android:2fdd3c9e662310e69b1c4c`
- **Web App ID:** `1:827176918437:web:356fe7e2b4ecb3b99b1c4c`

### Commands:
```bash
# Check Firebase setup
npm run firebase:check

# Clear cache and rebuild
npm run dev:clear
npm run build:ios:dev

# Test Firebase in app
# Navigate to /firebase-test route
```

---

**Last Updated:** December 23, 2025  
**Status:** ✅ Platform-specific configs implemented



