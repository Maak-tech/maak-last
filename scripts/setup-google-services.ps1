# PowerShell script to restore google-services.json from EAS environment variable
# This file is gitignored but required for Android builds

if (-not $env:GOOGLE_SERVICES_JSON) {
    Write-Host "⚠️  Warning: GOOGLE_SERVICES_JSON environment variable is not set" -ForegroundColor Yellow
    Write-Host "Please set it using: eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value-file google-services.json" -ForegroundColor Yellow
    exit 1
}

# Write the environment variable content to google-services.json
$env:GOOGLE_SERVICES_JSON | Out-File -FilePath "google-services.json" -Encoding utf8 -NoNewline

Write-Host "✅ Successfully restored google-services.json" -ForegroundColor Green

