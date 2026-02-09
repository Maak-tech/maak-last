import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { type Analytics, getAnalytics } from "firebase/analytics";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  type Auth,
  browserLocalPersistence,
  getAuth,
  // @ts-expect-error: getReactNativePersistence exists in the RN bundle but is missing from TypeScript definitions
  getReactNativePersistence,
  initializeAuth,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

type RNFirebaseAppModule = {
  app: () => unknown;
};

const hasErrorCode = (error: unknown, code: string): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === code;

// Initialize React Native Firebase early for native platforms
// This ensures the default Firebase app is initialized from native config files
// before any Firebase operations are attempted
let rnFirebaseApp: RNFirebaseAppModule | null = null;
if (Platform.OS !== "web") {
  try {
    // Import React Native Firebase app module - this auto-initializes Firebase
    // from GoogleService-Info.plist (iOS) and google-services.json (Android)
    const rnFirebase = require("@react-native-firebase/app") as {
      default?: RNFirebaseAppModule;
    };
    rnFirebaseApp = rnFirebase.default ?? null;

    // Ensure React Native Firebase app is initialized
    // React Native Firebase should auto-initialize from native config files
    // but we'll verify it's ready
    try {
      // Try to get the default app - this will initialize it if needed
      rnFirebaseApp?.app();
    } catch {
      // App might already be initialized or initialization might fail
      // This is okay - React Native Firebase should auto-initialize from native config
    }
  } catch (_error) {
    // React Native Firebase not available (e.g., in Expo Go or web)
    // This is expected and will be handled gracefully
  }
}

// Default Firebase configuration
// Note: For native iOS/Android, GoogleService-Info.plist and google-services.json
// are automatically used. These configs are primarily for web.
const firebaseConfig = {
  // Web config
  // Using maak-5caad.web.app instead of .firebaseapp.com for better OAuth compatibility
  web: {
    apiKey: "AIzaSyBzfNXpiKb5LhpX347PTXIODpZ6M9XFblQ",
    authDomain: "maak-5caad.web.app", // Changed from .firebaseapp.com for OAuth compatibility
    projectId: "maak-5caad",
    storageBucket: "maak-5caad.firebasestorage.app",
    messagingSenderId: "827176918437",
    appId: "1:827176918437:web:356fe7e2b4ecb3b99b1c4c",
    measurementId: "G-KZ279W9ELM",
  },
  // iOS config (from GoogleService-Info.plist)
  ios: {
    apiKey: "AIzaSyCQd61pZ_KgqzhibzSnTzqZYIF9q5d-pr4",
    authDomain: "maak-5caad.firebaseapp.com",
    projectId: "maak-5caad",
    storageBucket: "maak-5caad.firebasestorage.app",
    messagingSenderId: "827176918437",
    appId: "1:827176918437:ios:d950be8afe2055279b1c4c",
  },
  // Android config (from google-services.json)
  android: {
    apiKey: "AIzaSyBejWVJIY6RCzQ41R1xVd4ZYrFTtID3vGk",
    authDomain: "maak-5caad.firebaseapp.com",
    projectId: "maak-5caad",
    storageBucket: "maak-5caad.firebasestorage.app",
    messagingSenderId: "827176918437",
    appId: "1:827176918437:android:2fdd3c9e662310e69b1c4c",
  },
};

// Select config based on platform
export const getPlatformConfig = () => {
  if (Platform.OS === "web") {
    return firebaseConfig.web;
  }
  if (Platform.OS === "ios") {
    return firebaseConfig.ios;
  }
  return firebaseConfig.android;
};

const platformConfig = getPlatformConfig();

// Helper function to clean environment variables (remove quotes if present)
const cleanEnvVar = (value: string | undefined): string | undefined => {
  if (!value) {
    return;
  }
  // Remove surrounding quotes if present
  return value.replace(/^["']|["']$/g, "").trim();
};

// Use environment variables if available, otherwise use platform-specific defaults
const apiKey =
  cleanEnvVar(process.env.EXPO_PUBLIC_FIREBASE_API_KEY) ||
  platformConfig.apiKey;
const authDomain =
  cleanEnvVar(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN) ||
  platformConfig.authDomain;
const projectId =
  cleanEnvVar(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) ||
  platformConfig.projectId;
const storageBucket =
  cleanEnvVar(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET) ||
  platformConfig.storageBucket;
const messagingSenderId =
  cleanEnvVar(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) ||
  platformConfig.messagingSenderId;
const appId =
  cleanEnvVar(process.env.EXPO_PUBLIC_FIREBASE_APP_ID) || platformConfig.appId;
const configuredMeasurementId = cleanEnvVar(
  process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
);
const platformMeasurementId =
  "measurementId" in platformConfig &&
  typeof platformConfig.measurementId === "string"
    ? platformConfig.measurementId
    : undefined;
const measurementId = configuredMeasurementId || platformMeasurementId; // Only web has measurementId

export const getFirebaseConfig = () => ({
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  measurementId,
});

export const isFirebaseReady = (): boolean => {
  try {
    return getApps().length > 0;
  } catch {
    return false;
  }
};

// Validate required Firebase configuration
const requiredEnvVars = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  const _errorMessage = `Missing required Firebase environment variables: ${missingVars.join(", ")}. Please ensure your .env file contains all required EXPO_PUBLIC_FIREBASE_* variables.`;
  // Silently handle missing vars - Firebase operations will fail gracefully
}

// Check if Firebase app already exists (prevents duplicate initialization during HMR)
let app: ReturnType<typeof initializeApp> | undefined;
try {
  const existingApps = getApps();
  if (existingApps.length === 0) {
    // On native platforms, React Native Firebase might have already initialized the app
    // Check if we can get it via React Native Firebase first
    if (Platform.OS !== "web" && rnFirebaseApp) {
      try {
        // Try to get the app from React Native Firebase
        const _rnApp = rnFirebaseApp.app();
        // React Native Firebase uses a different app instance
        // We still need to initialize the web SDK app for compatibility
        // But we'll check if RN Firebase initialized first
      } catch (_rnError) {
        // React Native Firebase app not available, proceed with web SDK initialization
      }
    }

    // No apps exist, initialize a new one with web SDK
    app = initializeApp({
      apiKey: apiKey || "",
      authDomain: authDomain || "",
      projectId: projectId || "",
      storageBucket: storageBucket || "",
      messagingSenderId: messagingSenderId || "",
      appId: appId || "",
      measurementId,
    });
  } else {
    // App already exists, get the default app
    app = getApp();
  }
} catch (_error) {
  // If initialization fails, try to get existing app as fallback
  try {
    app = getApp();
  } catch {
    // On native platforms, React Native Firebase might be the only option
    if (Platform.OS !== "web" && rnFirebaseApp) {
      // Continue with a guarded fallback web app initialization below.
      // Do not crash startup.
    } else {
      // Continue with a guarded fallback web app initialization below.
      // Do not crash startup.
    }
  }
}

// Ensure we always have a Firebase app instance, even if configuration is degraded.
const getSafeApp = (): ReturnType<typeof initializeApp> => {
  if (app) {
    return app;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
    return app;
  }

  // Last-resort fallback to avoid hard startup crashes.
  app = initializeApp({
    apiKey: apiKey || "missing-api-key",
    authDomain: authDomain || "localhost",
    projectId: projectId || "missing-project-id",
    storageBucket: storageBucket || "missing-storage-bucket",
    messagingSenderId: messagingSenderId || "000000000000",
    appId: appId || "missing-app-id",
    measurementId,
  });
  return app;
};

const safeApp = getSafeApp();

// Initialize Auth with platform-appropriate persistence
// For web: use browserLocalPersistence
// For React Native (iOS/Android): use initializeAuth with AsyncStorage persistence
let auth: Auth;
try {
  if (Platform.OS === "web") {
    // For web, use browserLocalPersistence
    try {
      auth = initializeAuth(safeApp, {
        persistence: browserLocalPersistence,
      });
    } catch (error) {
      // If auth is already initialized (e.g., during hot reload), use getAuth instead
      if (hasErrorCode(error, "auth/already-initialized")) {
        auth = getAuth(safeApp);
        // Set persistence explicitly for existing auth instance
        setPersistence(auth, browserLocalPersistence).catch(() => {
          // Silently handle persistence errors
        });
      } else {
        // Fallback to getAuth if initialization fails
        auth = getAuth(safeApp);
        setPersistence(auth, browserLocalPersistence).catch(() => {
          // Silently handle persistence errors
        });
      }
    }
  } else {
    // For React Native (iOS/Android), use initializeAuth with AsyncStorage persistence
    try {
      auth = initializeAuth(safeApp, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage),
      });
    } catch (error) {
      // If auth is already initialized (e.g., during hot reload), use getAuth instead
      if (hasErrorCode(error, "auth/already-initialized")) {
        auth = getAuth(safeApp);
      } else {
        auth = getAuth(safeApp);
      }
    }
  }
} catch (_error) {
  // Final fallback: use getAuth
  auth = getAuth(safeApp);
}

export { auth };
const initializedApp = safeApp;
export const db = getFirestore(initializedApp);
export const storage = getStorage(initializedApp);
export const functions = getFunctions(initializedApp, "us-central1");

// Initialize Analytics only for web platform (not supported in React Native)
let analytics: Analytics | undefined;
if (Platform.OS === "web" && typeof window !== "undefined") {
  try {
    analytics = getAnalytics(initializedApp);
  } catch {
    // Analytics may already be initialized or window may not be available
    // Silently handle initialization errors
  }
}

export { analytics };
export { initializedApp as app };
export default initializedApp;
