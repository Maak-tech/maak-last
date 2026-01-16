/**
 * Diagnostic script to check audio setup for Zeina voice agent
 * Run with: bunx tsx scripts/check-audio-setup.ts
 */

import { Platform } from 'react-native';

console.log("=".repeat(60));
console.log("ZEINA VOICE AGENT - AUDIO SETUP DIAGNOSTIC");
console.log("=".repeat(60));
console.log();

// Check 1: Platform
console.log("1. Platform Check:");
console.log(`   Platform: ${Platform.OS}`);
console.log(`   ✓ Platform detected`);
console.log();

// Check 2: expo-av
console.log("2. expo-av Module Check:");
try {
  const expoAv = require('expo-av');
  console.log(`   ✓ expo-av is installed`);
  console.log(`   ✓ Audio module exists: ${!!expoAv.Audio}`);
  
  if (expoAv.Audio) {
    console.log(`   ✓ Audio.Recording exists: ${!!expoAv.Audio.Recording}`);
    console.log(`   ✓ Audio.Sound exists: ${!!expoAv.Audio.Sound}`);
  }
} catch (error) {
  console.log(`   ✗ expo-av NOT found`);
  console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
}
console.log();

// Check 3: expo-device
console.log("3. expo-device Module Check:");
try {
  const Device = require('expo-device');
  console.log(`   ✓ expo-device is installed`);
  console.log(`   Device type: ${Device.deviceType || 'Unknown'}`);
} catch (error) {
  console.log(`   ✗ expo-device NOT found`);
  console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
}
console.log();

// Check 4: expo-file-system
console.log("4. expo-file-system Module Check:");
try {
  const FileSystem = require('expo-file-system');
  console.log(`   ✓ expo-file-system is installed`);
} catch (error) {
  console.log(`   ✗ expo-file-system NOT found`);
  console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
}
console.log();

// Check 5: Environment variables
console.log("5. Environment Variables Check:");
try {
  const Constants = require('expo-constants');
  const config = Constants.default?.expoConfig?.extra;
  
  console.log(`   OPENAI_API_KEY: ${config?.openaiApiKey ? '✓ Set' : '✗ Not set'}`);
  
  if (!config?.openaiApiKey && !config?.zeinaApiKey) {
    console.log();
    console.log(`   ⚠️  WARNING: No API key found!`);
    console.log(`   Please set OPENAI_API_KEY in your .env file`);
  }
} catch (error) {
  console.log(`   ✗ Could not check environment variables`);
}
console.log();

console.log("=".repeat(60));
console.log("RECOMMENDATIONS:");
console.log("=".repeat(60));
console.log();

console.log("If audio is not working:");
console.log();
console.log("1. If running on SIMULATOR/EMULATOR:");
console.log("   → Use a PHYSICAL DEVICE instead");
console.log("   → Simulators often don't support audio recording");
console.log();
console.log("2. If expo-av is missing:");
console.log("   → Run: bun install expo-av");
console.log("   → Then restart your app");
console.log();
console.log("3. If in a DEVELOPMENT BUILD (not Expo Go):");
console.log("   → You need to REBUILD after installing expo-av:");
console.log("   → iOS: npm run ios");
console.log("   → Android: npm run android");
console.log();
console.log("4. If API key is missing:");
console.log("   → Create/update .env file with:");
console.log("   → OPENAI_API_KEY=your-key-here");
console.log();
console.log("5. Check microphone permissions:");
console.log("   → iOS: Settings → Your App → Microphone");
console.log("   → Android: Settings → Apps → Your App → Permissions");
console.log();

console.log("=".repeat(60));
