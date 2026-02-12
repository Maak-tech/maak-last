#!/bin/bash
set -euo pipefail

# EAS Build hook to restore google-services.json from environment variable.
# This script runs automatically before dependencies are installed.

REQUIRED_PATCH_FILE="patches/expo-font+14.0.11.patch"

if [ ! -f "$REQUIRED_PATCH_FILE" ]; then
  echo "Error: Required runtime patch missing: $REQUIRED_PATCH_FILE"
  echo "This patch prevents known iOS release crashes in expo-font."
  exit 1
fi

if [ ! -s "$REQUIRED_PATCH_FILE" ]; then
  echo "Error: Required runtime patch is empty: $REQUIRED_PATCH_FILE"
  exit 1
fi

if [ -z "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "Warning: GOOGLE_SERVICES_JSON environment variable is not set."
  echo "Please set it using: eas env:create --scope project --name GOOGLE_SERVICES_JSON --type file --value \"\$(cat google-services.json)\""
  exit 1
fi

# Write the environment variable content to google-services.json.
echo "$GOOGLE_SERVICES_JSON" > google-services.json

echo "Successfully restored google-services.json."

# Configure npm to use legacy-peer-deps to handle peer dependency conflicts.
# This is needed because lucide-react-native doesn't officially support React 19 yet.
echo "Configuring npm to use legacy-peer-deps for peer dependency resolution."
npm config set legacy-peer-deps true

# Note: iOS CocoaPods cache will be cleaned during prebuild phase.
echo "Note: iOS CocoaPods cache will be cleaned during prebuild phase."
