/**
 * Environment Variables Validation Script
 *
 * This script validates that all required Firebase environment variables are present
 * Run with: bunx tsx scripts/validate-env.ts
 *
 * Note: EAS secrets are only available during builds, not in local environment
 */

// Load .env file if it exists
try {
  const fs = require("fs");
  const path = require("path");
  const envPath = path.join(process.cwd(), ".env");

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const envLines = envContent.split("\n");

    for (const line of envLines) {
      const trimmedLine = line.trim();
      // Skip comments and empty lines
      if (!trimmedLine || trimmedLine.startsWith("#")) continue;

      const equalIndex = trimmedLine.indexOf("=");
      if (equalIndex === -1) continue;

      const key = trimmedLine.substring(0, equalIndex).trim();
      let value = trimmedLine.substring(equalIndex + 1).trim();

      // Remove surrounding quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Set environment variable if not already set
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
} catch (error) {
  // Silently handle .env loading errors
}

const requiredVars = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
];

const optionalVars = ["EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID"];

// Check if we're in an EAS build environment
const isEASBuild =
  process.env.EAS_BUILD === "true" ||
  process.env.EXPO_PUBLIC_EAS_BUILD === "true";
const isCI = process.env.CI === "true";

console.log("🔍 Validating Firebase Environment Variables...\n");

if (isEASBuild) {
  console.log("📦 EAS Build Environment Detected - Checking EAS secrets...\n");
} else {
  console.log("💻 Local Environment - Checking .env file or EAS secrets...\n");
  console.log(
    "ℹ️  Note: EAS secrets are only available during builds, not locally.\n"
  );
}

let allValid = true;
const missing: string[] = [];
const hasQuotes: string[] = [];
const empty: string[] = [];

// Check required variables
for (const varName of requiredVars) {
  const value = process.env[varName];

  if (value) {
    // Check if value has quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      hasQuotes.push(varName);
      console.log(`⚠️  ${varName}: Has quotes (will be auto-stripped)`);
    } else if (value.trim() === "") {
      empty.push(varName);
      allValid = false;
      console.log(`❌ ${varName}: EMPTY`);
    } else {
      console.log(`✅ ${varName}: OK`);
    }
  } else {
    missing.push(varName);
    allValid = false;
    console.log(`❌ ${varName}: MISSING`);
  }
}

// Check optional variables
console.log("\n📋 Optional Variables:");
for (const varName of optionalVars) {
  const value = process.env[varName];
  if (value) {
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      console.log(`⚠️  ${varName}: Has quotes (will be auto-stripped)`);
    } else {
      console.log(`✅ ${varName}: OK`);
    }
  } else {
    console.log(`ℹ️  ${varName}: Not set (optional)`);
  }
}

// Summary
console.log("\n" + "=".repeat(50));
if (allValid && hasQuotes.length === 0) {
  console.log("✅ All required environment variables are present and valid!");
} else if (allValid && hasQuotes.length > 0) {
  console.log("✅ All required environment variables are present!");
  console.log(
    `⚠️  Note: ${hasQuotes.length} variable(s) have quotes (these will be auto-stripped by the app)`
  );
} else {
  console.log("❌ Issues found:");
  if (missing.length > 0) {
    console.log(`   - Missing: ${missing.join(", ")}`);
  }
  if (empty.length > 0) {
    console.log(`   - Empty: ${empty.join(", ")}`);
  }
  if (hasQuotes.length > 0) {
    console.log(
      `   - Has quotes: ${hasQuotes.join(", ")} (will be auto-stripped)`
    );
  }
}

console.log("\n💡 Tips:");
if (isEASBuild) {
  console.log(
    "   - EAS secrets should be automatically available during build"
  );
  console.log("   - If variables are missing, check: eas secret:list");
} else {
  console.log(
    "   - For local development: Copy .env.example to .env and fill in your values"
  );
  console.log(
    '   - Remove quotes from .env file values (e.g., KEY=value not KEY="value")'
  );
  console.log("   - Restart your dev server after changing .env file");
  console.log("   - Make sure .env file is in the project root directory");
  console.log("\n📝 EAS Secrets:");
  console.log("   - To verify EAS secrets are set, run: eas secret:list");
  console.log("   - EAS secrets are automatically available during builds");
  console.log(
    "   - The app will use hardcoded Firebase configs as fallbacks locally"
  );
}

// Check EAS secrets if available
if (!(isEASBuild || allValid)) {
  console.log("\n✅ EAS Secrets Status:");
  console.log(
    "   - If you've set EAS secrets, they will be available during builds"
  );
  console.log("   - To verify secrets: eas secret:list");
  console.log(
    "   - Local development will use hardcoded Firebase configs as fallbacks"
  );
  console.log(
    "   - This is OK for development - secrets are used in production builds"
  );
}

// Exit logic
if (allValid) {
  console.log("\n✅ All required environment variables are present!");
  process.exit(0);
} else if (isEASBuild || isCI) {
  // Fail in EAS build or CI environment where secrets should be available
  console.log(
    "\n❌ Error: Required environment variables are missing in build environment."
  );
  console.log("   Please ensure EAS secrets are set: eas secret:list");
  process.exit(1);
} else {
  // Warn but don't fail in local development
  console.log("\n⚠️  Warning: Environment variables not set locally.");
  console.log("   The app will use hardcoded Firebase configs as fallbacks.");
  console.log(
    "   This is OK for development - EAS secrets will be used in production builds."
  );
  process.exit(0);
}
