/**
 * Firebase Admin SDK Configuration Example
 * 
 * This file demonstrates the standard Firebase Admin SDK initialization pattern
 * as shown in the Firebase Console.
 * 
 * Standard Pattern:
 * ```javascript
 * var admin = require("firebase-admin");
 * var serviceAccount = require("path/to/serviceAccountKey.json");
 * admin.initializeApp({
 *   credential: admin.credential.cert(serviceAccount)
 * });
 * ```
 */

// Example 1: Basic initialization (matches Firebase Console snippet)
var admin = require("firebase-admin");
var serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "maak-app-12cb8", // Optional but recommended
});

// Now you can use Firebase Admin SDK
const db = admin.firestore();
const auth = admin.auth();
const messaging = admin.messaging();

// Example usage:
async function example() {
  // Access Firestore
  const usersRef = db.collection("users");
  const snapshot = await usersRef.get();
  
  // Access Auth
  const user = await auth.getUser("user-id");
  
  // Access Messaging
  await messaging.send({
    token: "fcm-token",
    notification: {
      title: "Hello",
      body: "World",
    },
  });
}

module.exports = { admin, db, auth, messaging };

