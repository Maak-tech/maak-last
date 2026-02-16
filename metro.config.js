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
const pushNotificationPolyfillPath = path.resolve(
  __dirname,
  "lib/polyfills/pushNotificationIOS.js"
);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept PushNotificationIOS - react-native uses relative require from its index.js
  const isPushNotificationIOS =
    moduleName === "@react-native/push-notification-ios" ||
    moduleName ===
      "react-native/Libraries/PushNotificationIOS/PushNotificationIOS" ||
    moduleName === "react-native/Libraries/PushNotificationIOS" ||
    moduleName === "./Libraries/PushNotificationIOS/PushNotificationIOS" ||
    moduleName === "./Libraries/PushNotificationIOS";
  if (isPushNotificationIOS) {
    return {
      filePath: pushNotificationPolyfillPath,
      type: "sourceFile",
    };
  }

  // Exclude expo-dev-client modules in non-dev bundles.
  // Metro's context.dev is the most reliable signal across EAS build/update pipelines.
  const isDevBundle =
    typeof context.dev === "boolean"
      ? context.dev
      : process.env.NODE_ENV !== "production" &&
        process.env.BABEL_ENV !== "production" &&
        process.env.EXPO_PUBLIC_ENVIRONMENT !== "production";
  if (!isDevBundle) {
    const isDevelopmentModule =
      moduleName === "expo-dev-client" ||
      moduleName === "expo-dev-launcher" ||
      moduleName === "expo-dev-menu" ||
      moduleName === "expo-dev-menu-interface" ||
      moduleName.startsWith("expo-dev-client/") ||
      moduleName.startsWith("expo-dev-launcher/") ||
      moduleName.startsWith("expo-dev-menu/");

    if (isDevelopmentModule) {
      // Return an empty module to prevent bundling dev-only modules in production
      return {
        filePath: path.resolve(__dirname, "lib/polyfills/emptyModule.js"),
        type: "sourceFile",
      };
    }
  }

  // Use Metro's default resolver for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
