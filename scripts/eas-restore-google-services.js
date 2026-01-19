#!/usr/bin/env node
// Script to restore Google Services files from EAS environment variables during build
// These files are gitignored but required for builds
// EAS Build may append --platform ios/android, so we filter it out

const fs = require("fs");

// Filter out --platform flag and its value from command line arguments
// EAS Build appends these, but our script doesn't need them
const args = process.argv.slice(2);
let platformIndex = args.indexOf("--platform");
while (platformIndex !== -1) {
  args.splice(platformIndex, 2); // Remove --platform and its value
  platformIndex = args.indexOf("--platform");
}

console.log(
  "🔧 Restoring Google Services files from EAS environment variables..."
);

// Restore google-services.json for Android
if (process.env.GOOGLE_SERVICES_JSON) {
  const decoded = Buffer.from(
    process.env.GOOGLE_SERVICES_JSON,
    "base64"
  ).toString("utf-8");
  fs.writeFileSync("google-services.json", decoded);
  console.log("✅ Restored google-services.json");
} else {
  console.log(
    "⚠️  Warning: GOOGLE_SERVICES_JSON environment variable is not set"
  );
}

// Restore GoogleService-Info.plist for iOS
if (process.env.GOOGLE_SERVICE_INFO_PLIST) {
  const decoded = Buffer.from(
    process.env.GOOGLE_SERVICE_INFO_PLIST,
    "base64"
  ).toString("utf-8");
  fs.writeFileSync("GoogleService-Info.plist", decoded);
  console.log("✅ Restored GoogleService-Info.plist");
} else {
  console.log(
    "⚠️  Warning: GOOGLE_SERVICE_INFO_PLIST environment variable is not set"
  );
}
