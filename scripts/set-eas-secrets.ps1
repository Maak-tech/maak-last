# Quick script to set EAS secrets using the new eas env:create syntax
# Run from project root: .\scripts\set-eas-secrets.ps1

Write-Host "Setting EAS environment variables..." -ForegroundColor Cyan
Write-Host ""

# Get API key from .env
$openaiKey = $null
$envLines = Get-Content ".env"

foreach ($line in $envLines) {
    if ($line -match '^\s*OPENAI_API_KEY\s*=\s*(.+)$') {
        $value = $matches[1].Trim()
        if ($value -match '^"(.*)"$') {
            $openaiKey = $matches[1]
        } else {
            $openaiKey = $value
        }
        break
    }
}

if (-not $openaiKey -or $openaiKey -eq "") {
    Write-Host "Error: OPENAI_API_KEY not found in .env" -ForegroundColor Red
    exit 1
}

Write-Host "Found API key: $($openaiKey.Substring(0, [Math]::Min(10, $openaiKey.Length)))..." -ForegroundColor Green
Write-Host ""

# Set OPENAI_API_KEY for production environment
Write-Host "Setting OPENAI_API_KEY for production..." -ForegroundColor Yellow
$result1 = eas env:create --name OPENAI_API_KEY --value $openaiKey --visibility secret --environment production --non-interactive 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ OPENAI_API_KEY set successfully for production" -ForegroundColor Green
} else {
    # Try update if it already exists
    if ($result1 -match "already exists" -or $result1 -match "duplicate") {
        Write-Host "Updating existing OPENAI_API_KEY..." -ForegroundColor Yellow
        eas env:update --name OPENAI_API_KEY --value $openaiKey --visibility secret --environment production --non-interactive
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ OPENAI_API_KEY updated successfully" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Could not update OPENAI_API_KEY" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  Failed to set OPENAI_API_KEY: $result1" -ForegroundColor Yellow
    }
}

Write-Host ""

# Set ZEINA_API_KEY for production (use same key)
Write-Host "Setting ZEINA_API_KEY for production..." -ForegroundColor Yellow
$result2 = eas env:create --name ZEINA_API_KEY --value $openaiKey --visibility secret --environment production --non-interactive 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ ZEINA_API_KEY set successfully for production" -ForegroundColor Green
} else {
    # Try update if it already exists
    if ($result2 -match "already exists" -or $result2 -match "duplicate") {
        Write-Host "Updating existing ZEINA_API_KEY..." -ForegroundColor Yellow
        eas env:update --name ZEINA_API_KEY --value $openaiKey --visibility secret --environment production --non-interactive
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ ZEINA_API_KEY updated successfully" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Could not update ZEINA_API_KEY" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  Failed to set ZEINA_API_KEY: $result2" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Done! Verify with: eas env:list" -ForegroundColor Cyan
Write-Host "Remember to rebuild your app after setting secrets!" -ForegroundColor Yellow
