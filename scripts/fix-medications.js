const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
} = require("firebase/firestore");

// Firebase config - requires environment variables
// Scripts should fail if env vars are missing to prevent using wrong project
const requiredEnvVars = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Check for missing required environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missingVars.join(", ")}`
  );
  console.error(
    "Please set these in your .env file or export them before running this script."
  );
  process.exit(1);
}

const firebaseConfig = {
  apiKey: requiredEnvVars.apiKey,
  authDomain: requiredEnvVars.authDomain,
  projectId: requiredEnvVars.projectId,
  storageBucket: requiredEnvVars.storageBucket,
  messagingSenderId: requiredEnvVars.messagingSenderId,
  appId: requiredEnvVars.appId,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixMedications() {
  console.log("🔧 Fixing medications with missing or invalid reminders...");

  const userId = "Ezqaeqp23sXWHMIJJ4ELwyah8RC3";

  try {
    // Get all medications for this user
    const q = query(
      collection(db, "medications"),
      where("userId", "==", userId)
    );

    const querySnapshot = await getDocs(q);

    console.log(`Found ${querySnapshot.size} medications`);

    let fixedCount = 0;

    for (const medicationDoc of querySnapshot.docs) {
      const data = medicationDoc.data();
      console.log(`Checking medication: ${data.name}`);
      console.log("Current reminders:", data.reminders, typeof data.reminders);

      // Check if reminders needs fixing
      if (Array.isArray(data.reminders)) {
        console.log(`✅ ${data.name} already has proper reminders array`);
      } else {
        console.log(`Fixing reminders for ${data.name}`);

        await updateDoc(doc(db, "medications", medicationDoc.id), {
          reminders: [], // Set to empty array if not a proper array
        });

        fixedCount += 1;
        console.log(`✅ Fixed ${data.name}`);
      }
    }

    console.log(`\n🎉 Fixed ${fixedCount} medications`);
  } catch (error) {
    console.error("❌ Error fixing medications:", error);
  }
}

fixMedications().then(() => {
  console.log("Done!");
  process.exit(0);
});
