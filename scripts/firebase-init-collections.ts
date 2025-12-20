/**
 * Firebase Collections Initialization Script
 *
 * This script automatically creates the required Firestore collections
 * with sample data to ensure your app works properly.
 *
 * Run this script with: npm run firebase:init
 */

const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin SDK
async function initializeFirebaseAdmin() {
  try {
    // Check if already initialized
    if (admin.apps.length === 0) {
      // For local development, you can use the Firebase emulator
      // or provide your service account key

      // Option 1: Use Firebase Emulator (recommended for development)
      if (process.env.FIRESTORE_EMULATOR_HOST) {
        console.log("🔧 Using Firebase Emulator for initialization...");
        admin.initializeApp({
          projectId:
            process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
        });
      } else {
        // Option 2: Use production Firebase (requires service account)
        console.log("🔥 Using production Firebase for initialization...");

        // You'll need to download your service account key from Firebase Console
        // and set the path here or use environment variable
        const serviceAccountPath =
          process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
          path.join(__dirname, "../firebase-service-account.json");

        try {
          const serviceAccount = require(serviceAccountPath);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
          });
        } catch (error) {
          console.error("❌ Service account file not found. Please:");
          console.log(
            "1. Download your service account key from Firebase Console"
          );
          console.log(
            "2. Save it as firebase-service-account.json in the project root"
          );
          console.log(
            "3. Or set FIREBASE_SERVICE_ACCOUNT_PATH environment variable"
          );
          process.exit(1);
        }
      }
    }

    return admin.firestore();
  } catch (error) {
    console.error("❌ Failed to initialize Firebase Admin:", error.message);
    throw error;
  }
}

// Create sample user document
async function createUserDocument(db: any, userId: string) {
  console.log("👤 Creating user document...");

  const userData = {
    email: `user-${userId}@example.com`,
    name: `Sample User ${userId.slice(0, 6)}`,
    role: "admin",
    createdAt: admin.firestore.Timestamp.now(),
    onboardingCompleted: true,
    preferences: {
      language: "en",
      notifications: true,
      emergencyContacts: [],
    },
  };

  await db.collection("users").doc(userId).set(userData);
  console.log("✅ User document created");
  return userData;
}

// Create sample collections for a user
async function createSampleCollections(db: any, userId: string) {
  console.log("📄 Creating sample collections...");

  // Create sample symptoms
  const symptomsData = [
    {
      userId,
      type: "headache",
      severity: 3,
      description: "Mild headache after work",
      timestamp: admin.firestore.Timestamp.now(),
      location: "head",
      triggers: ["stress", "computer"],
    },
    {
      userId,
      type: "fatigue",
      severity: 2,
      description: "Feeling tired in the afternoon",
      timestamp: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - 86_400_000)
      ), // Yesterday
      triggers: ["lack of sleep"],
    },
  ];

  for (const symptom of symptomsData) {
    await db.collection("symptoms").add(symptom);
  }
  console.log("✅ Sample symptoms created");

  // Create sample medications
  const medicationsData = [
    {
      userId,
      name: "Vitamin D",
      dosage: "1000 IU",
      frequency: "Daily",
      startDate: admin.firestore.Timestamp.now(),
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
      startDate: admin.firestore.Timestamp.now(),
      endDate: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 7 * 86_400_000)
      ), // Next week
      reminders: [],
      notes: "For headaches only",
      isActive: true,
    },
  ];

  for (const medication of medicationsData) {
    await db.collection("medications").add(medication);
  }
  console.log("✅ Sample medications created");

  // Create sample medical history
  const medicalHistoryData = [
    {
      userId,
      condition: "Hypertension",
      diagnosedDate: admin.firestore.Timestamp.fromDate(new Date("2023-01-01")),
      severity: "mild",
      notes: "Controlled with lifestyle changes",
      isFamily: false,
    },
    {
      userId,
      condition: "Diabetes Type 2",
      diagnosedDate: admin.firestore.Timestamp.fromDate(new Date("2020-06-15")),
      severity: "moderate",
      notes: "Family history - grandfather",
      isFamily: true,
      relation: "grandfather",
    },
  ];

  for (const history of medicalHistoryData) {
    await db.collection("medicalHistory").add(history);
  }
  console.log("✅ Sample medical history created");

  // Create sample vital signs
  const vitalsData = [
    {
      userId,
      type: "heartRate",
      value: 72,
      unit: "bpm",
      timestamp: admin.firestore.Timestamp.now(),
      source: "manual",
    },
    {
      userId,
      type: "bloodPressure",
      value: 120,
      unit: "mmHg",
      timestamp: admin.firestore.Timestamp.now(),
      source: "manual",
    },
    {
      userId,
      type: "weight",
      value: 70,
      unit: "kg",
      timestamp: admin.firestore.Timestamp.now(),
      source: "manual",
    },
  ];

  for (const vital of vitalsData) {
    await db.collection("vitals").add(vital);
  }
  console.log("✅ Sample vitals created");
}

// Create family document
async function createFamilyDocument(db: any, userId: string) {
  console.log("👨‍👩‍👧‍👦 Creating family document...");

  const familyData = {
    name: "Sample Family",
    createdBy: userId,
    members: [userId],
    createdAt: admin.firestore.Timestamp.now(),
  };

  const familyRef = await db.collection("families").add(familyData);

  // Update user with family ID
  await db.collection("users").doc(userId).update({
    familyId: familyRef.id,
  });

  console.log("✅ Family document created and user updated");
  return familyRef.id;
}

// Main initialization function
async function initializeCollections() {
  console.log("🚀 Starting Firebase Collections Initialization...\n");

  try {
    const db = await initializeFirebaseAdmin();

    // Generate a sample user ID (in real app, this would be from Firebase Auth)
    const sampleUserId =
      process.env.SAMPLE_USER_ID || `sample-user-${Date.now()}`;

    console.log(`📋 Initializing collections for user ID: ${sampleUserId}\n`);

    // Create user document
    await createUserDocument(db, sampleUserId);

    // Create sample collections
    await createSampleCollections(db, sampleUserId);

    // Create family document
    await createFamilyDocument(db, sampleUserId);

    console.log("\n🎉 Collections initialization completed successfully!");
    console.log("\n📝 Summary:");
    console.log("✅ User document created");
    console.log("✅ Sample symptoms added");
    console.log("✅ Sample medications added");
    console.log("✅ Sample medical history added");
    console.log("✅ Sample vital signs added");
    console.log("✅ Family document created");

    console.log("\n🔧 Next steps:");
    console.log(
      "1. Update your Firestore security rules (see FIREBASE_SETUP.md)"
    );
    console.log("2. Test your app with the created data");
    console.log("3. Sign in with a real user account");

    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      console.log(`\n🆔 Sample User ID: ${sampleUserId}`);
      console.log(
        "💡 You can use this ID to test your app or create a real user account"
      );
    }
  } catch (error) {
    console.error("\n💥 Initialization failed:", error.message);
    console.log("\n🔧 Troubleshooting tips:");
    console.log("1. Make sure your Firebase project is set up correctly");
    console.log("2. Check your environment variables");
    console.log("3. Ensure you have the necessary permissions");
    console.log(
      "4. For production, make sure your service account key is valid"
    );
    process.exit(1);
  }
}

// Run the initialization
if (require.main === module) {
  initializeCollections();
}

module.exports = { initializeCollections };
