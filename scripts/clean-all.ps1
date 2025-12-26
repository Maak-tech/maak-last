# Clean All - Removes node_modules, cache, and build artifacts
# Run this before rebuilding your development client

Write-Host "🧹 Cleaning project..." -ForegroundColor Cyan

# Remove node_modules
if (Test-Path "node_modules") {
    Write-Host "Removing node_modules..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "node_modules"
    Write-Host "✓ node_modules removed" -ForegroundColor Green
}

# Remove .expo folder
if (Test-Path ".expo") {
    Write-Host "Removing .expo cache..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force ".expo"
    Write-Host "✓ .expo cache removed" -ForegroundColor Green
}

# Remove iOS build artifacts
if (Test-Path "ios") {
    Write-Host "Removing iOS build artifacts..." -ForegroundColor Yellow
    if (Test-Path "ios/build") {
        Remove-Item -Recurse -Force "ios/build"
    }
    if (Test-Path "ios/Pods") {
        Remove-Item -Recurse -Force "ios/Pods"
    }
    if (Test-Path "ios/Podfile.lock") {
        Remove-Item -Force "ios/Podfile.lock"
    }
    Write-Host "✓ iOS build artifacts removed" -ForegroundColor Green
}

# Remove Android build artifacts
if (Test-Path "android") {
    Write-Host "Removing Android build artifacts..." -ForegroundColor Yellow
    if (Test-Path "android/build") {
        Remove-Item -Recurse -Force "android/build"
    }
    if (Test-Path "android/app/build") {
        Remove-Item -Recurse -Force "android/app/build"
    }
    if (Test-Path "android/.gradle") {
        Remove-Item -Recurse -Force "android/.gradle"
    }
    Write-Host "✓ Android build artifacts removed" -ForegroundColor Green
}

# Clear Metro bundler cache
Write-Host "Clearing Metro bundler cache..." -ForegroundColor Yellow
npx expo start --clear 2>&1 | Out-Null
Write-Host "✓ Metro cache cleared" -ForegroundColor Green

# Clear npm cache (optional)
Write-Host "Clearing npm cache..." -ForegroundColor Yellow
npm cache clean --force 2>&1 | Out-Null
Write-Host "✓ npm cache cleared" -ForegroundColor Green

Write-Host "`n✨ Clean complete! Ready to rebuild." -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Run: npm install" -ForegroundColor White
Write-Host "2. Run: npm run build:ios:dev (or build:android:dev)" -ForegroundColor White
Write-Host "3. Run: npm run dev" -ForegroundColor White

