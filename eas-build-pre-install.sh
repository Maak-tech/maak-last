#!/bin/bash
set -euo pipefail

# EAS Build hook to restore google-services.json from environment variable
# This script runs automatically before dependencies are installed

if [ -z "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "⚠️  Warning: GOOGLE_SERVICES_JSON environment variable is not set"
  echo "Please set it using: eas env:create --scope project --name GOOGLE_SERVICES_JSON --type file --value \"\$(cat google-services.json)\""
  exit 1
fi

# Write the environment variable content to google-services.json
echo "$GOOGLE_SERVICES_JSON" > google-services.json

echo "✅ Successfully restored google-services.json"

# Clean CocoaPods cache to fix React Native module redefinition errors
# Note: In EAS builds, ios directory is created during prebuild, so we clean after prebuild
# This will be handled by a post-install hook if needed
echo "ℹ️  Note: iOS CocoaPods cache will be cleaned during prebuild phase"

