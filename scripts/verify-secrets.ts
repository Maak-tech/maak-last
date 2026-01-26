#!/usr/bin/env tsx
/**
 * Secrets Verification Script
 *
 * This script helps verify that secrets are properly configured in both
 * GitHub Secrets and EAS Secrets.
 *
 * Run with: bunx tsx scripts/verify-secrets.ts
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Load .env file if it exists
try {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const envLines = envContent.split("\n");

    for (const line of envLines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) continue;

      const equalIndex = trimmedLine.indexOf("=");
      if (equalIndex === -1) continue;

      const key = trimmedLine.substring(0, equalIndex).trim();
      let value = trimmedLine.substring(equalIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
} catch (error) {
  // Silently handle .env loading errors
}

// Required secrets for the project
const requiredSecrets = {
  firebase: [
    "EXPO_PUBLIC_FIREBASE_API_KEY",
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "EXPO_PUBLIC_FIREBASE_APP_ID",
  ],
  apiKeys: [
    "OPENAI_API_KEY",
    "ZEINA_API_KEY",
    "FITBIT_CLIENT_ID",
    "FITBIT_CLIENT_SECRET",
    "WITHINGS_CLIENT_ID",
    "WITHINGS_CLIENT_SECRET",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
    "REVENUECAT_PROJECT_ID",
  ],
  optional: [
    "EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID",
    "OURA_CLIENT_ID",
    "OURA_CLIENT_SECRET",
    "GARMIN_CLIENT_ID",
    "GARMIN_CLIENT_SECRET",
    "SAMSUNG_HEALTH_CLIENT_ID",
    "SAMSUNG_HEALTH_CLIENT_SECRET",
    "DEXCOM_CLIENT_ID",
    "DEXCOM_CLIENT_SECRET",
    "DEXCOM_REDIRECT_URI",
    "REVENUECAT_API_KEY",
  ],
  easOnly: ["GOOGLE_SERVICES_JSON", "GOOGLE_SERVICE_INFO_PLIST"],
};

console.log("🔐 Secrets Verification Report\n");
console.log("=".repeat(60));

// Check local .env file
console.log("\n📁 Local .env File:");
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  console.log("   ✅ .env file exists");

  const allSecrets = [
    ...requiredSecrets.firebase,
    ...requiredSecrets.apiKeys,
    ...requiredSecrets.optional,
  ];

  let foundCount = 0;
  for (const secret of allSecrets) {
    if (process.env[secret]) {
      foundCount++;
    }
  }

  console.log(`   📊 Found ${foundCount}/${allSecrets.length} secrets in .env`);
} else {
  console.log("   ⚠️  .env file not found (this is OK if using EAS secrets)");
}

// Check EAS secrets
console.log("\n📦 EAS Secrets:");
try {
  const easListOutput = execSync("eas secret:list --json", {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  const easSecrets = JSON.parse(easListOutput);
  if (easSecrets && easSecrets.length > 0) {
    console.log(`   ✅ Found ${easSecrets.length} EAS secret(s)`);

    const secretNames = easSecrets.map((s: any) => s.name || s.key);
    const allRequired = [
      ...requiredSecrets.firebase,
      ...requiredSecrets.apiKeys,
      ...requiredSecrets.easOnly,
    ];

    const missing = allRequired.filter((req) => !secretNames.includes(req));

    if (missing.length > 0) {
      console.log(`   ⚠️  Missing: ${missing.join(", ")}`);
    } else {
      console.log("   ✅ All required secrets found");
    }

    // Show available secrets (names only, not values)
    console.log("\n   Available EAS secrets:");
    secretNames.forEach((name: string) => {
      console.log(`      - ${name}`);
    });
  } else {
    console.log("   ⚠️  No EAS secrets found");
    console.log("   💡 Run: eas secret:create to set up secrets");
  }
} catch (error: any) {
  if (
    error.message?.includes("not found") ||
    error.message?.includes("command")
  ) {
    console.log("   ⚠️  EAS CLI not found or not authenticated");
    console.log("   💡 Install: npm install -g eas-cli");
    console.log("   💡 Login: eas login");
  } else {
    console.log("   ⚠️  Could not check EAS secrets");
    console.log(`   Error: ${error.message}`);
  }
}

// Check GitHub Secrets (can't directly verify, but provide instructions)
console.log("\n🐙 GitHub Secrets:");
console.log("   ℹ️  GitHub secrets cannot be verified via CLI");
console.log("   📝 To verify repository-level secrets:");
console.log(
  "      1. Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions"
);
console.log("      2. Check that all required secrets are listed");
console.log("\n   📝 To verify Development environment secrets:");
console.log(
  "      1. Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/environments"
);
console.log("      2. Click on 'Development' environment");
console.log("      3. Check that all required secrets are listed");
console.log("\n   Required GitHub secrets (repository-level):");
const allGitHubSecrets = [
  ...requiredSecrets.firebase,
  ...requiredSecrets.apiKeys,
  "FIREBASE_SERVICE_ACCOUNT_KEY",
  "FIREBASE_TOKEN",
];
allGitHubSecrets.forEach((secret) => {
  console.log(`      - ${secret}`);
});
console.log(
  "\n   💡 Tip: You can also set these in the Development environment"
);
console.log("      for environment-specific values");

// Summary
console.log("\n" + "=".repeat(60));
console.log("\n📋 Summary:");
console.log("\n✅ Setup Checklist:");
console.log("   [ ] All Firebase secrets set in GitHub");
console.log("   [ ] All Firebase secrets set in EAS");
console.log("   [ ] All API keys set in GitHub");
console.log("   [ ] All API keys set in EAS");
console.log("   [ ] Google Services files set in EAS (base64 encoded)");
console.log("   [ ] Firebase service account key set in GitHub");

console.log("\n💡 Next Steps:");
console.log("   1. Verify GitHub repository secrets: Settings → Secrets");
console.log(
  "   2. Verify GitHub Development environment: Settings → Environments → Development"
);
console.log("   3. Verify EAS secrets: eas secret:list");
console.log(
  "   4. Test EAS build: eas build --profile production --platform ios"
);
console.log("   5. Test GitHub Actions workflow with Development environment");

console.log("\n📚 Documentation:");
console.log("   See docs/SECRETS_SETUP.md for detailed guide\n");
