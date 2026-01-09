#!/bin/bash
# Deploy Cloud Functions Script
# Run this script to deploy vital and symptom benchmark checking functions

set -e

echo "🚀 Deploying Cloud Functions..."

# Step 1: Navigate to functions directory
cd functions

# Step 2: Install dependencies
echo "📦 Installing dependencies..."
bun install

# Step 3: Build TypeScript
echo "🔨 Building TypeScript..."
bun run build

# Step 4: Verify build
if [ ! -f "lib/index.js" ]; then
    echo "❌ Build failed - lib/index.js not found"
    exit 1
fi

echo "✅ Build successful!"

# Step 5: Go back to root
cd ..

# Step 6: Deploy functions
echo "☁️  Deploying to Firebase..."
firebase deploy --only functions

echo "✅ Deployment complete!"
echo ""
echo "📋 Deployed functions:"
echo "  - checkVitalBenchmarks"
echo "  - checkSymptomBenchmarks"
echo ""
echo "🔍 Verify deployment:"
echo "  - Check Firebase Console: https://console.firebase.google.com/"
echo "  - View logs: firebase functions:log"

