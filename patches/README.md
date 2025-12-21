# Patches

This directory contains patches applied to node_modules using [patch-package](https://github.com/ds300/patch-package).

## react-native+0.81.5.patch

**Issue**: PushNotificationIOS causes `NativeEventEmitter requires a non-null argument` error in Expo development builds.

**Root Cause**: React Native's `index.js` has a lazy getter for `PushNotificationIOS` that tries to load the native module, which doesn't exist in Expo. This happens before Metro can intercept the import with our polyfill.

**Solution**: Directly patch React Native's `index.js` to return a polyfill object instead of requiring the native module. This prevents the NativeEventEmitter error and allows notifications to work via expo-notifications.

**When this patch is applied**: Automatically on `npm install` via the `postinstall` script in `package.json`.

**To regenerate this patch**:
1. Make changes to `node_modules/react-native/index.js`
2. Run `npx patch-package react-native`

**Note**: This patch is necessary because:
- Expo doesn't include PushNotificationIOS native module
- Metro's resolver can't intercept lazy getters in React Native's index.js
- The polyfill in `lib/polyfills/pushNotificationIOS.js` and Metro config aren't sufficient alone

