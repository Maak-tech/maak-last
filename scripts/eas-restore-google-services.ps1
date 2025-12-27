# PowerShell script to restore Google Services files from EAS environment variables during build
# These files are gitignored but required for builds

Write-Host "🔧 Restoring Google Services files from EAS environment variables..." -ForegroundColor Cyan

# Restore google-services.json for Android
if ($env:GOOGLE_SERVICES_JSON) {
    $decoded = [System.Convert]::FromBase64String($env:GOOGLE_SERVICES_JSON)
    [System.IO.File]::WriteAllBytes("google-services.json", $decoded)
    Write-Host "✅ Restored google-services.json" -ForegroundColor Green
} else {
    Write-Host "⚠️  Warning: GOOGLE_SERVICES_JSON environment variable is not set" -ForegroundColor Yellow
}

# Restore GoogleService-Info.plist for iOS
if ($env:GOOGLE_SERVICE_INFO_PLIST) {
    $decoded = [System.Convert]::FromBase64String($env:GOOGLE_SERVICE_INFO_PLIST)
    [System.IO.File]::WriteAllBytes("GoogleService-Info.plist", $decoded)
    Write-Host "✅ Restored GoogleService-Info.plist" -ForegroundColor Green
} else {
    Write-Host "⚠️  Warning: GOOGLE_SERVICE_INFO_PLIST environment variable is not set" -ForegroundColor Yellow
}

