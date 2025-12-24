/**
 * Firebase Migration Validation Script
 *
 * This script helps validate that your Firebase migration is complete
 * Run with: bunx tsx scripts/validate-firebase-migration.ts
 */

const fs = require("fs");
const path = require("path");

console.log("🔍 Validating Firebase Migration Setup...\n");

let allValid = true;
const issues: string[] = [];

// Check 1: Environment variables
console.log("📋 Checking Environment Variables...");
const requiredVars = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
];

const envVars: Record<string, string> = {};
for (const varName of requiredVars) {
  const value = process.env[varName];
  if (!value || value.trim() === "") {
    issues.push(`Missing environment variable: ${varName}`);
    allValid = false;
    console.log(`❌ ${varName}: MISSING`);
  } else {
    envVars[varName] = value;
    console.log(`✅ ${varName}: Set`);
  }
}

// Check 2: .firebaserc file
console.log("\n📋 Checking .firebaserc Configuration...");
const firebasercPath = path.join(__dirname, "../.firebaserc");
if (fs.existsSync(firebasercPath)) {
  try {
    const firebaserc = JSON.parse(fs.readFileSync(firebasercPath, "utf8"));
    const projectId = firebaserc.projects?.default;
    
    if (!projectId) {
      issues.push(".firebaserc missing 'default' project");
      allValid = false;
      console.log("❌ .firebaserc: Missing default project");
    } else {
      console.log(`✅ .firebaserc: Project ID = ${projectId}`);
      
      // Check if it matches environment variable
      const envProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
      if (envProjectId && projectId !== envProjectId) {
        issues.push(
          `.firebaserc project ID (${projectId}) doesn't match EXPO_PUBLIC_FIREBASE_PROJECT_ID (${envProjectId})`
        );
        console.log(
          `⚠️  Warning: Project ID mismatch between .firebaserc and .env`
        );
      }
    }
  } catch (error) {
    issues.push(`Error reading .firebaserc: ${error}`);
    allValid = false;
    console.log(`❌ .firebaserc: Invalid JSON`);
  }
} else {
  issues.push(".firebaserc file not found");
  allValid = false;
  console.log("❌ .firebaserc: File not found");
}

// Check 3: Service account file (optional)
console.log("\n📋 Checking Service Account (Optional)...");
const serviceAccountPath = path.join(
  __dirname,
  "../firebase-service-account.json"
);
if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf8")
    );
    const saProjectId = serviceAccount.project_id;
    
    if (saProjectId) {
      console.log(`✅ Service Account: Project ID = ${saProjectId}`);
      
      // Check if it matches environment variable
      const envProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
      if (envProjectId && saProjectId !== envProjectId) {
        issues.push(
          `Service account project ID (${saProjectId}) doesn't match EXPO_PUBLIC_FIREBASE_PROJECT_ID (${envProjectId})`
        );
        console.log(
          `⚠️  Warning: Service account project ID doesn't match .env`
        );
      }
    } else {
      console.log("⚠️  Service Account: Missing project_id");
    }
  } catch (error) {
    console.log("⚠️  Service Account: Invalid JSON (will be ignored)");
  }
} else {
  console.log("ℹ️  Service Account: Not found (optional, only needed for Admin SDK scripts)");
}

// Check 4: Detect old project references
console.log("\n📋 Checking for Old Project References...");
const oldProjectIds = ["maak-5caad", "maak-health-demo"];
const envProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

if (envProjectId && oldProjectIds.includes(envProjectId)) {
  issues.push(
    `Environment variable still references old project: ${envProjectId}`
  );
  allValid = false;
  console.log(`❌ Old project ID detected: ${envProjectId}`);
} else {
  console.log("✅ No old project IDs detected");
}

// Summary
console.log("\n" + "=".repeat(60));
if (allValid && issues.length === 0) {
  console.log("✅ Firebase migration validation passed!");
  console.log("\n📝 Next Steps:");
  console.log("1. Restart your development server");
  console.log("2. Test Firebase connection in your app");
  console.log("3. Run Firebase test page: /firebase-test");
  console.log("4. Verify you can create accounts and read/write data");
} else {
  console.log("❌ Migration validation found issues:\n");
  issues.forEach((issue) => {
    console.log(`   - ${issue}`);
  });
  console.log("\n💡 Fix these issues and run the script again.");
  console.log("📚 See docs/FIREBASE_MIGRATION_GUIDE.md for detailed instructions.");
}

process.exit(allValid && issues.length === 0 ? 0 : 1);

