import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  type Auth,
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

// Default Firebase configuration
// Note: For native iOS/Android, GoogleService-Info.plist and google-services.json
// are automatically used. These configs are primarily for web.
const firebaseConfig = {
  // Web config
  web: {
    apiKey: "AIzaSyBzfNXpiKb5LhpX347PTXIODpZ6M9XFblQ",
    authDomain: "maak-5caad.firebaseapp.com",
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
const getPlatformConfig = () => {
  if (Platform.OS === "web") {
    return firebaseConfig.web;
  } else if (Platform.OS === "ios") {
    return firebaseConfig.ios;
  } else {
    return firebaseConfig.android;
  }
};

const platformConfig = getPlatformConfig();

// Helper function to clean environment variables (remove quotes if present)
const cleanEnvVar = (value: string | undefined): string | undefined => {
  if (!value) return;
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
const measurementId =
  cleanEnvVar(process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID) ||
  (platformConfig as any).measurementId; // Only web has measurementId

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
  const errorMessage = `Missing required Firebase environment variables: ${missingVars.join(", ")}. Please ensure your .env file contains all required EXPO_PUBLIC_FIREBASE_* variables.`;
  // Silently handle missing vars - Firebase operations will fail gracefully
}

// Check if Firebase app already exists (prevents duplicate initialization during HMR)
let app;
try {
  app =
    getApps().length === 0
      ? initializeApp({
          apiKey: apiKey || "",
          authDomain: authDomain || "",
          projectId: projectId || "",
          storageBucket: storageBucket || "",
          messagingSenderId: messagingSenderId || "",
          appId: appId || "",
          measurementId,
        })
      : getApp();
} catch (error) {
  throw new Error(
    "Firebase initialization failed. Please check your environment variables."
  );
}

// Initialize Auth with platform-appropriate persistence
// For web: use browserLocalPersistence
// For React Native (iOS/Android): Firebase Auth persists automatically using AsyncStorage
let auth: Auth;
try {
  if (Platform.OS === "web") {
    // For web, use browserLocalPersistence
    try {
      auth = initializeAuth(app, {
        persistence: browserLocalPersistence,
      });
    } catch (error: any) {
      // If auth is already initialized (e.g., during hot reload), use getAuth instead
      if (error.code === "auth/already-initialized") {
        auth = getAuth(app);
        // Set persistence explicitly for existing auth instance
        setPersistence(auth, browserLocalPersistence).catch(() => {
          // Silently handle persistence errors
        });
      } else {
        // Fallback to getAuth if initialization fails
        auth = getAuth(app);
        setPersistence(auth, browserLocalPersistence).catch(() => {
          // Silently handle persistence errors
        });
      }
    }
  } else {
    // For React Native (iOS/Android), Firebase Auth persists automatically using AsyncStorage
    // Use getAuth() directly - it handles persistence automatically without needing initializeAuth
    auth = getAuth(app);
  }
} catch (error) {
  // Final fallback: use getAuth
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");

// Initialize Analytics only for web platform (not supported in React Native)
let analytics;
if (Platform.OS === "web" && typeof window !== "undefined") {
  try {
    analytics = getAnalytics(app);
  } catch {
    // Analytics may already be initialized or window may not be available
    // Silently handle initialization errors
  }
}

export { analytics };
export { app };
export default app;
