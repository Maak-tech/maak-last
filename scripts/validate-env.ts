/**
 * Environment Variables Validation Script
 * 
 * This script validates that all required Firebase environment variables are present
 * Run with: bunx tsx scripts/validate-env.ts
 */

const requiredVars = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
];

const optionalVars = [
  "EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID",
];

console.log("🔍 Validating Firebase Environment Variables...\n");

let allValid = true;
const missing: string[] = [];
const hasQuotes: string[] = [];
const empty: string[] = [];

// Check required variables
for (const varName of requiredVars) {
  const value = process.env[varName];
  
  if (!value) {
    missing.push(varName);
    allValid = false;
    console.log(`❌ ${varName}: MISSING`);
  } else {
    // Check if value has quotes
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      hasQuotes.push(varName);
      console.log(`⚠️  ${varName}: Has quotes (will be auto-stripped)`);
    } else if (value.trim() === "") {
      empty.push(varName);
      allValid = false;
      console.log(`❌ ${varName}: EMPTY`);
    } else {
      console.log(`✅ ${varName}: OK`);
    }
  }
}

// Check optional variables
console.log("\n📋 Optional Variables:");
for (const varName of optionalVars) {
  const value = process.env[varName];
  if (!value) {
    console.log(`ℹ️  ${varName}: Not set (optional)`);
  } else {
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      console.log(`⚠️  ${varName}: Has quotes (will be auto-stripped)`);
    } else {
      console.log(`✅ ${varName}: OK`);
    }
  }
}

// Summary
console.log("\n" + "=".repeat(50));
if (allValid && hasQuotes.length === 0) {
  console.log("✅ All required environment variables are present and valid!");
} else if (allValid && hasQuotes.length > 0) {
  console.log("✅ All required environment variables are present!");
  console.log(`⚠️  Note: ${hasQuotes.length} variable(s) have quotes (these will be auto-stripped by the app)`);
} else {
  console.log("❌ Issues found:");
  if (missing.length > 0) {
    console.log(`   - Missing: ${missing.join(", ")}`);
  }
  if (empty.length > 0) {
    console.log(`   - Empty: ${empty.join(", ")}`);
  }
  if (hasQuotes.length > 0) {
    console.log(`   - Has quotes: ${hasQuotes.join(", ")} (will be auto-stripped)`);
  }
}

console.log("\n💡 Tips:");
console.log("   - Remove quotes from .env file values (e.g., KEY=value not KEY=\"value\")");
console.log("   - Restart your dev server after changing .env file");
console.log("   - Make sure .env file is in the project root directory");

process.exit(allValid ? 0 : 1);

