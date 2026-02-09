/**
 * Zeina Configuration Checker
 *
 * This script validates the configuration needed for Zeina voice assistant.
 * Run with: bunx tsx scripts/check-zeina-config.ts
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

// Load environment variables
config();

console.log("🔍 Checking Zeina Voice Assistant Configuration...\n");

// Check for .env file
const envPath = join(process.cwd(), ".env");
const envExists = existsSync(envPath);

console.log("📁 Environment File:");
if (envExists) {
  console.log("  ✅ .env file found");
} else {
  console.log("  ❌ .env file not found");
  console.log("  📝 Create a .env file in the project root");
  console.log("  💡 Use .env.example as a template\n");
}

// Check API keys
console.log("\n🔑 API Keys:");

const openaiKey = process.env.OPENAI_API_KEY;
const zeinaKey = process.env.ZEINA_API_KEY;

if (openaiKey) {
  const maskedKey =
    openaiKey.length > 15
      ? `${openaiKey.substring(0, 7)}...${openaiKey.substring(openaiKey.length - 4)}`
      : "***";
  console.log(`  ✅ OPENAI_API_KEY: ${maskedKey}`);

  // Validate key format
  if (!openaiKey.startsWith("sk-")) {
    console.log('  ⚠️  Warning: Key should start with "sk-" or "sk-proj-"');
  }

  if (
    openaiKey.includes(" ") ||
    openaiKey.includes('"') ||
    openaiKey.includes("'")
  ) {
    console.log("  ⚠️  Warning: Key contains spaces or quotes - remove them");
  }
} else {
  console.log("  ❌ OPENAI_API_KEY: Not set");
}

if (zeinaKey) {
  const maskedKey =
    zeinaKey.length > 15
      ? `${zeinaKey.substring(0, 7)}...${zeinaKey.substring(zeinaKey.length - 4)}`
      : "***";
  console.log(`  ✅ ZEINA_API_KEY: ${maskedKey}`);
} else {
  console.log("  ℹ️  ZEINA_API_KEY: Not set (will use OPENAI_API_KEY)");
}

// Check required packages
console.log("\n📦 Required Packages:");

try {
  require.resolve("expo-av");
  console.log("  ✅ expo-av: Installed");
} catch {
  console.log("  ❌ expo-av: Not found");
}

try {
  require.resolve("expo-constants");
  console.log("  ✅ expo-constants: Installed");
} catch {
  console.log("  ❌ expo-constants: Not found");
}

try {
  require.resolve("expo-file-system");
  console.log("  ✅ expo-file-system: Installed");
} catch {
  console.log("  ❌ expo-file-system: Not found");
}

// Summary
console.log(`\n${"=".repeat(50)}`);
console.log("📋 Summary:");

const hasEnv = envExists;
const hasApiKey = !!(openaiKey || zeinaKey);

if (hasEnv && hasApiKey) {
  console.log("  ✅ Configuration looks good!");
  console.log("\n📱 Next Steps:");
  console.log("  1. Restart the development server (if running)");
  console.log("  2. Rebuild the app:");
  console.log("     - npm run ios (for iOS)");
  console.log("     - npm run android (for Android)");
  console.log("  3. Test Zeina voice assistant on a physical device");
} else {
  console.log("  ⚠️  Configuration incomplete");
  console.log("\n📝 Required Actions:");

  if (!hasEnv) {
    console.log("  1. Create a .env file in the project root");
  }

  if (!hasApiKey) {
    console.log("  2. Add OPENAI_API_KEY to your .env file");
    console.log("     Get your key from: https://platform.openai.com/api-keys");
  }

  console.log("\n  After updating .env:");
  console.log("  - Restart dev server");
  console.log("  - Rebuild the app (npm run ios/android)");
}

console.log("\n📖 For detailed setup instructions, see:");
console.log("   docs/ZEINA_SETUP.md");
console.log(`${"=".repeat(50)}\n`);
