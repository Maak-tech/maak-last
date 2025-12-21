#!/bin/bash

# iOS Development Build Quick Start Script
# This script helps you build and run a development iOS app on your physical iPhone

set -e

echo "🚀 iOS Development Build Quick Start"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo -e "${RED}❌ EAS CLI is not installed${NC}"
    echo "Installing EAS CLI..."
    npm install -g @expo/eas-cli@latest  # EAS CLI requires npm for global install
else
    echo -e "${GREEN}✅ EAS CLI is installed${NC}"
fi

# Check if logged in to EAS
echo ""
echo "Checking EAS login status..."
if eas whoami &> /dev/null; then
    echo -e "${GREEN}✅ Logged in to EAS${NC}"
    eas whoami
else
    echo -e "${YELLOW}⚠️  Not logged in to EAS${NC}"
    echo "Please login:"
    eas login
fi

# Check iOS credentials
echo ""
echo "Checking iOS credentials..."
echo -e "${YELLOW}If this is your first time, you'll need to configure credentials:${NC}"
read -p "Do you want to check/configure iOS credentials? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    eas credentials -p ios
fi

# Build the app
echo ""
echo -e "${GREEN}Starting iOS development build...${NC}"
echo "This will take 8-15 minutes. You can monitor progress at the URL shown below."
echo ""

# Build with EAS
eas build -p ios --profile development

echo ""
echo -e "${GREEN}✅ Build started!${NC}"
echo ""
echo "Next steps:"
echo "1. Wait for the build to complete (check status with: bun run build:list)"
echo "2. Download and install the .ipa on your iPhone"
echo "3. Start the dev server: bun run dev"
echo "4. Open the app on your iPhone and connect to the dev server"
echo ""
echo "For detailed instructions, see: docs/IOS_DEV_BUILD_GUIDE.md"

