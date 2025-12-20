/**
 * Firebase Setup Validation Script
 *
 * This script helps validate your Firebase configuration and identify
 * common issues that cause permission errors.
 *
 * Run this script with: npm run firebase:check
 */

const { firebaseValidation } = require("../lib/services/firebaseValidation");

async function runValidation() {
  console.log("🔥 Starting Firebase Setup Validation...\n");

  // Check basic configuration
  console.log("📋 Checking Firebase Configuration:");
  const configStatus = firebaseValidation.getConfigStatus();
  console.log("- Firebase App:", configStatus.hasFirebaseConfig ? "✅" : "❌");
  console.log("- Project ID:", configStatus.projectId || "Not found");
  console.log("- Auth Service:", configStatus.hasAuth ? "✅" : "❌");
  console.log("- Firestore Service:", configStatus.hasFirestore ? "✅" : "❌");
  console.log("");

  if (!configStatus.hasFirebaseConfig) {
    console.error("❌ Firebase is not properly configured!");
    console.log(
      "💡 Please check your Firebase configuration in lib/firebase.ts"
    );
    console.log("💡 Make sure your environment variables are set correctly");
    return;
  }

  if (!configStatus.hasAuth) {
    console.warn("⚠️ No user is currently authenticated");
    console.log("💡 Please sign in to test permissions");
    console.log("💡 You can still check the configuration above");
    return;
  }

  // Run full validation
  console.log("🧪 Running Permission Tests...\n");
  const validation = await firebaseValidation.validateUserSetup();

  if (validation.isValid) {
    console.log(
      "🎉 All tests passed! Your Firebase setup is working correctly.\n"
    );
  } else {
    console.log("❌ Issues found:\n");
    validation.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });

    console.log("\n💡 Recommendations:\n");
    validation.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });

    console.log("\n🔧 Attempting quick fix...");
    const quickFix = await firebaseValidation.quickFix();

    if (quickFix.success) {
      console.log("✅", quickFix.message);
      console.log("🔄 Please try your app again");
    } else {
      console.log("❌", quickFix.message);
    }
  }

  console.log(
    "\n📚 Need help? Check FIREBASE_SETUP.md for detailed instructions"
  );
}

// Self-executing function
(async () => {
  try {
    await runValidation();
  } catch (error) {
    console.error("💥 Validation script failed:", error);
    console.log("\n💡 This might be a configuration issue. Please check:");
    console.log("1. Your .env file has all required variables");
    console.log("2. Your Firebase project is properly set up");
    console.log("3. Your network connection is working");
  }
})();
