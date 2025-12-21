#!/bin/bash

# Start Development Server Script
# Starts Expo dev server in dev-client mode for development builds

set -e

echo "🚀 Starting Expo Development Server"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get local IP address
echo -e "${BLUE}Finding your local IP address...${NC}"

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "Not found")
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    IP=$(hostname -I | awk '{print $1}')
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    IP=$(ipconfig | findstr /i "IPv4" | head -1 | awk '{print $NF}')
else
    IP="Unknown"
fi

if [ "$IP" != "Not found" ] && [ "$IP" != "Unknown" ] && [ -n "$IP" ]; then
    echo -e "${GREEN}✅ Your local IP: $IP${NC}"
    echo ""
    echo -e "${YELLOW}📱 On your iPhone, connect to:${NC}"
    echo -e "${BLUE}exp://$IP:8081${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠️  Could not automatically detect IP${NC}"
    echo "Please find your IP manually:"
    echo "  Windows: ipconfig"
    echo "  Mac/Linux: ifconfig"
    echo ""
fi

echo -e "${GREEN}Starting Expo dev server...${NC}"
echo "Press Ctrl+C to stop"
echo ""

# Start Expo dev server with dev-client mode
EXPO_NO_TELEMETRY=1 expo start --dev-client

