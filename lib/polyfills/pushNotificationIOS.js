// Polyfill for PushNotificationIOS to prevent errors in development builds
// React Native tries to auto-load this module, but it's not available in Expo development builds
// We use expo-notifications instead

// This polyfill prevents the "NativeEventEmitter requires a non-null argument" error
// by providing a mock implementation before React Native tries to load the real module

try {
  // Mock NativeModules.PushNotificationManager to prevent errors
  const ReactNative = require('react-native');
  if (ReactNative.NativeModules && !ReactNative.NativeModules.PushNotificationManager) {
    ReactNative.NativeModules.PushNotificationManager = {
      requestPermissions: () => Promise.resolve({}),
      addEventListener: () => {},
      removeEventListener: () => {},
      removeAllListeners: () => {},
    };
  }
} catch (e) {
  // Silently fail if React Native isn't available yet
}

// Export empty object to satisfy module requirements
module.exports = {};

