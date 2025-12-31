const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for Firebase + Expo SDK 53 "Component auth has not been registered yet" error
config.resolver.sourceExts.push("cjs");
config.resolver.unstable_enablePackageExports = false;

// Only essential configurations for production stability
config.transformer.unstable_allowRequireContext = true;

// Replace PushNotificationIOS with our polyfill to prevent NativeEventEmitter errors
// Also ensure TextImpl patch loads before react-native-reanimated
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept PushNotificationIOS module from any import path and replace with polyfill
  // This catches all possible import patterns including:
  // - react-native/Libraries/PushNotificationIOS/PushNotificationIOS
  // - react-native/Libraries/PushNotificationIOS
  // - Any module name containing PushNotificationIOS
  if (
    moduleName ===
      "react-native/Libraries/PushNotificationIOS/PushNotificationIOS" ||
    moduleName === "react-native/Libraries/PushNotificationIOS" ||
    moduleName === "PushNotificationIOS" ||
    (typeof moduleName === "string" &&
      (moduleName.includes("PushNotificationIOS") ||
        moduleName.endsWith("/PushNotificationIOS") ||
        moduleName.includes("PushNotificationIOS/PushNotificationIOS")))
  ) {
    return {
      filePath: path.resolve(__dirname, "lib/polyfills/pushNotificationIOS.js"),
      type: "sourceFile",
    };
  }

  // CRITICAL: Ensure TextImpl patch loads before react-native-reanimated
  // Intercept react-native-reanimated to inject our patch first
  if (moduleName === "react-native-reanimated") {
    // First, ensure our TextImpl patch has run
    try {
      require(path.resolve(__dirname, "lib/polyfills/textImplPatch.js"));
    } catch {
      // Patch might already be loaded, that's okay
    }
  }

  // Use default resolver for everything else
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
