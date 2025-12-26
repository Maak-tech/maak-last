# Biometric Authentication - Rebuild Instructions

## Issue: "Cannot find native module 'expobrightness'"

This error occurs because `expo-brightness` is a native module that requires rebuilding the development client.

## Solution: Rebuild Development Client

### For iOS:

```bash
# Option 1: Using EAS Build (Recommended)
npm run build:ios:dev

# Option 2: Using Expo CLI (Local)
npx expo run:ios
```

### For Android:

```bash
# Option 1: Using EAS Build (Recommended)
eas build -p android --profile development

# Option 2: Using Expo CLI (Local)
npx expo run:android
```

## After Rebuild:

1. Install the new development build on your device
2. Restart the Metro bundler: `npm run dev`
3. The biometric authentication should now work

## Note:

The component has been updated with error handling, so it will continue to work even if brightness control isn't available (though PPG accuracy may be slightly reduced without maximum screen brightness).

## Quick Test:

After rebuilding, test the biometric authentication:
1. Go to Profile → Settings → Biometric Authentication
2. Enroll your biometrics
3. Try logging in with biometrics

