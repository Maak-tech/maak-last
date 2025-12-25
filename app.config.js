// Load environment variables from .env file
require("dotenv").config();

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
      backgroundColor: "#F8FAFC"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.maak.health",
      buildNumber: "27",
      jsEngine: "hermes",
      googleServicesFile: "./GoogleService-Info.plist",
      splash: {
        image: "./assets/images/generated_image.png",
        resizeMode: "contain",
        backgroundColor: "#F8FAFC"
      },
      infoPlist: {
        NSCameraUsageDescription: "Maak Health uses the camera to allow you to take profile photos and scan medication barcodes for easy tracking.",
        NSPhotoLibraryUsageDescription: "Maak Health needs access to your photo library to select profile pictures and save health-related images.",
        NSMotionUsageDescription: "Maak Health uses motion sensors to detect falls and automatically alert your emergency contacts for your safety.",
        NSLocationWhenInUseUsageDescription: "Maak Health uses your location to share with emergency contacts during fall detection alerts, ensuring help can reach you quickly.",
        NSHealthShareUsageDescription: "Maak Health reads health data to provide personalized health insights, track your wellness progress, and help you manage your medications effectively.",
        NSHealthUpdateUsageDescription: "Maak Health writes health data to keep your health information synchronized across all your devices and maintain accurate health records.",
        NSUserTrackingUsageDescription: "This identifier helps us deliver personalized health insights and recommendations while keeping your data secure.",
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ["location", "processing"],
        UITextInputContextIdentifier: ""
      },
      entitlements: {
        "com.apple.developer.healthkit": true,
        "com.apple.developer.healthkit.access": []
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/generated_image.png",
        backgroundColor: "#2563EB"
      },
      package: "com.maak.health",
      versionCode: 1,
      jsEngine: "hermes",
      googleServicesFile: "./google-services.json",
      splash: {
        image: "./assets/images/generated_image.png",
        resizeMode: "contain",
        backgroundColor: "#F8FAFC"
      },
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "com.google.android.c2dm.permission.RECEIVE",
        "android.permission.activity_recognition"
      ]
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-font",
      [
        "expo-notifications",
        {
          icon: "./assets/images/generated_image.png",
          color: "#2563EB"
        }
      ],
      [
        "expo-sensors",
        {
          motionPermission: "Allow $(PRODUCT_NAME) to access motion and fitness data for fall detection."
        }
      ],
      [
        "@kingstinct/react-native-healthkit",
        {
          healthSharePermission: "Maak Health reads health data to provide personalized health insights, track your wellness progress, and help you manage your medications effectively.",
          healthUpdatePermission: "Maak Health writes health data to keep your health information synchronized across all your devices and maintain accurate health records."
        }
      ],
      "expo-localization",
      "expo-secure-store",
      "expo-web-browser",
      "./plugins/withFollyFix.js"
    ],
    experiments: {
      typedRoutes: true
    },
    newArchEnabled: false,
    extra: {
      router: {},
      eas: {
        projectId: "4ee7df2f-34c7-4be6-aaa0-f6bfca8f98c0"
      },
      // API keys are loaded from environment variables for security
      // Create a .env file with these variables (see .env.example)
      fitbitClientId: process.env.FITBIT_CLIENT_ID || "",
      fitbitClientSecret: process.env.FITBIT_CLIENT_SECRET || "",
      // Both regular and premium users use the same OpenAI API key
      openaiApiKey: process.env.OPENAI_API_KEY || "",
      zeinaApiKey: process.env.OPENAI_API_KEY || "" // Same as openaiApiKey
    }
  }
};

