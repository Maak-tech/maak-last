# Testing Guide for App Store Fixes

This guide provides step-by-step instructions to test all the fixes implemented for App Store compliance.

## Prerequisites

- **iOS Device Required**: ATT (App Tracking Transparency) only works on real iOS devices, not simulators
- **TestFlight Build**: Recommended to test with a TestFlight build or development build
- **Fresh Install**: For ATT testing, you may need to delete and reinstall the app

---

## ✅ Test 1: ATT Permission Dialog Appears on First Launch

### Steps:
1. **Delete the app** from your iOS device (if already installed)
2. **Install fresh** via TestFlight or development build
3. **Launch the app** for the first time
4. **Wait for app to become active** (after splash screen)

### Expected Result:
- ✅ ATT permission dialog should appear automatically
- ✅ Dialog shows message: "Maak Health uses tracking to provide personalized health insights and recommendations..."
- ✅ Dialog has two options: "Allow" and "Ask App Not to Track"

### Verification:
- Check logs in Xcode/console for: `"Tracking permission requested"` message
- Dialog appears without user interaction needed

### Code Location:
- `app/_layout.tsx` lines 136-149
- `lib/services/trackingTransparencyService.ts`

---

## ✅ Test 2: ATT Permission Respects User Choice

### Steps:
1. **Test "Allow" option:**
   - Tap "Allow" when ATT dialog appears
   - App should continue normally
   - Check that tracking can proceed (if applicable)

2. **Test "Ask App Not to Track" option:**
   - Delete and reinstall app
   - Launch app again
   - Tap "Ask App Not to Track"
   - App should continue normally
   - Verify app respects the denial (no tracking should occur)

### Expected Result:
- ✅ App continues normally regardless of user choice
- ✅ No crashes or errors
- ✅ App respects the user's decision

### Verification:
- Check permission status using: `getTrackingPermissionStatus()` from tracking transparency service
- Status should be "authorized" if allowed, "denied" if not allowed

---

## ✅ Test 3: Verify UIBackgroundModes Only Contains "processing"

### Steps:
1. **Check app.config.js:**
   - Open `app.config.js`
   - Navigate to line 197
   - Verify: `UIBackgroundModes: ["processing"]`

2. **Check built Info.plist:**
   - Build the app for iOS
   - Extract the `.app` bundle
   - Open `Info.plist` file
   - Check `UIBackgroundModes` array

### Expected Result:
- ✅ `UIBackgroundModes` array contains ONLY `"processing"`
- ✅ `"location"` is NOT present in the array
- ✅ No other background modes unless necessary

### Verification:
```javascript
// In app.config.js line 197, should be:
UIBackgroundModes: ["processing"]
```

---

## ✅ Test 4: Terms of Use Link Navigates Correctly

### Steps:
1. **Open subscription paywall:**
   - Navigate to Family screen (or any feature that shows paywall)
   - Tap on upgrade/subscribe button
   - Paywall should appear

2. **Find Terms link:**
   - Scroll to bottom of paywall
   - Look for "Terms of Use" link

3. **Test navigation:**
   - Tap "Terms of Use" link
   - Should navigate to Terms & Conditions screen

### Expected Result:
- ✅ Link is visible at bottom of paywall
- ✅ Tapping link navigates to `/profile/terms-conditions`
- ✅ Terms & Conditions screen loads correctly
- ✅ Content displays properly

### Verification:
- Check `components/RevenueCatPaywall.tsx` line 84-85
- Route should be: `router.push("/profile/terms-conditions")`

---

## ✅ Test 5: Privacy Policy Link Navigates Correctly

### Steps:
1. **Open subscription paywall:**
   - Navigate to Family screen (or any feature that shows paywall)
   - Tap on upgrade/subscribe button
   - Paywall should appear

2. **Find Privacy link:**
   - Scroll to bottom of paywall
   - Look for "Privacy Policy" link

3. **Test navigation:**
   - Tap "Privacy Policy" link
   - Should navigate to Privacy Policy screen

### Expected Result:
- ✅ Link is visible at bottom of paywall
- ✅ Tapping link navigates to `/profile/privacy-policy`
- ✅ Privacy Policy screen loads correctly
- ✅ Content displays properly

### Verification:
- Check `components/RevenueCatPaywall.tsx` line 88-89
- Route should be: `router.push("/profile/privacy-policy")`

---

## ✅ Test 6: Verify Links Are Visible in Subscription Paywall

### Steps:
1. **Open any subscription paywall:**
   - Go to Family screen → Try to add member (if no premium)
   - Or go to any FeatureGate → Try to access premium feature
   - Or navigate directly to subscription screen

2. **Check visibility:**
   - Scroll to bottom of paywall
   - Look for links container

### Expected Result:
- ✅ Links container is visible at bottom
- ✅ "Terms of Use" link is visible
- ✅ Separator (•) is visible between links
- ✅ "Privacy Policy" link is visible
- ✅ Links are styled correctly (blue, underlined)
- ✅ Links are tappable/clickable

### Verification:
- Check `components/RevenueCatPaywall.tsx` lines 156-172
- Links should be in a `View` with `styles.linksContainer`

---

## ✅ Test 7: Test RTL (Arabic) Layout for Links

### Steps:
1. **Change app language to Arabic:**
   - Go to Profile → Settings → Language
   - Select Arabic (العربية)
   - Or change device language to Arabic

2. **Open subscription paywall:**
   - Navigate to subscription paywall
   - Scroll to bottom

3. **Check RTL layout:**
   - Verify links are displayed right-to-left
   - Check Arabic text: "الشروط والأحكام" and "سياسة الخصوصية"
   - Verify separator position is correct

### Expected Result:
- ✅ Links container uses RTL layout (`flexDirection: "row-reverse"`)
- ✅ Arabic text displays correctly
- ✅ Links are readable and properly aligned
- ✅ Separator position is correct for RTL

### Verification:
- Check `components/RevenueCatPaywall.tsx` line 37: `const isRTL = i18n.language === "ar";`
- Check line 157: `style={[styles.linksContainer, isRTL && styles.linksContainerRTL]}`
- Arabic text: lines 160 and 169

---

## ✅ Test 8: Verify Terms and Privacy Policy Documents Load Correctly

### Steps:
1. **Test Terms & Conditions:**
   - Navigate to `/profile/terms-conditions`
   - Wait for document to load
   - Scroll through content

2. **Test Privacy Policy:**
   - Navigate to `/profile/privacy-policy`
   - Wait for document to load
   - Scroll through content

### Expected Result:
- ✅ Both screens load without errors
- ✅ Documents display correctly
- ✅ Content is readable and formatted properly
- ✅ Sections are properly structured
- ✅ No blank screens or error messages
- ✅ Loading indicator shows while loading
- ✅ Last updated date displays (if available)

### Verification:
- Check `app/profile/terms-conditions.tsx`
- Check `app/profile/privacy-policy.tsx`
- Check `lib/services/documentService.ts` loads documents correctly
- Documents are loaded from `assets/docs/` directory

---

## Quick Test Checklist

Use this checklist when testing:

```
[ ] ATT dialog appears on first launch (iOS device only)
[ ] ATT "Allow" option works correctly
[ ] ATT "Ask App Not to Track" option works correctly
[ ] UIBackgroundModes only contains "processing"
[ ] Terms of Use link visible in paywall
[ ] Terms of Use link navigates correctly
[ ] Privacy Policy link visible in paywall
[ ] Privacy Policy link navigates correctly
[ ] Links visible in English layout
[ ] Links visible in Arabic (RTL) layout
[ ] Terms document loads correctly
[ ] Privacy Policy document loads correctly
[ ] No crashes or errors during testing
```

---

## Troubleshooting

### ATT Dialog Not Appearing:
- **Issue**: Dialog doesn't show on first launch
- **Solution**: 
  - Make sure you're testing on a real iOS device (not simulator)
  - Delete app completely and reinstall
  - Check that `expo-tracking-transparency` is installed
  - Verify `NSUserTrackingUsageDescription` is in app.config.js

### Links Not Visible:
- **Issue**: Terms/Privacy links not showing in paywall
- **Solution**:
  - Check that RevenueCat Paywall is rendering
  - Scroll to bottom of paywall
  - Verify `components/RevenueCatPaywall.tsx` has the links container
  - Check console for any errors

### Navigation Not Working:
- **Issue**: Tapping links doesn't navigate
- **Solution**:
  - Verify routes exist: `/profile/terms-conditions` and `/profile/privacy-policy`
  - Check `app/profile/_layout.tsx` includes these routes
  - Verify router is imported correctly

### Documents Not Loading:
- **Issue**: Terms/Privacy screens show errors
- **Solution**:
  - Check `lib/services/documentService.ts` is working
  - Verify `assets/docs/terms-conditions.js` and `privacy-policy.js` exist
  - Check console for loading errors

---

## Testing on Different Scenarios

### Scenario 1: First-Time User
- Fresh install
- No previous permissions
- ATT dialog should appear
- Subscription paywall should show links

### Scenario 2: Returning User
- App already installed
- ATT already answered
- Subscription paywall should still show links
- Terms/Privacy should be accessible

### Scenario 3: Premium User
- User already has subscription
- Links should still be accessible from profile settings
- Terms/Privacy screens should work

---

## Notes for App Store Review

When submitting to App Store, include in Review Notes:

1. **ATT Implementation**: "ATT permission is requested in app/_layout.tsx when app becomes active. Permission dialog appears automatically on first launch."

2. **UIBackgroundModes**: "UIBackgroundModes contains only 'processing' for background fall detection. Location background mode has been removed as it's not needed."

3. **Subscription Links**: "Terms of Use and Privacy Policy links are displayed at the bottom of the subscription paywall (components/RevenueCatPaywall.tsx). Links navigate to /profile/terms-conditions and /profile/privacy-policy screens."

---

## Success Criteria

All tests pass if:
- ✅ ATT dialog appears and works correctly
- ✅ UIBackgroundModes is correct
- ✅ Both links are visible and functional
- ✅ Navigation works correctly
- ✅ Documents load properly
- ✅ RTL layout works
- ✅ No crashes or errors
