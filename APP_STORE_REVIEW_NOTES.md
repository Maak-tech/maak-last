# App Store Review Notes - App Tracking Transparency

## Implementation Summary

This app now implements **App Tracking Transparency (ATT)** framework as required by Apple's App Store guidelines.

### Where the Permission Request is Located

The ATT permission request is implemented in the app's root layout file (`app/_layout.tsx`). The permission dialog is automatically requested when the app becomes active for the first time after installation.

**Location in Code:**
- File: `app/_layout.tsx`
- Function: `initializeTracking()` within the `useEffect` hook (lines ~136-147)
- Service: `lib/services/trackingTransparencyService.ts`

### How It Works

1. **On App Launch**: When the app becomes active, it automatically checks if ATT permission has been requested
2. **Permission Dialog**: If permission hasn't been determined yet, the system shows the ATT permission dialog with the custom message defined in `NSUserTrackingUsageDescription`
3. **User Choice**: The user can choose to "Allow" or "Ask App Not to Track"
4. **Respect User Choice**: The app respects the user's choice and only collects tracking data if permission is granted

### Permission Message

The permission dialog displays the following message (defined in `app.config.js`):

> "Maak Health uses tracking to provide personalized health insights and recommendations. This helps us improve your health tracking experience and deliver relevant health information. Your health data remains secure and is never sold to third parties."

### Testing Instructions for App Review

1. **First Launch**: Install the app on a fresh device (or delete and reinstall)
2. **Permission Dialog**: The ATT permission dialog should appear automatically when the app becomes active
3. **Test Both Options**: 
   - Tap "Allow" - verify app continues normally
   - Tap "Ask App Not to Track" - verify app continues normally and respects the choice
4. **Subsequent Launches**: The dialog will not appear again (as per iOS behavior)

### Technical Details

- **Framework**: Uses `expo-tracking-transparency` package
- **Platform**: iOS only (Android doesn't require ATT)
- **Timing**: Permission is requested early in app lifecycle, before any tracking data collection
- **Error Handling**: Non-blocking implementation - app continues normally even if permission request fails

### Compliance

✅ ATT permission is requested before collecting any tracking data  
✅ User's choice is respected  
✅ Permission status is checked before any tracking operations  
✅ Custom permission message explains why tracking is needed  

---

## UIBackgroundModes Fix

### Issue Resolved
The app previously declared "location" in `UIBackgroundModes` but did not use persistent background location updates. This has been fixed.

### Changes Made
- **Removed** "location" from `UIBackgroundModes` in `app.config.js`
- **Kept** "processing" mode for background fall detection processing
- Location permission (`NSLocationWhenInUseUsageDescription`) remains for one-time location requests when needed (e.g., sharing location during fall alerts)

### Technical Details
- The app uses motion sensors (DeviceMotion) for fall detection, not location services
- Location is only needed "when in use" for sharing location during emergency alerts, not for persistent background tracking
- Background location mode is not required for this use case

---

## Subscription Terms and Privacy Policy Links

### Issue Resolved
The app now includes functional links to Terms of Use (EULA) and Privacy Policy within the subscription purchase flow, as required by Apple's guidelines for apps offering auto-renewable subscriptions.

### Implementation Details

**Location in Code:**
- File: `components/RevenueCatPaywall.tsx`
- Links are displayed at the bottom of the paywall screen (lines ~145-165)

**How It Works:**
1. **Terms of Use Link**: Navigates to `/profile/terms-conditions` screen
2. **Privacy Policy Link**: Navigates to `/profile/privacy-policy` screen
3. Both links are displayed below the RevenueCat Paywall UI
4. Links are functional and accessible during the subscription purchase flow

**Links Location:**
- The links appear at the bottom of the subscription paywall screen
- They are visible before, during, and after the purchase flow
- Users can tap these links to view the full Terms of Use and Privacy Policy documents

**Testing Instructions:**
1. Open the subscription paywall (e.g., from Family screen or FeatureGate)
2. Scroll to the bottom of the paywall
3. Verify "Terms of Use" and "Privacy Policy" links are visible
4. Tap each link to verify they navigate to the respective screens
5. Verify the Terms and Privacy Policy documents load correctly

### App Store Connect Metadata Requirements

**Required in App Store Connect:**
1. **Privacy Policy URL**: Must be added in the "Privacy Policy URL" field in App Store Connect
2. **Terms of Use (EULA)**: 
   - If using standard Apple EULA: Include link in App Description
   - If using custom EULA: Add it in the "EULA" field in App Store Connect

**Recommended URLs for App Store Connect:**
- Privacy Policy: `https://maak.app/privacy-policy` (or your hosted URL)
- Terms of Use: `https://maak.app/terms-conditions` (or your hosted URL)

---

**Note**: If your app does not actually track users (link data with third-party data for advertising or share with data brokers), you should update your App Store Connect privacy information to reflect that the app does not track users. The ATT implementation is only required if you actually track users as defined by Apple.
