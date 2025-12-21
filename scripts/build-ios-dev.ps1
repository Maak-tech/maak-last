# iOS Development Build Quick Start Script (PowerShell)
# This script helps you build and run a development iOS app on your physical iPhone

Write-Host "🚀 iOS Development Build Quick Start" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

# Check if EAS CLI is installed
try {
    $easVersion = eas --version 2>$null
    Write-Host "✅ EAS CLI is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ EAS CLI is not installed" -ForegroundColor Red
    Write-Host "Installing EAS CLI..."
    npm install -g @expo/eas-cli@latest  # EAS CLI requires npm for global install
}

# Check if logged in to EAS
Write-Host ""
Write-Host "Checking EAS login status..."
try {
    $whoami = eas whoami 2>$null
    Write-Host "✅ Logged in to EAS" -ForegroundColor Green
    Write-Host $whoami
} catch {
    Write-Host "⚠️  Not logged in to EAS" -ForegroundColor Yellow
    Write-Host "Please login:"
    eas login
}

# Check iOS credentials
Write-Host ""
Write-Host "Checking iOS credentials..."
Write-Host "⚠️  If this is your first time, you'll need to configure credentials:" -ForegroundColor Yellow
$response = Read-Host "Do you want to check/configure iOS credentials? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    eas credentials -p ios
}

# Build the app
Write-Host ""
Write-Host "Starting iOS development build..." -ForegroundColor Green
Write-Host "This will take 8-15 minutes. You can monitor progress at the URL shown below."
Write-Host ""

# Build with EAS
eas build -p ios --profile development

Write-Host ""
Write-Host "✅ Build started!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Wait for the build to complete (check status with: bun run build:list)"
Write-Host "2. Download and install the .ipa on your iPhone"
Write-Host "3. Start the dev server: bun run dev"
Write-Host "4. Open the app on your iPhone and connect to the dev server"
Write-Host ""
Write-Host "For detailed instructions, see: docs/IOS_DEV_BUILD_GUIDE.md"

