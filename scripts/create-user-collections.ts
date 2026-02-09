/**
 * Create Collections for Current User
 *
 * This script creates sample collections for your current authenticated user.
 * Make sure you're signed into your app before running this.
 *
 * Run this script with: npm run firebase:create-collections
 */

const { initializeApp } = require("firebase/app");
const { getAuth } = require("firebase/auth");
const {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  Timestamp,
} = require("firebase/firestore");

// Your Firebase config (should match your app's config)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "maak-health-demo.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "maak-health-demo",
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "maak-health-demo.appspot.com",
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef123456",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
getAuth(app);
const db = getFirestore(app);

async function createSampleData(userId: string) {
  console.log(`🔥 Creating sample data for user: ${userId}`);

  try {
    // Create sample symptoms
    console.log("📝 Creating sample symptoms...");
    const symptomsData = [
      {
        userId,
        type: "headache",
        severity: 3,
        description: "Mild headache after work",
        timestamp: Timestamp.now(),
        location: "head",
        triggers: ["stress", "computer"],
      },
      {
        userId,
        type: "fatigue",
        severity: 2,
        description: "Feeling tired in the afternoon",
        timestamp: Timestamp.fromDate(new Date(Date.now() - 86_400_000)), // Yesterday
        triggers: ["lack of sleep"],
      },
    ];

    for (const symptom of symptomsData) {
      await addDoc(collection(db, "symptoms"), symptom);
    }
    console.log("✅ Sample symptoms created");

    // Create sample medications
    console.log("💊 Creating sample medications...");
    const medicationsData = [
      {
        userId,
        name: "Vitamin D",
        dosage: "1000 IU",
        frequency: "Daily",
        startDate: Timestamp.now(),
        endDate: null,
        reminders: [
          {
            id: "reminder-1",
            time: "08:00",
            taken: false,
          },
        ],
        notes: "Take with breakfast",
        isActive: true,
      },
      {
        userId,
        name: "Paracetamol",
        dosage: "500mg",
        frequency: "As needed",
        startDate: Timestamp.now(),
        endDate: Timestamp.fromDate(new Date(Date.now() + 7 * 86_400_000)), // Next week
        reminders: [],
        notes: "For headaches only",
        isActive: true,
      },
    ];

    for (const medication of medicationsData) {
      await addDoc(collection(db, "medications"), medication);
    }
    console.log("✅ Sample medications created");

    // Create sample medical history
    console.log("🏥 Creating sample medical history...");
    const medicalHistoryData = [
      {
        userId,
        condition: "Hypertension",
        diagnosedDate: Timestamp.fromDate(new Date("2023-01-01")),
        severity: "mild",
        notes: "Controlled with lifestyle changes",
        isFamily: false,
      },
    ];

    for (const history of medicalHistoryData) {
      await addDoc(collection(db, "medicalHistory"), history);
    }
    console.log("✅ Sample medical history created");

    // Create sample vital signs
    console.log("❤️ Creating sample vital signs...");
    const vitalsData = [
      {
        userId,
        type: "heartRate",
        value: 72,
        unit: "bpm",
        timestamp: Timestamp.now(),
        source: "manual",
      },
      {
        userId,
        type: "bloodPressure",
        value: 120,
        unit: "mmHg",
        timestamp: Timestamp.now(),
        source: "manual",
      },
    ];

    for (const vital of vitalsData) {
      await addDoc(collection(db, "vitals"), vital);
    }
    console.log("✅ Sample vitals created");

    // Ensure user document exists with proper structure
    console.log("👤 Creating/updating user document...");
    const userData = {
      email: `user-${userId}@example.com`,
      name: `User ${userId.slice(0, 8)}`,
      role: "admin",
      createdAt: Timestamp.now(),
      onboardingCompleted: true,
      preferences: {
        language: "en",
        notifications: true,
        emergencyContacts: [],
      },
    };

    await setDoc(doc(db, "users", userId), userData, { merge: true });
    console.log("✅ User document created/updated");

    console.log("\n🎉 Sample data creation completed successfully!");
    console.log("\n📋 Summary:");
    console.log("✅ Sample symptoms added");
    console.log("✅ Sample medications added");
    console.log("✅ Sample medical history added");
    console.log("✅ Sample vital signs added");
    console.log("✅ User document ensured");
  } catch (error) {
    console.error(
      "❌ Error creating sample data:",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

async function main() {
  console.log("🚀 Starting sample data creation...\n");

  // For now, we'll create data for a specific user ID
  // In a real setup, you'd get this from authentication
  const userId = process.env.USER_ID || "Ezqaeqp23sXWHMIJJ4ELwyah8RC3"; // Your current user ID

  if (!userId || userId === "YOUR_USER_ID_HERE") {
    console.error(
      "❌ Please set USER_ID environment variable or update the script with your user ID"
    );
    console.log(
      "💡 You can find your user ID in the Firebase Authentication console"
    );
    console.log("💡 Or check your app logs for the user ID when you sign in");
    process.exit(1);
  }

  try {
    await createSampleData(userId);

    console.log("\n🔧 Next steps:");
    console.log(
      "1. Make sure your Firestore security rules are updated (see FIREBASE_SETUP.md)"
    );
    console.log("2. Test your app to see the sample data");
    console.log("3. Try adding new symptoms/medications through your app");
  } catch (error) {
    console.error(
      "\n💥 Script failed:",
      error instanceof Error ? error.message : String(error)
    );
    console.log("\n🔧 Troubleshooting:");
    console.log("1. Check your Firebase configuration");
    console.log("2. Ensure your Firestore security rules allow writes");
    console.log("3. Verify the user ID is correct");
    process.exit(1);
  }
}

// Run the script
main();
