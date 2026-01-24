/**
 * OpenAI API Key Validation Script for Zeina Voice Assistant
 *
 * This script validates your OpenAI API key and checks for Realtime API access
 * Run with: bunx tsx scripts/check-openai-key.ts
 */

require("dotenv").config();

const openaiKey = process.env.OPENAI_API_KEY || process.env.ZEINA_API_KEY;

console.log("🔍 Checking OpenAI API Key Configuration for Zeina...\n");

// Check if key exists
if (!openaiKey) {
  console.log("❌ No OpenAI API key found!");
  console.log(
    "   Please set OPENAI_API_KEY or ZEINA_API_KEY in your .env file"
  );
  console.log("\n📝 To fix this:");
  console.log(
    "   1. Get an OpenAI API key from: https://platform.openai.com/api-keys"
  );
  console.log("   2. Add to .env file: OPENAI_API_KEY=sk-proj-your-key-here");
  console.log("   3. Restart your development server");
  console.log("   4. Rebuild the app");
  process.exit(1);
}

// Basic key validation
console.log("✅ OpenAI API key found");

if (openaiKey.startsWith("sk-proj-") || openaiKey.startsWith("sk-")) {
  console.log("✅ API key format looks correct");
} else {
  console.log(
    "⚠️  API key format may be incorrect (should start with sk-proj- or sk-)"
  );
}

// Check key length (basic validation)
if (openaiKey.length < 50) {
  console.log("⚠️  API key seems too short - double-check it's complete");
} else {
  console.log("✅ API key length looks reasonable");
}

console.log("\n🔧 Zeina Voice Assistant Requirements:");
console.log(
  "   - Uses OpenAI Realtime API (gpt-4o-realtime-preview-2024-12-17)"
);
console.log("   - Requires Realtime API beta access from OpenAI");
console.log("   - WebSocket connection to: wss://api.openai.com/v1/realtime");

console.log("\n🚨 IMPORTANT: Realtime API Access");
console.log(
  "   The OpenAI Realtime API is currently in beta and requires special access."
);
console.log("   If you're getting 401 errors, this is likely because:");
console.log("   1. Your API key doesn't have Realtime API access");
console.log("   2. You need to apply for beta access at:");
console.log("      https://platform.openai.com/docs/guides/realtime");

console.log("\n📋 To get Realtime API access:");
console.log("   1. Go to: https://platform.openai.com/docs/guides/realtime");
console.log("   2. Click 'Join waitlist' or apply for beta access");
console.log("   3. Wait for OpenAI approval (may take time)");
console.log("   4. Once approved, your existing API key will work");

console.log("\n🧪 Testing API Key (basic connectivity):");

// Test basic API connectivity
async function testApiKey() {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      console.log("✅ API key authentication successful");
      console.log("   Your API key can access basic OpenAI endpoints");

      // Check if Realtime model is available
      const data = await response.json();
      const realtimeModel = data.data?.find(
        (model: any) => model.id === "gpt-4o-realtime-preview-2024-12-17"
      );

      if (realtimeModel) {
        console.log("✅ Realtime model is available in your account");
        console.log("   Zeina voice assistant should work!");
      } else {
        console.log("⚠️  Realtime model not found in available models");
        console.log("   This suggests you don't have Realtime API access yet");
        console.log(
          "   Apply for beta access: https://platform.openai.com/docs/guides/realtime"
        );
      }
    } else if (response.status === 401) {
      console.log("❌ API key authentication failed (401 Unauthorized)");
      console.log("   Your API key may be invalid or expired");
      console.log(
        "   Get a new key from: https://platform.openai.com/api-keys"
      );
    } else {
      console.log(`❌ API returned status ${response.status}`);
      console.log("   Check your internet connection and API key");
    }
  } catch (error) {
    console.log("❌ Could not connect to OpenAI API");
    console.log(`   Error: ${error}`);
    console.log("   Check your internet connection");
  }
}

testApiKey().then(() => {
  console.log("\n💡 Next Steps:");
  console.log("   1. If you have Realtime API access: Try Zeina again");
  console.log("   2. If not: Apply for beta access and wait for approval");
  console.log("   3. Check OpenAI status: https://status.openai.com/");
});
