const path = require("node:path");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

// Fix for Firebase + Expo SDK 53 "Component auth has not been registered yet" error
config.resolver.sourceExts.push("cjs");
config.resolver.unstable_enablePackageExports = false;

// Only essential configurations for production stability
config.transformer.unstable_allowRequireContext = true;

// Replace PushNotificationIOS with our polyfill to prevent NativeEventEmitter errors
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept PushNotificationIOS module from specific React Native import paths only
  // Be very specific to avoid accidentally intercepting other modules
  if (
    moduleName === "@react-native/push-notification-ios" ||
    moduleName ===
      "react-native/Libraries/PushNotificationIOS/PushNotificationIOS" ||
    moduleName === "react-native/Libraries/PushNotificationIOS"
  ) {
    return {
      filePath: path.resolve(__dirname, "lib/polyfills/pushNotificationIOS.js"),
      type: "sourceFile",
    };
  }

  // Use Metro's default resolver for everything else
  // Call Metro's default resolution strategy instead of context.resolveRequest
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
