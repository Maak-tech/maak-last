#!/bin/bash
# Wrapper script to restore Google Services files
# EAS Build may append --platform flag, so we filter it out and call the Node.js script

set -e

# Filter out --platform flag and its value
ARGS=()
SKIP_NEXT=false
for arg in "$@"; do
  if [ "$SKIP_NEXT" = true ]; then
    SKIP_NEXT=false
    continue
  fi
  if [ "$arg" = "--platform" ]; then
    SKIP_NEXT=true
    continue
  fi
  ARGS+=("$arg")
done

# Call the Node.js script (it will handle the environment variables)
node scripts/eas-restore-google-services.js "${ARGS[@]}"
