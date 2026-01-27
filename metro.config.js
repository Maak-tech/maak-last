const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for Firebase + Expo SDK 53 "Component auth has not been registered yet" error
config.resolver.sourceExts.push("cjs");
config.resolver.unstable_enablePackageExports = false;

// Only essential configurations for production stability
config.transformer.unstable_allowRequireContext = true;

// Replace PushNotificationIOS with our polyfill to prevent NativeEventEmitter errors
// Also replace reanimated's Text component to fix React 19 / RN 0.81+ compatibility
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept PushNotificationIOS module from any import path and replace with polyfill
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

  // Intercept reanimated's Text component to fix React 19 / RN 0.81+ compatibility
  // This prevents the "function component TextImpl" error
  if (
    typeof moduleName === "string" &&
    (moduleName === "react-native-reanimated/src/component/Text" ||
      moduleName.endsWith("/react-native-reanimated/src/component/Text") ||
      moduleName.endsWith("/react-native-reanimated/src/component/Text.ts"))
  ) {
    return {
      filePath: path.resolve(__dirname, "lib/polyfills/reanimatedText.js"),
      type: "sourceFile",
    };
  }

  // Use default resolver for everything else
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
