# PowerShell script to fix Expo devices.json permission issues on Windows
# Run this if you encounter EPERM errors when starting Expo

Write-Host "Cleaning up Expo devices.json files..." -ForegroundColor Cyan

$expoDir = ".expo"
if (Test-Path $expoDir) {
    # Remove the main devices.json file if it exists
    $devicesFile = Join-Path $expoDir "devices.json"
    if (Test-Path $devicesFile) {
        try {
            Remove-Item $devicesFile -Force -ErrorAction Stop
            Write-Host "✓ Removed devices.json" -ForegroundColor Green
        } catch {
            Write-Host "⚠ Could not remove devices.json (may be locked by another process)" -ForegroundColor Yellow
            Write-Host "  Try closing Expo/Metro bundler and running this script again" -ForegroundColor Yellow
        }
    }
    
    # Remove any temporary devices.json.* files
    $tempFiles = Get-ChildItem -Path $expoDir -Filter "devices.json.*" -ErrorAction SilentlyContinue
    if ($tempFiles) {
        foreach ($file in $tempFiles) {
            try {
                Remove-Item $file.FullName -Force -ErrorAction Stop
                Write-Host "✓ Removed $($file.Name)" -ForegroundColor Green
            } catch {
                Write-Host "⚠ Could not remove $($file.Name)" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "✓ No temporary devices.json files found" -ForegroundColor Green
    }
} else {
    Write-Host "⚠ .expo directory not found" -ForegroundColor Yellow
}

Write-Host "`nDone! You can now try starting Expo again." -ForegroundColor Cyan
