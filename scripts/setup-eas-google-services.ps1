# PowerShell script to set up GOOGLE_SERVICES_JSON as an EAS environment variable
# This uploads the google-services.json file content to EAS

$filePath = "google-services.json"

if (-not (Test-Path $filePath)) {
    Write-Host "❌ Error: $filePath not found in the current directory" -ForegroundColor Red
    exit 1
}

Write-Host "Reading $filePath..." -ForegroundColor Cyan
$fileContent = Get-Content $filePath -Raw

Write-Host "Creating EAS environment variable..." -ForegroundColor Cyan
Write-Host "Command: eas env:create --scope project --name GOOGLE_SERVICES_JSON --type file --value `"...`" --visibility secret" -ForegroundColor Yellow

# Create the environment variable
# Note: We need to escape the JSON content properly
$escapedContent = $fileContent -replace '"', '\"'
$escapedContent = $escapedContent -replace "`n", "\n"
$escapedContent = $escapedContent -replace "`r", ""

# Use the file content directly
$command = "eas env:create --scope project --name GOOGLE_SERVICES_JSON --type file --value `"$escapedContent`" --visibility secret --non-interactive"

Write-Host ""
Write-Host "⚠️  Note: Due to PowerShell escaping complexity, please run this command manually:" -ForegroundColor Yellow
Write-Host ""
Write-Host "For PowerShell, use this approach:" -ForegroundColor Cyan
Write-Host '$content = Get-Content google-services.json -Raw' -ForegroundColor White
Write-Host '$content | eas env:create --scope project --name GOOGLE_SERVICES_JSON --type file --visibility secret' -ForegroundColor White
Write-Host ""
Write-Host "Or use bash/WSL:" -ForegroundColor Cyan
Write-Host 'cat google-services.json | eas env:create --scope project --name GOOGLE_SERVICES_JSON --type file --visibility secret' -ForegroundColor White

