/**
 * Production Readiness Validation Script
 *
 * This script validates that your app is ready for production deployment.
 * Run with: bunx tsx scripts/validate-production.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type ValidationResult = {
  name: string;
  status: "pass" | "fail" | "warning";
  message: string;
  fix?: string;
};

const results: ValidationResult[] = [];

function addResult(
  name: string,
  status: "pass" | "fail" | "warning",
  message: string,
  fix?: string
) {
  results.push({ name, status, message, fix });
}

// Check if file exists
function fileExists(filePath: string): boolean {
  return existsSync(join(process.cwd(), filePath));
}

// Check if file has content
function fileHasContent(filePath: string): boolean {
  try {
    const content = readFileSync(join(process.cwd(), filePath), "utf-8");
    return content.trim().length > 0;
  } catch {
    return false;
  }
}

function hasFirebaseConfigFallback(): boolean {
  try {
    const firebaseModulePath = join(process.cwd(), "lib", "firebase.ts");
    const content = readFileSync(firebaseModulePath, "utf-8");
    return (
      content.includes("const firebaseConfig =") &&
      content.includes("projectId") &&
      content.includes("apiKey")
    );
  } catch {
    return false;
  }
}

// Check environment variables
function checkEnvVars() {
  console.log("\n📋 Checking Environment Variables...\n");

  const requiredVars = [
    "EXPO_PUBLIC_FIREBASE_API_KEY",
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "EXPO_PUBLIC_FIREBASE_APP_ID",
  ];

  const optionalVars = [
    "OPENAI_API_KEY",
    "FITBIT_CLIENT_ID",
    "FITBIT_CLIENT_SECRET",
  ];

  let allPresent = true;
  const hasFallbackConfig = hasFirebaseConfigFallback();
  const hasAndroidConfigFile = fileExists("google-services.json");
  const hasIosConfigFile = fileExists("GoogleService-Info.plist");

  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value?.trim()) {
      addResult(`Env: ${varName}`, "pass", "Present");
    } else if (hasFallbackConfig || hasAndroidConfigFile || hasIosConfigFile) {
      addResult(
        `Env: ${varName}`,
        "warning",
        "Missing (fallback config detected)",
        "Recommended: set this in .env or EAS secrets for explicit production config"
      );
    } else {
      allPresent = false;
      addResult(
        `Env: ${varName}`,
        "fail",
        "Missing",
        "Set this in your .env file or EAS secrets"
      );
    }
  }

  for (const varName of optionalVars) {
    const value = process.env[varName];
    if (value?.trim()) {
      addResult(`Env: ${varName}`, "pass", "Present");
    } else {
      addResult(
        `Env: ${varName}`,
        "warning",
        "Not set (optional)",
        "Set this if you need OpenAI or Fitbit integration"
      );
    }
  }

  return allPresent;
}

// Check Firebase configuration files
function checkFirebaseFiles() {
  console.log("\n🔥 Checking Firebase Configuration Files...\n");

  const androidFile = "google-services.json";
  const iosFile = "GoogleService-Info.plist";

  if (fileExists(androidFile)) {
    if (fileHasContent(androidFile)) {
      addResult(
        "Firebase: google-services.json",
        "pass",
        "File exists and has content"
      );
    } else {
      addResult(
        "Firebase: google-services.json",
        "fail",
        "File exists but is empty",
        "Download from Firebase Console and add to project root"
      );
    }
  } else {
    addResult(
      "Firebase: google-services.json",
      "warning",
      "File not found (will be restored from EAS env vars during build)",
      "Ensure GOOGLE_SERVICES_JSON is set in EAS secrets"
    );
  }

  if (fileExists(iosFile)) {
    if (fileHasContent(iosFile)) {
      addResult(
        "Firebase: GoogleService-Info.plist",
        "pass",
        "File exists and has content"
      );
    } else {
      addResult(
        "Firebase: GoogleService-Info.plist",
        "fail",
        "File exists but is empty",
        "Download from Firebase Console and add to project root"
      );
    }
  } else {
    addResult(
      "Firebase: GoogleService-Info.plist",
      "warning",
      "File not found (will be restored from EAS env vars during build)",
      "Ensure GOOGLE_SERVICE_INFO_PLIST is set in EAS secrets"
    );
  }
}

// Check EAS configuration
/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Validation branches intentionally mirror eas.json profile checks for explicit reporting. */
function checkEASConfig() {
  console.log("\n⚙️  Checking EAS Configuration...\n");

  if (!fileExists("eas.json")) {
    addResult(
      "EAS: eas.json",
      "fail",
      "eas.json file not found",
      "Create eas.json with build profiles"
    );
    return;
  }

  try {
    const easConfig = JSON.parse(readFileSync("eas.json", "utf-8"));

    // Check production profile exists
    if (easConfig.build?.production) {
      addResult(
        "EAS: Production profile",
        "pass",
        "Production build profile configured"
      );

      // Check iOS config
      if (easConfig.build.production.ios) {
        if (easConfig.build.production.ios.autoIncrement) {
          addResult(
            "EAS: iOS auto-increment",
            "pass",
            "Auto-increment enabled"
          );
        } else {
          addResult(
            "EAS: iOS auto-increment",
            "warning",
            "Auto-increment not enabled",
            'Add "autoIncrement": true to production.ios in eas.json'
          );
        }
      }

      // Check Android config
      if (easConfig.build.production.android) {
        if (easConfig.build.production.android.buildType === "app-bundle") {
          addResult(
            "EAS: Android build type",
            "pass",
            "App bundle configured (required for Play Store)"
          );
        } else {
          addResult(
            "EAS: Android build type",
            "fail",
            "Must use app-bundle for production",
            'Set "buildType": "app-bundle" in production.android'
          );
        }

        if (easConfig.build.production.android.autoIncrement) {
          addResult(
            "EAS: Android auto-increment",
            "pass",
            "Auto-increment enabled"
          );
        } else {
          addResult(
            "EAS: Android auto-increment",
            "warning",
            "Auto-increment not enabled",
            'Add "autoIncrement": true to production.android in eas.json'
          );
        }
      }
    } else {
      addResult(
        "EAS: Production profile",
        "fail",
        "Production build profile not found",
        "Add production profile to eas.json"
      );
    }

    // Check submit configuration
    if (easConfig.submit?.production) {
      addResult(
        "EAS: Submit configuration",
        "pass",
        "Production submit profile configured"
      );
    } else {
      addResult(
        "EAS: Submit configuration",
        "warning",
        "Submit profile not configured",
        "Add submit.production to eas.json for automated submission"
      );
    }
  } catch (error) {
    addResult(
      "EAS: eas.json",
      "fail",
      `Error parsing eas.json: ${error}`,
      "Fix JSON syntax errors"
    );
  }
}

// Check app.config.js
function checkAppConfig() {
  console.log("\n📱 Checking App Configuration...\n");

  if (!fileExists("app.config.js")) {
    addResult(
      "App Config: app.config.js",
      "fail",
      "app.config.js not found",
      "Create app.config.js with Expo configuration"
    );
    return;
  }

  try {
    const configContent = readFileSync("app.config.js", "utf-8");

    // Check for version
    if (configContent.includes("version:")) {
      addResult("App Config: Version", "pass", "Version specified");
    } else {
      addResult(
        "App Config: Version",
        "warning",
        "Version not found",
        "Add version field to app.config.js"
      );
    }

    // Check for bundle identifiers
    if (configContent.includes("bundleIdentifier")) {
      addResult(
        "App Config: iOS Bundle ID",
        "pass",
        "Bundle identifier configured"
      );
    } else {
      addResult(
        "App Config: iOS Bundle ID",
        "fail",
        "Bundle identifier not found",
        "Add ios.bundleIdentifier to app.config.js"
      );
    }

    if (configContent.includes("package:")) {
      addResult(
        "App Config: Android Package",
        "pass",
        "Package name configured"
      );
    } else {
      addResult(
        "App Config: Android Package",
        "fail",
        "Package name not found",
        "Add android.package to app.config.js"
      );
    }

    // Check for environment variable usage
    if (configContent.includes("process.env")) {
      addResult(
        "App Config: Environment variables",
        "pass",
        "Using environment variables"
      );
    }
  } catch (error) {
    addResult(
      "App Config: app.config.js",
      "fail",
      `Error reading app.config.js: ${error}`,
      "Fix file syntax errors"
    );
  }
}

// Check Firestore rules
function checkFirestoreRules() {
  console.log("\n🔒 Checking Firestore Security Rules...\n");

  if (!fileExists("firestore.rules")) {
    addResult(
      "Firestore: Rules file",
      "fail",
      "firestore.rules not found",
      "Create firestore.rules with security rules"
    );
    return;
  }

  try {
    const rulesContent = readFileSync("firestore.rules", "utf-8");

    // Check for basic security patterns
    if (rulesContent.includes("request.auth")) {
      addResult(
        "Firestore: Authentication checks",
        "pass",
        "Authentication checks present"
      );
    } else {
      addResult(
        "Firestore: Authentication checks",
        "warning",
        "No authentication checks found",
        "Review security rules to ensure proper authentication"
      );
    }

    // Check for allow rules
    if (rulesContent.includes("allow")) {
      addResult("Firestore: Access rules", "pass", "Access rules defined");
    } else {
      addResult(
        "Firestore: Access rules",
        "fail",
        "No access rules found",
        "Add allow rules to firestore.rules"
      );
    }
  } catch (error) {
    addResult(
      "Firestore: Rules file",
      "fail",
      `Error reading firestore.rules: ${error}`,
      "Fix file syntax errors"
    );
  }
}

// Check package.json
function checkPackageJson() {
  console.log("\n📦 Checking Package Configuration...\n");

  if (!fileExists("package.json")) {
    addResult(
      "Package: package.json",
      "fail",
      "package.json not found",
      "Create package.json"
    );
    return;
  }

  try {
    const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));

    // Check for build scripts
    if (packageJson.scripts) {
      if (packageJson.scripts["build:ios:production"]) {
        addResult(
          "Package: iOS production script",
          "pass",
          "Production build script exists"
        );
      } else {
        addResult(
          "Package: iOS production script",
          "warning",
          "Production build script not found",
          "Add build:ios:production script"
        );
      }

      if (packageJson.scripts["build:android:production"]) {
        addResult(
          "Package: Android production script",
          "pass",
          "Production build script exists"
        );
      } else {
        addResult(
          "Package: Android production script",
          "warning",
          "Production build script not found",
          "Add build:android:production script"
        );
      }
    }

    // Check for required dependencies
    const requiredDeps = ["expo", "react", "react-native"];
    for (const dep of requiredDeps) {
      if (
        packageJson.dependencies?.[dep] ||
        packageJson.devDependencies?.[dep]
      ) {
        addResult(`Package: ${dep}`, "pass", "Dependency present");
      } else {
        addResult(
          `Package: ${dep}`,
          "fail",
          "Required dependency missing",
          `Install ${dep}`
        );
      }
    }
  } catch (error) {
    addResult(
      "Package: package.json",
      "fail",
      `Error parsing package.json: ${error}`,
      "Fix JSON syntax errors"
    );
  }
}

// Main validation function
function main() {
  console.log("🚀 Production Readiness Validation\n");
  console.log("=".repeat(60));

  // Run all checks
  checkEnvVars();
  checkFirebaseFiles();
  checkEASConfig();
  checkAppConfig();
  checkFirestoreRules();
  checkPackageJson();

  // Print results
  console.log(`\n${"=".repeat(60)}`);
  console.log("\n📊 Validation Results:\n");

  const passed = results.filter((r) => r.status === "pass").length;
  const warnings = results.filter((r) => r.status === "warning").length;
  const failed = results.filter((r) => r.status === "fail").length;

  for (const result of results) {
    let icon = "❌";
    if (result.status === "pass") {
      icon = "✅";
    } else if (result.status === "warning") {
      icon = "⚠️";
    }
    console.log(`${icon} ${result.name}: ${result.message}`);
    if (result.fix) {
      console.log(`   💡 Fix: ${result.fix}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("\n📈 Summary:");
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ⚠️  Warnings: ${warnings}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (failed === 0 && warnings === 0) {
    console.log("\n🎉 All checks passed! Your app is ready for production.");
    process.exit(0);
  } else if (failed === 0) {
    console.log(
      "\n✅ All critical checks passed. Review warnings before deploying."
    );
    process.exit(0);
  } else {
    console.log(
      "\n❌ Some checks failed. Please fix the issues above before deploying."
    );
    process.exit(1);
  }
}

main();
