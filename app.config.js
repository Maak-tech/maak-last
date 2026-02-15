// Load environment variables from .env file
require("dotenv").config({ quiet: true });

// Restore Google Services files from EAS environment variables during build
// Skip restoration during config introspection to avoid parsing corrupted files
const fs = require("node:fs");
const path = require("node:path");

// Check if we're in config introspection mode (EAS Build uses this)
const isConfigIntrospection =
  process.env.EXPO_CONFIG_TYPE === "introspect" ||
  (process.argv.includes("--type") && process.argv.includes("introspect"));

const normalizeSecret = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  let normalized = value.trim();
  if (!normalized) {
    return "";
  }
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  if (normalized.toLowerCase().startsWith("bearer ")) {
    normalized = normalized.slice(7).trim();
  }
  return normalized;
};

const readFirstSecret = (...keys) => {
  for (const key of keys) {
    const normalized = normalizeSecret(process.env[key]);
    if (normalized) {
      return normalized;
    }
  }
  return "";
};

// Helper to validate plist file
function isValidPlist(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const content = fs.readFileSync(filePath, "utf8");
    return (
      content.includes("<?xml") ||
      content.includes("<!DOCTYPE plist") ||
      content.includes("<plist")
    );
  } catch {
    return false;
  }
}

if (!isConfigIntrospection) {
  if (process.env.GOOGLE_SERVICES_JSON) {
    try {
      const decoded = Buffer.from(process.env.GOOGLE_SERVICES_JSON, "base64");
      fs.writeFileSync("./google-services.json", decoded);
    } catch (_error) {
      // Silently handle restore error
    }
  }
  if (process.env.GOOGLE_SERVICE_INFO_PLIST) {
    try {
      const decoded = Buffer.from(
        process.env.GOOGLE_SERVICE_INFO_PLIST,
        "base64"
      );
      // Validate it's valid XML/plist before writing
      const decodedStr = decoded.toString("utf8");
      if (
        decodedStr.includes("<?xml") ||
        decodedStr.includes("<!DOCTYPE plist") ||
        decodedStr.includes("<plist")
      ) {
        fs.writeFileSync("./GoogleService-Info.plist", decoded);
      }
    } catch (_error) {
      // Silently handle restore error
    }
  }
}

// Remove corrupted plist file if it exists and is invalid
const plistPath = path.join(__dirname, "GoogleService-Info.plist");
if (fs.existsSync(plistPath) && !isValidPlist(plistPath)) {
  try {
    fs.unlinkSync(plistPath);
  } catch {
    // Ignore deletion errors
  }
}

export default {
  expo: {
    name: "Maak Health",
    slug: "maak-app",
    owner: "maak-tech",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/generated_image.png",
    scheme: "maak",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/generated_image.png",
      resizeMode: "contain",
      backgroundColor: "#F8FAFC",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.maaktech.maak",
      buildNumber: "42",
      jsEngine: "jsc",
      ...(fs.existsSync("./GoogleService-Info.plist") &&
      isValidPlist("./GoogleService-Info.plist")
        ? { googleServicesFile: "./GoogleService-Info.plist" }
        : {}),
      splash: {
        image: "./assets/images/generated_image.png",
        resizeMode: "contain",
        backgroundColor: "#F8FAFC",
      },
      infoPlist: {
        NSCameraUsageDescription:
          "Maak Health uses the camera to allow you to take profile photos, scan medication barcodes, and measure heart rate using PPG (photoplethysmography) for vital signs monitoring.",
        NSPhotoLibraryUsageDescription:
          "Maak Health needs access to your photo library to select profile pictures and save health-related images.",
        NSMotionUsageDescription:
          "Maak Health uses motion sensors to detect falls and automatically alert your emergency contacts for your safety.",
        NSLocationWhenInUseUsageDescription:
          "Maak Health uses your location to share with emergency contacts during fall detection alerts, ensuring help can reach you quickly.",
        NSHealthShareUsageDescription:
          "Maak Health reads health data to provide personalized health insights, track your wellness progress, and help you manage your medications effectively.",
        NSHealthUpdateUsageDescription:
          "Maak Health writes health data to keep your health information synchronized across all your devices and maintain accurate health records.",
        NSUserTrackingUsageDescription:
          "This identifier helps us deliver personalized health insights and recommendations while keeping your data secure.",
        NSFaceIDUsageDescription:
          "Maak Health uses Face ID or Touch ID to securely authenticate your identity for biometric authentication.",
        NSMicrophoneUsageDescription:
          "Maak Health needs access to your microphone to use voice features with Zeina, your health assistant.",
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ["location", "processing"],
        BGTaskSchedulerPermittedIdentifiers: [
          "com.maaktech.maak.background-task",
        ],
        UITextInputContextIdentifier: "",
      },
      entitlements: {
        "com.apple.developer.healthkit": true,
        "com.apple.developer.healthkit.access": [],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/generated_image.png",
        backgroundColor: "#2563EB",
      },
      package: "com.maaktech.maak",
      versionCode: 6,
      jsEngine: "hermes",
      googleServicesFile: "./google-services.json",
      splash: {
        image: "./assets/images/generated_image.png",
        resizeMode: "contain",
        backgroundColor: "#F8FAFC",
      },
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_HEALTH",
        "android.permission.WAKE_LOCK",
        "com.google.android.c2dm.permission.RECEIVE",
        "android.permission.activity_recognition",
        "USE_BIOMETRIC",
        "USE_FINGERPRINT",
        "android.permission.health.READ_HEART_RATE",
        "android.permission.health.READ_STEPS",
        "android.permission.health.READ_SLEEP",
        "android.permission.health.READ_BODY_TEMPERATURE",
        "android.permission.health.READ_BLOOD_PRESSURE",
        "android.permission.health.READ_WEIGHT",
        "android.permission.health.READ_RESTING_HEART_RATE",
        "android.permission.health.READ_RESPIRATORY_RATE",
        "android.permission.health.READ_OXYGEN_SATURATION",
        "android.permission.health.READ_HEIGHT",
        "android.permission.health.READ_BODY_MASS_INDEX",
        "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
        "android.permission.health.READ_DISTANCE",
        "android.permission.health.READ_EXERCISE",
        "android.permission.health.READ_HYDRATION",
        "android.permission.health.READ_BLOOD_GLUCOSE",
        "android.permission.health.READ_HEART_RATE_VARIABILITY",
        "android.permission.health.READ_BODY_FAT",
        "android.permission.health.READ_BASAL_METABOLIC_RATE",
        "android.permission.health.READ_FLOORS_CLIMBED",
        "android.permission.SCHEDULE_EXACT_ALARM",
      ],
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-font",
      [
        "@sentry/react-native/expo",
        {
          url: "https://sentry.io/",
          project: "react-native",
          organization: "maak-tech",
        },
      ],
      [
        "expo-av",
        {
          microphonePermission:
            "Maak Health needs access to your microphone to use voice features with Zeina, your health assistant.",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/generated_image.png",
          color: "#2563EB",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission:
            "Required for PPG heart rate measurement and vital signs monitoring",
        },
      ],
      [
        "react-native-vision-camera",
        {
          cameraPermissionText:
            "$(PRODUCT_NAME) needs access to your camera for real-time PPG heart rate measurement and vital signs monitoring using photoplethysmography.",
          enableMicrophonePermission: false,
          disableFrameProcessors: false, // Enabled for real PPG pixel extraction
        },
      ],
      [
        "expo-sensors",
        {
          motionPermission:
            "Allow $(PRODUCT_NAME) to access motion and fitness data for fall detection.",
        },
      ],
      [
        "@kingstinct/react-native-healthkit",
        {
          healthSharePermission:
            "Maak Health reads health data to provide personalized health insights, track your wellness progress, and help you manage your medications effectively.",
          healthUpdatePermission:
            "Maak Health writes health data to keep your health information synchronized across all your devices and maintain accurate health records.",
        },
      ],
      "@react-native-voice/voice",
      "expo-localization",
      "expo-local-authentication",
      "expo-secure-store",
      "expo-web-browser",
      [
        "expo-build-properties",
        {
          ios: {
            // Build React Native from source
            buildReactNativeFromSource: true,
            // Use static frameworks for Firebase compatibility
            useFrameworks: "static",
            deploymentTarget: "15.1",
          },
        },
      ],
      "./plugins/withFollyFix.js",
    ],
    experiments: {
      typedRoutes: true,
    },
    newArchEnabled: false,
    extra: {
      router: {},
      eas: {
        projectId: "4ee7df2f-34c7-4be6-aaa0-f6bfca8f98c0",
      },
      // API keys are loaded from Expo Secrets (EAS) for security
      // These are automatically available as environment variables during build time
      // Set them using: eas secret:create --scope project --name OPENAI_API_KEY --value your-key
      fitbitClientId: process.env.FITBIT_CLIENT_ID || "",
      fitbitClientSecret: process.env.FITBIT_CLIENT_SECRET || "",
      samsungHealthClientId: process.env.SAMSUNG_HEALTH_CLIENT_ID || "",
      samsungHealthClientSecret: process.env.SAMSUNG_HEALTH_CLIENT_SECRET || "",
      garminClientId: process.env.GARMIN_CLIENT_ID || "",
      garminClientSecret: process.env.GARMIN_CLIENT_SECRET || "",
      withingsClientId: process.env.WITHINGS_CLIENT_ID || "",
      withingsClientSecret: process.env.WITHINGS_CLIENT_SECRET || "",
      ouraClientId: process.env.OURA_CLIENT_ID || "",
      ouraClientSecret: process.env.OURA_CLIENT_SECRET || "",
      dexcomClientId: process.env.DEXCOM_CLIENT_ID || "",
      dexcomClientSecret: process.env.DEXCOM_CLIENT_SECRET || "",
      dexcomRedirectUri:
        process.env.DEXCOM_REDIRECT_URI ||
        "https://maak-5caad.web.app/dexcom-callback",
      // OpenAI API keys are stored in EAS environment variables.
      // We support both classic names and EXPO_PUBLIC_* names for compatibility.
      openaiApiKey: readFirstSecret(
        "OPENAI_API_KEY",
        "EXPO_PUBLIC_OPENAI_API_KEY"
      ),
      zeinaApiKey: readFirstSecret(
        "ZEINA_API_KEY",
        "EXPO_PUBLIC_ZEINA_API_KEY",
        "OPENAI_API_KEY",
        "EXPO_PUBLIC_OPENAI_API_KEY"
      ),
      // RevenueCat API Keys - REQUIRED for production
      // PUBLIC_REVENUECAT_API_KEY: Public SDK API key (starts with appl_ for iOS or goog_ for Android)
      //   - Used by the React Native SDK for client-side subscription management
      //   - Safe to include in client-side code
      // REVENUECAT_API_KEY: Secret API key (starts with sk_)
      //   - Used for server-side RevenueCat REST API calls (if needed)
      //   - Should NEVER be exposed in client-side code
      // The SDK prioritizes PUBLIC_REVENUECAT_API_KEY, falls back to REVENUECAT_API_KEY for compatibility
      revenueCatApiKey:
        process.env.PUBLIC_REVENUECAT_API_KEY ||
        process.env.REVENUECAT_API_KEY ||
        "",
    },
  },
};
