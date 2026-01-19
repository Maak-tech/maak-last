/**
 * Diagnostic script to check audio setup for Zeina voice agent
 * Run with: node scripts/check-audio-setup.js
 */

const fs = require("fs");
const path = require("path");

console.log("=".repeat(60));
console.log("ZEINA VOICE AGENT - AUDIO SETUP DIAGNOSTIC");
console.log("=".repeat(60));
console.log();

// Check 1: package.json dependencies
console.log("1. Package Dependencies Check:");
try {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
  );

  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  console.log(`   expo-av: ${deps["expo-av"] || "✗ NOT FOUND"}`);
  console.log(`   expo-device: ${deps["expo-device"] || "✗ NOT FOUND"}`);
  console.log(
    `   expo-file-system: ${deps["expo-file-system"] || "✗ NOT FOUND"}`
  );
  console.log(`   expo-constants: ${deps["expo-constants"] || "✗ NOT FOUND"}`);

  const allPresent =
    deps["expo-av"] &&
    deps["expo-device"] &&
    deps["expo-file-system"] &&
    deps["expo-constants"];
  console.log(
    `   ${allPresent ? "✓" : "✗"} All required packages ${allPresent ? "found" : "MISSING"}`
  );
} catch (error) {
  console.log("   ✗ Could not read package.json");
}
console.log();

// Check 2: node_modules
console.log("2. Installed Modules Check:");
const modulesToCheck = [
  "expo-av",
  "expo-device",
  "expo-file-system",
  "expo-constants",
];
modulesToCheck.forEach((mod) => {
  const modPath = path.join(process.cwd(), "node_modules", mod);
  const exists = fs.existsSync(modPath);
  console.log(
    `   ${exists ? "✓" : "✗"} ${mod} ${exists ? "installed" : "NOT INSTALLED"}`
  );
});
console.log();

// Check 3: .env file
console.log("3. Environment Configuration Check:");
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const hasOpenAI = envContent.includes("OPENAI_API_KEY");
  const hasZeina = envContent.includes("ZEINA_API_KEY");

  console.log("   .env file: ✓ Found");
  console.log(`   OPENAI_API_KEY: ${hasOpenAI ? "✓ Set" : "✗ Not set"}`);
  console.log(`   ZEINA_API_KEY: ${hasZeina ? "✓ Set" : "✗ Not set"}`);

  if (!(hasOpenAI || hasZeina)) {
    console.log();
    console.log("   ⚠️  WARNING: No OpenAI API key found!");
  }
} else {
  console.log("   ✗ .env file NOT FOUND");
  console.log("   Create a .env file with: OPENAI_API_KEY=your-key-here");
}
console.log();

// Check 4: Voice agent files
console.log("4. Voice Agent Files Check:");
const filesToCheck = [
  "app/voice-agent.tsx",
  "app/(tabs)/zeina.tsx",
  "lib/services/realtimeAgentService.ts",
];
filesToCheck.forEach((file) => {
  const filePath = path.join(process.cwd(), file);
  const exists = fs.existsSync(filePath);
  console.log(
    `   ${exists ? "✓" : "✗"} ${file} ${exists ? "exists" : "MISSING"}`
  );
});
console.log();

console.log("=".repeat(60));
console.log("RECOMMENDATIONS:");
console.log("=".repeat(60));
console.log();

console.log("To fix audio issues:");
console.log();
console.log("1. If modules are missing:");
console.log("   → Run: bun install");
console.log("   → This will install all dependencies");
console.log();
console.log("2. If running on SIMULATOR/EMULATOR:");
console.log("   → Use a PHYSICAL DEVICE instead");
console.log("   → Simulators often don't support audio recording");
console.log("   → Check the console logs when you open Zeina");
console.log();
console.log("3. If in a DEVELOPMENT BUILD (not Expo Go):");
console.log("   → After installing expo-av, you MUST rebuild:");
console.log("   → iOS: npm run ios");
console.log("   → Android: npm run android");
console.log();
console.log("4. If API key is missing:");
console.log("   → Create .env file in project root");
console.log("   → Add: OPENAI_API_KEY=your-api-key-here");
console.log("   → Restart your development server");
console.log();
console.log("5. Check app console logs:");
console.log("   → Open Zeina tab in your app");
console.log("   → Look for: '=== Zeina Tab - Audio Availability Check ==='");
console.log("   → This will show exactly what's wrong");
console.log();

console.log("=".repeat(60));
