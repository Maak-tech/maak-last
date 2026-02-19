/**
 * EAS OpenAI API Key Configuration Checker
 *
 * This script helps diagnose issues with OpenAI API keys in EAS production builds.
 * It checks both local .env and EAS secrets configuration.
 *
 * Run with: bunx tsx scripts/check-eas-openai-config.ts
 */

require("dotenv").config();

const { execSync } = require("child_process");

console.log("🔍 Checking EAS OpenAI API Key Configuration...\n");

// Check if EAS CLI is installed
let easInstalled = false;
try {
  execSync("eas --version", { stdio: "ignore" });
  easInstalled = true;
} catch {
  console.log("⚠️  EAS CLI not found. Install with: npm install -g eas-cli");
  console.log("   Some checks will be skipped.\n");
}

// Check local .env file
console.log("📁 Checking local .env file:");
const localOpenAIKey = process.env.OPENAI_API_KEY;
const localZeinaKey = process.env.ZEINA_API_KEY;

if (localOpenAIKey) {
  const masked =
    localOpenAIKey.length > 15
      ? `${localOpenAIKey.substring(0, 7)}...${localOpenAIKey.substring(localOpenAIKey.length - 4)}`
      : "***";
  console.log(`   ✅ OPENAI_API_KEY found: ${masked}`);

  // Validate format
  if (!localOpenAIKey.startsWith("sk-")) {
    console.log("   ⚠️  Warning: Key doesn't start with 'sk-' - may be invalid");
  }

  // Check for common issues
  if (localOpenAIKey.includes('"') || localOpenAIKey.includes("'")) {
    console.log("   ⚠️  Warning: Key contains quotes - remove them!");
  }
  if (localOpenAIKey.includes(" ")) {
    console.log("   ⚠️  Warning: Key contains spaces - remove them!");
  }
  if (localOpenAIKey.trim() !== localOpenAIKey) {
    console.log("   ⚠️  Warning: Key has leading/trailing whitespace!");
  }
} else {
  console.log("   ❌ OPENAI_API_KEY not found in .env");
}

if (localZeinaKey && localZeinaKey !== localOpenAIKey) {
  const masked =
    localZeinaKey.length > 15
      ? `${localZeinaKey.substring(0, 7)}...${localZeinaKey.substring(localZeinaKey.length - 4)}`
      : "***";
  console.log(`   ✅ ZEINA_API_KEY found: ${masked}`);
} else if (!localZeinaKey) {
  console.log("   ℹ️  ZEINA_API_KEY not set (will use OPENAI_API_KEY)");
}

console.log("\n☁️  Checking EAS Secrets:");

if (easInstalled) {
  try {
    // List EAS secrets
    const secretsOutput = execSync("eas secret:list --scope project --json", {
      encoding: "utf-8",
      stdio: "pipe",
    });

    const secrets = JSON.parse(secretsOutput);
    const secretNames = secrets.map((s: { name: string }) => s.name);

    console.log(`   Found ${secrets.length} project secrets`);

    // Check for OPENAI_API_KEY
    if (secretNames.includes("OPENAI_API_KEY")) {
      console.log("   ✅ OPENAI_API_KEY secret exists in EAS");
    } else {
      console.log("   ❌ OPENAI_API_KEY secret NOT found in EAS");
      console.log("      This is required for production builds!");
    }

    // Check for EXPO_PUBLIC_OPENAI_API_KEY
    if (secretNames.includes("EXPO_PUBLIC_OPENAI_API_KEY")) {
      console.log("   ✅ EXPO_PUBLIC_OPENAI_API_KEY secret exists in EAS");
    } else {
      console.log(
        "   ℹ️  EXPO_PUBLIC_OPENAI_API_KEY not set (using OPENAI_API_KEY)"
      );
    }

    // Check for ZEINA_API_KEY
    if (secretNames.includes("ZEINA_API_KEY")) {
      console.log("   ✅ ZEINA_API_KEY secret exists in EAS");
    } else {
      console.log("   ℹ️  ZEINA_API_KEY not set (will use OPENAI_API_KEY)");
    }

    // Check for EXPO_PUBLIC_ZEINA_API_KEY
    if (secretNames.includes("EXPO_PUBLIC_ZEINA_API_KEY")) {
      console.log("   ✅ EXPO_PUBLIC_ZEINA_API_KEY secret exists in EAS");
    }
  } catch (error: any) {
    console.log("   ⚠️  Could not list EAS secrets");
    if (error.message) {
      console.log(`      Error: ${error.message}`);
    }
    console.log("   Make sure you're logged in: eas login");
  }
} else {
  console.log("   ⏭️  Skipping EAS checks (EAS CLI not installed)");
}

console.log("\n📋 Configuration Summary:");
console.log("\n   Your app.config.js reads from:");
console.log("   - OPENAI_API_KEY or EXPO_PUBLIC_OPENAI_API_KEY → openaiApiKey");
console.log("   - ZEINA_API_KEY or EXPO_PUBLIC_ZEINA_API_KEY → zeinaApiKey");
console.log("   - Falls back to OPENAI_API_KEY if ZEINA_API_KEY not set");

console.log("\n   Your openaiService.ts reads from:");
console.log("   - Constants.expoConfig?.extra?.openaiApiKey");
console.log("   - Constants.expoConfig?.extra?.zeinaApiKey");
console.log("   - process.env.EXPO_PUBLIC_OPENAI_API_KEY");
console.log("   - process.env.EXPO_PUBLIC_ZEINA_API_KEY");

console.log("\n🔧 To Fix Production Issues:");
console.log("\n   1. Set EAS secret (if not already set):");
console.log(
  "      eas secret:create --scope project --name OPENAI_API_KEY --value YOUR_KEY --type string --visibility secret --environment production"
);
console.log("\n   2. Or update existing secret:");
console.log(
  "      eas secret:update --scope project --name OPENAI_API_KEY --value YOUR_KEY --type string --visibility secret --environment production"
);
console.log("\n   3. Verify the secret is set:");
console.log("      eas secret:list --scope project");
console.log(
  "\n   4. IMPORTANT: Rebuild your app after setting/updating secrets:"
);
console.log("      eas build --platform ios --profile production");
console.log("      eas build --platform android --profile production");
console.log(
  "\n   5. The secret must be available during build time (not runtime)"
);
console.log("      It gets baked into app.config.js during the build process");

console.log("\n⚠️  Common Issues:");
console.log("   ❌ Secret set but app not rebuilt → Rebuild required!");
console.log(
  "   ❌ Secret has quotes/spaces → Remove them from the secret value"
);
console.log(
  "   ❌ Secret name wrong → Must be OPENAI_API_KEY or EXPO_PUBLIC_OPENAI_API_KEY"
);
console.log(
  "   ❌ Secret not set for production environment → Set --environment production"
);
console.log(
  "   ❌ API key actually expired → Get new key from OpenAI dashboard"
);

console.log("\n🧪 Test API Key Validity:");
if (localOpenAIKey) {
  testApiKey(localOpenAIKey).catch(() => {
    console.log("   Could not test API key");
  });
} else {
  console.log("   ⏭️  Skipping API test (no key in .env)");
}

async function testApiKey(key: string) {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      console.log("   ✅ API key is valid and working");
    } else if (response.status === 401) {
      console.log("   ❌ API key is invalid or expired (401 Unauthorized)");
      console.log(
        "      Get a new key from: https://platform.openai.com/api-keys"
      );
    } else {
      console.log(`   ⚠️  API returned status ${response.status}`);
    }
  } catch (error: unknown) {
    console.log(
      `   ⚠️  Could not test API key: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
