#!/bin/bash
set -euo pipefail

# Script to restore Google Services files from EAS environment variables during build
# These files are gitignored but required for builds

echo "🔧 Restoring Google Services files from EAS environment variables..."

# Restore google-services.json for Android
if [ -n "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "$GOOGLE_SERVICES_JSON" | base64 -d > google-services.json
  echo "✅ Restored google-services.json"
else
  echo "⚠️  Warning: GOOGLE_SERVICES_JSON environment variable is not set"
fi

# Restore GoogleService-Info.plist for iOS
if [ -n "${GOOGLE_SERVICE_INFO_PLIST:-}" ]; then
  echo "$GOOGLE_SERVICE_INFO_PLIST" | base64 -d > GoogleService-Info.plist
  echo "✅ Restored GoogleService-Info.plist"
else
  echo "⚠️  Warning: GOOGLE_SERVICE_INFO_PLIST environment variable is not set"
fi

