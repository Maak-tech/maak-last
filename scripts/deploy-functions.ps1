# Deploy Cloud Functions Script (PowerShell)
# Run this script to deploy vital and symptom benchmark checking functions

Write-Host "🚀 Deploying Cloud Functions..." -ForegroundColor Cyan

# Step 1: Navigate to functions directory
Set-Location functions

# Step 2: Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
bun install

# Step 3: Build TypeScript
Write-Host "🔨 Building TypeScript..." -ForegroundColor Yellow
bun run build

# Step 4: Verify build
if (-not (Test-Path "lib/index.js")) {
    Write-Host "❌ Build failed - lib/index.js not found" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful!" -ForegroundColor Green

# Step 5: Go back to root
Set-Location ..

# Step 6: Deploy functions
Write-Host "☁️  Deploying to Firebase..." -ForegroundColor Yellow
firebase deploy --only functions

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Deployed functions:" -ForegroundColor Cyan
Write-Host "  - checkVitalBenchmarks"
Write-Host "  - checkSymptomBenchmarks"
Write-Host ""
Write-Host "🔍 Verify deployment:" -ForegroundColor Cyan
Write-Host "  - Check Firebase Console: https://console.firebase.google.com/"
Write-Host "  - View logs: firebase functions:log"

