import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, initializeAuth, browserLocalPersistence, setPersistence, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// Helper function to clean environment variables (remove quotes if present)
const cleanEnvVar = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  // Remove surrounding quotes if present
  return value.replace(/^["']|["']$/g, "").trim();
};

const apiKey = cleanEnvVar(process.env.EXPO_PUBLIC_FIREBASE_API_KEY);
const authDomain = cleanEnvVar(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN);
const projectId = cleanEnvVar(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
const storageBucket = cleanEnvVar(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET);
const messagingSenderId = cleanEnvVar(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
const appId = cleanEnvVar(process.env.EXPO_PUBLIC_FIREBASE_APP_ID);
const measurementId = cleanEnvVar(process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID);

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
  
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.error(`❌ ${errorMessage}`);
  }
  
  // In production, still initialize but log the error
  // This prevents the app from crashing but Firebase operations will fail
  if (typeof __DEV__ === "undefined" || !__DEV__) {
    console.error(`Firebase Configuration Error: ${errorMessage}`);
  }
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
          measurementId: measurementId,
        })
      : getApp();
} catch (error) {
  console.error("Failed to initialize Firebase:", error);
  throw new Error(
    "Firebase initialization failed. Please check your environment variables."
  );
}

// Initialize Auth with persistence for React Native
// This ensures authentication state persists across app restarts
let auth: Auth;
try {
  // Try to initialize with local persistence (uses AsyncStorage in React Native)
  auth = initializeAuth(app, {
    persistence: browserLocalPersistence,
  });
} catch (error: any) {
  // If auth is already initialized (e.g., during hot reload), use getAuth instead
  if (error.code === "auth/already-initialized") {
    auth = getAuth(app);
    // Set persistence explicitly for existing auth instance
    setPersistence(auth, browserLocalPersistence).catch((persistError) => {
      console.warn("Failed to set auth persistence:", persistError);
    });
  } else {
    // Fallback to getAuth if initialization fails
    auth = getAuth(app);
    // Set persistence explicitly
    setPersistence(auth, browserLocalPersistence).catch((persistError) => {
      console.warn("Failed to set auth persistence:", persistError);
    });
  }
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");

export { app };
export default app;
