// Polyfill for PushNotificationIOS to prevent errors in development builds
// React Native tries to auto-load this module, but it's not available in Expo development builds
// We use expo-notifications instead
//
// This module replaces react-native/Libraries/PushNotificationIOS/PushNotificationIOS
// to prevent the "NativeEventEmitter requires a non-null argument" error

// Create a mock event emitter that won't crash
const eventEmitter = {
  addListener: () => ({ remove: () => {} }),
  removeListener: () => {},
  removeAllListeners: () => {},
};

// Create the PushNotificationIOS mock object
const PushNotificationIOS = {
  requestPermissions: (permissions) =>
    Promise.resolve({
      alert: true,
      badge: true,
      sound: true,
    }),
  addEventListener: (type, handler) => eventEmitter.addListener(type, handler),
  removeEventListener: (type, handler) => {
    eventEmitter.removeListener(type, handler);
  },
  removeAllListeners: (type) => {
    eventEmitter.removeAllListeners(type);
  },
  getInitialNotification: () => Promise.resolve(null),
  setApplicationIconBadgeNumber: (number) => {
    // No-op in development builds
  },
  getApplicationIconBadgeNumber: (callback) => {
    if (callback) callback(0);
  },
  presentLocalNotification: (notification) => {
    // No-op in development builds
  },
  scheduleLocalNotification: (notification) => {
    // No-op in development builds
  },
  cancelLocalNotifications: (userInfo) => {
    // No-op in development builds
  },
  cancelAllLocalNotifications: () => {
    // No-op in development builds
  },
  getScheduledLocalNotifications: (callback) => {
    if (callback) callback([]);
  },
  removeAllDeliveredNotifications: () => {
    // No-op in development builds
  },
  removeDeliveredNotifications: (identifiers) => {
    // No-op in development builds
  },
  getDeliveredNotifications: (callback) => {
    if (callback) callback([]);
  },
};

// Export for CommonJS (module.exports)
// Set both the module.exports and default property to handle all import styles
// This ensures compatibility with:
// - require('PushNotificationIOS') -> CommonJS
// - import PushNotificationIOS from 'PushNotificationIOS' -> ES modules
// - Expo's async require which may access .default
module.exports = PushNotificationIOS;
module.exports.default = PushNotificationIOS;

// Also handle ES module interop and ensure default is always available
if (typeof exports !== "undefined") {
  exports.default = PushNotificationIOS;
}

// For ES module compatibility, also set __esModule flag
if (typeof module !== "undefined" && module.exports) {
  module.exports.__esModule = true;
}
