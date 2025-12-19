# Firebase Production Setup Guide

## Step 1: Re-authenticate Firebase CLI
```bash
firebase login --reauth
```
This will open a browser window. Sign in with your Google account that has access to the Firebase project.

## Step 2: Verify Firebase Project
```bash
firebase projects:list
firebase use maak-5caad
```

## Step 3: Create Android Configuration
```bash
firebase setup:android
```
When prompted:
- **Package name**: `com.maak.health`
- **Debug SHA-1**: Press Enter (skip for now)

This will create `google-services.json` file. Make sure it's placed in the project root.

## Step 4: Verify iOS Configuration
```bash
firebase setup:ios
```
When prompted:
- **Bundle ID**: `com.maak.health`
- This should update your existing `GoogleService-Info.plist`

## Step 5: Deploy Latest Functions (if any changes)
```bash
cd functions
npm run build
firebase deploy --only functions
cd ..
```

## Step 6: Test Firebase Connection
```bash
# Test Firebase connection
npm run firebase:check
```

## Troubleshooting

If you get authentication errors:
```bash
firebase logout
firebase login
```

If you need to re-setup the project:
```bash
firebase use --add
# Select maak-5caad and set as default
```

## Required Files After Setup
- ✅ `google-services.json` (for Android)  
- ✅ `GoogleService-Info.plist` (for iOS)
- ✅ `.firebaserc` (project config)
- ✅ `firebase.json` (service config)

## Firebase Project Details
- **Project ID**: maak-5caad
- **iOS Bundle ID**: com.maak.health
- **Android Package**: com.maak.health