# Patches

This directory contains patches applied to node_modules using [patch-package](https://github.com/ds300/patch-package).

## react-native+0.81.5.patch

**Issue**: PushNotificationIOS causes `NativeEventEmitter requires a non-null argument` error in Expo development builds.

**Root Cause**: React Native's `index.js` has a lazy getter for `PushNotificationIOS` that tries to load the native module, which doesn't exist in Expo. This happens before Metro can intercept the import with our polyfill. Additionally, Expo's `importAll` function eagerly accesses all exports, including the `.default` property.

**Solution**: Directly patch React Native's `index.js` to return a polyfill object instead of requiring the native module. The polyfill includes:
- All PushNotificationIOS methods as no-op functions
- A `polyfill.default = polyfill` assignment so the object references itself as the default export
- This prevents both the NativeEventEmitter error and the "Cannot read property 'default' of undefined" error

**When this patch is applied**: Automatically on `npm install` or `bun install` via the `postinstall` script in `package.json`.

**To regenerate this patch**:
1. Make changes to `node_modules/react-native/index.js`
2. Run `npx patch-package react-native`

**Important Notes**:
- Expo doesn't include PushNotificationIOS native module
- Metro's resolver can't intercept lazy getters in React Native's index.js
- Expo's `importAll` function accesses all exports, requiring proper `default` property
- The polyfill in `lib/polyfills/pushNotificationIOS.js` and Metro config aren't sufficient alone
- This allows the app to use expo-notifications for all notification functionality

