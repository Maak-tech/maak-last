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

// Export the same API as PushNotificationIOS
// This is a safe mock that doesn't try to create NativeEventEmitter
module.exports = {
  requestPermissions: (permissions) => {
    return Promise.resolve({
      alert: true,
      badge: true,
      sound: true,
    });
  },
  addEventListener: (type, handler) => {
    return eventEmitter.addListener(type, handler);
  },
  removeEventListener: (type, handler) => {
    eventEmitter.removeListener(type, handler);
  },
  removeAllListeners: (type) => {
    eventEmitter.removeAllListeners(type);
  },
  getInitialNotification: () => {
    return Promise.resolve(null);
  },
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

