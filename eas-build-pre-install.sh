#!/bin/bash
set -euo pipefail

# EAS Build hook to restore google-services.json from environment variable.
# This script runs automatically before dependencies are installed.

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
