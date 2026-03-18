/**
 * Production Readiness Validation Script
 *
 * This script validates that your app is ready for production deployment.
 * Run with: bunx tsx scripts/validate-production.ts
 */

import { execSync } from "node:child_process";
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

function fileIsTrackedInGit(filePath: string): boolean {
  try {
    const output = execSync(`git ls-files -- "${filePath}"`, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return output.length > 0;
  } catch {
    return false;
  }
}

// Check environment variables
function checkEnvVars() {
  console.log("\n📋 Checking Environment Variables...\n");

  const requiredVars = [
    "EXPO_PUBLIC_API_URL",
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "OPENAI_API_KEY",
  ];

  const optionalVars = [
    "FITBIT_CLIENT_ID",
    "FITBIT_CLIENT_SECRET",
  ];

  let allPresent = true;

  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value?.trim()) {
      addResult(`Env: ${varName}`, "pass", "Present");
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

// Check native push notification config files.
// Note: the app uses Expo Push Notifications (not the Firebase SDK). These files
// are still required because Expo uses FCM as the underlying transport on Android/iOS.
// They contain no Firebase SDK credentials — only the project sender IDs needed by FCM.
function checkNativeConfigFiles() {
  console.log("\n📱 Checking Native Push Notification Config Files...\n");

  const androidFile = "google-services.json";
  const iosFile = "GoogleService-Info.plist";

  if (fileExists(androidFile)) {
    if (fileHasContent(androidFile)) {
      addResult(
        "Expo Push (FCM transport): google-services.json",
        "pass",
        "File exists and has content"
      );
    } else {
      addResult(
        "Expo Push (FCM transport): google-services.json",
        "fail",
        "File exists but is empty",
        "Required as FCM transport credential for Expo push on Android"
      );
    }
  } else {
    addResult(
      "Expo Push (FCM transport): google-services.json",
      "warning",
      "File not found (will be restored from EAS env vars during build)",
      "Ensure GOOGLE_SERVICES_JSON is set in EAS secrets"
    );
  }

  if (fileExists(iosFile)) {
    if (fileHasContent(iosFile)) {
      addResult(
        "Expo Push (FCM transport): GoogleService-Info.plist",
        "pass",
        "File exists and has content"
      );
    } else {
      addResult(
        "Expo Push (FCM transport): GoogleService-Info.plist",
        "fail",
        "File exists but is empty",
        "Required as FCM transport credential for Expo push on iOS"
      );
    }
  } else {
    addResult(
      "Expo Push (FCM transport): GoogleService-Info.plist",
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

function checkPatchFiles() {
  console.log("\nChecking Runtime Patch Files...\n");

  const requiredPatchFiles = ["patches/expo-font+14.0.11.patch"];

  for (const patchFile of requiredPatchFiles) {
    if (!fileExists(patchFile)) {
      addResult(
        `Patch: ${patchFile}`,
        "fail",
        "Required patch file not found",
        `Add ${patchFile} and ensure it is committed before production builds`
      );
      continue;
    }

    if (!fileHasContent(patchFile)) {
      addResult(
        `Patch: ${patchFile}`,
        "fail",
        "Patch file exists but is empty",
        "Regenerate the patch with patch-package and commit the file"
      );
      continue;
    }

    if (!fileIsTrackedInGit(patchFile)) {
      addResult(
        `Patch: ${patchFile}`,
        "fail",
        "Patch file is not tracked by git",
        "Run `git add patches/expo-font+14.0.11.patch` and commit before production builds"
      );
      continue;
    }

    addResult(
      `Patch: ${patchFile}`,
      "pass",
      "Required patch file present and tracked"
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

// Check API / backend config (Railway + Drizzle).
// Firebase has been fully replaced by Elysia on Railway + Neon (PostgreSQL).
function checkAPIConfig() {
  console.log("\n🛠️  Checking API / Backend Configuration...\n");

  // Confirm there are no stale Firebase files present (they should have been removed)
  if (fileExists("firestore.rules")) {
    addResult(
      "API: No stale firestore.rules",
      "warning",
      "firestore.rules still present — Firebase has been decommissioned",
      "Delete firestore.rules; security is now enforced in api/src/routes/* middleware"
    );
  } else {
    addResult(
      "API: No stale firestore.rules",
      "pass",
      "firestore.rules not present (Firebase decommissioned)"
    );
  }

  if (fileExists("firestore.indexes.json")) {
    addResult(
      "API: No stale firestore.indexes.json",
      "warning",
      "firestore.indexes.json still present — Firebase has been decommissioned",
      "Delete firestore.indexes.json; queries are now served by Neon + Drizzle"
    );
  } else {
    addResult(
      "API: No stale firestore.indexes.json",
      "pass",
      "firestore.indexes.json not present (Firebase decommissioned)"
    );
  }

  // Confirm Railway deployment config exists
  if (fileExists("api/railway.json") || fileExists("railway.json")) {
    addResult(
      "API: railway.json",
      "pass",
      "Railway deployment config present"
    );
  } else {
    addResult(
      "API: railway.json",
      "warning",
      "railway.json not found",
      "Create api/railway.json with build + cron job configuration"
    );
  }

  // Confirm Drizzle migrations exist
  if (fileExists("api/drizzle")) {
    addResult(
      "API: Drizzle migrations",
      "pass",
      "Drizzle migrations folder present"
    );
  } else {
    addResult(
      "API: Drizzle migrations",
      "fail",
      "api/drizzle/ folder not found",
      "Run `bun drizzle-kit generate` inside api/ to generate migrations"
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
  checkNativeConfigFiles();
  checkEASConfig();
  checkPatchFiles();
  checkAppConfig();
  checkAPIConfig();
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
