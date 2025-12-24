/**
 * Firebase Admin SDK Configuration
 * 
 * This file provides a reusable Firebase Admin SDK initialization
 * that matches the standard Firebase Admin SDK pattern.
 * 
 * Usage:
 * ```typescript
 * import { initializeAdmin } from './lib/firebase-admin';
 * const admin = initializeAdmin();
 * const db = admin.firestore();
 * ```
 */

import * as admin from "firebase-admin";
import * as path from "path";

/**
 * Initialize Firebase Admin SDK
 * 
 * Follows the standard Firebase Admin SDK pattern:
 * ```javascript
 * var admin = require("firebase-admin");
 * var serviceAccount = require("path/to/serviceAccountKey.json");
 * admin.initializeApp({
 *   credential: admin.credential.cert(serviceAccount)
 * });
 * ```
 * 
 * @param options - Optional configuration options
 * @returns Firebase Admin instance
 */
export function initializeAdmin(options?: {
  serviceAccountPath?: string;
  projectId?: string;
  useDefaultCredentials?: boolean;
}): admin.app.App {
  // Return existing app if already initialized
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const {
    serviceAccountPath,
    projectId = "maak-app-12cb8",
    useDefaultCredentials = false,
  } = options || {};

  // Check if running in Cloud Functions environment
  const isCloudFunctions = process.env.FUNCTION_TARGET || process.env.K_SERVICE;

  // Use default credentials in Cloud Functions or if explicitly requested
  if (isCloudFunctions || useDefaultCredentials) {
    return admin.initializeApp({
      projectId,
    });
  }

  // Local development: Use service account key file
  const accountPath =
    serviceAccountPath ||
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    path.join(process.cwd(), "serviceAccountKey.json");

  try {
    // Standard Firebase Admin SDK pattern
    const serviceAccount = require(accountPath);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  } catch (error) {
    console.warn(
      `⚠️ Service account file not found at: ${accountPath}`,
      "\nFor local development, place serviceAccountKey.json in the project root.",
      "\nOr set FIREBASE_SERVICE_ACCOUNT_PATH environment variable."
    );
    
    // Fallback to default credentials (works with Firebase emulator or gcloud auth)
    return admin.initializeApp({
      projectId,
    });
  }
}

/**
 * Get Firebase Admin instance (initializes if needed)
 */
export function getAdmin(): admin.app.App {
  if (admin.apps.length === 0) {
    return initializeAdmin();
  }
  return admin.app();
}

/**
 * Get Firestore database instance
 */
export function getFirestore(): admin.firestore.Firestore {
  return getAdmin().firestore();
}

/**
 * Get Firebase Auth instance
 */
export function getAuth(): admin.auth.Auth {
  return getAdmin().auth();
}

/**
 * Get Firebase Messaging instance
 */
export function getMessaging(): admin.messaging.Messaging {
  return getAdmin().messaging();
}

// Export admin for direct access if needed
export { admin };

