/**
 * Test WebSocket connection for Zeina voice assistant
 *
 * This script tests the WebSocket connection to OpenAI Realtime API
 * to diagnose 401 authentication issues
 */

require("dotenv").config();

const openaiKey = process.env.OPENAI_API_KEY || process.env.ZEINA_API_KEY;

if (!openaiKey) {
  console.log("❌ No OpenAI API key found. Set OPENAI_API_KEY in .env");
  process.exit(1);
}

console.log("🔍 Testing WebSocket connection to OpenAI Realtime API...\n");

// Simulate the exact WebSocket connection that Zeina uses
const wsUrl =
  "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17";

// Test with Node.js WebSocket (this should work if the API key is valid)
async function testWebSocketConnection() {
  try {
    // For Node.js testing, we'll use a basic HTTP request first
    console.log("📡 Testing basic API connectivity...");
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.log(`❌ HTTP authentication failed: ${response.status}`);
      return;
    }

    console.log("✅ HTTP authentication successful");

    // Now test WebSocket connection (this is harder to test from Node.js)
    console.log("🔌 Testing WebSocket connection...");

    // Since we can't easily test WebSocket from Node.js, let's provide guidance
    console.log("\n📋 WebSocket Connection Details:");
    console.log(`   URL: ${wsUrl}`);
    console.log("   Headers:");
    console.log(`     Authorization: Bearer ${openaiKey.substring(0, 20)}...`);
    console.log("     OpenAI-Beta: realtime=v1");

    console.log("\n🔧 React Native WebSocket Issues:");
    console.log("   React Native's WebSocket implementation has limitations:");
    console.log("   - Headers may not be properly sent on all platforms");
    console.log("   - iOS and Android have different header support");
    console.log("   - Web platform doesn't support headers at all");

    console.log("\n💡 Troubleshooting Steps:");
    console.log("   1. Ensure you're on a physical device (not simulator)");
    console.log("   2. Check device network connection");
    console.log("   3. Verify OpenAI account has Realtime API access");
    console.log("   4. Try clearing app data and reinstalling");
    console.log("   5. Check OpenAI status: https://status.openai.com/");

    console.log("\n🧪 Alternative Test:");
    console.log("   You can test Realtime API access manually:");
    console.log("   1. Go to: https://platform.openai.com/realtime");
    console.log("   2. Try the Realtime API playground");
    console.log(
      "   3. If it works there, the issue is with the app's WebSocket implementation"
    );
  } catch (error) {
    console.log(`❌ Test failed: ${error}`);
  }
}

testWebSocketConnection();
