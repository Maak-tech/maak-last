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

let hasLoggedBundleMode = false;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (!hasLoggedBundleMode) {
    hasLoggedBundleMode = true;
    const devFlag = context?.dev;
    const mode = devFlag === true ? "dev" : "non-dev";
    // This runs in the Metro/Node process (build time), not inside the app runtime.
    // Useful for debugging EAS builds where env vars can be misleading.
    // eslint-disable-next-line no-console
    console.log(
      `[metro] bundle mode: ${mode} (context.dev=${String(devFlag)}) platform=${String(
        platform
      )}`
    );
  }
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

  // React Native Firebase modules don't exist in web builds
  // Stub them out to prevent build failures in Firebase App Hosting and other web environments
  // This check must happen before the dev bundle check to catch all web builds
  const isReactNativeFirebaseModule =
    moduleName === "@react-native-firebase/app" ||
    moduleName === "@react-native-firebase/crashlytics" ||
    moduleName.startsWith("@react-native-firebase/");

  if (isReactNativeFirebaseModule && platform === "web") {
    return {
      filePath: path.resolve(__dirname, "lib/polyfills/emptyModule.js"),
      type: "sourceFile",
    };
  }

  // Exclude expo-dev-client modules in non-dev bundles.
  //
  // IMPORTANT:
  // - In EAS build/update pipelines, env vars like NODE_ENV/BABEL_ENV may be unset or misleading.
  // - Metro's resolver context provides `dev` (true for dev server bundles, false for release bundles).
  //
  // So we ONLY treat it as a dev bundle when Metro explicitly says `context.dev === true`.
  // Anything else (false/undefined) is treated as non-dev and will have dev-client modules stubbed out.
  const isDevBundle = context?.dev === true;
  if (!isDevBundle) {
    const normalizedModuleName = String(moduleName || "").replace(/\\/g, "/");
    const originModulePath = String(context?.originModulePath || "").replace(
      /\\/g,
      "/"
    );
    const isRelativeImport =
      moduleName.startsWith("./") ||
      moduleName.startsWith("../") ||
      moduleName.startsWith(".\\") ||
      moduleName.startsWith("..\\");

    const isDevelopmentModule =
      moduleName === "expo-dev-client" ||
      moduleName === "expo-dev-launcher" ||
      moduleName === "expo-dev-menu" ||
      moduleName === "expo-dev-menu-interface" ||
      moduleName.startsWith("expo-dev-client/") ||
      moduleName.startsWith("expo-dev-launcher/") ||
      moduleName.startsWith("expo-dev-menu/") ||
      moduleName.startsWith("expo-dev-menu-interface/");

    // Expo dev-client packages frequently import internal files via relative paths
    // (e.g. `require("./DevMenu")`). Those won't match the moduleName checks above,
    // so we also block any relative imports originating from these packages.
    const isDevPackageOrigin =
      originModulePath.includes("/node_modules/expo-dev-client/") ||
      originModulePath.includes("/node_modules/expo-dev-launcher/") ||
      originModulePath.includes("/node_modules/expo-dev-menu/") ||
      originModulePath.includes("/node_modules/expo-dev-menu-interface/");

    // React Native also contains a DevMenu TurboModule spec (`NativeDevMenu`) that will
    // crash release builds if anything imports it (even behind a `__DEV__` usage check),
    // because the spec module calls `getEnforcing('DevMenu')` at import time.
    //
    // If any library accidentally does `import { DevMenu } from "react-native"` in production,
    // this prevents a hard crash by stubbing the DevMenu spec/modules.
    const isReactNativeDevMenuRequest =
      normalizedModuleName ===
        "react-native/Libraries/NativeModules/specs/NativeDevMenu" ||
      normalizedModuleName.includes(
        "react-native/src/private/devsupport/devmenu/specs/NativeDevMenu"
      ) ||
      normalizedModuleName.includes(
        "react-native/src/private/devsupport/devmenu/DevMenu"
      ) ||
      // Relative imports inside react-native itself
      ((originModulePath.includes("/node_modules/react-native/") ||
        originModulePath.includes("/node_modules/@react-native/")) &&
        (normalizedModuleName.includes("NativeDevMenu") ||
          normalizedModuleName.includes("devsupport/devmenu")));

    if (
      isDevelopmentModule ||
      (isDevPackageOrigin && isRelativeImport) ||
      isReactNativeDevMenuRequest
    ) {
      // Return an empty module to prevent bundling dev-only or native-only modules
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
