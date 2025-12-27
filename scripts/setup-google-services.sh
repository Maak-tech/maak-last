#!/bin/bash
set -euo pipefail

# Script to restore google-services.json from EAS environment variable
# This file is gitignored but required for Android builds

if [ -z "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "⚠️  Warning: GOOGLE_SERVICES_JSON environment variable is not set"
  echo "Please set it using: eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value-file google-services.json"
  exit 1
fi

# Write the environment variable content to google-services.json
echo "$GOOGLE_SERVICES_JSON" > google-services.json

echo "✅ Successfully restored google-services.json"

